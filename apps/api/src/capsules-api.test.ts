import { beforeEach, describe, expect, it } from "vitest";
import { capsules } from "@kcom/db";
import { createTestDb } from "@kcom/db/test-db";
import { createApp } from "./app.js";
import { rolePermissions } from "./permissions.js";
import { seedUser } from "./seed-users.js";
import { sanitizeRichText } from "./content/index.js";

const PASSWORD = "correct horse battery";
const ORIGIN = "http://admin.test";
const authOpts = { secret: "x".repeat(40), baseURL: "http://api.test" };
const doc = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

let db: Awaited<ReturnType<typeof createTestDb>>;
let app: ReturnType<typeof createApp>;
let editor: string;
let admin: string;

async function signIn(email: string) {
  const res = await app.request("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, "x-forwarded-for": "10.0.0.1" },
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

const valid = (over: Record<string, unknown> = {}) => ({
  title: "Hello",
  slug: "hello",
  body: doc("hi"),
  ...over,
});

beforeEach(async () => {
  db = await createTestDb();
  await seedUser(db, { email: "admin@example.test", password: PASSWORD, role: "admin" });
  await seedUser(db, { email: "editor@example.test", password: PASSWORD, role: "editor" });
  app = createApp(db, { corsOrigins: [ORIGIN], auth: authOpts });
  editor = await signIn("editor@example.test");
  admin = await signIn("admin@example.test");
});

describe("permissions", () => {
  it.each([
    ["GET", "/admin/capsules"],
    ["POST", "/admin/capsules"],
    ["GET", "/admin/series"],
    ["POST", "/admin/series"],
    ["DELETE", "/admin/series/00000000-0000-4000-8000-000000000000"],
  ])("%s %s needs a session", async (method, path) => {
    const res = await call(path, null, method, method === "POST" ? {} : undefined);
    expect(res.status).toBe(401);
  });

  it("lets editors and admins create a draft", async () => {
    expect((await call("/admin/capsules", editor, "POST", valid())).status).toBe(201);
    expect((await call("/admin/capsules", admin, "POST", valid({ slug: "two" }))).status).toBe(201);
  });
});

describe("admin capsule CRUD", () => {
  it("creates with defaults, reads, updates and deletes", async () => {
    const created = await call("/admin/capsules", editor, "POST", valid());
    const row = (await created.json()) as { id: string; status: string; decrees: string[] };
    expect(row.status).toBe("draft");
    expect(row.decrees).toEqual([]);

    expect((await call(`/admin/capsules/${row.id}`, editor)).status).toBe(200);
    const patched = await call(`/admin/capsules/${row.id}`, editor, "PATCH", { title: "New" });
    expect(((await patched.json()) as { title: string }).title).toBe("New");
    const list = (await (await call("/admin/capsules?status=draft&limit=1", editor)).json()) as {
      items: unknown[];
      total: number;
    };
    expect([list.items.length, list.total]).toEqual([1, 1]);
    expect((await call(`/admin/capsules/${row.id}`, editor, "DELETE")).status).toBe(204);
    expect((await call(`/admin/capsules/${row.id}`, editor)).status).toBe(404);
  });

  it("404s on unknown ids and 400s on malformed ones", async () => {
    const missing = "00000000-0000-4000-8000-000000000000";
    expect((await call(`/admin/capsules/${missing}`, editor, "PATCH", { title: "x" })).status).toBe(
      404,
    );
    expect((await call(`/admin/capsules/${missing}`, editor, "DELETE")).status).toBe(404);
    expect((await call("/admin/capsules/nope", editor)).status).toBe(400);
  });

  it("409s on a duplicate slug", async () => {
    await call("/admin/capsules", editor, "POST", valid());
    expect((await call("/admin/capsules", editor, "POST", valid())).status).toBe(409);
  });
});

describe("validation", () => {
  it.each([
    ["blank title", { title: "  " }],
    ["bad slug", { slug: "Bad_Slug" }],
    ["unknown field", { nope: 1 }],
    ["bad status", { status: "live" }],
    ["bad publishAt", { publishAt: "tomorrow" }],
    ["body not a doc", { body: { type: "paragraph" } }],
    ["body missing", { body: undefined }],
    ["too many decrees", { decrees: Array.from({ length: 21 }, () => "x") }],
    ["blank decree", { decrees: [""] }],
    ["part without series", { partNumber: 1 }],
    ["zero part", { partNumber: 0 }],
    ["bad series id", { seriesId: "x" }],
    ["overlong scripture ref", { scriptureRef: "x".repeat(201) }],
  ])("rejects %s", async (_n, over) => {
    const res = await call("/admin/capsules", editor, "POST", valid(over));
    expect([400, 422]).toContain(res.status);
  });

  it("rejects an unknown series with 422", async () => {
    const res = await call(
      "/admin/capsules",
      editor,
      "POST",
      valid({ seriesId: "00000000-0000-4000-8000-000000000000" }),
    );
    expect(res.status).toBe(422);
  });

  it("rejects an empty patch", async () => {
    const created = (await (await call("/admin/capsules", editor, "POST", valid())).json()) as {
      id: string;
    };
    expect((await call(`/admin/capsules/${created.id}`, editor, "PATCH", {})).status).toBe(400);
  });
});

describe("rich text sanitising", () => {
  it("strips scripts, unknown nodes and unsafe links", () => {
    const out = sanitizeRichText({
      type: "doc",
      onload: "x",
      content: [
        { type: "script", content: [] },
        {
          type: "paragraph",
          attrs: { style: "x" },
          content: [
            {
              type: "text",
              text: "a",
              marks: [
                { type: "link", attrs: { href: "javascript:alert(1)" } },
                { type: "bold" },
                { type: "evil" },
              ],
            },
            {
              type: "text",
              text: "b",
              marks: [{ type: "link", attrs: { href: "https://example.com", onclick: "x" } }],
            },
          ],
        },
      ],
    });
    expect(out).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "a", marks: [{ type: "bold" }] },
            {
              type: "text",
              text: "b",
              marks: [{ type: "link", attrs: { href: "https://example.com" } }],
            },
          ],
        },
      ],
    });
  });

  it("is applied on write", async () => {
    const body = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "x", marks: [{ type: "link", attrs: { href: "javascript:x" } }] },
          ],
        },
      ],
    };
    const res = await call("/admin/capsules", editor, "POST", valid({ body }));
    expect(((await res.json()) as { body: unknown }).body).toEqual(doc("x"));
  });
});

describe("public reads never leak drafts or future capsules", () => {
  const base = { body: doc("b") };
  beforeEach(async () => {
    await db.insert(capsules).values([
      {
        ...base,
        title: "Pub",
        slug: "pub",
        status: "published",
        publishAt: new Date("2026-01-10T12:00:00Z"),
      },
      {
        ...base,
        title: "Draft",
        slug: "draft",
        status: "draft",
        publishAt: new Date("2026-01-11T12:00:00Z"),
      },
      {
        ...base,
        title: "Sched",
        slug: "sched",
        status: "scheduled",
        publishAt: new Date("2026-01-12T12:00:00Z"),
      },
      {
        ...base,
        title: "Future",
        slug: "future",
        status: "published",
        publishAt: new Date("2999-01-01T00:00:00Z"),
      },
      {
        ...base,
        title: "Feb",
        slug: "feb",
        status: "published",
        publishAt: new Date("2026-02-01T12:00:00Z"),
      },
    ]);
  });

  it("lists only live published capsules", async () => {
    const list = (await (await call("/capsules", null)).json()) as { slug: string }[];
    expect(list.map((c) => c.slug)).toEqual(["feb", "pub"]);
  });

  it("404s for drafts, scheduled and future by slug", async () => {
    for (const s of ["draft", "sched", "future"]) {
      expect((await call(`/capsules/${s}`, null)).status).toBe(404);
    }
  });

  it("filters by month, date and series", async () => {
    const month = (await (await call("/capsules?month=2026-01", null)).json()) as unknown[];
    expect(month).toHaveLength(1);
    expect((await call("/capsules/date/2026-01-10", null)).status).toBe(200);
    expect((await call("/capsules/date/2026-01-11", null)).status).toBe(404);
    expect(await (await call("/capsules?series=none", null)).json()).toEqual([]);
    expect((await call("/capsules?month=2026-13", null)).status).toBe(400);
    expect((await call("/capsules?month=2026-01&date=2026-01-10", null)).status).toBe(400);
  });

  it("does not expose admin endpoints publicly", async () => {
    expect((await call("/admin/capsules", null)).status).toBe(401);
  });
});

describe("public /capsules/latest", () => {
  it("404s with the shared not-found shape", async () => {
    const res = await call("/capsules/latest", null);
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: { message: string } }).error.message).toBe(
      "capsule not found",
    );
  });
});

describe("series", () => {
  it("supports CRUD and public reads", async () => {
    const res = await call("/admin/series", editor, "POST", { title: "Faith", slug: "faith" });
    expect(res.status).toBe(201);
    const s = (await res.json()) as { id: string };
    expect(
      (await call("/admin/series", editor, "POST", { title: "Faith", slug: "faith" })).status,
    ).toBe(409);
    const adminList = (await (await call("/admin/series?limit=1", editor)).json()) as {
      items: unknown[];
      total: number;
    };
    expect([adminList.items.length, adminList.total]).toEqual([1, 1]);
    // Hidden while it has no live capsule.
    expect((await call("/series/faith", null)).status).toBe(404);
    expect(await (await call("/series", null)).json()).toEqual([]);
    await call("/admin/capsules", admin, "POST", valid({ seriesId: s.id, status: "draft" }));
    expect(await (await call("/series", null)).json()).toEqual([]);
    await call(
      "/admin/capsules",
      admin,
      "POST",
      valid({
        slug: "live",
        seriesId: s.id,
        status: "published",
        publishAt: "2026-01-01T00:00:00Z",
      }),
    );
    expect((await call("/series/faith", null)).status).toBe(200);
    expect(((await (await call("/series", null)).json()) as unknown[]).length).toBe(1);
    const patched = await call(`/admin/series/${s.id}`, editor, "PATCH", { description: "d" });
    expect(((await patched.json()) as { description: string }).description).toBe("d");
    expect((await call("/admin/series", editor, "POST", { title: "", slug: "x" })).status).toBe(
      400,
    );
  });

  it("filters capsules by series and detaches them on delete", async () => {
    const s = (await (
      await call("/admin/series", editor, "POST", { title: "F", slug: "f" })
    ).json()) as { id: string };
    const c = (await (
      await call(
        "/admin/capsules",
        editor,
        "POST",
        valid({
          seriesId: s.id,
          partNumber: 2,
          status: "published",
          publishAt: "2026-01-01T00:00:00Z",
        }),
      )
    ).json()) as { id: string };
    expect(((await (await call("/capsules?series=f", null)).json()) as unknown[]).length).toBe(1);

    expect((await call(`/admin/series/${s.id}`, editor, "DELETE")).status).toBe(204);
    const after = (await (await call(`/admin/capsules/${c.id}`, editor)).json()) as {
      seriesId: string | null;
      partNumber: number | null;
    };
    expect(after).toMatchObject({ seriesId: null, partNumber: null });
  });
});

describe("publish permission for a writer without it", () => {
  const original = rolePermissions.editor;
  const live = { status: "published", publishAt: "2026-01-01T00:00:00Z" };
  beforeEach(() => {
    rolePermissions.editor = ["content:read", "content:write"];
    return () => {
      rolePermissions.editor = original;
    };
  });

  async function make(over: Record<string, unknown>) {
    const res = await call("/admin/capsules", admin, "POST", valid(over));
    return ((await res.json()) as { id: string }).id;
  }

  it("may create and edit drafts", async () => {
    expect((await call("/admin/capsules", editor, "POST", valid())).status).toBe(201);
    const id = await make({ slug: "d" });
    expect(
      (
        await call(`/admin/capsules/${id}`, editor, "PATCH", {
          title: "T",
          publishAt: "2026-03-01T00:00:00Z",
        })
      ).status,
    ).toBe(200);
    expect((await call(`/admin/capsules/${id}`, editor, "DELETE")).status).toBe(204);
  });

  it("cannot create a non-draft or move a draft out of draft", async () => {
    expect((await call("/admin/capsules", editor, "POST", valid(live))).status).toBe(403);
    const id = await make({ slug: "d" });
    expect(
      (await call(`/admin/capsules/${id}`, editor, "PATCH", { status: "scheduled" })).status,
    ).toBe(403);
  });

  it("cannot edit, reschedule or delete published or scheduled capsules", async () => {
    for (const status of ["published", "scheduled"]) {
      const id = await make({ ...live, status, slug: status });
      for (const patch of [
        { title: "x" },
        { publishAt: "2027-01-01T00:00:00Z" },
        { status: "draft" },
      ]) {
        expect((await call(`/admin/capsules/${id}`, editor, "PATCH", patch)).status).toBe(403);
      }
      expect((await call(`/admin/capsules/${id}`, editor, "DELETE")).status).toBe(403);
      expect((await call(`/admin/capsules/${id}`, admin, "PATCH", { title: "ok" })).status).toBe(
        200,
      );
    }
  });
});
