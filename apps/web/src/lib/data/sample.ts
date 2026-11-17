import type { CapsuleSummary, DataSource, SeriesSummary } from "./types";

export const sampleCapsule: CapsuleSummary = {
  slug: "be-ye-transformed",
  title: "Be ye transformed",
  displayDate: "2026-11-14",
  scriptureRef: "Romans 12:2",
  scriptureText: "Be ye transformed by the renewing of your mind.",
  seriesId: "sample-series-1",
};

export const sampleSeries: SeriesSummary[] = [
  { id: "sample-series-1", slug: "renewed-mind", title: "The renewed mind", description: "Sample series." },
  { id: "sample-series-2", slug: "still-waters", title: "Still waters", description: "Sample series." },
];

export const sampleSource: DataSource = {
  latestCapsule: async () => sampleCapsule,
  listSeries: async () => sampleSeries,
};
