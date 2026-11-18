import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@kcom/db/test-db";
import { createApp } from "./app.js";
import { rolePermissions } from "./permissions.js";
import { seedUser } from "./seed-users.js";

const PASSWORD = "correct horse battery";
const ORIGIN = "http://admin.test";
const authOpts = { secret: "x".repeat(40), baseURL: "http://api.test" };

const doc = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

type Ev = { id: string; title: string; slug: string; status: string };
const json = async <T = Ev>(res: Response) => (await res.json()) as T;

let app: ReturnType<typeof createApp>;
let editor: string;
let admin: string;

async function signIn(email: string) {
  const res = await app.request("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, "x-forwarded-for": "10.0.0.2" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  return res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

const call = (path: string, cookie: string | null, method = "GET", body?: unknown) =>
  app.request(path, {
    method,
    headers: {
      origin: ORIGIN,
      ...(cookie ? { cookie } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const FUTURE = "2099-01-01T10:00:00Z";
const PAST = "2000-01-01T10:00:00Z";
const valid = (over: Record<string, unknown> = {}) => ({
  title: "Prayer night",
  slug: "prayer-night",
  startsAt: FUTURE,
  ...over,
});

beforeEach(async () => {
  const db = await createTestDb();
  await seedUser(db, { email: "admin@example.test", password: PASSWORD, role: "admin" });
  await seedUser(db, { email: "editor@example.test", password: PASSWORD, role: "editor" });
  app = createApp(db, { corsOrigins: [ORIGIN], auth: authOpts });
  editor = await signIn("editor@example.test");
  admin = await signIn("admin@example.test");
});

describe("admin events", () => {
  it("requires sign-in", async () => {
    expect((await call("/admin/events", null)).status).toBe(401);
    expect((await call("/admin/events", null, "POST", valid())).status).toBe(401);
  });

  it("creates a draft, reads, updates, lists and deletes", async () => {
    const created = await call("/admin/events", editor, "POST", valid({ description: doc("hi") }));
    expect(created.status).toBe(201);
    const ev = await json(created);
    expect(ev.status).toBe("draft");

    const patched = await call(`/admin/events/${ev.id}`, editor, "PATCH", { title: "Day" });
    expect((await json(patched)).title).toBe("Day");
    expect((await json(await call(`/admin/events/${ev.id}`, editor))).title).toBe("Day");

    const list = await json<{ items: Ev[]; total: number }>(await call("/admin/events", editor));
    expect(list.total).toBe(1);
    expect(list.items).toHaveLength(1);

    expect((await call(`/admin/events/${ev.id}`, editor, "DELETE")).status).toBe(204);
    expect((await call(`/admin/events/${ev.id}`, editor)).status).toBe(404);
  });

  it("validates input strictly", async () => {
    const bad = async (over: Record<string, unknown>) =>
      (await call("/admin/events", editor, "POST", valid(over))).status;
    expect(await bad({ title: "" })).toBe(400);
    expect(await bad({ endsAt: PAST })).toBe(400);
    expect(await bad({ imageUrl: "javascript:alert(1)" })).toBe(400);
    expect(await bad({ status: "scheduled" })).toBe(400);
    expect(await bad({ extra: 1 })).toBe(400);
    expect((await call("/admin/events/not-a-uuid", editor, "PATCH", { title: "x" })).status).toBe(
      400,
    );
  });

  it("422s when a patch moves the end before the start", async () => {
    const ev = await json(
      await call("/admin/events", editor, "POST", valid({ endsAt: "2099-01-02T10:00:00Z" })),
    );
    const res = await call(`/admin/events/${ev.id}`, editor, "PATCH", { endsAt: PAST });
    expect(res.status).toBe(422);
  });

  it("409s on a duplicate slug", async () => {
    await call("/admin/events", editor, "POST", valid());
    expect((await call("/admin/events", editor, "POST", valid())).status).toBe(409);
  });

  it("applies the publish rule", async () => {
    const original = rolePermissions.editor;
    rolePermissions.editor = ["content:read", "content:write"];
    try {
      await publishRule();
    } finally {
      rolePermissions.editor = original;
    }
  });

  async function publishRule() {
    expect(
      (await call("/admin/events", editor, "POST", valid({ status: "published" }))).status,
    ).toBe(403);
    const ev = await json(
      await call("/admin/events", admin, "POST", valid({ status: "published" })),
    );
    expect(ev.status).toBe("published");
    expect((await call(`/admin/events/${ev.id}`, editor, "PATCH", { title: "x" })).status).toBe(
      403,
    );
    expect((await call(`/admin/events/${ev.id}`, editor, "DELETE")).status).toBe(403);
    expect((await call(`/admin/events/${ev.id}`, admin, "DELETE")).status).toBe(204);
  }
});

describe("public events", () => {
  it("lists only published events, split into upcoming and past, and serves detail by slug", async () => {
    const mk = (slug: string, startsAt: string, status: string) =>
      call("/admin/events", admin, "POST", valid({ title: slug, slug, startsAt, status }));
    await mk("soon", FUTURE, "published");
    await mk("done", PAST, "published");
    await mk("hidden", FUTURE, "draft");
    await call("/admin/events", admin, "POST", {
      ...valid({ title: "now", slug: "now", startsAt: PAST, status: "published" }),
      endsAt: FUTURE,
    });

    const res = await call("/events", null);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, max-age=60");
    const slugs = async (when: string) =>
      (await json<Ev[]>(await call(`/events?when=${when}`, null))).map((e) => e.slug);
    expect(await slugs("upcoming")).toEqual(["now", "soon"]);
    expect(await slugs("past")).toEqual(["done"]);
    expect((await call("/events?when=never", null)).status).toBe(400);

    expect((await call("/events/hidden", null)).status).toBe(404);
    expect((await json(await call("/events/soon", null))).title).toBe("soon");
  });
});
