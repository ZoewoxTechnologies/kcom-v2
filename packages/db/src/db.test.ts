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
  it("ignores drafts, scheduled, future publishAt and future-dated capsules", async () => {
    const d = await createTestDb();
    await d.insert(capsules).values([
      { ...base, title: "draft", slug: "draft", date: "2026-01-01", status: "draft" },
      { ...base, title: "sched", slug: "sched", date: "2026-01-02", status: "scheduled" },
      {
        ...base,
        title: "future-publish",
        slug: "future-publish",
        date: "2026-01-03",
        status: "published",
        publishAt: new Date(Date.now() + 86_400_000),
      },
      {
        ...base,
        title: "future-date",
        slug: "future-date",
        date: "2999-01-01",
        status: "published",
      },
    ]);
    expect(await latestCapsule(d)).toBeNull();
    await d
      .insert(capsules)
      .values({ ...base, title: "ok", slug: "ok", date: "2026-01-04", status: "published" });
    expect((await latestCapsule(d))?.slug).toBe("ok");
  });
});

describe("constraints", () => {
  it("rejects duplicate slug and legacyNid", async () => {
    await db
      .insert(capsules)
      .values({ title: "a", slug: "dup", date: "2026-03-01", body: {}, legacyNid: 99 });
    await expect(
      db.insert(capsules).values({ title: "b", slug: "dup", date: "2026-03-01", body: {} }),
    ).rejects.toThrow();
    await expect(
      db
        .insert(capsules)
        .values({ title: "c", slug: "dup2", date: "2026-03-01", body: {}, legacyNid: 99 }),
    ).rejects.toThrow();
  });

  it("rejects a part number without a series", async () => {
    await expect(
      db
        .insert(capsules)
        .values({ title: "x", slug: "x", date: "2026-02-01", body: {}, partNumber: 1 }),
    ).rejects.toThrow();
  });

  it("accepts a series part", async () => {
    const [s] = await db.insert(series).values({ title: "S", slug: "s" }).returning();
    await db.insert(capsules).values({
      title: "y",
      slug: "y",
      date: "2026-02-01",
      body: {},
      seriesId: s!.id,
      partNumber: 2,
    });
  });

  it("rejects duplicate subscriber emails case-insensitively", async () => {
    await db.insert(subscribers).values({ email: "A@example.com" });
    await expect(db.insert(subscribers).values({ email: "a@example.com" })).rejects.toThrow();
  });

  it("keeps site settings a singleton", async () => {
    await expect(db.insert(siteSettings).values({ id: 2, siteName: "x" })).rejects.toThrow();
  });
});
