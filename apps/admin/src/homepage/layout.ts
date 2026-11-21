export type SectionKey =
  | "todays_capsule"
  | "current_series"
  | "past_series"
  | "blog"
  | "events_books"
  | "email_signup";

export interface SectionRow {
  key: SectionKey;
  visible: boolean;
}

/** Today's Capsule is pinned first and always shown; the other five can move and hide. */
export const FIXED_KEY: SectionKey = "todays_capsule";

export const SECTION_LABELS: Record<SectionKey, string> = {
  todays_capsule: "Today’s Capsule",
  current_series: "Current series",
  past_series: "Explore past series",
  blog: "From the blog",
  events_books: "Events and Books",
  email_signup: "Email signup",
};

/** Moves `key` to `to` (an index among the movable rows, 0 = right under Today's Capsule). */
export function moveSection(rows: SectionRow[], key: SectionKey, to: number): SectionRow[] {
  if (key === FIXED_KEY) return rows;
  const fixed = rows.filter((r) => r.key === FIXED_KEY);
  const movable = rows.filter((r) => r.key !== FIXED_KEY);
  const from = movable.findIndex((r) => r.key === key);
  if (from < 0) return rows;
  const target = Math.max(0, Math.min(movable.length - 1, to));
  if (target === from) return rows;
  const [row] = movable.splice(from, 1);
  movable.splice(target, 0, row!);
  return [...fixed, ...movable];
}

export const setVisible = (rows: SectionRow[], key: SectionKey, visible: boolean): SectionRow[] =>
  key === FIXED_KEY ? rows : rows.map((r) => (r.key === key ? { ...r, visible } : r));
