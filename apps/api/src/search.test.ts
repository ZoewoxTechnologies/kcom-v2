import { beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { blogPosts, books, capsules, events, series } from "@kcom/db";
import { createTestDb } from "@kcom/db/test-db";
import { createApp } from "./app.js";
import { segments, SEARCH_LIMIT, SEARCH_RATE_LIMIT } from "./routes/search.js";

let db: Awaited<ReturnType<typeof createTestDb>>;
let app: ReturnType<typeof createApp>;

const doc = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});
const hour = 3_600_000;
// Capsules are limited to one per Lagos day, so each test capsule gets its own day.
const past = (days = 1) => new Date(Date.now() - days * 24 * hour);
const future = (days = 2) => new Date(Date.now() + days * 24 * hour);

type Hit = {
  type: string;
  url: string;
  title: string;
  date: string | null;
  series: string | null;
  excerpt: { text: string; match: boolean }[];
};
const search = async (q: string, ip = "10.0.0.1") => {
  const res = await app.request(`/search?q=${encodeURIComponent(q)}`, {
    headers: { "x-forwarded-for": ip },
  });
  return { res, hits: res.ok ? ((await res.json()) as { hits: Hit[] }).hits : [] };
};

beforeEach(async () => {
  db = await createTestDb();
  app = createApp(db, { corsOrigins: [] });
});

describe("GET /search", () => {
  it("finds every kind of published content, by title and by body", async () => {
    const [s] = await db
      .insert(series)
      .values({
        title: "Harvest Series",
        slug: "harvest-series",
        description: "Studies in harvest",
      })
      .returning();
    await db.insert(capsules).values({
      title: "Walking in Harvest",
      slug: "walking",
      status: "published",
      publishAt: past(),
      body: doc("renew your mind daily"),
      seriesId: s!.id,
    });
    await db.insert(blogPosts).values({
      title: "Notes",
      slug: "notes",
      date: "2026-02-03",
      status: "published",
      body: doc("harvest abounds"),
    });
    await db
      .insert(events)
      .values({ title: "Harvest night", slug: "night", startsAt: past(), status: "published" });
    await db
      .insert(books)
      .values({ title: "Harvest Book", slug: "gb", status: "published", publishedYear: 2020 });
    const { hits } = await search("harvest");
    expect(hits.map((h) => h.type).sort()).toEqual(["Blog", "Book", "Capsule", "Event", "Series"]);
    expect(hits.find((h) => h.type === "Capsule")).toMatchObject({
      url: "/capsules/walking",
      series: "Harvest Series",
    });
    expect(hits.find((h) => h.type === "Book")).toMatchObject({ url: "/books", date: "2020" });
    expect(hits.find((h) => h.type === "Blog")).toMatchObject({
      url: "/blog/notes",
      date: "2026-02-03",
    });
    // Body text is searchable too, and stemming applies.
    expect((await search("renewing")).hits.map((h) => h.url)).toEqual(["/capsules/walking"]);
  });

  it("only returns published content that is live", async () => {
    await db.insert(capsules).values([
      { title: "Zebra draft", slug: "a", status: "draft", publishAt: past(10), body: doc("x") },
      {
        title: "Zebra scheduled",
        slug: "b",
        status: "scheduled",
        publishAt: future(3),
        body: doc("x"),
      },
      {
        title: "Zebra later",
        slug: "c",
        status: "published",
        publishAt: future(4),
        body: doc("x"),
      },
      { title: "Zebra live", slug: "d", status: "published", publishAt: past(11), body: doc("x") },
    ]);
    await db
      .insert(blogPosts)
      .values({ title: "Zebra blog draft", slug: "e", date: "2026-01-01", body: doc("x") });
    await db.insert(events).values({ title: "Zebra event draft", slug: "f", startsAt: past() });
    await db.insert(books).values({ title: "Zebra book draft", slug: "g" });
    expect((await search("zebra")).hits.map((h) => h.url)).toEqual(["/capsules/d"]);
  });

  it("ranks title matches above body matches", async () => {
    await db.insert(capsules).values([
      {
        title: "Morning light",
        slug: "body",
        status: "published",
        publishAt: past(12),
        body: doc("patience patience patience"),
      },
      {
        title: "Patience",
        slug: "title",
        status: "published",
        publishAt: past(13),
        body: doc("a short word"),
      },
    ]);
    expect((await search("patience")).hits.map((h) => h.url)).toEqual([
      "/capsules/title",
      "/capsules/body",
    ]);
  });

  it("matches Bible references and finds the About pages", async () => {
    await db.insert(capsules).values({
      title: "Renewal",
      slug: "r",
      status: "published",
      publishAt: past(),
      body: doc("x"),
      scriptureRef: "Romans 12:2",
    });
    expect((await search("Romans 12")).hits.map((h) => h.url)).toEqual(["/capsules/r"]);
    expect((await search("intercession")).hits.map((h) => h.url)).toContain("/about/team");
    expect((await search("mandate")).hits[0]).toMatchObject({ type: "Page", url: "/about" });
  });

  it("returns excerpts as plain-text segments with the matches flagged", async () => {
    const text = "Before <script>alert(1)</script> the word mercy appears in this body of text.";
    await db.insert(capsules).values({
      title: "Plain",
      slug: "p",
      status: "published",
      publishAt: past(),
      body: doc(text),
    });
    const [hit] = (await search("mercy")).hits;
    const joined = hit!.excerpt.map((s) => s.text).join("");
    // Markup is dropped from excerpts, and what is left is plain text.
    expect(joined).not.toContain("<");
    expect(joined).toContain("alert(1)");
    expect(hit!.excerpt.filter((s) => s.match).map((s) => s.text)).toEqual(["mercy"]);
    expect(joined).not.toMatch(/[]/);
  });

  it("does not let the match markers be forged from stored text", async () => {
    await db.insert(capsules).values({
      title: "Forge",
      slug: "f",
      status: "published",
      publishAt: past(),
      body: doc("a forged mercy line"),
    });
    const [hit] = (await search("mercy")).hits;
    expect(hit!.excerpt.filter((s) => s.match).map((s) => s.text)).toEqual(["mercy"]);
  });

  it("caps the number of results and caches briefly", async () => {
    await db.insert(events).values(
      Array.from({ length: SEARCH_LIMIT + 5 }, (_, i) => ({
        title: `Gathering ${i}`,
        slug: `g-${i}`,
        startsAt: past(),
        status: "published" as const,
      })),
    );
    const { res, hits } = await search("gathering");
    expect(hits).toHaveLength(SEARCH_LIMIT);
    expect(res.headers.get("cache-control")).toBe("public, max-age=30");
  });

  it("treats odd input as plain words and rejects an empty query", async () => {
    for (const q of ['"', "&|!:*", "the", "a:b'c", "%", "\\"]) {
      const { res, hits } = await search(q);
      expect(res.status, q).toBe(200);
      expect(hits).toEqual([]);
    }
    expect((await search("  ")).res.status).toBe(400);
    expect((await app.request("/search")).status).toBe(400);
    expect((await search("x".repeat(101))).res.status).toBe(400);
  });

  it("limits each client address, and not others", async () => {
    for (let i = 0; i < SEARCH_RATE_LIMIT.max; i++)
      expect((await search("x", "10.0.0.9")).res.status).toBe(200);
    const blocked = await search("x", "10.0.0.9");
    expect(blocked.res.status).toBe(429);
    expect(blocked.res.headers.get("retry-after")).toBeTruthy();
    expect((await search("x", "10.0.0.10")).res.status).toBe(200);
  });

  it("is answered from the full-text indexes", async () => {
    await db.execute(sql`set enable_seqscan = off`);
    const plan = async (query: ReturnType<typeof sql>) => JSON.stringify(await db.execute(query));
    const q = sql`websearch_to_tsquery('english', 'grace')`;
    expect(
      await plan(
        sql`explain select 1 from capsules c where kcom_capsule_tsv(c.title, c.scripture_ref, c.bible_meditation, c.body, c.scripture_text, c.prayer, c.decrees) @@ ${q}`,
      ),
    ).toContain("capsules_search_idx");
    expect(
      await plan(
        sql`explain select 1 from blog_posts b where kcom_blog_tsv(b.title, b.excerpt, b.tags, b.body) @@ ${q}`,
      ),
    ).toContain("blog_posts_search_idx");
    expect(
      await plan(
        sql`explain select 1 from events e where kcom_event_tsv(e.title, e.place, e.description, e.programme) @@ ${q}`,
      ),
    ).toContain("events_search_idx");
    expect(
      await plan(
        sql`explain select 1 from books k where kcom_book_tsv(k.title, k.description) @@ ${q}`,
      ),
    ).toContain("books_search_idx");
    expect(
      await plan(
        sql`explain select 1 from series r where kcom_series_tsv(r.title, r.description) @@ ${q}`,
      ),
    ).toContain("series_search_idx");
  });
});

describe("segments", () => {
  it("splits on the match markers", () => {
    expect(segments("a b c")).toEqual([
      { text: "a ", match: false },
      { text: "b", match: true },
      { text: " c", match: false },
    ]);
    expect(segments("")).toEqual([]);
  });
});
