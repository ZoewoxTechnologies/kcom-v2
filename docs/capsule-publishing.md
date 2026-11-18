# Capsule publishing

## States

`draft` → `scheduled` → `published`, and `scheduled` → `draft` (unschedule).

- Creating a capsule without `publishAt` defaults it to the next 00:00 Africa/Lagos (`nextLagosMidnight` in `@kcom/content`). Editors may pick any later time.
- Scheduling needs a future `publishAt`. Moving a draft with a stale time to `scheduled` without a new time resets it to the next Lagos midnight.
- Editing a scheduled capsule (no status in the patch) keeps its `publishAt`. Unscheduling sets `draft` and keeps the time.
- Publishing manually (`status: "published"`) publishes now; a future `publishAt` is rejected (use `scheduled`).
- Moving out of draft, or changing non-draft content, needs `content:publish` (`assertCanChange`).

## Publisher

`publishDueCapsules` (`apps/api/src/capsule-publishing.ts`) runs one conditional `UPDATE ... WHERE status = 'scheduled' AND publish_at <= now RETURNING`. Only rows it flips are returned, so re-running or running concurrently never publishes or emits twice. Manual publishes use the same guard.

### Why an endpoint, not a separate job

The API already runs on Cloud Run, so Cloud Scheduler calls `POST /internal/publish-due` on the existing service: one image, no second deploy target. The endpoint requires `Authorization: Bearer $INTERNAL_JOB_TOKEN`; with the variable unset it returns 404.

```bash
gcloud scheduler jobs create http kcom-publish-due \
  --location=europe-west1 --schedule="* * * * *" --time-zone="Africa/Lagos" \
  --uri="https://<api-url>/internal/publish-due" --http-method=POST \
  --headers="Authorization=Bearer <token>"
```

Store the token in Secret Manager and mount it on the API service as `INTERNAL_JOB_TOKEN`. Running every minute keeps go-live within a minute of midnight; the job is cheap when nothing is due.

## Event

`createApp(db, { capsuleEvents })` takes a bus from `createCapsuleEvents()`. Subscribe with `events.on(({ capsule }) => ...)`. It fires once per publish, from the publisher and from manual publishes. A throwing handler is logged and does not affect the publish or other handlers. Handlers run in-process, so they must be quick or hand work to a queue.
