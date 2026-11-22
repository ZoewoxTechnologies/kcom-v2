/** Any http loopback origin on any port. Only ever added outside production (see AppOptions). */
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;

/** CORS origin check: the configured list, plus loopback origins when `allowLocalhost` is set. */
export function corsOriginPolicy(origins: string[], allowLocalhost: boolean) {
  return (origin: string): string | null =>
    origins.includes(origin) || (allowLocalhost && LOCAL_ORIGIN.test(origin)) ? origin : null;
}

/** Auth trusted origins: the configured list, plus loopback wildcards when `allowLocalhost` is set. */
export function trustedOriginList(origins: string[], allowLocalhost: boolean): string[] {
  return allowLocalhost ? [...origins, "http://localhost:*", "http://127.0.0.1:*"] : origins;
}
