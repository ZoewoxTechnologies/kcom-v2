import { describe, expect, it } from "vitest";
import { redirects } from "@kcom/db";
import { createTestDb } from "@kcom/db/test-db";
import { createApp } from "./app.js";

describe("GET /redirects", () => {
  it("lists every redirect with a short public cache", async () => {
    const db = await createTestDb();
    await db.insert(redirects).values([
      { fromPath: "/node/2", toPath: "/blog/b", status: 301 },
      { fromPath: "/content/a", toPath: "/capsules/a" },
    ]);
    const app = createApp(db, { corsOrigins: [], auth: { secret: "x".repeat(40), baseURL: "http://api.test" } });
    const res = await app.request("/redirects");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("max-age=60");
    expect(await res.json()).toEqual([
      { from: "/content/a", to: "/capsules/a", status: 301 },
      { from: "/node/2", to: "/blog/b", status: 301 },
    ]);
  });
});
