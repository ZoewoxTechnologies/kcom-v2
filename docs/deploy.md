# Deploy

CI runs on every PR (`.github/workflows/ci.yml`): install, lint, typecheck, test, build via Turborepo, plus a Docker build of each app.
After CI passes on `main`, `.github/workflows/deploy.yml` (also runnable manually) builds three images, pushes them to Artifact Registry and deploys three Cloud Run services (`kcom-web-staging`, `kcom-api-staging`, `kcom-admin-staging`, min instances 0). GitHub authenticates to GCP with Workload Identity Federation (no keys). The deploy job skips cleanly until the repo variables below are set.

Images: `apps/<app>/Dockerfile`, built from the repo root (`docker build -f apps/web/Dockerfile .`). All listen on `$PORT` (Cloud Run sets 8080).

## One-time GCP setup

Replace the values below, then run in a terminal logged in with `gcloud auth login`.

```bash
export PROJECT_ID=kcom-staging          # globally unique
export REGION=europe-west1
export REPO=kcom
export GH_REPO=ZoewoxTechnologies/kcom-v2
export SA=github-deployer

gcloud projects create $PROJECT_ID
gcloud billing projects link $PROJECT_ID --billing-account=<BILLING_ACCOUNT_ID>
gcloud config set project $PROJECT_ID

gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
  iamcredentials.googleapis.com sts.googleapis.com cloudresourcemanager.googleapis.com

gcloud artifacts repositories create $REPO --repository-format=docker --location=$REGION

# Runtime service account (what the services run as) and deployer service account
gcloud iam service-accounts create kcom-run
gcloud iam service-accounts create $SA
SA_EMAIL=$SA@$PROJECT_ID.iam.gserviceaccount.com
RUN_SA=kcom-run@$PROJECT_ID.iam.gserviceaccount.com

gcloud projects add-iam-policy-binding $PROJECT_ID --member=serviceAccount:$SA_EMAIL \
  --role=roles/artifactregistry.writer
# run.admin only on services named kcom-*
gcloud projects add-iam-policy-binding $PROJECT_ID --member=serviceAccount:$SA_EMAIL \
  --role=roles/run.admin \
  --condition="title=kcom-services-only,expression=resource.name.startsWith('projects/$PROJECT_ID/locations/$REGION/services/kcom-')"
# act-as only the runtime service account
gcloud iam service-accounts add-iam-policy-binding $RUN_SA \
  --member=serviceAccount:$SA_EMAIL --role=roles/iam.serviceAccountUser

# Workload Identity Federation, restricted to this repo's main branch
gcloud iam workload-identity-pools create github --location=global
gcloud iam workload-identity-pools providers create-oidc github-oidc \
  --location=global --workload-identity-pool=github \
  --issuer-uri=https://token.actions.githubusercontent.com \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='$GH_REPO' && assertion.ref=='refs/heads/main'"

PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
gcloud iam service-accounts add-iam-policy-binding $SA_EMAIL \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/$GH_REPO"

# Value for the GCP_WORKLOAD_IDENTITY_PROVIDER secret
echo "projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/providers/github-oidc"
echo $SA_EMAIL
```

If the org blocks public services (domain-restricted sharing), the deploy step's `allUsers` binding fails; relax the org policy for this project.

## GitHub settings

Repo → Settings → Secrets and variables → Actions.

| Kind     | Name                             | Value                                  |
| -------- | -------------------------------- | -------------------------------------- |
| Secret   | `GCP_WORKLOAD_IDENTITY_PROVIDER` | provider path printed above            |
| Secret   | `GCP_SERVICE_ACCOUNT`            | `$SA_EMAIL`                            |
| Variable | `GCP_PROJECT_ID`                 | `$PROJECT_ID`                          |
| Variable | `GCP_REGION`                     | `europe-west1`                         |
| Variable | `GCP_ARTIFACT_REPO`              | `kcom`                                 |

Or: `gh variable set GCP_PROJECT_ID --repo $GH_REPO` / `gh secret set ... --repo $GH_REPO`.

Runtime config (database URL, etc.) is not set by the workflow yet. Add it with `gcloud run services update ... --set-secrets` (Secret Manager) once the database is wired.

## First deploy

Merge to `main` (or run "Deploy staging" manually from the Actions tab). Then get the service URLs:

```bash
gcloud run services list --region=$REGION
```

## Cloudflare (staging subdomain)

Prerequisite: the domain's zone is on Cloudflare (free plan, nameservers switched).

Cloud Run domain mappings are not available in every region; `europe-west1` supports them.

1. Map custom domains (verifies domain ownership first time via Search Console):
   ```bash
   gcloud domains verify kingdomcapstone.org   # once
   gcloud beta run domain-mappings create --service=kcom-web-staging   --domain=staging.kingdomcapstone.org       --region=$REGION
   gcloud beta run domain-mappings create --service=kcom-api-staging   --domain=api.staging.kingdomcapstone.org   --region=$REGION
   gcloud beta run domain-mappings create --service=kcom-admin-staging --domain=admin.staging.kingdomcapstone.org --region=$REGION
   ```
   Each prints the DNS target (usually `CNAME ghs.googlehosted.com`).
2. Cloudflare → DNS: add a `CNAME` for each host to `ghs.googlehosted.com`, **Proxied** (orange cloud).
3. SSL/TLS → set mode to **Full (strict)**. (Google issues the origin cert; it can take ~15 min. Keep the record DNS-only until the mapping shows a certificate, then enable the proxy.)
4. Caching → Cache Rules (in this order):
   1. **Bypass**: hostname is `api.staging.kingdomcapstone.org` or `admin.staging.kingdomcapstone.org` → Bypass cache.
   2. **Cache public HTML**: hostname is `staging.kingdomcapstone.org` and the request is a GET and the URI path does not start with `/api` → Eligible for cache; Edge TTL: ignore origin, 5 minutes; Browser TTL: respect origin.
   3. Static assets (`/_astro/*`) are fingerprinted: Edge TTL 1 year.
5. Optional: Cache Reserve/Tiered Cache are not needed. A rule that keeps cached pages warm reduces cold starts for visitors.

Purge cache after a deploy if HTML looks stale: Cloudflare → Caching → Purge Everything.

## Rebuild on publish

The API asks for a site rebuild when a capsule is published (by an editor or by the scheduler) and after any successful write to blog, pages, events, books, settings, homepage or series. Requests are debounced: the webhook is called once, `REBUILD_DEBOUNCE_MS` (default 60 s) after the last change, so a burst of edits produces one build. A failed call is logged and reported to Sentry and never blocks the edit.

Set `REBUILD_HOOK_URL` on the API service to turn it on. For the staging deploy workflow, use a GitHub `workflow_dispatch` call:

```text
REBUILD_HOOK_URL=https://api.github.com/repos/<org>/<repo>/actions/workflows/deploy.yml/dispatches
REBUILD_HOOK_TOKEN=<token that can run workflows>
REBUILD_HOOK_BODY={"ref":"main"}
```

The request is at-most-once like the publish event: a crash inside the debounce window loses it, and the next change or a manual run of "Deploy staging" catches up.
