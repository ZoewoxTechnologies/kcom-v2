export const HOME_SECTION_KEYS = [
  "today",
  "current-series",
  "past-series",
  "blog",
  "events-books",
  "signup",
] as const;
export type HomeSectionKey = (typeof HOME_SECTION_KEYS)[number];

export interface HomeSection {
  key: HomeSectionKey;
  hidden: boolean;
}

export const defaultSections: HomeSection[] = HOME_SECTION_KEYS.map((key) => ({
  key,
  hidden: false,
}));

/**
 * The sections to render, in order. Today's Capsule is always first and always shown; unknown
 * or repeated keys are dropped and any section missing from the list is appended.
 */
export function visibleSections(
  list: readonly { key: string; hidden?: boolean }[] = defaultSections,
): HomeSectionKey[] {
  const known = new Set<string>(HOME_SECTION_KEYS);
  const seen = new Set<string>(["today"]);
  const rest: HomeSection[] = [];
  for (const s of list) {
    if (!known.has(s.key) || seen.has(s.key)) continue;
    seen.add(s.key);
    rest.push({ key: s.key as HomeSectionKey, hidden: Boolean(s.hidden) });
  }
  for (const key of HOME_SECTION_KEYS) if (!seen.has(key)) rest.push({ key, hidden: false });
  return ["today", ...rest.filter((s) => !s.hidden).map((s) => s.key)];
}

const API_KEYS: Record<string, HomeSectionKey> = {
  todays_capsule: "today",
  current_series: "current-series",
  past_series: "past-series",
  blog: "blog",
  events_books: "events-books",
  email_signup: "signup",
};

/**
 * The API lists only the visible sections, in order. Turns that into a full arrangement in which
 * every section left out is hidden. An empty or unusable list means "unknown" and gives null.
 */
export function sectionsFromApi(visibleKeys: readonly string[]): HomeSection[] | null {
  const shown = visibleKeys.flatMap((k) => (API_KEYS[k] ? [API_KEYS[k]] : []));
  if (shown.length === 0) return null;
  const hidden = HOME_SECTION_KEYS.filter((k) => !shown.includes(k));
  return [
    ...shown.map((key) => ({ key, hidden: false })),
    ...hidden.map((key) => ({ key, hidden: true })),
  ];
}

/** Dev-only preview of an arrangement: `?sections=blog,-signup` orders sections and hides those with a leading dash. */
export function sectionsFromQuery(raw: string | null): HomeSection[] | null {
  if (!raw) return null;
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => ({ key: t.replace(/^-/, "") as HomeSectionKey, hidden: t.startsWith("-") }));
}

export interface HomeEvent {
  slug: string;
  title: string;
  date: string;
  meta: string;
}
export interface HomeBook {
  slug: string;
  title: string;
}

/** Sample events and books until their data sources exist. */
export const sampleEvents: HomeEvent[] = [
  {
    slug: "thanksgiving",
    title: "End-of-Year Thanksgiving Service",
    date: "2026-12-06",
    meta: "Saturday · 10:00 a.m.",
  },
  {
    slug: "new-year",
    title: "New Year Prophetic Message 2027",
    date: "2027-01-01",
    meta: "Friday · 9:00 a.m. · online and in person",
  },
];
export const sampleBooks: HomeBook[] = [
  { slug: "war-words", title: "War Words" },
  { slug: "vision", title: "Vision for Your Mission" },
  { slug: "distinction", title: "Designed for Distinction" },
];

/** Pull quote beside the featured post until posts carry their own. */
export const featuredQuote: { text: string; ref: string } | null = {
  text: "For there shall be a performance of those things which were told her from the Lord.",
  ref: "Luke 1:45",
};

/**
 * The rows of the "Current series" block: the latest `count` capsules up to today, newest first so
 * today's is at the top. `capsules` must be in series order (Day 1 first); days still to come are left out.
 */
export function recentSeriesRows<T extends { displayDate: string }>(
  capsules: readonly T[],
  today: string,
  count = 4,
): T[] {
  return capsules
    .filter((c) => c.displayDate <= today)
    .slice(-count)
    .reverse();
}
