# KCOM v2

Rebuild of kingdomcapstone.org as a pnpm + Turborepo monorepo.

| Path               | What                                                    |
| ------------------ | ------------------------------------------------------- |
| `apps/web`         | Public site (Astro, Node standalone adapter), port 4321 |
| `apps/api`         | API (Hono on Node), port 8787, `GET /health`            |
| `apps/admin`       | Admin (React + Vite), port 5173                         |
| `packages/content` | Content model types and Zod schemas                     |
| `packages/ui`      | Brand tokens and the `Button` component                 |
| `packages/config`  | Shared ESLint, Prettier, TypeScript configs             |
| `brand/`, `docs/`  | Brand assets and planning pages                         |

## Setup

Requires Node >=24 (`.nvmrc`) and pnpm via Corepack.

```bash
nvm use
corepack enable
pnpm install
pnpm dev        # all three apps
pnpm build
pnpm test
pnpm lint
pnpm typecheck
```

Git hooks (lint-staged, gitleaks) are installed by `pnpm install`: run it in every new clone or worktree. Install gitleaks locally (`brew install gitleaks`).

## Running several checkouts at once

The main checkout uses 3000 (API), 4321 (site) and 5173 (admin). In a git worktree, run this once:

```bash
pnpm dev:ports             # site and admin on free ports (4331 / 5183, then +10 steps)
pnpm dev:ports --own-api   # also run this worktree's own API (3010, ...)
pnpm dev:ports --reassign  # pick a new port set
```

It updates `apps/{api,web,admin}/.env.local` and `.claude/launch.json` (git-ignored) and keeps every other value. A missing env file starts from the main checkout's copy, then `.env.example`. Ports in use right now, or claimed by another worktree's `.env.local`, are skipped.

**Shared API (default).** The worktree's site and admin call the main checkout's API on port 3000, so the main checkout's API must be running. Start only the site and admin with `pnpm dev:front`. The API accepts any `http://localhost:<port>` origin outside production (CORS and auth; production only accepts `CORS_ORIGINS`). Shared mode reads and writes whichever database the main checkout's `apps/api/.env.local` points at: content you create in a worktree appears in the main checkout.

**Own API.** The script gives the worktree its own API and port when you pass `--own-api`, when the branch changes `apps/api` or `packages/db`, or when nothing is listening on 3000. Run everything with `pnpm dev`. It sets `PORT`, `CORS_ORIGINS` and `BETTER_AUTH_URL` for the API and points the site and admin at it.

- Database: an own API copies `DATABASE_URL` from the main checkout's `apps/api/.env.local` (never printed), so it still uses the shared database.
- Exception: when the branch adds a file under `packages/db/migrations`, it must not migrate the shared database. The script then creates a local Postgres database `kcom_<worktree folder>` (Postgres must be running on localhost:5432), migrates and seeds it, and writes its URL to the API's `.env.local`. Drop it when the worktree is gone: `dropdb kcom_<name>`.

Env vars it sets: API `PORT`, `CORS_ORIGINS`, `BETTER_AUTH_URL`, `DATABASE_URL`; site `PUBLIC_API_URL`, `DEV_PORT` (and `PUBLIC_SITE_URL` when already set); admin `VITE_API_URL`, `VITE_SITE_URL`, `DEV_PORT`.

Auth cookies are per host, not per port, so checkouts that share a database and `BETTER_AUTH_SECRET` share one `localhost` login.

`data/legacy/` holds the Drupal export with personal data. It is gitignored: never commit it.

## Database

PostgreSQL via Drizzle (`packages/db`). Copy each app's `.env.example` to `.env.local` in that app's folder (the API's `pnpm dev` loads `apps/api/.env.local`):

```bash
cp apps/api/.env.example apps/api/.env.local
cp apps/web/.env.example apps/web/.env.local
cp apps/admin/.env.example apps/admin/.env.local
```

The database scripts read `DATABASE_URL` from your shell environment; the root `.env.example` lists it and the legacy import variables. Then:

```bash
pnpm --filter @kcom/db db:migrate   # apply migrations
pnpm --filter @kcom/db db:seed      # insert sample capsules
pnpm --filter @kcom/db db:generate  # create a migration after editing schema.ts
pnpm --filter @kcom/db db:studio
```

Tests use in-memory Postgres (pglite); no local database needed.
