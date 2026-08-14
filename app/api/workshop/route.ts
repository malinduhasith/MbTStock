import { NextResponse } from "next/server";
import seed from "../../inventory.json";
import { CustodyError, isCustodyAction } from "../../../lib/custody";
import { GoogleSheetsError } from "../../../lib/google-sheets";
import { InventoryItem } from "../../../lib/inventory";
import {
  loadWorkshopDataset,
  recordCustodyAction,
} from "../../../lib/workshop-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function response<T>(body: T, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store, max-age=0" },
  });
}

function errorResponse(error: unknown) {
  if (error instanceof CustodyError) {
    return response({ error: error.message, code: error.code }, error.status);
  }
  if (error instanceof GoogleSheetsError) {
    const status = error.code === "GOOGLE_API" ? 502 : 503;
    return response({ error: error.message, code: error.code }, status);
  }
  console.error("Workshop API failure", error);
  return response(
    { error: "The workshop data service is temporarily unavailable." },
    500,
  );
}

export async function GET() {
  try {
    return response(await loadWorkshopDataset(seed as InventoryItem[]));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload: unknown = await request.json();
    if (!isCustodyAction(payload)) {
      return response(
        { error: "The tool movement request is invalid.", code: "INVALID_ACTION" },
        400,
      );
    }
    return response(
      await recordCustodyAction(seed as InventoryItem[], payload),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
