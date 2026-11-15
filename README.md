# KCOM v2

Rebuild of kingdomcapstone.org as a pnpm + Turborepo monorepo.

| Path | What |
| --- | --- |
| `apps/web` | Public site (Astro, Node standalone adapter), port 4321 |
| `apps/api` | API (Hono on Node), port 8787, `GET /health` |
| `apps/admin` | Admin (React + Vite), port 5173 |
| `packages/content` | Content model types and Zod schemas |
| `packages/ui` | Brand tokens and the `Button` component |
| `packages/config` | Shared ESLint, Prettier, TypeScript configs |
| `brand/`, `docs/` | Brand assets and planning pages |

## Setup

Requires Node 22 (`.nvmrc`) and pnpm via Corepack.

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

`data/legacy/` holds the Drupal export with personal data. It is gitignored: never commit it.
