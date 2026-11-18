import { beforeEach, describe, expect, it } from "vitest";
import { books, people } from "@kcom/db";
import { createTestDb } from "@kcom/db/test-db";
import { createApp } from "./app.js";
import { seedUser } from "./seed-users.js";

const PASSWORD = "correct horse battery";
const ORIGIN = "http://admin.test";
const authOpts = { secret: "x".repeat(40), baseURL: "http://api.test" };

let db: Awaited<ReturnType<typeof createTestDb>>;
let app: ReturnType<typeof createApp>;
let editor: string;

async function signIn(email: string) {
  const res = await app.request("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, "x-forwarded-for": "10.0.0.1" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  expect(res.status).toBe(200);
  return res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

const admin = (path: string, init: RequestInit & { json?: unknown } = {}) =>
  app.request(`/admin/books${path}`, {
    ...init,
    headers: {
      cookie: editor,
      origin: ORIGIN,
      ...(init.json ? { "content-type": "application/json" } : {}),
    },
    body: init.json ? JSON.stringify(init.json) : undefined,
  });

beforeEach(async () => {
  db = await createTestDb();
  await seedUser(db, { email: "editor@example.test", password: PASSWORD, role: "editor" });
  app = createApp(db, { corsOrigins: [ORIGIN], auth: authOpts });
  editor = await signIn("editor@example.test");
});

const sample = { title: "A Book", slug: "a-book" };

describe("GET /books (public)", () => {
  it("lists only published, non-scheduled books and is cacheable", async () => {
    await db.insert(books).values([
      { title: "Live", slug: "live", status: "published" },
      { title: "Draft", slug: "draft", status: "draft" },
      { title: "Scheduled", slug: "scheduled", status: "scheduled" },
      {
        title: "Future",
        slug: "future",
        status: "published",
        publishAt: new Date(Date.now() + 86_400_000),
      },
    ]);
    const res = await app.request("/books");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, max-age=60");
    expect(((await res.json()) as { slug: string }[]).map((b) => b.slug)).toEqual(["live"]);
  });

  it("hides drafts by slug", async () => {
    await db.insert(books).values([
      { title: "Draft", slug: "draft" },
      { title: "Live", slug: "live", status: "published" },
    ]);
    expect((await app.request("/books/draft")).status).toBe(404);
    const res = await app.request("/books/live");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, max-age=60");
  });
});

describe("/admin/books auth", () => {
  it("is 401 anonymous, for every method", async () => {
    for (const [method, path] of [
      ["GET", "/admin/books"],
      ["POST", "/admin/books"],
      ["PATCH", "/admin/books/x"],
      ["DELETE", "/admin/books/x"],
    ]) {
      const res = await app.request(path!, { method });
      expect(res.status, `${method} ${path}`).toBe(401);
    }
  });
});

describe("/admin/books CRUD", () => {
  it("sanitises rich-text descriptions", async () => {
    const description = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "hi",
              marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
            },
          ],
        },
        { type: "script", content: [] },
      ],
    };
    const res = await admin("", { method: "POST", json: { ...sample, description } });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { description: unknown };
    expect(JSON.stringify(body.description)).not.toMatch(/javascript|script/);
    const bad = await admin("", {
      method: "POST",
      json: { ...sample, slug: "b2", description: "<b>x</b>" },
    });
    expect(bad.status).toBe(400);
  });

  it("creates, reads, updates and deletes, with no-store", async () => {
    const created = await admin("", { method: "POST", json: sample });
    expect(created.status).toBe(201);
    expect(created.headers.get("cache-control")).toBe("no-store");
    const book = (await created.json()) as { id: string; status: string };
    expect(book.status).toBe("draft");

    const list = (await (await admin("")).json()) as { items: unknown[]; total: number };
    expect(list.total).toBe(1); // drafts included
    expect(list.items).toHaveLength(1);

    const updated = await admin(`/${book.id}`, {
      method: "PATCH",
      json: { status: "published", purchaseUrl: "https://example.test/buy" },
    });
    expect(updated.status).toBe(200);
    expect(((await updated.json()) as { status: string }).status).toBe("published");
    expect((await app.request("/books/a-book")).status).toBe(200);

    expect((await admin(`/${book.id}`)).status).toBe(200);
    expect((await admin(`/${book.id}`, { method: "DELETE" })).status).toBe(204);
    expect((await admin(`/${book.id}`)).status).toBe(404);
    expect((await admin(`/${book.id}`, { method: "DELETE" })).status).toBe(404);
  });

  it("validates input", async () => {
    for (const bad of [
      {},
      { ...sample, slug: "Bad Slug" },
      { ...sample, coverUrl: "javascript:alert(1)" },
      { ...sample, status: "nope" },
      { ...sample, publishedYear: 1.5 },
      { ...sample, title: "x".repeat(201) },
      { ...sample, unknown: true },
    ]) {
      const res = await admin("", { method: "POST", json: bad });
      expect(res.status, JSON.stringify(bad)).toBe(400);
    }
    expect((await admin("/not-a-uuid")).status).toBe(400);
  });

  it("rejects duplicate slugs and unknown authors", async () => {
    expect((await admin("", { method: "POST", json: sample })).status).toBe(201);
    expect((await admin("", { method: "POST", json: sample })).status).toBe(409);
    const res = await admin("", {
      method: "POST",
      json: { title: "Other", slug: "other", authorId: crypto.randomUUID() },
    });
    expect(res.status).toBe(422);
  });

  it("accepts an existing author and keeps the slug on self-update", async () => {
    const [person] = await db.insert(people).values({ name: "Author" }).returning();
    const res = await admin("", { method: "POST", json: { ...sample, authorId: person!.id } });
    expect(res.status).toBe(201);
    const book = (await res.json()) as { id: string };
    const patch = await admin(`/${book.id}`, { method: "PATCH", json: { slug: "a-book" } });
    expect(patch.status).toBe(200);
  });
});
