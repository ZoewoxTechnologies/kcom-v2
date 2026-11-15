export interface AnalyticsEnv {
  key?: string;
  host?: string;
}

/** True when the browser asks not to be tracked. */
export function doNotTrack(nav: {
  doNotTrack?: string | null;
  globalPrivacyControl?: boolean;
}): boolean {
  return nav.doNotTrack === "1" || nav.doNotTrack === "yes" || nav.globalPrivacyControl === true;
}

/** PostHog runs only with a project key and when the visitor has not opted out. */
export function shouldTrack(
  env: AnalyticsEnv,
  nav: { doNotTrack?: string | null; globalPrivacyControl?: boolean },
): boolean {
  return Boolean(env.key) && !doNotTrack(nav);
}
