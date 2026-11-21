# Accessibility and performance audit

Run against the built public site on sample data (`DATA_SOURCE=sample`); CI job `audit` does this on every web change.

```bash
pnpm --filter @kcom/web exec astro build
DATA_SOURCE=sample HOST=127.0.0.1 PORT=4321 node apps/web/dist/server/entry.mjs &
pnpm --filter @kcom/web audit:a11y   # axe, WCAG 2.2 AA
pnpm --filter @kcom/web audit:perf   # Lighthouse
```

Set `PW_CHANNEL=chrome` and `CHROME_PATH` to use a local Chrome instead of the Playwright download.

## Accessibility

`apps/web/audit/a11y.mjs` runs axe (wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa) on every page in `audit/pages.json`, in light and dark, at 375px and 1280px. Any violation fails the check. Add new public page types to `pages.json`.

## Performance targets

Lighthouse, default mobile emulation (slow 4G, 4x CPU throttle), median of 3 runs per page (`apps/web/lighthouserc.json`):

| Metric | Budget |
| --- | --- |
| Performance score | at least 0.90 |
| Largest Contentful Paint | at most 2.5 s |
| Total Blocking Time | at most 300 ms |
| Cumulative Layout Shift | at most 0.1 |
| JavaScript transferred | at most 150 KB |

## Manual pass (per release)

Keyboard only: skip link, header menu, theme toggle, search, forms, focus always visible. Screen reader (VoiceOver): landmarks, headings order, form labels and errors, image alt text.
