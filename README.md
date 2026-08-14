# MbT Stock

MbT Stock is a typed Next.js workshop inventory and tool-custody prototype.
The checked-in seed contains only clearly labelled fictional tools, locations,
part numbers, and employees for safe demonstrations.

## Capabilities

- Search and filter by part number, description, location, condition, or holder
- Check tools out to identified employees and return them to the workshop
- Mechanic-facing Workshop Desk with identity selection and guided movement
- Universal check-in and direct employee-to-employee custody hand-off
- Live 30-second overdue threshold for stakeholder demonstrations
- Usage, custody, inventory-health, and employee assignment views
- Shared Google Sheets storage with separate Tools and Employees tabs
- Append-only Tool_Movements audit history for every custody change
- Server-only Google authentication and version-checked tool updates
- Validated Excel import and auditable Excel export
- Versioned browser persistence when Google Sheets is not configured
- Keyboard-accessible navigation and check-out dialog

## Engineering approach

The application separates presentation, domain rules, persistence, and spreadsheet
integration. Checkout and overdue rules are pure functions covered by automated
tests. The Google Sheets adapter validates its three schemas before reading or
writing and commits each tool-state update with its matching movement event in
one atomic Sheets API batch.

See [Architecture](docs/architecture.md) for boundaries and the production
migration path.

## Development

Requirements: Node.js 22 and npm.

```bash
npm install
npm run dev
```

Run the full quality gate:

```bash
npm run check
```

This runs strict TypeScript, ESLint, unit tests, and the production build.

## Prototype data policy

Google Sheets is the temporary shared data store. When it is not configured,
browser changes are saved locally for demonstration and should be exported
before clearing browser data. The repository and hosted seed must contain
fictional demonstration data only; customer registers must not be committed or
bundled into a deployment. A production release must use authenticated persistence,
role-based access, immutable custody events, backups, and an approved retention
policy.

## Google Sheets

Create one blank spreadsheet, share it with a Google service account, and set
the three server-only environment variables documented in
[Google Sheets setup](docs/google-sheets-setup.md). MbT Stock creates and seeds
the `Tools`, `Employees`, and `Tool_Movements` tabs automatically. Never commit
or expose the service-account private key to browser code.

## Deployment

The public prototype is deployed on Vercel after the full quality gate passes.
Preview builds are validated before promotion to the production alias.
