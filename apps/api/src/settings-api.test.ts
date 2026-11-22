import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@kcom/db/test-db";
import { createApp } from "./app.js";
import { seedUser } from "./seed-users.js";

const PASSWORD = "correct horse battery";
const ORIGIN = "http://admin.test";
const authOpts = { secret: "x".repeat(40), baseURL: "http://api.test" };
const PORTRAIT = "https://res.cloudinary.com/demo/image/upload/v1/kcom/a.png";

type Item = { id: string; name: string; [k: string]: unknown };
type Settings = Record<string, Record<string, unknown>> & { team: Item[]; arms: Item[] };
const json = async <T = Settings>(res: Response) => (await res.json()) as T;

let app: ReturnType<typeof createApp>;
let editor: string;
let admin: string;

async function signIn(email: string) {
  const res = await app.request("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, "x-forwarded-for": "10.0.0.3" },
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

beforeEach(async () => {
  const db = await createTestDb();
  await seedUser(db, { email: "admin@example.test", password: PASSWORD, role: "admin" });
  await seedUser(db, { email: "editor@example.test", password: PASSWORD, role: "editor" });
  app = createApp(db, { corsOrigins: [ORIGIN], auth: authOpts });
  editor = await signIn("editor@example.test");
  admin = await signIn("admin@example.test");
});

describe("settings", () => {
  it("public GET works without sign-in and starts empty", async () => {
    const res = await call("/settings", null);
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.contact).toEqual({ email: null, phone: null, address: null });
    expect(body.team).toEqual([]);
    expect(body.arms).toEqual([]);
  });

  it("requires sign-in for admin reads and writes", async () => {
    expect((await call("/admin/settings", null)).status).toBe(401);
    expect((await call("/admin/settings", null, "PATCH", { contact: { phone: "1" } })).status).toBe(
      401,
    );
  });

  it("admin writes grouped settings, partial updates keep the rest", async () => {
    const patch = await call("/admin/settings", admin, "PATCH", {
      contact: { email: "hello@example.test", phone: "+234 1", address: "1 Road" },
      bank: { bankName: "Bank", accountName: "KCOM", accountNumber: "0123", sortOrSwift: "ABC" },
      social: { facebook: "https://facebook.com/kcom" },
    });
    expect(patch.status).toBe(200);
    await call("/admin/settings", admin, "PATCH", { contact: { phone: "" } });
    const pub = await json(await call("/settings", null));
    expect(pub.contact).toEqual({ email: "hello@example.test", phone: null, address: "1 Road" });
    expect(pub.bank).toMatchObject({ bankName: "Bank", sortOrSwift: "ABC" });
    expect(pub.social?.facebook).toBe("https://facebook.com/kcom");
    expect(pub.social?.youtube).toBeNull();
    expect((await json(await call("/admin/settings", editor))).contact?.email).toBe(
      "hello@example.test",
    );
  });

  it("editors get 403 on every write", async () => {
    const t = await json<Item>(
      await call("/admin/settings/team", admin, "POST", { name: "A", role: "Pastor" }),
    );
    for (const [path, method, body] of [
      ["/admin/settings", "PATCH", { contact: { phone: "1" } }],
      ["/admin/settings/team", "POST", { name: "B", role: "R" }],
      [`/admin/settings/team/${t.id}`, "PATCH", { name: "C" }],
      [`/admin/settings/team/${t.id}`, "DELETE", undefined],
      ["/admin/settings/team/order", "PUT", { ids: [t.id] }],
      ["/admin/settings/arms", "POST", { name: "Arm" }],
    ] as const) {
      expect((await call(path, editor, method, body)).status, `${method} ${path}`).toBe(403);
    }
    expect((await call("/admin/settings/team", editor)).status).toBe(200);
  });

  it("validates input", async () => {
    const bad = async (body: unknown) =>
      (await call("/admin/settings", admin, "PATCH", body)).status;
    expect(await bad({})).toBe(400);
    expect(await bad({ contact: { email: "nope" } })).toBe(400);
    expect(await bad({ social: { x: "javascript:alert(1)" } })).toBe(400);
    expect(await bad({ contact: { extra: 1 } })).toBe(400);
    expect(await bad({ site: { siteName: "" } })).toBe(400);
  });

  it("saves real URLs and an email that contain the letter s", async () => {
    const social = {
      facebook: "https://www.facebook.com/kingdomcapstone",
      youtube: "https://www.youtube.com/@kingdomcapstone/videos?sub_confirmation=1",
      instagram: "https://www.instagram.com/kingdomcapstone/",
      x: "https://x.com/kingdomcapstone",
      whatsappChannel: "https://whatsapp.com/channel/0029VaAbCdEfGh",
      telegram: "https://t.me/kingdomcapstone",
    };
    const res = await call("/admin/settings", admin, "PATCH", {
      social,
      contact: { email: "info@kingdomcapstone.org" },
    });
    expect(res.status).toBe(200);
    const saved = await json(await call("/admin/settings", admin));
    expect(saved.social).toEqual(social);
    expect(saved.contact?.email).toBe("info@kingdomcapstone.org");
  });

  it("a bad URL is a 400 field error naming the field, never a 500", async () => {
    const tooLong = `https://example.com/${"a".repeat(2048)}`;
    for (const bad of [
      tooLong,
      "not a url",
      "https://example.com/a b",
      "ftp://files.example.com",
      "javascript:alert(1)",
    ]) {
      const res = await call("/admin/settings", admin, "PATCH", { social: { facebook: bad } });
      expect(res.status, bad).toBe(400);
      const body = await json<{ error: { details: { path: string }[] } }>(res);
      expect(
        body.error.details.map((d) => d.path),
        bad,
      ).toEqual(["social.facebook"]);
    }
  });

  it("team: portraits must be Cloudinary URLs; order persists across moves", async () => {
    const add = (name: string, extra: object = {}) =>
      call("/admin/settings/team", admin, "POST", { name, role: "Elder", ...extra });
    expect((await add("Bad", { portraitUrl: "https://example.org/a.png" })).status).toBe(400);
    const [a, b, c] = [
      await json<Item>(await add("A", { portraitUrl: PORTRAIT, bio: "Hi" })),
      await json<Item>(await add("B")),
      await json<Item>(await add("C")),
    ];
    expect(a.portraitUrl).toBe(PORTRAIT);
    expect((await json(await call("/settings", null))).team.map((m) => m.name)).toEqual([
      "A",
      "B",
      "C",
    ]);

    const reordered = await call("/admin/settings/team/order", admin, "PUT", {
      ids: [c!.id, a!.id, b!.id],
    });
    expect(reordered.status).toBe(200);
    expect((await json(await call("/settings", null))).team.map((m) => m.name)).toEqual([
      "C",
      "A",
      "B",
    ]);

    await call(`/admin/settings/team/${a!.id}`, admin, "DELETE");
    await add("D");
    expect((await json(await call("/settings", null))).team.map((m) => m.name)).toEqual([
      "C",
      "B",
      "D",
    ]);

    const patched = await json<Item>(
      await call(`/admin/settings/team/${b!.id}`, admin, "PATCH", { role: "Deacon" }),
    );
    expect(patched.role).toBe("Deacon");
  });

  it("PATCH leaves unspecified optional fields alone", async () => {
    const m = await json<Item>(
      await call("/admin/settings/team", admin, "POST", {
        name: "A",
        role: "R",
        bio: "Hi",
        portraitUrl: PORTRAIT,
      }),
    );
    const patched = await json<Item>(
      await call(`/admin/settings/team/${m.id}`, admin, "PATCH", { role: "Elder" }),
    );
    expect(patched).toMatchObject({ role: "Elder", bio: "Hi", portraitUrl: PORTRAIT });
    const arm = await json<Item>(
      await call("/admin/settings/arms", admin, "POST", {
        name: "X",
        description: "D",
        imageUrl: PORTRAIT,
      }),
    );
    const armPatched = await json<Item>(
      await call(`/admin/settings/arms/${arm.id}`, admin, "PATCH", { name: "Y" }),
    );
    expect(armPatched).toMatchObject({ name: "Y", description: "D", imageUrl: PORTRAIT });
    const cleared = await json<Item>(
      await call(`/admin/settings/arms/${arm.id}`, admin, "PATCH", { description: null }),
    );
    expect(cleared).toMatchObject({ description: null, imageUrl: PORTRAIT });
  });

  it("concurrent creates get distinct positions", async () => {
    await Promise.all(
      ["A", "B", "C", "D"].map((name) => call("/admin/settings/arms", admin, "POST", { name })),
    );
    const items = (await json(await call("/settings", null))).arms;
    expect(items).toHaveLength(4);
    const order = await call("/admin/settings/arms/order", admin, "PUT", {
      ids: items.map((i) => i.id).reverse(),
    });
    expect(order.status).toBe(200);
  });

  it("rejects an order that is not every id exactly once, and unknown ids 404", async () => {
    const a = await json<Item>(await call("/admin/settings/arms", admin, "POST", { name: "One" }));
    await call("/admin/settings/arms", admin, "POST", { name: "Two" });
    const order = (ids: string[]) => call("/admin/settings/arms/order", admin, "PUT", { ids });
    expect((await order([a.id])).status).toBe(422);
    expect((await order([a.id, a.id])).status).toBe(422);
    const missing = "00000000-0000-4000-8000-000000000000";
    expect(
      (await call(`/admin/settings/arms/${missing}`, admin, "PATCH", { name: "x" })).status,
    ).toBe(404);
    expect((await call(`/admin/settings/arms/${missing}`, admin, "DELETE")).status).toBe(404);
  });
});
