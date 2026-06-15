# Internal Portal

Monorepo with an Ember frontend and a Fastify backend, managed with pnpm workspaces and Turborepo.

## Tech Stack

| Layer        | Technology                          |
| ------------ | ----------------------------------- |
| Frontend     | Ember 7 (Octane) + Embroider/Vite  |
| Backend      | Fastify 5 + vite-node              |
| Database     | PostgreSQL 18 + MikroORM           |
| Secrets      | SOPS + age                          |
| Styling      | Tailwind CSS 4 + DaisyUI 5         |
| Testing      | Vitest, Playwright                  |
| Language     | TypeScript                          |
| Monorepo     | pnpm workspaces + Turborepo        |
| Linting      | oxlint, ESLint, Stylelint, oxfmt   |
| Git hooks    | Lefthook + git-conventional-commits |

## Prerequisites

- **Node 24** (managed via [Volta](https://volta.sh/) — `volta install node@24`)
- **pnpm 11.6.0** (via Corepack/Volta — pinned by `packageManager`)
- **Docker** (for PostgreSQL)
- **[sops](https://getsops.io/) + [age](https://github.com/FiloSottile/age)** (`brew install sops age`) — to decrypt the backend secrets. See [tuto/2_sops.md](./tuto/2_sops.md).

## Project Structure

```
@apps/
├── front             # Ember frontend application
├── backend           # Fastify REST API server
└── e2e               # Playwright end-to-end tests

@libs/
├── backend-shared    # Shared utilities and types for backend services
├── shared-front      # Shared frontend components, services, and utilities
├── todos-backend     # Todos domain — backend (entities, routes, schemas)
├── todos-front       # Todos domain — frontend (components, routes, services)
├── users-backend     # Users domain — backend (auth, entities, emails)
├── users-front       # Users domain — frontend (auth UI, user management)
└── repo-utils        # Shared build and dev configurations
```

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Get access to the secrets (SOPS)

Backend secrets are stored **encrypted** in git (`@apps/backend/.env.enc`, `.env.e2e.enc`) and decrypted at setup with your personal [age](https://github.com/FiloSottile/age) key. Full guide: [tuto/2_sops.md](./tuto/2_sops.md).

**As a new collaborator:**

```bash
# 1. Generate your age key
age-keygen -o ~/.config/sops/age/keys.txt
# macOS only — also place it where SOPS looks by default:
mkdir -p ~/"Library/Application Support/sops/age"
cp ~/.config/sops/age/keys.txt ~/"Library/Application Support/sops/age/keys.txt"

# 2. Send your PUBLIC key to a maintainer:
age-keygen -y ~/.config/sops/age/keys.txt
```

**A maintainer** then adds your public key to `.sops.yaml`, runs `sops updatekeys -y --input-type dotenv` on both `.enc` files, and pushes. After they confirm, `git pull` — you can now decrypt.

### 3. Run everything

```bash
pnpm dev
```

`pnpm dev` (via `predev`) decrypts the secrets, starts PostgreSQL 18 via Docker (`localhost:5432` — user `backend_user`, password `backend_user`, database `database_dev`), runs `schema:fresh`, then starts the backend and frontend concurrently. Use `pnpm setup` to run only the preparation step, or `pnpm fresh` to force a clean database reset.

### Running an app individually

- **Backend** — from `@apps/backend`: `pnpm dev`
- **Frontend** — from `@apps/front`: `pnpm start` (mocked API, default) or `pnpm start:with-back` (proxies `/api` to `http://localhost:8000`)

## E2E Tests

From `@apps/e2e`:

```bash
pnpm setup      # Prepare the test database and environment
pnpm test:ui    # Run tests with the Playwright UI
pnpm test       # Run tests in headless mode
```

## Scripts

Key scripts available at the root:

| Script           | Description                               |
| ---------------- | ----------------------------------------- |
| `pnpm dev`       | Run backend + frontend concurrently       |
| `pnpm lint`      | Lint all packages                         |
| `pnpm lint:fix`  | Auto-fix lint issues across all packages  |
| `pnpm format`    | Format code across all packages           |

## Git Conventions

Commits follow [Conventional Commits](https://www.conventionalcommits.org/) enforced via Lefthook + git-conventional-commits.

Allowed commit types: `feat`, `fix`, `perf`, `refactor`, `style`, `test`, `build`, `ops`, `docs`, `chore`, `merge`, `revert`.

## API Documentation

When the backend is running, Swagger UI is available at [`/documentation`](http://localhost:8000/documentation).
