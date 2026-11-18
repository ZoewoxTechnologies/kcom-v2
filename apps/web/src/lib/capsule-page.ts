import type { Capsule, CapsuleLink, CapsuleListItem, DataSource, SeriesSummary } from "./data";

const PAST_YEARS = 8;
/** Longest run of parts listed under a capsule; longer series link to their own page. */
export const SERIES_WINDOW = 30;

export interface Neighbours {
  prev: CapsuleLink | null;
  next: CapsuleLink | null;
}

export interface SeriesContext {
  series: SeriesSummary;
  /** Oldest part first; a window around the current capsule when the series is long. */
  members: CapsuleListItem[];
  /** True when the series has more parts than `members` shows. */
  truncated: boolean;
}

/** The capsule's series and its parts, or null when it has none. */
export async function seriesContext(src: DataSource, capsule: Capsule): Promise<SeriesContext | null> {
  if (!capsule.series) return null;
  const detail = await src.seriesBySlug(capsule.series.slug);
  if (!detail) return null;
  const all = detail.capsules;
  const truncated = all.length > SERIES_WINDOW;
  const at = Math.max(0, all.findIndex((c) => c.slug === capsule.slug));
  const start = truncated ? Math.min(Math.max(0, at - SERIES_WINDOW / 2), all.length - SERIES_WINDOW) : 0;
  return { series: detail.series, members: all.slice(start, start + SERIES_WINDOW), truncated };
}

/** Capsules from the same calendar day in earlier years, newest first. */
export async function onThisDay(src: DataSource, date: string): Promise<CapsuleLink[]> {
  const year = Number(date.slice(0, 4));
  const days = Array.from({ length: PAST_YEARS }, (_, i) => `${year - 1 - i}${date.slice(4)}`);
  const found = await Promise.all(days.map((d) => src.capsuleByDate(d)));
  return found.filter((c) => c !== null).map(({ slug, title, displayDate, scriptureRef }) => ({ slug, title, displayDate, scriptureRef }));
}

export interface CapsulePageData extends Neighbours {
  capsule: Capsule;
  seriesInfo: SeriesContext | null;
  past: CapsuleLink[];
}

export async function loadCapsulePage(src: DataSource, capsule: Capsule): Promise<CapsulePageData> {
  const [n, seriesInfo, past] = await Promise.all([
    src.capsuleNeighbours(capsule.slug).then((r) => r ?? { prev: null, next: null }),
    seriesContext(src, capsule),
    onThisDay(src, capsule.displayDate),
  ]);
  return { capsule, ...n, seriesInfo, past };
}
