import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "./test-db.js";
import { latestCapsule } from "./queries.js";
import { seed } from "./seed-data.js";
import { capsules, series, siteSettings, subscribers } from "./schema.js";

let db: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  db = await createTestDb();
});

describe("seed", () => {
  it("is idempotent and marks capsules as samples", async () => {
    await seed(db);
    await seed(db);
    const rows = await db.select().from(capsules);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.title.startsWith("[SAMPLE]"))).toBe(true);
    expect(await db.select().from(siteSettings)).toHaveLength(1);
  });

  it("latestCapsule returns the newest published capsule", async () => {
    expect((await latestCapsule(db))?.slug).toBe("sample-capsule-3");
  });
});

describe("latestCapsule visibility", () => {
  const base = { body: {}, decrees: [] as string[] };
  const past = new Date("2026-01-01T00:00:00Z");
  it("ignores drafts, scheduled and future publishAt", async () => {
    const d = await createTestDb();
    await d.insert(capsules).values([
      { ...base, title: "draft", slug: "draft", publishAt: past, status: "draft" },
      { ...base, title: "sched", slug: "sched", publishAt: past, status: "scheduled" },
      {
        ...base,
        title: "future-publish",
        slug: "future-publish",
        status: "published",
        publishAt: new Date(Date.now() + 86_400_000),
      },
    ]);
    expect(await latestCapsule(d)).toBeNull();
    await d.insert(capsules).values([
      { ...base, title: "old", slug: "old", status: "published", publishAt: past },
      {
        ...base,
        title: "ok",
        slug: "ok",
        status: "published",
        publishAt: new Date("2026-01-04T00:00:00Z"),
      },
    ]);
    expect((await latestCapsule(d))?.slug).toBe("ok");
  });
});

describe("constraints", () => {
  it("rejects duplicate slug and legacyNid", async () => {
    await db
      .insert(capsules)
      .values({
        title: "a",
        slug: "dup",
        publishAt: new Date("2026-03-01T00:00:00Z"),
        body: {},
        legacyNid: 99,
      });
    await expect(
      db
        .insert(capsules)
        .values({ title: "b", slug: "dup", publishAt: new Date("2026-03-01T00:00:00Z"), body: {} }),
    ).rejects.toThrow();
    await expect(
      db
        .insert(capsules)
        .values({
          title: "c",
          slug: "dup2",
          publishAt: new Date("2026-03-01T00:00:00Z"),
          body: {},
          legacyNid: 99,
        }),
    ).rejects.toThrow();
  });

  it("requires publishAt", async () => {
    await expect(
      db.insert(capsules).values({ title: "n", slug: "no-publish", body: {} } as never),
    ).rejects.toThrow();
  });

  it("rejects bad slugs and blank titles", async () => {
    const ok = { body: {}, publishAt: new Date("2026-02-01T00:00:00Z") };
    await expect(
      db.insert(capsules).values({ ...ok, title: "t", slug: "Bad Slug" }),
    ).rejects.toThrow();
    await expect(
      db.insert(capsules).values({ ...ok, title: "  ", slug: "blank-title" }),
    ).rejects.toThrow();
  });

  it("defaults status to draft and stores the new fields", async () => {
    const [row] = await db
      .insert(capsules)
      .values({
        title: "z",
        slug: "z-fields",
        body: {},
        publishAt: new Date("2026-02-01T00:00:00Z"),
        bibleMeditation: "Romans 12:1-8",
        authorSource: "Someone Else",
      })
      .returning();
    expect(row).toMatchObject({
      status: "draft",
      bibleMeditation: "Romans 12:1-8",
      authorSource: "Someone Else",
      decrees: [],
    });
  });

  it("allows capsules without decrees (defaults to empty list)", async () => {
    const [row] = await db
      .insert(capsules)
      .values({
        title: "nd",
        slug: "no-decrees",
        body: {},
        publishAt: new Date("2026-02-01T00:00:00Z"),
      })
      .returning();
    expect(row!.decrees).toEqual([]);
  });

  it("rejects a part number without a series", async () => {
    await expect(
      db
        .insert(capsules)
        .values({
          title: "x",
          slug: "x",
          publishAt: new Date("2026-02-01T00:00:00Z"),
          body: {},
          partNumber: 1,
        }),
    ).rejects.toThrow();
  });

  it("accepts a series part", async () => {
    const [s] = await db.insert(series).values({ title: "S", slug: "s" }).returning();
    await db.insert(capsules).values({
      title: "y",
      slug: "y",
      publishAt: new Date("2026-02-01T00:00:00Z"),
      body: {},
      seriesId: s!.id,
      partNumber: 2,
    });
  });

  it("rejects duplicate subscriber emails case-insensitively", async () => {
    await db.insert(subscribers).values({ email: "A@example.com" });
    await expect(db.insert(subscribers).values({ email: "a@example.com" })).rejects.toThrow();
  });

  it("rejects malformed settings email and URLs", async () => {
    await expect(db.update(siteSettings).set({ contactEmail: "not-an-email" })).rejects.toThrow();
    await expect(
      db.update(siteSettings).set({ facebookUrl: "javascript:alert(1)" }),
    ).rejects.toThrow();
    await db
      .update(siteSettings)
      .set({ facebookUrl: "https://facebook.com/x", contactEmail: "a@b.org" });
  });

  it("keeps site settings a singleton", async () => {
    await expect(db.insert(siteSettings).values({ id: 2, siteName: "x" })).rejects.toThrow();
  });
});
