import { beforeEach, describe, expect, it } from "vitest";
import { contactMessages } from "@kcom/db";
import { createTestDb } from "@kcom/db/test-db";
import { createApp } from "./app.js";
import { seedUser } from "./seed-users.js";

const PASSWORD = "correct horse battery";
const ORIGIN = "http://admin.test";
const authOpts = { secret: "x".repeat(40), baseURL: "http://api.test" };

type Msg = { id: string; topic: string; name: string; status: string; keepPrivate: boolean };
type List = { items: Msg[]; total: number };

let app: ReturnType<typeof createApp>;
let db: Awaited<ReturnType<typeof createTestDb>>;
let editor: string;
let admin: string;
let ids: Record<string, string>;

async function signIn(email: string) {
  const res = await app.request("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, "x-forwarded-for": "10.0.0.3" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  return res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
}

const call = (path: string, cookie: string | null, method = "GET", body?: unknown) =>
  app.request(`/admin/contact-messages${path}`, {
    method,
    headers: {
      origin: ORIGIN,
      ...(cookie ? { cookie } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const list = async (path: string, cookie: string) => (await (await call(path, cookie)).json()) as List;

beforeEach(async () => {
  db = await createTestDb();
  await seedUser(db, { email: "admin@example.test", password: PASSWORD, role: "admin" });
  await seedUser(db, { email: "editor@example.test", password: PASSWORD, role: "editor" });
  app = createApp(db, { corsOrigins: [ORIGIN], auth: authOpts });
  editor = await signIn("editor@example.test");
  admin = await signIn("admin@example.test");
  const base = { email: "a@example.org", message: "Hello" };
  const seed = async (key: string, v: Partial<typeof contactMessages.$inferInsert>, minute: number) => {
    const [row] = await db
      .insert(contactMessages)
      .values({ ...base, name: key, topic: "question", ...v, createdAt: new Date(2026, 0, 1, 10, minute) })
      .returning({ id: contactMessages.id });
    ids = { ...ids, [key]: row!.id };
  };
  ids = {};
  await seed("oldest", {}, 1);
  await seed("prayer", { topic: "prayer" }, 2);
  await seed("secret", { topic: "prayer", keepPrivate: true }, 3);
  await seed("read", { topic: "testimony", status: "read" }, 4);
});

describe("admin contact inbox", () => {
  it("requires sign-in", async () => {
    expect((await call("", null)).status).toBe(401);
    expect((await call("/unread-count", null)).status).toBe(401);
    expect((await call(`/${ids.oldest}`, null, "PATCH", { status: "read" })).status).toBe(401);
  });

  it("lists newest first and paginates", async () => {
    const all = await list("", admin);
    expect(all.items.map((m) => m.name)).toEqual(["read", "secret", "prayer", "oldest"]);
    expect(all.total).toBe(4);
    const page = await list("?limit=2&offset=2", admin);
    expect(page.items.map((m) => m.name)).toEqual(["prayer", "oldest"]);
    expect(page.total).toBe(4);
    expect((await call("?limit=0", admin)).status).toBe(400);
  });

  it("filters by status and topic", async () => {
    expect((await list("?status=new", admin)).items.map((m) => m.name)).toEqual(["secret", "prayer", "oldest"]);
    expect((await list("?status=read", admin)).items.map((m) => m.name)).toEqual(["read"]);
    expect((await list("?topic=prayer", admin)).items.map((m) => m.name)).toEqual(["secret", "prayer"]);
    const both = await list("?topic=prayer&status=read", admin);
    expect(both).toEqual({ items: [], total: 0 });
    expect((await call("?topic=nope", admin)).status).toBe(400);
  });

  it("hides private messages without prayer:read, everywhere", async () => {
    const seen = await list("", editor);
    expect(seen.items.map((m) => m.name)).toEqual(["read", "prayer", "oldest"]);
    expect(seen.total).toBe(3);
    expect((await list("?topic=prayer", editor)).items.map((m) => m.name)).toEqual(["prayer"]);
    expect((await call(`/${ids.secret}`, editor)).status).toBe(404);
    expect((await call(`/${ids.secret}`, editor, "PATCH", { status: "read" })).status).toBe(404);
    expect(((await (await call("/unread-count", editor)).json()) as { unread: number }).unread).toBe(2);
  });

  it("shows private messages to the prayer team", async () => {
    const res = await call(`/${ids.secret}`, admin);
    expect(res.status).toBe(200);
    expect(((await res.json()) as Msg).keepPrivate).toBe(true);
    expect(((await (await call("/unread-count", admin)).json()) as { unread: number }).unread).toBe(3);
  });

  it("gets one message and 404s for unknown ids", async () => {
    const msg = (await (await call(`/${ids.oldest}`, editor)).json()) as Msg & { message: string; email: string };
    expect(msg).toMatchObject({ name: "oldest", message: "Hello", email: "a@example.org" });
    expect((await call("/00000000-0000-4000-8000-000000000000", editor)).status).toBe(404);
    expect((await call("/not-a-uuid", editor)).status).toBe(400);
  });

  it("marks a message read and unread again", async () => {
    const read = await call(`/${ids.oldest}`, editor, "PATCH", { status: "read" });
    expect(read.status).toBe(200);
    expect(((await read.json()) as Msg).status).toBe("read");
    expect(((await (await call("/unread-count", editor)).json()) as { unread: number }).unread).toBe(1);
    const unread = await call(`/${ids.oldest}`, editor, "PATCH", { status: "new" });
    expect(((await unread.json()) as Msg).status).toBe("new");
    expect((await call(`/${ids.oldest}`, editor, "PATCH", { status: "bogus" })).status).toBe(400);
  });
});
