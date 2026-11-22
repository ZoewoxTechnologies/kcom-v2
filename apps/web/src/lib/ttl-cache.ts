export interface TtlCache<T> {
  get(): Promise<T | null>;
}

/**
 * Keeps one value in memory. It loads on first use and then at most once per `ttlMs`. A failed
 * or empty load keeps the previous value (or null) and retries after `retryMs`, so a down API
 * never slows every request.
 */
export function createTtlCache<T>(
  load: () => Promise<T | null>,
  {
    ttlMs = 60_000,
    retryMs = 30_000,
    now = Date.now,
  }: { ttlMs?: number; retryMs?: number; now?: () => number } = {},
): TtlCache<T> {
  let value: T | null = null;
  let expires = 0;
  let loading: Promise<void> | null = null;

  const refresh = () =>
    (loading ??= load()
      .then((v) => {
        if (v !== null) {
          value = v;
          expires = now() + ttlMs;
        } else expires = now() + retryMs;
      })
      .catch(() => {
        expires = now() + retryMs;
      })
      .finally(() => {
        loading = null;
      }));

  return {
    async get() {
      if (now() >= expires) await refresh();
      return value;
    },
  };
}
