import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { contactMessages, rateLimits } from "@kcom/db";
import { createTestDb } from "@kcom/db/test-db";
import { createApp } from "./app.js";

const ok = { topic: "prayer", name: "Grace", email: "grace@example.org", message: "Please pray." };

let db: Awaited<ReturnType<typeof createTestDb>>;
let app: ReturnType<typeof createApp>;
beforeEach(async () => {
  db = await createTestDb();
  app = createApp(db, { corsOrigins: ["http://web.test"] });
});

const post = (body: unknown, ip = "203.0.113.5", target = app) =>
  target.request("/contact", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://web.test", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });

describe("POST /contact", () => {
  it("stores the message and returns 201 with its id", async () => {
    const res = await post({ ...ok, name: "  Grace  ", keepPrivate: true });
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: string };
    const rows = await db.select().from(contactMessages);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id, topic: "prayer", name: "Grace", email: "grace@example.org", keepPrivate: true, status: "new" });
    expect(rows[0]!.createdAt).toBeInstanceOf(Date);
  });

  it("defaults keepPrivate to false", async () => {
    await post(ok);
    expect((await db.select().from(contactMessages))[0]!.keepPrivate).toBe(false);
  });

  it("answers 400 with field errors and stores nothing", async () => {
    const res = await post({ topic: "nope", name: " ", email: "grace@", message: "" });
    expect(res.status).toBe(400);
    const { error } = (await res.json()) as { error: { details: { path: string }[] } };
    expect(error.details.map((d) => d.path).sort()).toEqual(["email", "message", "name", "topic"]);
    expect(await db.select().from(contactMessages)).toHaveLength(0);
  });

  it("rejects unknown fields such as status", async () => {
    expect((await post({ ...ok, status: "read" })).status).toBe(400);
  });

  it("allows the web origin to POST cross-origin", async () => {
    const res = await app.request("/contact", {
      method: "OPTIONS",
      headers: { origin: "http://web.test", "access-control-request-method": "POST", "access-control-request-headers": "content-type" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBe("http://web.test");
    expect(res.headers.get("access-control-allow-methods")).toContain("POST");
  });
});

describe("POST /contact spam protection", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  const withRecaptcha = (verdict: object | Error) => {
    const fetcher = vi.fn(async () => {
      if (verdict instanceof Error) throw verdict;
      return new Response(JSON.stringify(verdict));
    });
    return { fetcher, app: createApp(db, { corsOrigins: ["http://web.test"], recaptcha: { secret: "s", fetcher: fetcher as unknown as typeof fetch } }) };
  };

  it("answers a filled honeypot with a normal-looking 201, stores nothing and warns", async () => {
    const res = await post({ ...ok, website: "http://spam.example" });
    expect(res.status).toBe(201);
    expect(Object.keys((await res.json()) as object)).toEqual(["id"]);
    expect(await db.select().from(contactMessages)).toHaveLength(0);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("honeypot"));
  });

  it("catches the honeypot even when the rest of the body is invalid", async () => {
    expect((await post({ website: "x" })).status).toBe(201);
  });

  it("accepts an empty honeypot and does not store the field", async () => {
    expect((await post({ ...ok, website: "" })).status).toBe(201);
    expect(await db.select().from(contactMessages)).toHaveLength(1);
  });

  it("rate limits per IP with 429, stores nothing past the limit and warns", async () => {
    for (let i = 0; i < 5; i++) expect((await post(ok)).status).toBe(201);
    const res = await post(ok);
    expect(res.status).toBe(429);
    expect(await db.select().from(contactMessages)).toHaveLength(5);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("rate limit"));
    expect((await post(ok, "198.51.100.9")).status).toBe(201);
  });

  it("starts a fresh window once the old one has expired", async () => {
    for (let i = 0; i < 6; i++) await post(ok);
    await db.update(rateLimits).set({ lastRequest: Date.now() - 2 * 60 * 60 * 1000 });
    expect((await post(ok)).status).toBe(201);
  });

  it("skips reCAPTCHA with a warning when no secret is configured", async () => {
    expect((await post(ok)).status).toBe(201);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("RECAPTCHA_SECRET_KEY"));
  });

  it("accepts a high-scoring token and verifies it with the secret", async () => {
    const { app: a, fetcher } = withRecaptcha({ success: true, score: 0.9 });
    expect((await post({ ...ok, recaptchaToken: "tok" }, undefined, a)).status).toBe(201);
    const [, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(init.body)).toContain("response=tok");
  });

  it.each([
    ["a low score", { success: true, score: 0.1 }, "low score"],
    ["a rejected token", { success: false }, "token rejected"],
  ])("rejects %s with 403, stores nothing and warns", async (_n, verdict, reason) => {
    const { app: a } = withRecaptcha(verdict);
    const res = await post({ ...ok, recaptchaToken: "tok" }, undefined, a);
    expect(res.status).toBe(403);
    expect(await db.select().from(contactMessages)).toHaveLength(0);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(reason));
  });

  it("rejects a missing token when a secret is configured", async () => {
    const { app: a, fetcher } = withRecaptcha({ success: true, score: 1 });
    expect((await post(ok, undefined, a)).status).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("fails closed when Google cannot be reached", async () => {
    const { app: a } = withRecaptcha(new Error("network down"));
    expect((await post({ ...ok, recaptchaToken: "tok" }, undefined, a)).status).toBe(403);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("network down"));
  });
});
