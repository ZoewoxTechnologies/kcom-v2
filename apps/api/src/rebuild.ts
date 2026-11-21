import * as Sentry from "@sentry/node";

export type RebuildTrigger = {
  /** Ask for a rebuild. Calls within the debounce window share one request. */
  schedule(): void;
  /** Cancels a pending request, for shutdown and tests. */
  cancel(): void;
};

export type RebuildOptions = {
  /** Webhook that starts the site build or deploy. */
  url: string;
  /** Sent as a Bearer token when set. */
  token?: string;
  /** JSON body for the request. */
  body?: unknown;
  /** Quiet time after the last change before the request goes out. */
  debounceMs?: number;
  fetch?: typeof fetch;
  /** Where a failed request is reported. Defaults to Sentry. */
  onError?: (err: unknown) => void;
};

export const DEFAULT_REBUILD_DEBOUNCE_MS = 60_000;

/**
 * Debounced site rebuild: a burst of publishes and edits produces one POST to
 * the webhook, sent once changes have stopped for `debounceMs`. A failed
 * request is logged and reported, never thrown into a publish.
 */
export function createRebuildTrigger({
  url,
  token,
  body = { source: "kcom-api" },
  debounceMs = DEFAULT_REBUILD_DEBOUNCE_MS,
  fetch: doFetch = fetch,
  onError = (err) => {
    console.error("site rebuild trigger failed:", err);
    Sentry.captureException(err);
  },
}: RebuildOptions): RebuildTrigger {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const send = async () => {
    timer = undefined;
    try {
      const res = await doFetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`rebuild webhook answered ${res.status}`);
    } catch (err) {
      onError(err);
    }
  };

  return {
    schedule() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(send, debounceMs);
      timer.unref?.();
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = undefined;
    },
  };
}

/** Builds the trigger from env; undefined (rebuilds off) when REBUILD_HOOK_URL is unset. */
export function rebuildFromEnv(env: NodeJS.ProcessEnv = process.env): RebuildTrigger | undefined {
  if (!env.REBUILD_HOOK_URL) return undefined;
  const debounce = Number(env.REBUILD_DEBOUNCE_MS);
  return createRebuildTrigger({
    url: env.REBUILD_HOOK_URL,
    token: env.REBUILD_HOOK_TOKEN || undefined,
    body: env.REBUILD_HOOK_BODY ? JSON.parse(env.REBUILD_HOOK_BODY) : undefined,
    debounceMs:
      Number.isFinite(debounce) && debounce >= 0 && env.REBUILD_DEBOUNCE_MS ? debounce : undefined,
  });
}

/** Admin areas whose changes show on the public site. Capsules go through the publish event instead. */
const SITE_CONTENT = /^\/admin\/(blog|pages|events|books|settings|homepage|series)(\/|$)/;

/** True for a successful write to content that appears on the public site. */
export const changesSiteContent = (method: string, path: string, status: number) =>
  ["POST", "PUT", "PATCH", "DELETE"].includes(method) && status < 300 && SITE_CONTENT.test(path);
