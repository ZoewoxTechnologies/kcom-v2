import { beforeAll, describe, expect, it, vi } from "vitest";
import { capsules, type CapsuleDb } from "@kcom/db";
import { createTestDb } from "@kcom/db/test-db";
import { seed } from "@kcom/db/seed-data";
import { createApp } from "./app.js";

let app: ReturnType<typeof createApp>;
let empty: ReturnType<typeof createApp>;
beforeAll(async () => {
  const db = await createTestDb();
  empty = createApp(await createTestDb());
  await seed(db);
  app = createApp(db);
});

describe("GET /health", () => {
  it("returns ok", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});

describe("GET /capsules/latest", () => {
  it("returns the latest seeded capsule", async () => {
    const res = await app.request("/capsules/latest");
    expect(res.status).toBe(200);
    expect(((await res.json()) as { slug: string }).slug).toBe("sample-capsule-3");
  });

  it("404s when there are no capsules", async () => {
    expect((await empty.request("/capsules/latest")).status).toBe(404);
  });
});

describe("visibility and errors", () => {
  it("does not return draft, scheduled or future capsules", async () => {
    const db = await createTestDb();
    const base = { body: {}, decrees: [] as string[], date: "2026-01-01" };
    await db.insert(capsules).values([
      { ...base, title: "d", slug: "d", status: "draft" },
      { ...base, title: "s", slug: "s", status: "scheduled" },
      { ...base, title: "f", slug: "f", status: "published", date: "2999-01-01" },
    ]);
    const res = await createApp(db).request("/capsules/latest");
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("returns JSON 500 when the database fails", async () => {
    const broken = {
      select: () => {
        throw new Error("boom");
      },
    } as unknown as CapsuleDb;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await createApp(broken).request("/capsules/latest");
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "internal error" });
    spy.mockRestore();
  });
});
