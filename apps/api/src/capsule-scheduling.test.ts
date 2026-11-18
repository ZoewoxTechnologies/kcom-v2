import { beforeEach, describe, expect, it, vi } from "vitest";
import { capsules } from "@kcom/db";
import { createTestDb } from "@kcom/db/test-db";
import { nextLagosMidnight } from "@kcom/content";
import { createApp } from "./app.js";
import { createCapsuleEvents, publishDueCapsules } from "./capsule-publishing.js";
import { seedUser } from "./seed-users.js";

const PASSWORD = "correct horse battery";
const ORIGIN = "http://admin.test";
const doc = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }],
};

let db: Awaited<ReturnType<typeof createTestDb>>;
let app: ReturnType<typeof createApp>;
let events: ReturnType<typeof createCapsuleEvents>;
let published: string[];
let cookie: string;

const call = (path: string, method = "GET", body?: unknown, headers: Record<string, string> = {}) =>
  app.request(path, {
    method,
    headers: {
      origin: ORIGIN,
      cookie,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const create = async (over: Record<string, unknown> = {}) =>
  (await (
    await call("/admin/capsules", "POST", { title: "T", slug: "t", body: doc, ...over })
  ).json()) as {
    id: string;
    status: string;
    publishAt: string;
  };

beforeEach(async () => {
  db = await createTestDb();
  await seedUser(db, { email: "admin@example.test", password: PASSWORD, role: "admin" });
  events = createCapsuleEvents();
  published = [];
  events.on(({ capsule }) => {
    published.push(capsule.slug);
  });
  app = createApp(db, {
    corsOrigins: [ORIGIN],
    auth: { secret: "x".repeat(40), baseURL: "http://api.test" },
    capsuleEvents: events,
    internalToken: "job-token",
  });
  const res = await app.request("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, "x-forwarded-for": "10.0.0.1" },
    body: JSON.stringify({ email: "admin@example.test", password: PASSWORD }),
  });
  cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
});

describe("default publish time", () => {
  it("is the next Lagos midnight, either side of the day boundary", async () => {
    // Lagos is UTC+1: 23:00Z is local midnight.
    expect(nextLagosMidnight(new Date("2026-11-17T22:59:59Z")).toISOString()).toBe(
      "2026-11-17T23:00:00.000Z",
    );
    expect(nextLagosMidnight(new Date("2026-11-17T23:00:00Z")).toISOString()).toBe(
      "2026-11-18T23:00:00.000Z",
    );
  });

  it("is applied when a capsule is created without a date", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-17T22:59:59Z"));
    try {
      expect((await create()).publishAt).toBe("2026-11-17T23:00:00.000Z");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("state machine", () => {
  const future = "2999-01-01T00:00:00.000Z";

  it("keeps the schedule on edit and returns to draft on unschedule", async () => {
    const { id } = await create({ status: "scheduled", publishAt: future });
    const edited = await (await call(`/admin/capsules/${id}`, "PATCH", { title: "New" })).json();
    expect(edited).toMatchObject({ title: "New", status: "scheduled", publishAt: future });
    const draft = await (await call(`/admin/capsules/${id}`, "PATCH", { status: "draft" })).json();
    expect(draft).toMatchObject({ status: "draft", publishAt: future });
  });

  it("rejects scheduling in the past and publishing in the future", async () => {
    const past = "2020-01-01T00:00:00.000Z";
    const res = await call("/admin/capsules", "POST", {
      title: "T",
      slug: "p",
      body: doc,
      status: "scheduled",
      publishAt: past,
    });
    expect(res.status).toBe(422);
    const { id } = await create({ slug: "q" });
    expect(
      (await call(`/admin/capsules/${id}`, "PATCH", { status: "published", publishAt: future }))
        .status,
    ).toBe(422);
  });

  it("scheduling a draft with a stale time moves it to the next Lagos midnight", async () => {
    const { id } = await create({ publishAt: "2020-01-01T00:00:00.000Z" });
    const row = (await (
      await call(`/admin/capsules/${id}`, "PATCH", { status: "scheduled" })
    ).json()) as { publishAt: string };
    expect(new Date(row.publishAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("emits once when published manually, and not on later edits", async () => {
    const { id } = await create();
    await call(`/admin/capsules/${id}`, "PATCH", { status: "published" });
    await call(`/admin/capsules/${id}`, "PATCH", { status: "published" });
    await call(`/admin/capsules/${id}`, "PATCH", { title: "Again" });
    expect(published).toEqual(["t"]);
  });
});

describe("due publisher", () => {
  const body = doc;
  const seed = async () =>
    db.insert(capsules).values([
      {
        title: "a",
        slug: "due",
        body,
        status: "scheduled",
        publishAt: new Date("2026-01-01T00:00:00Z"),
      },
      {
        title: "b",
        slug: "later",
        body,
        status: "scheduled",
        publishAt: new Date("2999-01-01T00:00:00Z"),
      },
      {
        title: "c",
        slug: "draft",
        body,
        status: "draft",
        publishAt: new Date("2026-01-01T00:00:00Z"),
      },
    ]);

  it("publishes due capsules once and emits one event each, even when run twice", async () => {
    await seed();
    const now = new Date("2026-06-01T00:00:00Z");
    expect((await publishDueCapsules(db, events, now)).map((r) => r.slug)).toEqual(["due"]);
    expect(await publishDueCapsules(db, events, now)).toEqual([]);
    expect(published).toEqual(["due"]);
  });

  it("concurrent runs publish once", async () => {
    await seed();
    const now = new Date("2026-06-01T00:00:00Z");
    await Promise.all([publishDueCapsules(db, events, now), publishDueCapsules(db, events, now)]);
    expect(published).toEqual(["due"]);
  });

  it("endpoint needs the token", async () => {
    await seed();
    const noAuth = await app.request("/internal/publish-due", { method: "POST" });
    expect(noAuth.status).toBe(401);
    const wrong = await app.request("/internal/publish-due", {
      method: "POST",
      headers: { authorization: "Bearer nope" },
    });
    expect(wrong.status).toBe(401);
    const ok = await app.request("/internal/publish-due", {
      method: "POST",
      headers: { authorization: "Bearer job-token" },
    });
    expect(await ok.json()).toEqual({ published: ["due"] });
    const again = await app.request("/internal/publish-due", {
      method: "POST",
      headers: { authorization: "Bearer job-token" },
    });
    expect(await again.json()).toEqual({ published: [] });
    expect(published).toEqual(["due"]);
  });

  it("is disabled without a configured token", async () => {
    const bare = createApp(db, { auth: { secret: "x".repeat(40), baseURL: "http://api.test" } });
    expect((await bare.request("/internal/publish-due", { method: "POST" })).status).toBe(404);
  });
});
