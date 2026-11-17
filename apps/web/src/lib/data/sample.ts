import type { Capsule, CapsuleLink, CapsuleSummary, DataSource, SeriesInfo } from "./types";

const doc = (...paragraphs: string[]) => ({
  type: "doc",
  content: paragraphs.map((text) => ({ type: "paragraph", content: [{ type: "text", text }] })),
});

const seriesId = "sample-series-renewed-mind";
export const sampleSeries: SeriesInfo = { id: seriesId, slug: "the-renewed-mind", title: "The Renewed Mind" };

const make = (
  slug: string,
  title: string,
  displayDate: string,
  scriptureRef: string,
  scripture: string,
  extra: Partial<Capsule> = {},
): Capsule => ({
  slug,
  title,
  displayDate,
  scriptureRef,
  scriptureText: doc(scripture),
  bibleMeditation: null,
  body: doc(
    "Sample devotional text for layout purposes. Every day the world presses on us, quietly and constantly, asking us to take its shape.",
    "Transformation begins in the mind. Not by trying harder, but by letting the Word of God renew the way we think.",
  ),
  decrees: [],
  prayer: doc("Father, thank You for Your Word. Renew my mind today. In Jesus’ name, amen."),
  authorSource: "Sample author",
  seriesId: null,
  partNumber: null,
  bannerUrl: null,
  ...extra,
});

export const sampleCapsules: Capsule[] = [
  make("be-ye-transformed", "Be Ye Transformed", "2026-11-14", "Romans 12:2",
    "And be not conformed to this world: but be ye transformed by the renewing of your mind, that ye may prove what is that good, and acceptable, and perfect, will of God.",
    {
      bibleMeditation: "Romans 12:1-8",
      decrees: ["I decree that my mind is renewed daily by the Word of God.", "I refuse to be conformed to the pattern of this world, in Jesus’ name."],
      seriesId, partNumber: 11,
    }),
  make("whatsoever-things-are-pure", "Whatsoever Things Are Pure", "2026-11-13", "Philippians 4:8",
    "Finally, brethren, whatsoever things are true, whatsoever things are honest, whatsoever things are just, whatsoever things are pure, think on these things.",
    { seriesId, partNumber: 10 }),
  make("thoughts-taken-captive", "Thoughts Taken Captive", "2026-11-12", "2 Corinthians 10:5",
    "Casting down imaginations, and every high thing that exalteth itself against the knowledge of God, and bringing into captivity every thought to the obedience of Christ.",
    { decrees: ["My thoughts are obedient to Christ."], seriesId, partNumber: 9 }),
  make("renewed-day-by-day", "Renewed Day by Day", "2026-11-10", "2 Corinthians 4:16",
    "Though our outward man perish, yet the inward man is renewed day by day.", { seriesId, partNumber: 8 }),
  make("a-sound-mind", "A Sound Mind", "2026-11-09", "2 Timothy 1:7",
    "For God hath not given us the spirit of fear; but of power, and of love, and of a sound mind.", { seriesId, partNumber: 7 }),
  make("the-peace-that-guards", "The Peace That Guards", "2025-11-14", "Philippians 4:7",
    "And the peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus."),
  make("strongholds-pulled-down", "Strongholds Pulled Down", "2024-11-14", "2 Corinthians 10:4",
    "For the weapons of our warfare are not carnal, but mighty through God to the pulling down of strong holds."),
];

const link = (c: Capsule): CapsuleLink => ({
  slug: c.slug, title: c.title, displayDate: c.displayDate, scriptureRef: c.scriptureRef, seriesId: c.seriesId, partNumber: c.partNumber,
});
const newestFirst = [...sampleCapsules].sort((a, b) => b.displayDate.localeCompare(a.displayDate));

export const sampleCapsule: CapsuleSummary = {
  slug: "be-ye-transformed",
  title: "Be ye transformed",
  displayDate: "2026-11-14",
  scriptureRef: "Romans 12:2",
  scriptureText: "Be ye transformed by the renewing of your mind.",
};

export const sampleSource: DataSource = {
  latestCapsule: async () => sampleCapsule,
  capsuleBySlug: async (slug) => sampleCapsules.find((c) => c.slug === slug) ?? null,
  capsuleByDate: async (date) => sampleCapsules.find((c) => c.displayDate === date) ?? null,
  listCapsules: async ({ month, date, series, limit = 100 }) =>
    newestFirst
      .filter((c) => (!month || c.displayDate.startsWith(month)) && (!date || c.displayDate === date) && (!series || (series === sampleSeries.slug && c.seriesId === seriesId)))
      .slice(0, limit)
      .map(link),
  listSeries: async () => [sampleSeries],
};
