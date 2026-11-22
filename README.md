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

The main checkout uses 3000 (API), 4321 (site) and 5173 (admin). In a git worktree, run this once to give it its own free port set (3010 / 4331 / 5183, then 3020 and so on):

```bash
pnpm dev:ports            # keep this worktree's ports if it already has a set
pnpm dev:ports --reassign # pick a new set
```

It updates `apps/{api,web,admin}/.env.local` and `.claude/launch.json` (git-ignored). If a file is missing it starts from the main checkout's copy, then `.env.example`; every other value is kept. It sets:

- API: `PORT`, `CORS_ORIGINS`, `BETTER_AUTH_URL`
- site: `PUBLIC_API_URL`, `DEV_PORT` (and `PUBLIC_SITE_URL` when already set)
- admin: `VITE_API_URL`, `VITE_SITE_URL`, `DEV_PORT`

Then `pnpm dev` as usual. Ports already claimed by another worktree's `.env.local`, or in use right now, are skipped. Auth cookies are per host, not per port: worktrees that share `BETTER_AUTH_SECRET` and `DATABASE_URL` (the default when seeded from the main checkout) share one login on `localhost`.

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
