export const HOME_SECTION_KEYS = ["today", "current-series", "past-series", "blog", "events-books", "signup"] as const;
export type HomeSectionKey = (typeof HOME_SECTION_KEYS)[number];

export interface HomeSection {
  key: HomeSectionKey;
  hidden: boolean;
}

export const defaultSections: HomeSection[] = HOME_SECTION_KEYS.map((key) => ({ key, hidden: false }));

/**
 * The sections to render, in order. Today's Capsule is always first and always shown; unknown
 * or repeated keys are dropped and any section missing from the list is appended.
 */
export function visibleSections(list: readonly { key: string; hidden?: boolean }[] = defaultSections): HomeSectionKey[] {
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

/** Dev-only preview of an arrangement: `?sections=blog,-signup` orders sections and hides those with a leading dash. */
export function sectionsFromQuery(raw: string | null): HomeSection[] | null {
  if (!raw) return null;
  return raw.split(",").map((t) => t.trim()).filter(Boolean).map((t) => ({ key: t.replace(/^-/, "") as HomeSectionKey, hidden: t.startsWith("-") }));
}

export interface HomeEvent { slug: string; title: string; date: string; meta: string }
export interface HomeBook { slug: string; title: string }

/** Sample events and books until their data sources exist. */
export const sampleEvents: HomeEvent[] = [
  { slug: "thanksgiving", title: "End-of-Year Thanksgiving Service", date: "2026-12-06", meta: "Saturday · 10:00 a.m." },
  { slug: "new-year", title: "New Year Prophetic Message 2027", date: "2027-01-01", meta: "Friday · 9:00 a.m. · online and in person" },
];
export const sampleBooks: HomeBook[] = [{ slug: "war-words", title: "War Words" }, { slug: "vision", title: "Vision for Your Mission" }, { slug: "distinction", title: "Designed for Distinction" }];
