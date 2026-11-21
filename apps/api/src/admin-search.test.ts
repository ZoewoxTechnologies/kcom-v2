import { beforeEach, describe, expect, it } from "vitest";
import { blogPosts, capsules, events } from "@kcom/db";
import { createTestDb } from "@kcom/db/test-db";
import { createApp } from "./app.js";
import { seedUser } from "./seed-users.js";

const PASSWORD = "correct horse battery";
const ORIGIN = "http://admin.test";
const authOpts = { secret: "x".repeat(40), baseURL: "http://api.test" };

let db: Awaited<ReturnType<typeof createTestDb>>;
let app: ReturnType<typeof createApp>;
let cookie: string;

beforeEach(async () => {
  db = await createTestDb();
  await seedUser(db, { email: "editor@example.test", password: PASSWORD, role: "editor" });
  app = createApp(db, { corsOrigins: [ORIGIN], auth: authOpts });
  const res = await app.request("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, "x-forwarded-for": "10.0.0.1" },
    body: JSON.stringify({ email: "editor@example.test", password: PASSWORD }),
  });
  cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
});

const search = (q: string, headers: Record<string, string> = { cookie, origin: ORIGIN }) =>
  app.request(`/admin/search?q=${encodeURIComponent(q)}`, { headers });

describe("GET /admin/search", () => {
  it("finds capsules, blog posts and events by title, case-insensitively", async () => {
    await db.insert(capsules).values({
      title: "Walking in Grace",
      slug: "walking-in-grace",
      publishAt: new Date(),
      body: { type: "doc", content: [] },
    });
    await db.insert(blogPosts).values({
      title: "Grace abounds",
      slug: "grace-abounds",
      date: "2026-01-01",
      body: { type: "doc", content: [] },
    });
    await db
      .insert(events)
      .values({ title: "Prayer night", slug: "prayer-night", startsAt: new Date() });
    const res = await search("GRACE");
    expect(res.status).toBe(200);
    const { items } = (await res.json()) as { items: { kind: string; title: string }[] };
    expect(items.map((i) => i.kind).sort()).toEqual(["blog", "capsule"]);
    expect((await (await search("prayer")).json()).items).toMatchObject([
      { kind: "event", title: "Prayer night" },
    ]);
  });

  it("treats % and _ literally and caps results per kind", async () => {
    await db.insert(events).values(
      Array.from({ length: 8 }, (_, i) => ({
        title: `Meet ${i}`,
        slug: `meet-${i}`,
        startsAt: new Date(),
      })),
    );
    expect(((await (await search("meet")).json()) as { items: unknown[] }).items).toHaveLength(5);
    expect(((await (await search("%")).json()) as { items: unknown[] }).items).toHaveLength(0);
  });

  it("rejects an empty query and anonymous callers", async () => {
    expect((await search("  ")).status).toBe(400);
    expect((await search("x", {})).status).toBe(401);
  });
});
