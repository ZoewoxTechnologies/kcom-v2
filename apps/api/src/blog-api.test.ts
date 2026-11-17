import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@kcom/db/test-db";
import { createApp } from "./app.js";
import { seedUser } from "./seed-users.js";

const PASSWORD = "correct horse battery";
const ORIGIN = "http://admin.test";
const authOpts = { secret: "x".repeat(40), baseURL: "http://api.test" };

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

const send = (method: string, path: string, body?: unknown, cookie: string | undefined = editor) =>
  app.request(path, {
    method,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const post = { title: "Hello", slug: "hello", date: "2026-01-02", body: { type: "doc" } };

describe.each([["blog", post]] as const)("%s API", (name, sample) => {
  const admin = `/admin/${name}`;

  it("requires auth on every admin route", async () => {
    const id = "00000000-0000-4000-8000-000000000000";
    for (const [m, p] of [
      ["GET", admin],
      ["GET", `${admin}/${id}`],
      ["POST", admin],
      ["PATCH", `${admin}/${id}`],
      ["DELETE", `${admin}/${id}`],
    ]) {
      expect((await send(m!, p!, m === "GET" ? undefined : {}, "")).status, `${m} ${p}`).toBe(401);
    }
  });

  it("supports editor CRUD", async () => {
    const created = await send("POST", admin, sample);
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as { id: string };

    expect((await (await send("GET", admin)).json()) as unknown[]).toHaveLength(1);
    expect((await send("GET", `${admin}/${id}`)).status).toBe(200);

    const patched = await send("PATCH", `${admin}/${id}`, { title: "Renamed" });
    expect(patched.status).toBe(200);
    expect(await patched.json()).toMatchObject({ title: "Renamed", slug: sample.slug });

    expect((await send("DELETE", `${admin}/${id}`)).status).toBe(204);
    expect((await send("GET", `${admin}/${id}`)).status).toBe(404);
    expect((await send("DELETE", `${admin}/${id}`)).status).toBe(404);
  });

  it("hides drafts and future-dated items from public reads", async () => {
    const draft = await send("POST", admin, sample);
    const { id } = (await draft.json()) as { id: string };
    const pub = (p: string) => send("GET", `/${name}${p}`, undefined, "");

    expect(await (await pub("")).json()).toEqual([]);
    expect((await pub(`/${sample.slug}`)).status).toBe(404);

    await send("PATCH", `${admin}/${id}`, {
      status: "published",
      publishAt: "2999-01-01T00:00:00Z",
    });
    expect(await (await pub("")).json()).toEqual([]);
    expect((await pub(`/${sample.slug}`)).status).toBe(404);

    await send("PATCH", `${admin}/${id}`, { publishAt: null });
    expect(await (await pub("")).json()).toHaveLength(1);
    expect((await pub(`/${sample.slug}`)).status).toBe(200);
  });

  it("rejects invalid input with 400", async () => {
    expect((await send("POST", admin, { ...sample, slug: "Not A Slug" })).status).toBe(400);
    expect((await send("POST", admin, { title: "" })).status).toBe(400);
    expect((await send("PATCH", `${admin}/not-a-uuid`, {})).status).toBe(400);
    expect(
      (await send("PATCH", `${admin}/00000000-0000-4000-8000-000000000000`, { status: "bogus" }))
        .status,
    ).toBe(400);
  });

  it("rejects a duplicate slug with 409", async () => {
    expect((await send("POST", admin, sample)).status).toBe(201);
    expect((await send("POST", admin, sample)).status).toBe(409);
  });
});

describe("blog fields", () => {
  it("rejects non-http hero images", async () => {
    expect(
      (await send("POST", "/admin/blog", { ...post, heroImageUrl: "javascript:alert(1)" })).status,
    ).toBe(400);
  });
});
