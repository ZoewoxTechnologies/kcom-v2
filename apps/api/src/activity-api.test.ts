import { beforeEach, describe, expect, it } from "vitest";
import { blogPosts, contactMessages, subscribers } from "@kcom/db";
import { createTestDb } from "@kcom/db/test-db";
import { createApp } from "./app.js";
import { shortName } from "./routes/admin-activity.js";
import { seedUser } from "./seed-users.js";

const PASSWORD = "correct horse battery";
const ORIGIN = "http://admin.test";
let db: Awaited<ReturnType<typeof createTestDb>>;
let app: ReturnType<typeof createApp>;
let editor: string;

beforeEach(async () => {
  db = await createTestDb();
  await seedUser(db, { email: "editor@example.test", password: PASSWORD, role: "editor" });
  app = createApp(db, {
    corsOrigins: [ORIGIN],
    auth: { secret: "x".repeat(40), baseURL: "http://api.test" },
  });
  const res = await app.request("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, "x-forwarded-for": "10.0.0.1" },
    body: JSON.stringify({ email: "editor@example.test", password: PASSWORD }),
  });
  editor = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
});

const get = (cookie: string | null) =>
  app.request("/admin/activity", { headers: { origin: ORIGIN, ...(cookie ? { cookie } : {}) } });

describe("GET /admin/activity", () => {
  it("needs a session", async () => {
    expect((await get(null)).status).toBe(401);
  });

  it("is empty with no activity", async () => {
    expect(await (await get(editor)).json()).toEqual({ items: [] });
  });

  it("merges content edits, subscribers and messages, newest first", async () => {
    await db.insert(blogPosts).values({
      title: "Hello",
      slug: "hello",
      date: "2026-11-01",
      body: { type: "doc", content: [] } as never,
      createdAt: new Date("2026-11-01T08:00:00Z"),
      updatedAt: new Date("2026-11-02T08:00:00Z"),
    });
    await db.insert(subscribers).values({
      email: "g@example.org",
      name: "Grace Adeyemi",
      status: "confirmed",
      confirmedAt: new Date("2026-11-03T09:12:00Z"),
    });
    await db.insert(subscribers).values({ email: "p@example.org", status: "pending" });
    await db.insert(contactMessages).values({
      topic: "prayer",
      name: "A",
      email: "a@example.org",
      message: "Pray",
      createdAt: new Date("2026-11-04T08:00:00Z"),
    });
    const { items } = (await (await get(editor)).json()) as {
      items: { text: string; badge: string | null; href: string | null }[];
    };
    expect(items.map((i) => i.text)).toEqual([
      "Contact: a prayer request",
      "Grace A. subscribed",
      "Blog post updated: Hello",
    ]);
    expect(items[0]!.badge).toBe("New");
    expect(items[2]!.href).toMatch(/^\/blog\//);
  });
});

describe("shortName", () => {
  it("keeps the first name and last initial", () => {
    expect(shortName("Grace Adeyemi")).toBe("Grace A.");
    expect(shortName("Grace")).toBe("Grace");
    expect(shortName(null)).toBe("Someone");
  });
});
