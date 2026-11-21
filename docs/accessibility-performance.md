# Accessibility and performance audit

Run against the built public site on sample data (`DATA_SOURCE=sample`); CI job `audit` does this on every web change.

```bash
pnpm --filter @kcom/web exec astro build
DATA_SOURCE=sample PUBLIC_SITE_URL=http://127.0.0.1:4321 HOST=127.0.0.1 PORT=4321 node apps/web/dist/server/entry.mjs &
pnpm --filter @kcom/web audit:a11y
```

Set `PW_CHANNEL=chrome` to use a local Chrome instead of the Playwright download.

`apps/web/audit/a11y.mjs` runs axe (wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa) on every page in `audit/pages.json`, in light and dark, at 375px and 1280px. Any violation fails. Add new public page types to `pages.json`.

## Manual pass (per release)

Keyboard only: skip link, header menu, theme toggle, search, forms, focus always visible. Screen reader (VoiceOver): landmarks, headings order, form labels and errors, image alt text.

## Run the performance audit

Run locally on demand; it never runs in CI or on pull requests (CI runs axe only). `--url` or `BASE_URL` picks the target. Lighthouse, default mobile emulation (slow 4G, 4x CPU throttle), median of 3 runs on 6 pages. Budgets: performance at least 0.90, LCP at most 2.5 s, TBT at most 300 ms, CLS at most 0.1, JavaScript at most 150 KB transferred (compressed). Set in `apps/web/lighthouserc.cjs`.

Local build:

```bash
pnpm --filter @kcom/web exec astro build
DATA_SOURCE=sample PUBLIC_SITE_URL=http://localhost:4321 HOST=127.0.0.1 PORT=4321 node apps/web/dist/server/entry.mjs &
pnpm --filter @kcom/web audit:perf
```

Deployed URL (staging or production):

```bash
pnpm --filter @kcom/web audit:perf -- --url https://example.org
```

Use `CHROME_PATH` to point at a local Chrome.
