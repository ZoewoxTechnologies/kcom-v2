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

  it("exposes the Lagos display day (23:00 UTC is the next day)", async () => {
    const db = await createTestDb();
    await db.insert(capsules).values({
      title: "t",
      slug: "t",
      body: {},
      status: "published",
      publishAt: new Date("2026-01-01T23:00:00Z"),
    });
    const res = await createApp(db).request("/capsules/latest");
    expect(((await res.json()) as { displayDate: string }).displayDate).toBe("2026-01-02");
  });

  it("404s when there are no capsules", async () => {
    const res = await empty.request("/capsules/latest");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: { code: "not_found", message: "capsule not found" },
    });
  });
});

describe("GET /capsules/:slug", () => {
  it("returns a published capsule", async () => {
    const res = await app.request("/capsules/sample-capsule-3");
    expect(res.status).toBe(200);
    expect(((await res.json()) as { slug: string }).slug).toBe("sample-capsule-3");
  });

  it("400s on an invalid slug with details", async () => {
    const res = await app.request("/capsules/Bad_Slug");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; details: unknown[] } };
    expect(body.error.code).toBe("invalid_request");
    expect(body.error.details).toHaveLength(1);
  });

  it("404s for an unknown slug", async () => {
    expect((await app.request("/capsules/nope")).status).toBe(404);
  });
});

describe("cross-cutting", () => {
  it("404s unknown routes in the error shape", async () => {
    const res = await app.request("/nope");
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("not_found");
  });

  it("sets CORS only for allowed origins", async () => {
    const cors = createApp(await createTestDb(), { corsOrigins: ["http://localhost:4321"] });
    const ok = await cors.request("/health", { headers: { Origin: "http://localhost:4321" } });
    expect(ok.headers.get("access-control-allow-origin")).toBe("http://localhost:4321");
    const bad = await cors.request("/health", { headers: { Origin: "https://evil.example" } });
    expect(bad.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("lets the admin UI preflight PUT writes (homepage layout, page sections, ordering)", async () => {
    const cors = createApp(await createTestDb(), { corsOrigins: ["http://localhost:5173"] });
    const res = await cors.request("/admin/homepage", {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:5173",
        "Access-Control-Request-Method": "PUT",
        "Access-Control-Request-Headers": "content-type",
      },
    });
    expect(res.headers.get("access-control-allow-methods")).toContain("PUT");
  });
});

describe("visibility and errors", () => {
  it("does not return draft, scheduled or future capsules", async () => {
    const db = await createTestDb();
    const base = { body: {}, decrees: [] as string[], publishAt: new Date("2026-01-01T00:00:00Z") };
    await db.insert(capsules).values([
      { ...base, title: "d", slug: "d", status: "draft" },
      { ...base, title: "s", slug: "s", status: "scheduled" },
      {
        ...base,
        title: "f",
        slug: "f",
        status: "published",
        publishAt: new Date("2999-01-01T00:00:00Z"),
      },
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
    expect(await res.json()).toEqual({
      error: { code: "internal_error", message: "internal error" },
    });
    spy.mockRestore();
  });
});
