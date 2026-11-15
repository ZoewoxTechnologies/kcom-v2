import { beforeAll, describe, expect, it } from "vitest";
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
