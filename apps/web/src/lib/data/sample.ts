import { lagosDate } from "@kcom/content";
import { inSeriesOrder, toSeriesSummary } from "./series";
import type { CapsuleListItem, CapsuleSummary, DataSource, SeriesDetail, SeriesSummary } from "./types";

export const sampleCapsule: CapsuleSummary = {
  slug: "be-ye-transformed",
  title: "Be ye transformed",
  displayDate: "2026-11-14",
  scriptureRef: "Romans 12:2",
  scriptureText: "Be ye transformed by the renewing of your mind.",
};

const DAY_MS = 24 * 60 * 60 * 1000;
const slugOf = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const seriesDefs = [
  { title: "The Renewed Mind", description: "Letting the Word reshape how we think, choose and speak.", days: 12, endsAgo: 0 },
  { title: "Walking in Dominion", description: "Authority, stewardship and the believer’s rule in Christ.", days: 14, endsAgo: 20 },
  { title: "The Fear of the Lord", description: "The beginning of wisdom, and the end of every other fear.", days: 10, endsAgo: 40 },
  { title: "Psalms for the Weary", description: "Three weeks resting in the songs of Israel.", days: 21, endsAgo: 55 },
  { title: "The Names of God", description: "Jehovah Jireh, Rapha, Shalom: knowing Him by name.", days: 7, endsAgo: 80 },
  { title: "Fruit of the Spirit", description: "Nine graces, one Spirit, a life that bears fruit.", days: 15, endsAgo: 100 },
  { title: "Prayer That Prevails", description: "Lessons from Elijah, Hannah and the early church.", days: 9, endsAgo: 130 },
  { title: "The Cross and the Crown", description: "From Gethsemane to the empty tomb.", days: 12, endsAgo: 160 },
  { title: "Sunday Psalms", description: "A psalm every Sunday morning.", days: 11, endsAgo: 200 },
  { title: "Rooted and Grounded", description: "Deep roots for every season.", days: 8, endsAgo: 230 },
] as const;

/** Sample archive: a handful of series laid back from today, so every page has content. */
function build(now: Date): { items: CapsuleListItem[]; series: SeriesSummary[] } {
  const items: CapsuleListItem[] = [];
  const series: SeriesSummary[] = [];
  for (const def of seriesDefs) {
    const own: CapsuleListItem[] = [];
    for (let i = 0; i < def.days; i++) {
      const ago = def.endsAgo + (def.days - 1 - i);
      own.push({
        slug: `${slugOf(def.title)}-day-${i + 1}`,
        title: `${def.title}, day ${i + 1}`,
        displayDate: lagosDate(new Date(now.getTime() - ago * DAY_MS)),
        scriptureRef: "Romans 12:2",
        partNumber: i + 1,
        seriesTitle: def.title,
      });
    }
    series.push(
      toSeriesSummary(
        {
          slug: slugOf(def.title),
          title: def.title,
          description: def.description,
          capsuleCount: own.length,
          firstDate: own[0]!.displayDate,
          lastDate: own[own.length - 1]!.displayDate,
          latestPart: own.length,
        },
        now,
      ),
    );
    items.push(...own);
  }
  return { items, series };
}

export function createSampleSource(now: () => Date = () => new Date()): DataSource {
  return {
    latestCapsule: async () => sampleCapsule,
    async listCapsulesInMonth(month) {
      return build(now())
        .items.filter((c) => c.displayDate.startsWith(month))
        .sort((a, b) => b.displayDate.localeCompare(a.displayDate));
    },
    async listSeries() {
      return build(now()).series;
    },
    async seriesBySlug(slug): Promise<SeriesDetail | null> {
      const { items, series } = build(now());
      const found = series.find((s) => s.slug === slug);
      return found ? { series: found, capsules: inSeriesOrder(items.filter((c) => c.seriesTitle === found.title)) } : null;
    },
  };
}

export const sampleSource: DataSource = createSampleSource();
