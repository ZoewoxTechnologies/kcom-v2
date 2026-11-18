import type { Capsule, CapsuleLink, DataSource, SeriesInfo } from "./data";

const PAST_YEARS = 8;

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const i = y * 12 + (m - 1) + by;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
}

export interface Neighbours {
  prev: CapsuleLink | null;
  next: CapsuleLink | null;
}

export interface SeriesContext {
  series: SeriesInfo;
  /** Oldest part first. */
  members: CapsuleLink[];
  total: number;
}

/** The capsule's series and its parts, or null when it has none. */
export async function seriesContext(src: DataSource, capsule: Capsule): Promise<SeriesContext | null> {
  if (!capsule.seriesId) return null;
  const series = (await src.listSeries()).find((s) => s.id === capsule.seriesId);
  if (!series) return null;
  const rows = await src.listCapsules({ series: series.slug });
  const members = [...rows].sort((a, b) => (a.partNumber ?? 0) - (b.partNumber ?? 0) || a.displayDate.localeCompare(b.displayDate));
  return { series, members, total: members.length };
}

/** Capsules from the same calendar day in earlier years, newest first. */
export async function onThisDay(src: DataSource, date: string): Promise<CapsuleLink[]> {
  const year = Number(date.slice(0, 4));
  const days = Array.from({ length: PAST_YEARS }, (_, i) => `${year - 1 - i}${date.slice(4)}`);
  const found = await Promise.all(days.map((d) => src.listCapsules({ date: d, limit: 1 }).then((r) => r[0] ?? null)));
  return found.filter((c): c is CapsuleLink => c !== null);
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
