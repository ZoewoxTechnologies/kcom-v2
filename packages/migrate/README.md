# @kcom/migrate

Legacy Drupal 7 migration tooling. This package only extracts raw content.

```bash
LEGACY_SQL=/path/to/dump.sql pnpm --filter @kcom/migrate extract
```

Writes one JSON file per published node to `data/legacy/extract/<type>/<nid>.json`
(override with `EXTRACT_DIR`) and prints counts per type plus the real capsule
count and date range. The dump is parsed directly, so no MySQL or Docker is needed.
`data/legacy/` is gitignored: the dump and its output contain personal data.

## Environment variables

The scripts read these from the shell (no `.env` file is loaded):

| Variable        | Used by            | Default                 | Purpose                                                          |
| --------------- | ------------------ | ----------------------- | ---------------------------------------------------------------- |
| `LEGACY_SQL`    | extract            | none (required)         | Path to the Drupal MySQL dump.                                   |
| `EXTRACT_DIR`   | extract, transform | `data/legacy/extract`   | Where extract writes, and transform reads, node JSON.            |
| `LEGACY_FILES`  | transform          | `data/legacy/files`     | Folder with the legacy public files, used to check images exist. |
| `TRANSFORM_DIR` | transform, import  | `data/legacy/transform` | Where transform writes `capsules`, `series` and `report` JSON; import writes `redirects.json` and `import-state.json`. |
| `DATABASE_URL`  | import             | none (required)         | Postgres connection string (the Neon dev branch).                |

## Transform

```bash
pnpm --filter @kcom/migrate transform
```

Both scripts run with `tsx`: `@kcom/content` ships TypeScript source with `.js` import
specifiers, which Node's built-in type stripping cannot resolve.

Reads the extract output and maps every `daily_digest` node onto the capsule model
(`@kcom/content`), writing `data/legacy/transform/{capsules,series,report}.json`:

- Scripture is split from the first paragraph (`text – Ref` or `text (Ref)`); the prayer, Bible
  meditation and author credit come from their fields; the rest is the body.
- Bodies are converted from legacy HTML to the editor's JSON document format.
- Series come from numbered titles (`Name 3`, `Name (3)`) shared by two or more capsules.
- `publishAt` is the capsule date at Africa/Lagos midnight; slugs and legacy paths come from the
  Drupal alias.
- Every record is validated against the shared capsule schema. `report.json` lists skipped
  records (including fields over the shared length limits), warnings (no scripture, prayer or author credit; slug collisions; capsules sharing a date; repeated series
  parts), dropped images and unsafe links, and files that are not on disk (the private files folder).

Capsule authorship (the Editor account) is assigned when loading, not here.

## Import

```bash
DATABASE_URL=postgres://... pnpm --filter @kcom/migrate import
```

Run `extract` first. Imports series, capsules and blog posts into the database and builds the
301 redirect map, all in one transaction.

- Rows are matched on the legacy node id (series on slug, redirects on old path) and written only
  when a field differs, so a second run reports everything `unchanged`. Every record keeps its
  legacy node id and old path.
- `--dry-run` runs everything and rolls back.
- `--final` imports only capsules and posts changed since the last run (read from
  `import-state.json`); `--since=2026-01-31T00:00:00Z` sets the date by hand. Redirects always run in full.
- A full run exits non-zero if the database counts differ from the extracted counts.
- Redirects cover every alias, `/node/<nid>`, `/archive/YYYYMM`, `/daily-digest` and the page
  mappings. Nodes that are not imported (pages, events, books, gallery, skipped capsules) redirect to
  the closest listing. `/rss.xml` is already served at the same path, so it needs no redirect.
  The map is also written to `redirects.json`.
