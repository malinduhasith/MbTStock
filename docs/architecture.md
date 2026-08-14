# Architecture

## Goals

MbT Stock demonstrates a workshop tool-control workflow without coupling domain
rules to the current Excel data source. The architecture is deliberately small,
but each boundary can be replaced independently.

## Boundaries

- `app/`: Next.js routing, metadata, global presentation
- `components/`: accessible UI composition and view-specific components
- `lib/inventory.ts`: domain types, checkout/return rules, filtering, metrics
- `lib/excel.ts`: register-schema adapter and workbook import/export
- `lib/storage.ts`: versioned prototype persistence
- `tests/`: unit tests for safety-critical workflow and import behaviour

UI components do not directly mutate inventory records. They request domain
operations such as `checkOutTool` and `returnTool`, which return immutable
state. This keeps behaviour predictable and testable.

## Data integrity

- Identifiers remain strings so part-number formatting and leading zeroes survive.
- Quantities must be finite and positive.
- Imported rows require both a description and storage location.
- Damage and missing-parts values map to an explicit attention status.
- Persisted browser data is accepted only when its schema and version validate.
- Excel exports use ISO timestamps rather than locale-dependent date strings.

## Prototype limitations

Local storage is single-browser state, not a shared database. It provides no
authentication, concurrency control, durable audit log, or central backup.
Seeded employee records and usage counts are demonstration data.

## Production migration

1. Replace `lib/storage.ts` with an authenticated repository/API boundary.
2. Store tools, employees, custody events, inspections, and locations separately.
3. Use append-only custody events for checkout and return auditability.
4. Add role-based permissions and workshop identity-provider integration.
5. Add optimistic concurrency, database constraints, backups, and monitoring.
6. Change the demo threshold to a configurable workshop policy.
7. Perform privacy, security, accessibility, and operational acceptance testing.

## Quality controls

Every pull request runs strict type checking, ESLint, unit tests, and a
production build. Preview deployments are used for stakeholder acceptance;
production promotion requires explicit approval.
