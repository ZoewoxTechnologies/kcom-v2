# @kcom/migrate

Legacy Drupal 7 migration tooling. This package only extracts raw content.

```bash
LEGACY_SQL=/path/to/dump.sql pnpm --filter @kcom/migrate extract
```

Writes one JSON file per published node to `data/legacy/extract/<type>/<nid>.json`
(override with `EXTRACT_DIR`) and prints counts per type plus the real capsule
count and date range. The dump is parsed directly, so no MySQL or Docker is needed.
`data/legacy/` is gitignored: the dump and its output contain personal data.
