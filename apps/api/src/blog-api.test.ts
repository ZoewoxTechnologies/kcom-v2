import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@kcom/db/test-db";
import { createApp } from "./app.js";
import { seedUser } from "./seed-users.js";

const PASSWORD = "correct horse battery";
const ORIGIN = "http://admin.test";
const authOpts = { secret: "x".repeat(40), baseURL: "http://api.test" };
const doc = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

let app: ReturnType<typeof createApp>;
let editor: string;

beforeEach(async () => {
  const db = await createTestDb();
  await seedUser(db, { email: "editor@example.test", password: PASSWORD, role: "editor" });
  app = createApp(db, { corsOrigins: [ORIGIN], auth: authOpts });
  const res = await app.request("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, "x-forwarded-for": "10.0.0.2" },
    body: JSON.stringify({ email: "editor@example.test", password: PASSWORD }),
  });
  editor = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
});

const send = (method: string, path: string, body?: unknown, cookie: string | null = editor) =>
  app.request(path, {
    method,
    headers: {
      origin: ORIGIN,
      ...(cookie ? { cookie } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const post = { title: "Hello", slug: "hello", date: "2026-01-02", body: doc("hi") };
const ID = "00000000-0000-4000-8000-000000000000";

describe("admin blog", () => {
  it("requires sign-in on every route", async () => {
    for (const [m, p] of [
      ["GET", "/admin/blog"],
      ["GET", `/admin/blog/${ID}`],
      ["POST", "/admin/blog"],
      ["PATCH", `/admin/blog/${ID}`],
      ["DELETE", `/admin/blog/${ID}`],
    ] as const) {
      const res = await send(m, p, m === "GET" || m === "DELETE" ? undefined : {}, null);
      expect(res.status, `${m} ${p}`).toBe(401);
    }
  });

  it("supports editor CRUD with no-store responses", async () => {
    const created = await send("POST", "/admin/blog", post);
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as { id: string };

    const list = await send("GET", "/admin/blog");
    expect(list.headers.get("cache-control")).toBe("no-store");
    expect(await list.json()).toMatchObject({ total: 1, items: [{ id, status: "draft" }] });
    expect((await send("GET", `/admin/blog/${id}`)).status).toBe(200);

    const patched = await send("PATCH", `/admin/blog/${id}`, { title: "Renamed" });
    expect(await patched.json()).toMatchObject({ title: "Renamed", slug: "hello" });

    expect((await send("DELETE", `/admin/blog/${id}`)).status).toBe(204);
    expect((await send("GET", `/admin/blog/${id}`)).status).toBe(404);
    expect((await send("DELETE", `/admin/blog/${id}`)).status).toBe(404);
  });

  it("filters the admin list by status and paginates", async () => {
    await send("POST", "/admin/blog", post);
    await send("POST", "/admin/blog", { ...post, slug: "two", status: "published" });
    const drafts = await (await send("GET", "/admin/blog?status=draft")).json();
    expect(drafts).toMatchObject({ total: 1, items: [{ slug: "hello" }] });
    const page = await (await send("GET", "/admin/blog?limit=1&offset=1")).json();
    expect(page).toMatchObject({ total: 2 });
    expect((page as { items: unknown[] }).items).toHaveLength(1);
  });

  it("rejects invalid input with 400", async () => {
    for (const bad of [
      { ...post, slug: "Not A Slug" },
      { title: "" },
      { ...post, title: "x".repeat(201) },
      { ...post, excerpt: "x".repeat(501) },
      { ...post, tags: Array.from({ length: 21 }, (_, i) => `t${i}`) },
      { ...post, heroImageUrl: "javascript:alert(1)" },
      { ...post, unknown: 1 },
      { ...post, status: "bogus" },
    ]) {
      expect(
        (await send("POST", "/admin/blog", bad)).status,
        JSON.stringify(bad).slice(0, 60),
      ).toBe(400);
    }
    expect((await send("PATCH", "/admin/blog/not-a-uuid", { title: "a" })).status).toBe(400);
    expect((await send("PATCH", `/admin/blog/${ID}`, {})).status).toBe(400);
    expect((await send("PATCH", `/admin/blog/${ID}`, { title: "a" })).status).toBe(404);
  });

  it("sanitises rich text before storing it", async () => {
    const dirty = {
      type: "doc",
      content: [
        { type: "script", content: [] },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "x", marks: [{ type: "link", attrs: { href: "javascript:1" } }] },
          ],
        },
      ],
    };
    const res = await send("POST", "/admin/blog", { ...post, body: dirty });
    expect(((await res.json()) as { body: unknown }).body).toEqual({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "x" }] }],
    });
    expect(
      (await send("POST", "/admin/blog", { ...post, slug: "b", body: { type: "p" } })).status,
    ).toBe(400);
  });

  it("rejects a duplicate slug with 409", async () => {
    expect((await send("POST", "/admin/blog", post)).status).toBe(201);
    expect((await send("POST", "/admin/blog", post)).status).toBe(409);
  });
});

describe("public blog", () => {
  it("hides drafts and future-dated posts, and is cacheable", async () => {
    const created = await send("POST", "/admin/blog", post);
    const { id } = (await created.json()) as { id: string };
    const pub = (p = "") => send("GET", `/blog${p}`, undefined, null);

    expect(await (await pub()).json()).toEqual([]);
    expect((await pub("/hello")).status).toBe(404);

    await send("PATCH", `/admin/blog/${id}`, {
      status: "published",
      publishAt: "2999-01-01T00:00:00Z",
    });
    expect(await (await pub()).json()).toEqual([]);
    expect((await pub("/hello")).status).toBe(404);

    await send("PATCH", `/admin/blog/${id}`, { publishAt: null });
    const list = await pub();
    expect(list.headers.get("cache-control")).toBe("public, max-age=60");
    expect(await list.json()).toHaveLength(1);
    expect((await pub("/hello")).status).toBe(200);
  });
});
