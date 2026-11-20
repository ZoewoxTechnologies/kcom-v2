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
| `TRANSFORM_DIR` | transform          | `data/legacy/transform` | Where transform writes `capsules`, `series` and `report` JSON.   |

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
