# MbT Stock

MbT Stock is a typed Next.js workshop inventory and tool-custody prototype built
from the supplied TA and TB Excel registers. It contains 386 register records,
744 tools by quantity, and 37 workshop storage locations.

## Capabilities

- Search and filter by part number, description, location, condition, or holder
- Check tools out to identified employees and return them to the workshop
- Mechanic-facing Workshop Desk with identity selection and guided movement
- Live 30-second overdue threshold for stakeholder demonstrations
- Usage, custody, inventory-health, and employee assignment views
- Validated Excel import and auditable Excel export
- Versioned browser persistence for prototype sessions
- Keyboard-accessible navigation and check-out dialog

## Engineering approach

The application separates presentation, domain rules, persistence, and Excel
integration. Checkout and overdue rules are pure functions covered by automated
tests. Spreadsheet parsing accepts the known register schema and rejects files
that contain no valid inventory rows.

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

Excel is a temporary interchange and storage mechanism. Browser changes are
saved locally for convenience and should be exported before clearing browser
data. A production release must use authenticated server-side persistence,
role-based access, immutable custody events, backups, and an approved retention
policy.

## Deployment

Production is intentionally offline. Engineering builds must be validated with
a Vercel preview deployment and must not be promoted without explicit approval.
