import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@kcom/db/test-db";
import { createApp } from "../app.js";
import { seedUser } from "../seed-users.js";

const PASSWORD = "correct horse battery";
const ORIGIN = "http://admin.test";
const authOpts = { secret: "x".repeat(40), baseURL: "http://api.test" };

let app: ReturnType<typeof createApp>;
let editor: string;

async function signIn(email: string) {
  const res = await app.request("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, "x-forwarded-for": "10.0.0.2" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  expect(res.status).toBe(200);
  return res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

const send = (method: string, path: string, body?: unknown, cookie = editor) =>
  app.request(path, {
    method,
    headers: { "content-type": "application/json", origin: ORIGIN, cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

type Ev = { id: string; title: string; status: string };
const json = async <T = Ev>(res: Response) => (await res.json()) as T;

const future = "2099-01-01T10:00:00Z";
const past = "2000-01-01T10:00:00Z";

beforeEach(async () => {
  const db = await createTestDb();
  await seedUser(db, { email: "editor@example.test", password: PASSWORD, role: "editor" });
  app = createApp(db, { corsOrigins: [ORIGIN], auth: authOpts });
  editor = await signIn("editor@example.test");
});

describe("admin events", () => {
  it("requires a session", async () => {
    expect((await app.request("/admin/events")).status).toBe(401);
    expect((await send("POST", "/admin/events", {}, "")).status).toBe(401);
  });

  it("creates, reads, updates and deletes", async () => {
    const created = await send("POST", "/admin/events", {
      title: "Prayer night",
      startsAt: future,
      place: "Lagos",
    });
    expect(created.status).toBe(201);
    const ev = await json(created);
    expect(ev.status).toBe("draft");

    const patched = await send("PATCH", `/admin/events/${ev.id}`, { title: "Prayer day" });
    expect((await json(patched)).title).toBe("Prayer day");
    expect((await json(await send("GET", `/admin/events/${ev.id}`))).title).toBe("Prayer day");

    expect((await send("DELETE", `/admin/events/${ev.id}`)).status).toBe(204);
    expect((await send("GET", `/admin/events/${ev.id}`)).status).toBe(404);
  });

  it("validates input", async () => {
    expect((await send("POST", "/admin/events", { title: "", startsAt: future })).status).toBe(400);
    expect(
      (await send("POST", "/admin/events", { title: "x", startsAt: future, endsAt: past })).status,
    ).toBe(400);
    expect((await send("PATCH", "/admin/events/not-a-uuid", { title: "x" })).status).toBe(400);
  });
});

describe("public events", () => {
  it("lists only published events, split into upcoming and past", async () => {
    const mk = (title: string, startsAt: string, status: string) =>
      send("POST", "/admin/events", { title, startsAt, status });
    await mk("Soon", future, "published");
    await mk("Done", past, "published");
    const hidden = await json(await mk("Hidden", future, "draft"));

    const res = await app.request("/events");
    expect(res.status).toBe(200);
    const body = await json<{ upcoming: Ev[]; past: Ev[] }>(res);
    expect(body.upcoming.map((e) => e.title)).toEqual(["Soon"]);
    expect(body.past.map((e) => e.title)).toEqual(["Done"]);

    expect((await app.request(`/events/${hidden.id}`)).status).toBe(404);
    const soon = body.upcoming[0]!;
    expect((await json(await app.request(`/events/${soon.id}`))).title).toBe("Soon");
  });
});
