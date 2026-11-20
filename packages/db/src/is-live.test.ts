import { describe, expect, it } from "vitest";
import { capsules, books } from "./schema.js";
import { isLive } from "./queries.js";
import { createTestDb } from "./test-db.js";

const body = { type: "doc" };
const past = new Date("2020-01-01T00:00:00Z");
const future = new Date("2999-01-01T00:00:00Z");

describe("isLive", () => {
  it("keeps only published capsules whose publish time has passed", async () => {
    const db = await createTestDb();
    await db.insert(capsules).values([
      { title: "a", slug: "live", body, status: "published", publishAt: past },
      { title: "b", slug: "future", body, status: "published", publishAt: future },
      { title: "c", slug: "draft", body, status: "draft", publishAt: past },
      {
        title: "d",
        slug: "sched",
        body,
        status: "scheduled",
        publishAt: new Date("2020-01-02T00:00:00Z"),
      },
    ]);
    const rows = await db.select({ slug: capsules.slug }).from(capsules).where(isLive(capsules));
    expect(rows).toEqual([{ slug: "live" }]);
  });

  it("treats a null publish time as live when published", async () => {
    const db = await createTestDb();
    await db.insert(books).values([
      { title: "a", slug: "no-date", status: "published", publishAt: null },
      { title: "b", slug: "draft", status: "draft", publishAt: null },
      { title: "c", slug: "later", status: "published", publishAt: future },
    ]);
    const rows = await db.select({ slug: books.slug }).from(books).where(isLive(books));
    expect(rows).toEqual([{ slug: "no-date" }]);
  });
});
