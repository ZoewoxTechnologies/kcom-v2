import { beforeEach, describe, expect, it } from "vitest";
import { activityLog, contactMessages, subscribers } from "@kcom/db";
import { asc } from "drizzle-orm";
import { createTestDb } from "@kcom/db/test-db";
import { createApp } from "./app.js";
import { contactHref, shortName } from "./routes/admin-activity.js";
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
    await db.insert(activityLog).values({
      userName: "Grace Adeyemi",
      action: "update",
      entityType: "blog",
      entityId: "11111111-1111-4111-8111-111111111111",
      title: "Hello",
      at: new Date("2026-11-02T08:00:00Z"),
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
      "Grace A. updated blog post: Hello",
    ]);
    expect(items[0]!.badge).toBe("New");
    expect(items[0]!.href).toBe("/inbox");
    expect(items[2]!.href).toMatch(/^\/blog\//);
  });
});

const send = (cookie: string, method: string, path: string, body?: unknown, extra = {}) =>
  app.request(`/admin${path}`, {
    method,
    headers: { origin: ORIGIN, cookie, "content-type": "application/json", ...extra },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const logRows = () => db.select().from(activityLog).orderBy(asc(activityLog.at));
const post = (title: string) => ({
  title,
  slug: title.toLowerCase().replace(/\W+/g, "-"),
  date: "2026-11-01",
  body: { type: "doc", content: [] },
});

describe("activity log writes", () => {
  it("records create, update, publish, unpublish and delete with who did it", async () => {
    const created = (await (await send(editor, "POST", "/blog", post("Hello"))).json()) as {
      id: string;
    };
    // Separate rows need different actions: update, publish, unpublish, delete.
    await send(editor, "PATCH", `/blog/${created.id}`, { title: "Hello again" });
    await send(editor, "PATCH", `/blog/${created.id}`, { status: "published" });
    await send(editor, "PATCH", `/blog/${created.id}`, { status: "draft" });
    await send(editor, "DELETE", `/blog/${created.id}`);
    const rows = await logRows();
    expect(rows.map((r) => r.action)).toEqual([
      "create",
      "update",
      "publish",
      "unpublish",
      "delete",
    ]);
    expect(rows.every((r) => r.entityType === "blog" && r.entityId === created.id)).toBe(true);
    expect(new Set(rows.map((r) => r.userName))).toEqual(new Set(["editor"]));
    expect(rows.every((r) => r.userId)).toBe(true);
    expect(rows.map((r) => r.title)).toEqual([
      "Hello",
      "Hello again",
      "Hello again",
      "Hello again",
      "Hello again",
    ]);
    const feed = (await (await get(editor)).json()) as {
      items: { text: string; href: string | null }[];
    };
    expect(feed.items[0]!.text).toMatch(/deleted blog post: Hello again$/);
    expect(feed.items[0]!.href).toBeNull();
  });

  it("merges a repeat edit of the same item by the same person within 10 minutes", async () => {
    const created = (await (await send(editor, "POST", "/blog", post("Hello"))).json()) as {
      id: string;
    };
    await send(editor, "PATCH", `/blog/${created.id}`, { title: "One" });
    await send(editor, "PATCH", `/blog/${created.id}`, { title: "Two" });
    await send(editor, "PATCH", `/blog/${created.id}`, { title: "Three" });
    const updates = (await logRows()).filter((r) => r.action === "update");
    expect(updates).toHaveLength(1);
    expect(updates[0]!.title).toBe("Three");
  });

  it("adds a new row once the 10 minutes have passed", async () => {
    const created = (await (await send(editor, "POST", "/blog", post("Hello"))).json()) as {
      id: string;
    };
    await send(editor, "PATCH", `/blog/${created.id}`, { title: "One" });
    await db.update(activityLog).set({ at: new Date(Date.now() - 11 * 60 * 1000) });
    await send(editor, "PATCH", `/blog/${created.id}`, { title: "Two" });
    expect((await logRows()).filter((r) => r.action === "update")).toHaveLength(2);
  });

  it("does not merge across people or items", async () => {
    await seedUser(db, { email: "other@example.test", password: PASSWORD, role: "editor" });
    const res = await app.request("/api/auth/sign-in/email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: ORIGIN,
        "x-forwarded-for": "10.0.0.2",
      },
      body: JSON.stringify({ email: "other@example.test", password: PASSWORD }),
    });
    const other = res.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    const a = (await (await send(editor, "POST", "/blog", post("A"))).json()) as { id: string };
    const b = (await (await send(editor, "POST", "/blog", post("B"))).json()) as { id: string };
    await send(editor, "PATCH", `/blog/${a.id}`, { title: "A2" });
    await send(editor, "PATCH", `/blog/${b.id}`, { title: "B2" });
    await send(other, "PATCH", `/blog/${a.id}`, { title: "A3" });
    expect((await logRows()).filter((r) => r.action === "update")).toHaveLength(3);
  });

  it("skips autosaves and failed writes", async () => {
    const created = (await (await send(editor, "POST", "/blog", post("Hello"))).json()) as {
      id: string;
    };
    await send(editor, "PATCH", `/blog/${created.id}`, { title: "Draft" }, { "x-autosave": "1" });
    expect((await send(editor, "PATCH", `/blog/${created.id}`, { nope: 1 })).status).toBe(400);
    expect((await send(editor, "POST", "/blog", { title: "" })).status).toBe(400);
    expect((await logRows()).map((r) => r.action)).toEqual(["create"]);
  });

  it("logs capsule and series changes too", async () => {
    const cap = await send(editor, "POST", "/capsules", {
      title: "Day one",
      slug: "day-one",
      scriptureRef: "John 1:1",
      body: { type: "doc", content: [] },
    });
    expect(cap.status).toBe(201);
    const ser = await send(editor, "POST", "/series", { title: "Faith", slug: "faith" });
    expect(ser.status).toBe(201);
    expect((await logRows()).map((r) => [r.entityType, r.action])).toEqual([
      ["capsule", "create"],
      ["series", "create"],
    ]);
  });
});

describe("contactHref", () => {
  it("links the inbox only for roles that can read it", () => {
    expect(contactHref("editor")).toBe("/inbox");
    expect(contactHref("nobody" as never)).toBeNull();
  });
});

describe("shortName", () => {
  it("keeps the first name and last initial", () => {
    expect(shortName("Grace Adeyemi")).toBe("Grace A.");
    expect(shortName("Grace")).toBe("Grace");
    expect(shortName(null)).toBe("Someone");
  });
});
