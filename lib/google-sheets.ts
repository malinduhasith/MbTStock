import { createSign, randomUUID } from "node:crypto";
import { applyCustodyAction } from "./custody";
import {
  CustodyAction,
  EMPLOYEES,
  Employee,
  InventoryItem,
  MovementEvent,
  WorkshopDataset,
  createDemoInventory,
} from "./inventory";
import {
  EMPLOYEE_HEADERS,
  MOVEMENT_HEADERS,
  SHEET_NAMES,
  TOOL_HEADERS,
  SheetToolRow,
  employeeFromSheetRow,
  employeeToSheetRow,
  headersMatch,
  movementFromSheetRow,
  movementToSheetRow,
  toCellData,
  toolFromSheetRow,
  toolToSheetRow,
} from "./sheets-schema";

const SHEETS_API = "https://sheets.googleapis.com/v4";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

interface GoogleSheetsConfig {
  spreadsheetId: string;
  clientEmail: string;
  privateKey: string;
}

interface SheetProperties {
  sheetId: number;
  title: string;
}

interface SpreadsheetMetadata {
  sheets?: Array<{ properties?: SheetProperties }>;
}

interface ValueRange {
  range?: string;
  values?: unknown[][];
}

interface BatchGetResponse {
  valueRanges?: ValueRange[];
}

interface InternalDataset {
  items: InventoryItem[];
  employees: Employee[];
  movements: MovementEvent[];
  toolRows: Map<string, number>;
  sheetIds: Record<(typeof SHEET_NAMES)[keyof typeof SHEET_NAMES], number>;
}

export class GoogleSheetsError extends Error {
  constructor(
    message: string,
    readonly code: "CONFIGURATION" | "SCHEMA" | "GOOGLE_API",
  ) {
    super(message);
    this.name = "GoogleSheetsError";
  }
}

let cachedToken: { value: string; expiresAt: number; email: string } | null =
  null;
let schemaPromise: Promise<
  Record<(typeof SHEET_NAMES)[keyof typeof SHEET_NAMES], number>
> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function configuration(): GoogleSheetsConfig | null {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim() ?? "";
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() ?? "";
  const privateKey =
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replaceAll("\\n", "\n") ??
    "";
  const present = [spreadsheetId, clientEmail, privateKey].filter(Boolean);
  if (!present.length) return null;
  if (present.length !== 3) {
    throw new GoogleSheetsError(
      "Google Sheets is only partially configured. Set the spreadsheet ID, service-account email, and private key together.",
      "CONFIGURATION",
    );
  }
  return { spreadsheetId, clientEmail, privateKey };
}

export function isGoogleSheetsConfigured(): boolean {
  return configuration() !== null;
}

function encode(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

async function accessToken(config: GoogleSheetsConfig): Promise<string> {
  if (
    cachedToken &&
    cachedToken.email === config.clientEmail &&
    cachedToken.expiresAt > Date.now() + 60_000
  ) {
    return cachedToken.value;
  }

  const issuedAt = Math.floor(Date.now() / 1_000);
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    iss: config.clientEmail,
    scope: SHEETS_SCOPE,
    aud: TOKEN_URL,
    iat: issuedAt,
    exp: issuedAt + 3_600,
  })}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${signer
    .sign(config.privateKey)
    .toString("base64url")}`;

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
  });
  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };
  if (!response.ok || !payload.access_token) {
    throw new GoogleSheetsError(
      payload.error_description || "Google service-account authentication failed.",
      "GOOGLE_API",
    );
  }
  cachedToken = {
    value: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in ?? 3_600) * 1_000,
    email: config.clientEmail,
  };
  return payload.access_token;
}

async function googleRequest<T>(
  config: GoogleSheetsConfig,
  path: string,
  init?: RequestInit,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const token = await accessToken(config);
      const headers = new Headers(init?.headers);
      headers.set("authorization", `Bearer ${token}`);
      headers.set("content-type", "application/json");
      const response = await fetch(`${SHEETS_API}${path}`, {
        ...init,
        headers,
        cache: "no-store",
      });
      if (response.ok) {
        return (await response.json()) as T;
      }
      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      const message = payload?.error?.message || `Google Sheets returned ${response.status}.`;
      if (response.status !== 429 && response.status < 500) {
        throw new GoogleSheetsError(message, "GOOGLE_API");
      }
      lastError = new GoogleSheetsError(message, "GOOGLE_API");
    } catch (error) {
      lastError = error;
      if (error instanceof GoogleSheetsError && error.code !== "GOOGLE_API") {
        throw error;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
  }
  throw lastError instanceof Error
    ? lastError
    : new GoogleSheetsError("Google Sheets could not be reached.", "GOOGLE_API");
}

function valuesPath(config: GoogleSheetsConfig, suffix: string): string {
  return `/spreadsheets/${encodeURIComponent(config.spreadsheetId)}/values${suffix}`;
}

async function batchUpdate(
  config: GoogleSheetsConfig,
  requests: unknown[],
): Promise<void> {
  await googleRequest(
    config,
    `/spreadsheets/${encodeURIComponent(config.spreadsheetId)}:batchUpdate`,
    { method: "POST", body: JSON.stringify({ requests }) },
  );
}

async function metadata(config: GoogleSheetsConfig): Promise<SheetProperties[]> {
  const result = await googleRequest<SpreadsheetMetadata>(
    config,
    `/spreadsheets/${encodeURIComponent(config.spreadsheetId)}?fields=sheets.properties`,
  );
  return (result.sheets ?? [])
    .map((sheet) => sheet.properties)
    .filter((value): value is SheetProperties => Boolean(value));
}

function rangesQuery(ranges: readonly string[]): string {
  const params = new URLSearchParams();
  ranges.forEach((range) => params.append("ranges", range));
  params.set("majorDimension", "ROWS");
  params.set("valueRenderOption", "UNFORMATTED_VALUE");
  return `:batchGet?${params.toString()}`;
}

async function readRanges(
  config: GoogleSheetsConfig,
  ranges: readonly string[],
): Promise<ValueRange[]> {
  const result = await googleRequest<BatchGetResponse>(
    config,
    valuesPath(config, rangesQuery(ranges)),
  );
  return result.valueRanges ?? [];
}

async function writeRanges(
  config: GoogleSheetsConfig,
  data: Array<{ range: string; values: unknown[][] }>,
): Promise<void> {
  await googleRequest(config, valuesPath(config, ":batchUpdate"), {
    method: "POST",
    body: JSON.stringify({
      valueInputOption: "RAW",
      data: data.map((entry) => ({ ...entry, majorDimension: "ROWS" })),
    }),
  });
}

async function ensureSchema(
  config: GoogleSheetsConfig,
): Promise<Record<(typeof SHEET_NAMES)[keyof typeof SHEET_NAMES], number>> {
  const required = Object.values(SHEET_NAMES);
  let properties = await metadata(config);
  const existing = new Set(properties.map((sheet) => sheet.title));
  const missing = required.filter((title) => !existing.has(title));
  if (missing.length) {
    await batchUpdate(
      config,
      missing.map((title) => ({ addSheet: { properties: { title } } })),
    );
    properties = await metadata(config);
  }

  const sheetIds = Object.fromEntries(
    required.map((title) => {
      const sheet = properties.find((candidate) => candidate.title === title);
      if (!sheet) {
        throw new GoogleSheetsError(
          `The required ${title} sheet could not be created.`,
          "SCHEMA",
        );
      }
      return [title, sheet.sheetId];
    }),
  ) as Record<(typeof SHEET_NAMES)[keyof typeof SHEET_NAMES], number>;

  const headerDefinitions = [
    { title: SHEET_NAMES.tools, headers: TOOL_HEADERS },
    { title: SHEET_NAMES.employees, headers: EMPLOYEE_HEADERS },
    { title: SHEET_NAMES.movements, headers: MOVEMENT_HEADERS },
  ] as const;
  const headerRanges = await readRanges(
    config,
    headerDefinitions.map(
      ({ title, headers }) => `${title}!A1:${columnName(headers.length)}1`,
    ),
  );
  const missingHeaders: Array<{ range: string; values: unknown[][] }> = [];
  headerDefinitions.forEach(({ title, headers }, index) => {
    const actual = headerRanges[index]?.values?.[0] ?? [];
    if (!actual.length) {
      missingHeaders.push({
        range: `${title}!A1:${columnName(headers.length)}1`,
        values: [[...headers]],
      });
      return;
    }
    if (!headersMatch(actual, headers)) {
      throw new GoogleSheetsError(
        `${title} has an unexpected header row. Use the documented MbT Stock column order.`,
        "SCHEMA",
      );
    }
  });
  if (missingHeaders.length) {
    await writeRanges(config, missingHeaders);
    await batchUpdate(
      config,
      missingHeaders.flatMap(({ range }) => {
        const title = range.split("!")[0] as keyof typeof sheetIds;
        const sheetId = sheetIds[title];
        return [
          {
            updateSheetProperties: {
              properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
              fields: "gridProperties.frozenRowCount",
            },
          },
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.05, green: 0.08, blue: 0.12 },
                  textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true },
                },
              },
              fields: "userEnteredFormat(backgroundColor,textFormat)",
            },
          },
        ];
      }),
    );
  }
  return sheetIds;
}

function columnName(length: number): string {
  let value = length;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

async function sheetIds(config: GoogleSheetsConfig) {
  if (!schemaPromise) {
    schemaPromise = ensureSchema(config).catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

function seedEvents(items: readonly InventoryItem[]): MovementEvent[] {
  return items.flatMap((item) =>
    item.lastMovementType &&
    item.lastMovementById &&
    item.lastMovementAt &&
    item.checkedOutAt
      ? [
          {
            id: `DEMO-EVENT-${item.id}`,
            toolId: item.id,
            type: item.lastMovementType,
            toEmployeeId: item.holderId,
            performedByEmployeeId: item.lastMovementById,
            occurredAt: item.lastMovementAt,
            originalCheckedOutAt: item.checkedOutAt,
            notes: "Fictional demonstration movement",
          } satisfies MovementEvent,
        ]
      : [],
  );
}

async function readInternal(
  config: GoogleSheetsConfig,
  seed: readonly InventoryItem[],
): Promise<InternalDataset> {
  const ids = await sheetIds(config);
  let ranges = await readRanges(config, [
    `${SHEET_NAMES.employees}!A2:E`,
    `${SHEET_NAMES.tools}!A2:P`,
    `${SHEET_NAMES.movements}!A2:I`,
  ]);
  let employeeRows = ranges[0]?.values ?? [];
  let toolRows = ranges[1]?.values ?? [];
  let movementRows = ranges[2]?.values ?? [];
  const seedWrites: Array<{ range: string; values: unknown[][] }> = [];

  if (!employeeRows.some((row) => employeeFromSheetRow(row))) {
    employeeRows = EMPLOYEES.map(employeeToSheetRow);
    seedWrites.push({
      range: `${SHEET_NAMES.employees}!A2:E${employeeRows.length + 1}`,
      values: employeeRows,
    });
  }
  const employees = employeeRows
    .map(employeeFromSheetRow)
    .filter((employee): employee is Employee => Boolean(employee));

  if (!toolRows.some((row) => row[0] && row[2] && row[4])) {
    const demoItems = createDemoInventory(seed);
    toolRows = demoItems.map(toolToSheetRow);
    seedWrites.push({
      range: `${SHEET_NAMES.tools}!A2:P${toolRows.length + 1}`,
      values: toolRows,
    });
    if (!movementRows.length) {
      movementRows = seedEvents(demoItems).map(movementToSheetRow);
      if (movementRows.length) {
        seedWrites.push({
          range: `${SHEET_NAMES.movements}!A2:I${movementRows.length + 1}`,
          values: movementRows,
        });
      }
    }
  }
  if (seedWrites.length) await writeRanges(config, seedWrites);

  const parsedTools = toolRows
    .map((row, index) => toolFromSheetRow(row, index + 2, employees))
    .filter((entry): entry is SheetToolRow => Boolean(entry));
  return {
    items: parsedTools.map(({ item }) => item),
    employees,
    movements: movementRows
      .map(movementFromSheetRow)
      .filter((event): event is MovementEvent => Boolean(event)),
    toolRows: new Map(parsedTools.map(({ item, rowNumber }) => [item.id, rowNumber])),
    sheetIds: ids,
  };
}

function publicDataset(data: InternalDataset): WorkshopDataset {
  return {
    source: "google-sheets",
    writable: true,
    items: data.items,
    employees: data.employees,
    movements: data.movements,
    loadedAt: new Date().toISOString(),
  };
}

export async function loadGoogleSheetsDataset(
  seed: readonly InventoryItem[],
): Promise<WorkshopDataset | null> {
  const config = configuration();
  if (!config) return null;
  return publicDataset(await readInternal(config, seed));
}

function serializeWrite<T>(work: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(work, work);
  writeQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export async function mutateGoogleSheetsDataset(
  seed: readonly InventoryItem[],
  action: CustodyAction,
): Promise<WorkshopDataset> {
  const config = configuration();
  if (!config) {
    throw new GoogleSheetsError(
      "Google Sheets persistence is not configured.",
      "CONFIGURATION",
    );
  }
  return serializeWrite(async () => {
    const data = await readInternal(config, seed);
    const rowNumber = data.toolRows.get(action.toolId);
    if (!rowNumber) {
      throw new GoogleSheetsError(
        "The selected tool row could not be located.",
        "SCHEMA",
      );
    }
    const { item, event } = applyCustodyAction(
      data.items,
      data.employees,
      action,
      Date.now(),
      randomUUID(),
    );

    await batchUpdate(config, [
      {
        updateCells: {
          range: {
            sheetId: data.sheetIds[SHEET_NAMES.tools],
            startRowIndex: rowNumber - 1,
            endRowIndex: rowNumber,
            startColumnIndex: 0,
            endColumnIndex: TOOL_HEADERS.length,
          },
          rows: [toCellData(toolToSheetRow(item))],
          fields: "userEnteredValue",
        },
      },
      {
        appendCells: {
          sheetId: data.sheetIds[SHEET_NAMES.movements],
          rows: [toCellData(movementToSheetRow(event))],
          fields: "userEnteredValue",
        },
      },
    ]);

    return publicDataset(await readInternal(config, seed));
  });
}
