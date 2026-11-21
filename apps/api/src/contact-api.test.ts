import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { contactMessages, rateLimits } from "@kcom/db";
import { createTestDb } from "@kcom/db/test-db";
import { createApp, type AppOptions } from "./app.js";
import { clientIp, parseTrustedProxyHops } from "./client-ip.js";

const ok = { topic: "prayer", name: "Grace", email: "grace@example.org", message: "Please pray." };

let db: Awaited<ReturnType<typeof createTestDb>>;
let app: ReturnType<typeof createApp>;
beforeEach(async () => {
  db = await createTestDb();
  app = createApp(db, { corsOrigins: ["http://web.test"] });
});

const post = (body: unknown, ip: string | null = "203.0.113.5", target = app, env?: object) =>
  target.request(
    "/contact",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://web.test",
        ...(ip === null ? {} : { "x-forwarded-for": ip }),
      },
      body: JSON.stringify(body),
    },
    env,
  );
const socket = (address: string) => ({ incoming: { socket: { remoteAddress: address } } });

describe("POST /contact bot check", () => {
  const withCheck = (check: NonNullable<AppOptions["contactBotCheck"]>) =>
    createApp(db, { corsOrigins: ["http://web.test"], contactBotCheck: check });

  it("passes the token and IP to the check and stores the message when it passes", async () => {
    const check = vi.fn().mockResolvedValue(true);
    const res = await post({ ...ok, botToken: "tok" }, "203.0.113.9", withCheck(check));
    expect(res.status).toBe(201);
    expect(check).toHaveBeenCalledWith({ token: "tok", ip: "203.0.113.9" });
    expect(await db.select().from(contactMessages)).toHaveLength(1);
  });

  it("rejects with 400 verification_failed and stores nothing when the check fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await post(
      ok,
      "203.0.113.9",
      withCheck(() => false),
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      "verification_failed",
    );
    expect(await db.select().from(contactMessages)).toHaveLength(0);
    warn.mockRestore();
  });

  it("accepts a botToken when no check is configured", async () => {
    expect((await post({ ...ok, botToken: "tok" })).status).toBe(201);
  });
});

describe("POST /contact", () => {
  it("stores the message and returns 201 with its id", async () => {
    const res = await post({ ...ok, name: "  Grace  ", keepPrivate: true });
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: string };
    const rows = await db.select().from(contactMessages);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id,
      topic: "prayer",
      name: "Grace",
      email: "grace@example.org",
      keepPrivate: true,
      status: "new",
    });
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
      headers: {
        origin: "http://web.test",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type",
      },
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

  it("answers a filled honeypot with a normal-looking 201, stores nothing and warns", async () => {
    const res = await post({ ...ok, hp_url: "http://spam.example" });
    expect(res.status).toBe(201);
    expect(Object.keys((await res.json()) as object)).toEqual(["id"]);
    expect(await db.select().from(contactMessages)).toHaveLength(0);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("honeypot"));
  });

  it("catches the honeypot even when the rest of the body is invalid", async () => {
    expect((await post({ hp_url: "x" })).status).toBe(201);
  });

  it("accepts an empty honeypot and does not store the field", async () => {
    expect((await post({ ...ok, hp_url: "" })).status).toBe(201);
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

  it("ignores client-supplied x-forwarded-for entries, so a spoofed header does not change the bucket", async () => {
    for (let i = 0; i < 5; i++)
      expect((await post(ok, `spoof-${i}, 203.0.113.5`)).status).toBe(201);
    expect((await post(ok, "another-spoof, 203.0.113.5")).status).toBe(429);
  });

  it("picks the hop set by trustedProxyHops from the right of a multi-hop chain", async () => {
    const two = createApp(db, { corsOrigins: ["http://web.test"], trustedProxyHops: 2 });
    for (let i = 0; i < 5; i++)
      expect((await post(ok, `198.51.100.${i}, 203.0.113.5, 10.0.0.1`, two)).status).toBe(201);
    expect((await post(ok, "198.51.100.99, 203.0.113.5, 10.0.0.1", two)).status).toBe(429);
    expect((await post(ok, "198.51.100.99, 203.0.113.6, 10.0.0.1", two)).status).toBe(201);
  });

  it("falls back to the socket address when the header is missing", async () => {
    for (let i = 0; i < 5; i++)
      expect((await post(ok, null, app, socket("192.0.2.7"))).status).toBe(201);
    expect((await post(ok, null, app, socket("192.0.2.7"))).status).toBe(429);
    expect((await post(ok, null, app, socket("192.0.2.8"))).status).toBe(201);
  });

  it("does not lock everyone out when no client IP can be determined", async () => {
    for (let i = 0; i < 7; i++) expect((await post(ok, null)).status).toBe(201);
    expect(await db.select().from(rateLimits)).toHaveLength(0);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("no client IP"));
  });

  it("starts a fresh window once the old one has expired", async () => {
    for (let i = 0; i < 6; i++) await post(ok);
    await db.update(rateLimits).set({ lastRequest: Date.now() - 2 * 60 * 60 * 1000 });
    expect((await post(ok)).status).toBe(201);
  });
});

describe("clientIp", () => {
  it("takes the entry hops from the right", () => {
    expect(clientIp("a, b, c", 1)).toBe("c");
    expect(clientIp("a, b, c", 2)).toBe("b");
    expect(clientIp("a", 1)).toBe("a");
  });
  it("uses the socket when the header has fewer entries than hops, is empty, or hops is 0", () => {
    expect(clientIp("a", 2, "s")).toBe("s");
    expect(clientIp("", 1, "s")).toBe("s");
    expect(clientIp(undefined, 1, "s")).toBe("s");
    expect(clientIp("a, b", 0, "s")).toBe("s");
  });
  it("is undefined with nothing usable", () => expect(clientIp(undefined, 1)).toBeUndefined());
});

describe("parseTrustedProxyHops", () => {
  it("defaults to 1 when unset or blank", () => {
    expect(parseTrustedProxyHops(undefined)).toBe(1);
    expect(parseTrustedProxyHops("  ")).toBe(1);
  });
  it("accepts positive integers", () => {
    expect(parseTrustedProxyHops("2")).toBe(2);
    expect(parseTrustedProxyHops(" 3 ")).toBe(3);
  });
  it.each(["0", "-1", "1.5", "two", "1e2"])("falls back to 1 with a warning for %s", (raw) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(parseTrustedProxyHops(raw)).toBe(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("TRUSTED_PROXY_HOPS"));
    warn.mockRestore();
  });
});
