# Backups and monitoring

Neon's free plan has a 6-hour restore window and no scheduled backups, so a GitHub Actions workflow
(`.github/workflows/backup.yml`) takes a nightly encrypted dump to S3-compatible storage.

## How it works

- Runs daily at 02:17 UTC and on manual trigger (Actions → nightly-backup → Run workflow).
- `pg_dump` (custom format, PostgreSQL 18 client) → `gzip` → `age` encryption → upload.
- Skips with a notice (job stays green) if any variable or secret below is missing.
- Keys: `daily/`, `weekly/` (Sundays), `monthly/` (1st). Each run prunes to the newest 14 daily, 8 weekly, 12 monthly.
- The workflow uses no third-party actions, so there is nothing to pin.

## Setup

1. **age keypair** (on your own machine; keep the private key offline, e.g. in a password manager):
   ```bash
   age-keygen -o kcom-backup.key
   ```
   Copy the `age1...` public key it prints. The private key stays only with you (password manager);
   never commit it or store it in GitHub, the bucket or CI. Without it the backups cannot be restored.
2. **Bucket**: create a private bucket on Backblaze B2 or Cloudflare R2 and an application key limited to that bucket
   (read, write, list, delete). Do not enable bucket versioning/lifecycle rules; the workflow prunes itself.
3. **Repository variables** (Settings → Secrets and variables → Actions → Variables):
   - `BACKUP_AGE_PUBLIC_KEY`: the `age1...` public key
   - `BACKUP_S3_ENDPOINT`: e.g. `https://<account>.r2.cloudflarestorage.com` or `https://s3.<region>.backblazeb2.com`
   - `BACKUP_S3_BUCKET`: bucket name
   - `BACKUP_S3_REGION` (optional; default `auto`; B2 needs its region, e.g. `us-west-004`)
4. **Repository secrets**:
   - `DATABASE_URL`: Neon connection string (use the direct, non-pooled one)
   - `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY`
5. Run the workflow manually once and confirm a file appears under `daily/`.

## Restore

Needs `age`, `gzip` and the PostgreSQL 18 client tools (`pg_restore`, `psql`).

```bash
# 1. Download a backup (any S3 client works; example with the AWS CLI)
aws --endpoint-url "$S3_ENDPOINT" s3 cp "s3://$S3_BUCKET/daily/kcom-YYYY-MM-DD.dump.gz.age" .

# 2. Decrypt and decompress with your private key
age -d -i kcom-backup.key kcom-YYYY-MM-DD.dump.gz.age | gunzip > kcom.dump

# 3. Restore into a scratch database
createdb kcom_restore
pg_restore --no-owner --no-privileges --dbname kcom_restore kcom.dump

# 4. Sanity check
psql kcom_restore -c '\dt'
psql kcom_restore -c 'select count(*) from capsules'   # adjust to any table
```

These steps were tested end to end (dump, gzip, age encrypt, decrypt, restore into a throwaway PostgreSQL 18
cluster, row counts matched on every table). The dump must be taken with a `pg_dump` at least as new as the
server (Neon runs 18).

To restore into a new Neon branch or project, replace `kcom_restore` with its connection string
(`--dbname "$NEW_DATABASE_URL"`), then point `DATABASE_URL` at it.

Use `--clean --if-exists` only when restoring over an existing database you intend to overwrite.

## Neon usage alert (manual, in the Neon console)

1. Open the project → Settings → Usage / Billing.
2. Add an alert on storage and compute hours at about 80% of the free-plan limit.
3. Send it to an email address you read.

## Monitoring env vars

All optional; every integration is a no-op when its variable is unset.

| App | Variables |
| --- | --- |
| api | `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE`, `SENTRY_TRACES_SAMPLE_RATE` |
| web | `SENTRY_DSN` (server, runtime), `PUBLIC_SENTRY_DSN` (browser, build time), `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE`, `PUBLIC_SENTRY_*`, `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT` (source maps), `PUBLIC_POSTHOG_KEY`, `PUBLIC_POSTHOG_HOST`, `PUBLIC_API_URL` (build time as well: the browser calls the API for search and the contact form; set it as a Docker build arg / Railway build variable, and as the repo variable `PUBLIC_API_URL` for CI and deploy builds) |
| admin | `VITE_SENTRY_DSN`, `VITE_SENTRY_ENVIRONMENT`, `VITE_SENTRY_RELEASE` (all build time) |

`pnpm build` in `apps/web` also needs `PUBLIC_API_URL`, because search and the contact form call the API from the browser.

Set the Sentry and PostHog keys only on the production services and the production build, never in local `.env` files.

PostHog runs on the public site only, skips visitors with Do Not Track or Global Privacy Control, and has
session recording disabled. Set `SENTRY_RELEASE` to the git SHA at deploy time.
