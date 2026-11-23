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
const MISSING = "00000000-0000-4000-8000-000000000000";

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

const page = (over: Record<string, unknown> = {}) => ({
  title: "Who We Are",
  slug: "who-we-are",
  ...over,
});
const richSection = { type: "richText", props: { body: doc("hi") } };
const putSections = (id: string, cookie: string | null, sections: unknown[]) =>
  call(`/admin/pages/${id}/sections`, cookie, "PUT", { sections });

beforeEach(async () => {
  const db = await createTestDb();
  await seedUser(db, { email: "admin@example.test", password: PASSWORD, role: "admin" });
  await seedUser(db, { email: "editor@example.test", password: PASSWORD, role: "editor" });
  app = createApp(db, { corsOrigins: [ORIGIN], auth: authOpts });
  editor = await signIn("editor@example.test");
  admin = await signIn("admin@example.test");
});

describe("public pages", () => {
  it("serves only published pages, with ordered sections and caching", async () => {
    const live = (await (
      await call("/admin/pages", admin, "POST", page({ status: "published" }))
    ).json()) as { id: string };
    await putSections(live.id, admin, [{ type: "hero", props: { heading: "Hello" } }, richSection]);
    await call("/admin/pages", editor, "POST", page({ slug: "draft-page", title: "Draft" }));
    await call(
      "/admin/pages",
      admin,
      "POST",
      page({
        slug: "future",
        status: "published",
        publishAt: new Date(Date.now() + 86_400_000).toISOString(),
      }),
    );

    const listRes = await call("/pages", null);
    expect(listRes.headers.get("cache-control")).toContain("public");
    const listed = (await listRes.json()) as { slug: string }[];
    expect(listed.map((p) => p.slug)).toEqual(["privacy", "who-we-are"]);

    const sections = (await (await call("/pages/who-we-are", null)).json()) as {
      sections: { type: string }[];
    };
    expect(sections.sections.map((s) => s.type)).toEqual(["hero", "richText"]);
    expect((await call("/pages/draft-page", null)).status).toBe(404);
    expect((await call("/pages/future", null)).status).toBe(404);
  });

  it("is read-only", async () => {
    expect((await call("/pages", null, "POST", page())).status).toBeGreaterThanOrEqual(400);
    expect((await call("/pages/who-we-are", null, "DELETE")).status).toBeGreaterThanOrEqual(400);
  });
});

describe("admin pages", () => {
  it("needs a session", async () => {
    expect((await call("/admin/pages", null)).status).toBe(401);
    expect((await call("/admin/pages", null, "POST", page())).status).toBe(401);
  });

  it("creates, reads, replaces sections, lists and deletes", async () => {
    const created = await call("/admin/pages", editor, "POST", page());
    expect(created.status).toBe(201);
    const row = (await created.json()) as { id: string; status: string };
    expect(row.status).toBe("draft");

    const patched = await call(`/admin/pages/${row.id}`, editor, "PATCH", { title: "New" });
    expect(((await patched.json()) as { title: string }).title).toBe("New");

    await putSections(row.id, editor, [richSection]);
    const replaced = await putSections(row.id, editor, [
      { type: "quote", props: { text: "Thy kingdom come", cite: "Matthew 6:10" } },
      {
        type: "cardGrid",
        props: { cards: [{ title: "Pastor", subtitle: "Team", text: "Bio" }] },
      },
      { type: "columns", props: { columns: [{ heading: "Publishing", items: ["Books"] }] } },
      { type: "bankDetails", props: {} },
      { type: "hero", props: { heading: "Hello" } },
      { type: "cta", props: { label: "Give", url: "https://example.test/give" } },
    ]);
    const body = (await replaced.json()) as { sections: { type: string }[] };
    expect(body.sections.map((s) => s.type)).toEqual([
      "quote",
      "cardGrid",
      "columns",
      "bankDetails",
      "hero",
      "cta",
    ]);
    const read = (await (await call(`/admin/pages/${row.id}/sections`, editor)).json()) as {
      sections: unknown[];
    };
    expect(read.sections).toHaveLength(6);
    expect((await putSections(row.id, editor, [])).status).toBe(200);

    const list = (await (await call("/admin/pages?status=draft", editor)).json()) as {
      items: unknown[];
      total: number;
    };
    expect([list.items.length, list.total]).toEqual([1, 1]);
    expect((await call(`/admin/pages/${row.id}`, editor, "DELETE")).status).toBe(204);
    expect((await call(`/admin/pages/${row.id}`, editor)).status).toBe(404);
  });

  it("404s unknown ids, 400s malformed ones, 409s duplicate slugs", async () => {
    expect((await call(`/admin/pages/${MISSING}`, editor, "PATCH", { title: "x" })).status).toBe(
      404,
    );
    expect((await call(`/admin/pages/${MISSING}`, editor, "DELETE")).status).toBe(404);
    expect((await call("/admin/pages/nope", editor)).status).toBe(400);
    await call("/admin/pages", editor, "POST", page());
    expect((await call("/admin/pages", editor, "POST", page())).status).toBe(409);
  });

  it.each([
    ["unknown field", { nope: 1 }],
    ["bad slug", { slug: "Bad_Slug" }],
    ["blank title", { title: " " }],
    ["bad status", { status: "live" }],
    ["sections inline", { sections: [] }],
  ])("rejects %s", async (_n, over) => {
    expect((await call("/admin/pages", editor, "POST", page(over))).status).toBe(400);
  });

  it.each([
    ["unknown section type", [{ type: "script", props: {} }]],
    ["extra section prop", [{ type: "hero", props: { heading: "x", evil: 1 } }]],
    [
      "non-Cloudinary image url",
      [{ type: "image", props: { url: "https://example.org/a.png", alt: "" } }],
    ],
    [
      "non-Cloudinary hero image",
      [{ type: "hero", props: { heading: "x", imageUrl: "https://example.org/a.png" } }],
    ],
    ["non-http image url", [{ type: "image", props: { url: "javascript:x", alt: "" } }]],
    ["non-http cta url", [{ type: "cta", props: { label: "x", url: "javascript:alert(1)" } }]],
    ["richText not a doc", [{ type: "richText", props: { body: { type: "p" } } }]],
  ])("rejects sections with %s", async (_n, sections) => {
    const row = (await (await call("/admin/pages", editor, "POST", page())).json()) as {
      id: string;
    };
    expect((await putSections(row.id, editor, sections)).status).toBe(400);
    expect((await putSections(MISSING, editor, [])).status).toBe(404);
    expect((await putSections(row.id, null, [])).status).toBe(401);
  });

  it("lets editors publish, edit and delete live pages (they hold content:publish)", async () => {
    const pub = (await (
      await call("/admin/pages", editor, "POST", page({ status: "published" }))
    ).json()) as { id: string };
    expect((await call(`/admin/pages/${pub.id}`, editor, "PATCH", { title: "x" })).status).toBe(
      200,
    );
    expect((await call(`/admin/pages/${pub.id}`, editor, "DELETE")).status).toBe(204);
  });
});

const layout = (keys: [string, boolean][]) => ({
  sections: keys.map(([key, visible]) => ({ key, visible })),
});
const DEFAULT = [
  "todays_capsule",
  "current_series",
  "past_series",
  "blog",
  "events_books",
  "email_signup",
];

describe("homepage sections", () => {
  it("starts with the default order, all visible", async () => {
    const res = (await (await call("/homepage", null)).json()) as { sections: { key: string }[] };
    expect(res.sections.map((s) => s.key)).toEqual(DEFAULT);
  });

  it("reorders and hides, and the public view follows", async () => {
    const order: [string, boolean][] = [
      ["todays_capsule", true],
      ["blog", true],
      ["current_series", false],
      ["past_series", true],
      ["events_books", true],
      ["email_signup", true],
    ];
    const put = await call("/admin/homepage", admin, "PUT", layout(order));
    expect(put.status).toBe(200);
    const admin_ = (await (await call("/admin/homepage", editor)).json()) as {
      sections: { key: string; visible: boolean }[];
    };
    expect(admin_.sections.map((s) => s.key)).toEqual(order.map(([k]) => k));
    const pub = (await (await call("/homepage", null)).json()) as { sections: { key: string }[] };
    expect(pub.sections.map((s) => s.key)).toEqual(order.filter(([, v]) => v).map(([k]) => k));
  });

  it("keeps Today's Capsule first and visible", async () => {
    const moved: [string, boolean][] = [
      ["blog", true],
      ["todays_capsule", true],
      ...DEFAULT.slice(1, 3).map((k): [string, boolean] => [k, true]),
      ["events_books", true],
      ["email_signup", true],
    ];
    expect((await call("/admin/homepage", admin, "PUT", layout(moved))).status).toBe(400);
    const hidden = DEFAULT.map((k): [string, boolean] => [k, k !== "todays_capsule"]);
    expect((await call("/admin/homepage", admin, "PUT", layout(hidden))).status).toBe(400);
  });

  it.each([
    ["missing section", { sections: DEFAULT.slice(0, 5).map((key) => ({ key, visible: true })) }],
    [
      "duplicate section",
      { sections: [...DEFAULT.slice(0, 5), "blog"].map((key) => ({ key, visible: true })) },
    ],
    [
      "unknown key",
      { sections: [...DEFAULT.slice(0, 5), "nope"].map((key) => ({ key, visible: true })) },
    ],
    ["extra field", { sections: DEFAULT.map((key) => ({ key, visible: true })), x: 1 }],
  ])("rejects %s", async (_n, body) => {
    expect((await call("/admin/homepage", admin, "PUT", body)).status).toBe(400);
  });

  it("needs a session; public is read-only", async () => {
    const ok = layout(DEFAULT.map((k): [string, boolean] => [k, true]));
    expect((await call("/admin/homepage", null, "PUT", ok)).status).toBe(401);
    expect((await call("/homepage", null, "PUT", ok)).status).toBeGreaterThanOrEqual(400);
  });
});
