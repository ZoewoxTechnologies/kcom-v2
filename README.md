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

`data/legacy/` holds the Drupal export with personal data. It is gitignored: never commit it.

## Database

PostgreSQL via Drizzle (`packages/db`). Copy each app's `.env.example` to `.env.local` in that app's folder (the API's `pnpm dev` loads `apps/api/.env.local`). The database scripts read `DATABASE_URL` from your shell environment; the root `.env.example` lists it and the legacy import variables. Then:

```bash
pnpm --filter @kcom/db db:migrate   # apply migrations
pnpm --filter @kcom/db db:seed      # insert sample capsules
pnpm --filter @kcom/db db:generate  # create a migration after editing schema.ts
pnpm --filter @kcom/db db:studio
```

Tests use in-memory Postgres (pglite); no local database needed.
