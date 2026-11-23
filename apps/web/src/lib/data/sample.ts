import { lagosDate } from "@kcom/content";
import { sampleBlogPosts } from "./sample-blog";
import { inSeriesOrder, toSeriesSummary } from "./series";
import type {
  StaticPage,
  Book,
  EventDetail,
  EventSummary,
  Capsule,
  CapsuleListItem,
  DataSource,
  SeriesDetail,
  SeriesSummary,
} from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
const slugOf = (t: string) =>
  t
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const seriesDefs = [
  {
    title: "The Renewed Mind",
    description: "Letting the Word reshape how we think, choose and speak.",
    days: 12,
    endsAgo: 0,
  },
  {
    title: "Walking in Dominion",
    description: "Authority, stewardship and the believer’s rule in Christ.",
    days: 14,
    endsAgo: 20,
  },
  {
    title: "The Fear of the Lord",
    description: "The beginning of wisdom, and the end of every other fear.",
    days: 10,
    endsAgo: 40,
  },
  {
    title: "Psalms for the Weary",
    description: "Three weeks resting in the songs of Israel.",
    days: 21,
    endsAgo: 55,
  },
  {
    title: "The Names of God",
    description: "Jehovah Jireh, Rapha, Shalom: knowing Him by name.",
    days: 7,
    endsAgo: 80,
  },
  {
    title: "Fruit of the Spirit",
    description: "Nine graces, one Spirit, a life that bears fruit.",
    days: 15,
    endsAgo: 100,
  },
  {
    title: "Prayer That Prevails",
    description: "Lessons from Elijah, Hannah and the early church.",
    days: 9,
    endsAgo: 130,
  },
  {
    title: "The Cross and the Crown",
    description: "From Gethsemane to the empty tomb.",
    days: 12,
    endsAgo: 160,
  },
  { title: "Sunday Psalms", description: "A psalm every Sunday morning.", days: 11, endsAgo: 200 },
  {
    title: "Rooted and Grounded",
    description: "Deep roots for every season.",
    days: 8,
    endsAgo: 230,
  },
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

const SCRIPTURE =
  "And be not conformed to this world: but be ye transformed by the renewing of your mind.";

const bullets = (...items: string[]) => ({
  type: "bulletList",
  content: items.map((text) => ({
    type: "listItem",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  })),
});

const doc = (...paragraphs: string[]) => ({
  type: "doc",
  content: paragraphs.map((text) => ({ type: "paragraph", content: [{ type: "text", text }] })),
});

/** A full sample capsule for a listed one; even parts carry decrees, so both layouts show. */
function toCapsule(c: CapsuleListItem, series: SeriesSummary[]): Capsule {
  const found = series.find((s) => s.title === c.seriesTitle);
  return {
    slug: c.slug,
    title: c.title,
    displayDate: c.displayDate,
    scriptureRef: c.scriptureRef,
    scriptureText: doc(SCRIPTURE),
    bibleMeditation: "Romans 12:1-8",
    body: {
      type: "doc",
      content: [
        ...doc(
          "Sample devotional text for layout purposes. Every day the world presses on us, quietly and constantly, asking us to take its shape.",
        ).content,
        bullets(
          "Renew your mind with the Word.",
          "Refuse the pattern of this world.",
          "Prove what is good and acceptable.",
        ),
        ...doc(
          "Transformation begins in the mind. Not by trying harder, but by letting the Word of God renew the way we think.",
        ).content,
      ],
    },
    decrees:
      (c.partNumber ?? 1) % 2 === 0
        ? [
            "I decree that my mind is renewed daily by the Word of God.",
            "I refuse to be conformed to the pattern of this world.",
          ]
        : [],
    prayer: doc("Father, thank You for Your Word. Renew my mind today. In Jesus’ name, amen."),
    authorSource: "Sample author",
    series: found ? { slug: found.slug, title: found.title } : null,
    partNumber: c.partNumber,
    bannerUrl: null,
  };
}

const link = ({ slug, title, displayDate, scriptureRef }: CapsuleListItem) => ({
  slug,
  title,
  displayDate,
  scriptureRef,
});

const sampleBooks: Book[] = [
  "Alone With God",
  "Divine Help",
  "Holistic Growth",
  "Peak Performance Gateway",
  "Power of Peak Thinking",
  "Rock of Ages",
  "The Control Room",
  "The Inner Life",
  "The Renewed Mind",
  "Thirty Dominion Quotes",
].map((title, i) => ({
  slug: slugOf(title),
  title,
  description: "Sample description of the book, for layout purposes.",
  coverUrl: null,
  purchaseUrl: i % 3 === 0 ? null : "https://example.com/buy",
  publishedYear: 2012 + i,
  kind: (["Book", "Mini-book", "Mini-book", "New Year message"] as const)[i % 4],
  author: "Dr. Adetokunbo O. Ilesanmi",
  sampleUrl: i === 1 ? "https://example.com/sample" : null,
}));

export function createSampleSource(now: () => Date = () => new Date()): DataSource {
  return {
    async latestCapsule() {
      const newest = build(now()).items.sort((a, b) =>
        b.displayDate.localeCompare(a.displayDate),
      )[0];
      return newest ? { ...link(newest), scriptureText: SCRIPTURE } : null;
    },
    async earliestCapsuleDate() {
      const days = build(now())
        .items.map((c) => c.displayDate)
        .sort();
      return days[0] ?? null;
    },
    async capsuleBySlug(slug) {
      const { items, series } = build(now());
      const found = items.find((c) => c.slug === slug);
      return found ? toCapsule(found, series) : null;
    },
    async capsuleByDate(date) {
      const { items, series } = build(now());
      const found = items.find((c) => c.displayDate === date);
      return found ? toCapsule(found, series) : null;
    },
    async capsuleNeighbours(slug) {
      const items = build(now()).items.sort((a, b) => b.displayDate.localeCompare(a.displayDate));
      const i = items.findIndex((c) => c.slug === slug);
      if (i < 0) return null;
      const at = (c: CapsuleListItem | undefined) => (c ? link(c) : null);
      return { prev: at(items[i + 1]), next: at(items[i - 1]) };
    },
    async listCapsulesInMonth(month) {
      return build(now())
        .items.filter((c) => c.displayDate.startsWith(month))
        .sort((a, b) => b.displayDate.localeCompare(a.displayDate));
    },
    async listAllCapsules() {
      return build(now()).items.sort((a, b) => b.displayDate.localeCompare(a.displayDate));
    },
    async listSeries() {
      return build(now()).series;
    },
    async seriesBySlug(slug): Promise<SeriesDetail | null> {
      const { items, series } = build(now());
      const found = series.find((s) => s.slug === slug);
      return found
        ? {
            series: found,
            capsules: inSeriesOrder(items.filter((c) => c.seriesTitle === found.title)),
          }
        : null;
    },
    async listRedirects() {
      return [];
    },
    async contactDetails() {
      return null;
    },
    async listHomepageSections() {
      return [];
    },
    async listBooks() {
      return sampleBooks;
    },
    async listBlogPosts({ limit = 20, offset = 0 } = {}) {
      return sampleBlogPosts.slice(offset, offset + limit).map((b) => ({
        slug: b.slug,
        title: b.title,
        date: b.date,
        excerpt: b.excerpt,
        heroImageUrl: b.heroImageUrl,
        tags: b.tags,
      }));
    },
    async pageBySlug(slug) {
      return slug === "privacy-policy" ? samplePrivacyPolicy : null;
    },
    async blogPostBySlug(slug) {
      return sampleBlogPosts.find((b) => b.slug === slug) ?? null;
    },
    async listEvents(when, limit) {
      const t = now().getTime();
      const over = (e: EventSummary) => new Date(e.endsAt ?? e.startsAt).getTime() < t;
      const rows = [...sampleEventList].filter((e) => over(e) === (when === "past"));
      return rows
        .sort((a, b) => (when === "past" ? -1 : 1) * a.startsAt.localeCompare(b.startsAt))
        .slice(0, limit);
    },
    async eventBySlug(slug) {
      const full = sampleEvents.find((e) => e.slug === slug);
      if (full) return full;
      const listedEvent = sampleEventList.find((e) => e.slug === slug);
      return listedEvent ? eventDetailFromSummary(listedEvent) : null;
    },
  };
}

const sampleEvent: EventDetail = {
  slug: "kingdom-capstone-conference-2027",
  title: "Kingdom Capstone Conference 2027",
  startsAt: "2027-03-12T17:00:00Z",
  endsAt: "2027-03-14T13:00:00Z",
  allDay: false,
  place: "Venue to be announced",
  description: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Three days of teaching, prophecy and intercession." }],
      },
    ],
  },
  imageUrl: null,
  onlineUrl: "https://example.org/live",
  programme:
    "Fri · 6 p.m. · Opening service\nSat · 10 a.m. · Teaching sessions and workshops\nSat · 6 p.m. · Prophetic night",
  relatedPost: null,
};

/** An event with none of the optional parts, to show they are hidden. */
const bareEvent: EventDetail = {
  ...sampleEvent,
  slug: "prayer-night",
  title: "Prayer Night",
  endsAt: null,
  place: null,
  description: null,
  onlineUrl: null,
  programme: null,
};
const sampleEvents = [sampleEvent, bareEvent];

/** Every event in the sample list gets a detail page: the summary becomes the description. */
const eventDetailFromSummary = (e: EventSummary): EventDetail => ({
  slug: e.slug,
  title: e.title,
  startsAt: e.startsAt,
  endsAt: e.endsAt,
  allDay: e.allDay,
  place: e.place,
  description: e.summary
    ? {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: e.summary }] }],
      }
    : null,
  imageUrl: null,
  onlineUrl: e.online ? "https://example.org/live" : null,
  programme: null,
  relatedPost: null,
});

const listed = (
  slug: string,
  title: string,
  startsAt: string,
  endsAt: string | null,
  place: string | null,
  summary: string | null,
  online = false,
): EventSummary => ({ slug, title, startsAt, endsAt, allDay: false, place, summary, online });
const sampleEventList: EventSummary[] = [
  listed(
    "end-of-year-thanksgiving-service",
    "End-of-Year Thanksgiving Service",
    "2026-12-06T09:00:00Z",
    null,
    "Venue to be announced",
    "A morning of thanksgiving for all the Lord has done in 2026.",
  ),
  listed(
    "new-year-prophetic-message-2027",
    "New Year Prophetic Message 2027",
    "2027-01-01T08:00:00Z",
    null,
    null,
    "The word for the year, published on the blog the same day.",
    true,
  ),
  listed(
    "kingdom-capstone-conference-2027",
    "Kingdom Capstone Conference 2027",
    "2027-03-12T17:00:00Z",
    "2027-03-14T13:00:00Z",
    "Venue to be announced",
    "Three days of teaching, prophecy and intercession. Registration opens in January.",
    true,
  ),
  listed(
    "kingdom-capstone-conference-2025",
    "Kingdom Capstone Conference 2025",
    "2025-11-14T17:00:00Z",
    "2025-11-16T13:00:00Z",
    null,
    null,
  ),
  listed(
    "fire-force-convention",
    "FIRE Force Convention",
    "2025-08-15T17:00:00Z",
    null,
    null,
    null,
  ),
  listed("salti-graduation", "SALTI Graduation", "2025-06-14T10:00:00Z", null, null, null),
  listed(
    "new-year-prophetic-message-2025",
    "New Year Prophetic Message 2025",
    "2025-01-01T08:00:00Z",
    null,
    null,
    null,
  ),
];

const para = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
const h2 = (text: string) => ({
  type: "heading",
  attrs: { level: 2 },
  content: [{ type: "text", text }],
});

/** Stand-in for the privacy policy until the admin has published the real one. */
const samplePrivacyPolicy: StaticPage = {
  slug: "privacy-policy",
  title: "Privacy Policy",
  body: {
    type: "doc",
    content: [
      para(
        "Kingdom Capstone Outreach Ministries respects your privacy. This page explains what we collect and why.",
      ),
      h2("What we collect"),
      para(
        "If you subscribe to the daily Capstone Capsule we keep your email address. If you write to us through the contact form we keep your name, email address and message.",
      ),
      h2("How we use it"),
      para(
        "We use your email address to send the Capsule and to reply to you. We do not sell or share it.",
      ),
      h2("Unsubscribing"),
      para(
        "Every email carries a one-click unsubscribe link. Once you unsubscribe we stop sending to that address.",
      ),
    ],
  },
};

export const sampleSource: DataSource = createSampleSource();
