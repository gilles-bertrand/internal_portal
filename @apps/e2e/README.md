# E2E Tests

End-to-end tests using Playwright that run against the real backend.

## Prerequisites

- Docker (for PostgreSQL)
- Node.js 24 (see the root `volta` pin)
- `@apps/backend/.env.e2e` decrypted from `.env.e2e.enc` via SOPS — see [tuto/2_sops.md](../../tuto/2_sops.md)

## Running Tests

```bash
# 1. Prepare the environment (Postgres up, e2e database seeded, browsers installed)
pnpm setup

# 2. Run the suite — Playwright starts the backend and the built frontend itself
pnpm test
```

`pnpm test` does **not** re-seed the database: run `pnpm setup:db` when you need a
clean dataset again. The backend and frontend servers are started by
`playwright.config.ts` (`webServer`), with `VITE_MOCK_API=false` so the frontend
talks to the real API.

### Other Commands

```bash
pnpm test:ui        # Playwright UI mode
pnpm test:headed    # setup + run with a visible browser
pnpm test:debug     # setup + step-by-step debugging
pnpm setup:db       # only re-create and re-seed the e2e database
```

## Database

E2E runs use a **dedicated database, `database_e2e`**, on the same PostgreSQL
container as development. `pnpm e2e:setup` drops and recreates the whole schema,
so it must never point at `database_dev`: the backend swaps the database name of
`DATABASE_URI` whenever it runs in `--mode=e2e`
(`@apps/backend/src/configuration.ts`). The database is created automatically on
first run. Your development data is untouched by an e2e run.

## Test Data

The e2e seeder (`@apps/backend/src/seeders/e2e.seeder.ts`) creates one user per
role, plus the access-registry referentials (data categories, purposes, legal
bases). Password for every account: `123456789`.

| Email | Role |
|-------|------|
| deflorenne.amaury@triptyk.eu | encoder |
| dpo-e2e@triptyk.eu | dpo |
| auditor-e2e@triptyk.eu | auditor |
| tech-admin-e2e@triptyk.eu | tech_admin |

## Project Structure

```
@apps/e2e/
├── tests/                      # Specs
│   ├── access-export-scope.spec.ts
│   ├── incidents-create.spec.ts
│   ├── incidents.spec.ts
│   ├── login.spec.ts
│   └── permissions.spec.ts
├── scripts/
│   ├── docker-postgres.ts      # Shared Docker/Postgres/seed helpers
│   ├── setup.ts                # Full setup (Postgres + database + browsers)
│   └── setup-db.ts             # Database only
├── playwright.config.ts
└── package.json
```
