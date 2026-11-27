import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { subscribers } from "@kcom/db";
import { createTestDb } from "@kcom/db/test-db";
import { createApp } from "./app.js";
import { noopMailer } from "./mailer.js";
import { signSubscriberToken, verifySubscriberToken } from "./subscriber-tokens.js";
import { turnstileBotCheck } from "./turnstile.js";

const SECRET = "s".repeat(40);
const WEB = "http://web.test";
let db: Awaited<ReturnType<typeof createTestDb>>;
let sent: { email: string; confirmUrl: string; unsubscribeUrl: string }[];
let app: ReturnType<typeof createApp>;

function makeApp(botCheck?: (i: { token?: string; ip?: string }) => boolean | Promise<boolean>) {
  return createApp(db, {
    corsOrigins: [WEB],
    mailer: {
      ...noopMailer,
      sendSubscriberConfirmation: async (email, confirmUrl, unsubscribeUrl) => {
        sent.push({ email, confirmUrl, unsubscribeUrl });
      },
    },
    signup: { secret: SECRET, apiUrl: "http://api.test", webUrl: WEB, botCheck },
  });
}

beforeEach(async () => {
  db = await createTestDb();
  sent = [];
  app = makeApp();
});

const signup = (body: unknown, ip = "203.0.113.1", target = app) =>
  target.request("/subscribers", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
const path = (url: string) => url.replace("http://api.test", "");
const rows = () => db.select().from(subscribers);

describe("POST /subscribers", () => {
  it("creates a pending subscriber and emails a confirm link", async () => {
    const res = await signup({ email: "Ada@Example.org" });
    expect(res.status).toBe(202);
    const [row] = await rows();
    expect(row).toMatchObject({ email: "Ada@Example.org", status: "pending" });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.confirmUrl).toContain(encodeURIComponent(row!.confirmToken!));
  });

  it("rejects a bad email with 400", async () => {
    expect((await signup({ email: "nope" })).status).toBe(400);
    expect(sent).toHaveLength(0);
  });

  it("silently discards honeypot signups", async () => {
    expect((await signup({ email: "bot@example.org", hp_url: "http://spam" })).status).toBe(202);
    expect(await rows()).toHaveLength(0);
    expect(sent).toHaveLength(0);
  });

  it("answers 202 without emailing for a confirmed address", async () => {
    await signup({ email: "a@example.org" });
    await app.request(path(sent[0]!.confirmUrl));
    sent = [];
    expect((await signup({ email: "A@example.org" })).status).toBe(202);
    expect(sent).toHaveLength(0);
    expect((await rows())[0]!.status).toBe("confirmed");
  });

  it("re-sends a fresh link to a pending address and invalidates the old one", async () => {
    await signup({ email: "a@example.org" });
    const first = sent[0]!.confirmUrl;
    await signup({ email: "a@example.org" });
    expect(await rows()).toHaveLength(1);
    expect(sent).toHaveLength(2);
    const res = await app.request(path(first));
    expect(res.headers.get("location")).toBe(`${WEB}/subscribe/expired`);
  });

  it("lets an unsubscribed address sign up again", async () => {
    await signup({ email: "a@example.org" });
    await app.request(path(sent[0]!.unsubscribeUrl));
    await signup({ email: "a@example.org" });
    expect((await rows())[0]).toMatchObject({ status: "pending", unsubscribedAt: null });
  });

  it("rate limits per IP with 429", async () => {
    for (let i = 0; i < 5; i++) await signup({ email: `u${i}@example.org` });
    expect((await signup({ email: "u9@example.org" })).status).toBe(429);
    expect((await signup({ email: "u9@example.org" }, "203.0.113.2")).status).toBe(202);
  });

  it("stops emailing one address after repeated signups, still answering 202", async () => {
    for (let i = 0; i < 3; i++) await signup({ email: "a@example.org" }, `10.0.0.${i}`);
    expect((await signup({ email: "a@example.org" }, "10.0.0.9")).status).toBe(202);
    expect(sent).toHaveLength(3);
  });

  it("still answers 202 when the email fails to send", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = createApp(db, {
      mailer: {
        ...noopMailer,
        sendSubscriberConfirmation: () => Promise.reject(new Error("down")),
      },
      signup: { secret: SECRET, apiUrl: "http://api.test", webUrl: WEB },
    });
    expect((await signup({ email: "a@example.org" }, "1.1.1.1", failing)).status).toBe(202);
    err.mockRestore();
  });

  it("rejects with 400 when the bot check fails, and passes when it succeeds", async () => {
    const check = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const guarded = makeApp(check);
    expect(
      (await signup({ email: "a@example.org", turnstileToken: "bad" }, "1.1.1.1", guarded)).status,
    ).toBe(400);
    expect(await rows()).toHaveLength(0);
    expect(
      (await signup({ email: "a@example.org", turnstileToken: "ok" }, "1.1.1.1", guarded)).status,
    ).toBe(202);
    expect(check).toHaveBeenCalledWith({ token: "ok", ip: "1.1.1.1" });
  });
});

describe("confirm and unsubscribe links", () => {
  it("confirms and redirects to the confirmed page, idempotently", async () => {
    await signup({ email: "a@example.org" });
    const url = path(sent[0]!.confirmUrl);
    const res = await app.request(url);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(`${WEB}/subscribe/confirmed`);
    const [row] = await rows();
    expect(row).toMatchObject({ status: "confirmed", confirmToken: null });
    expect(row!.confirmedAt).not.toBeNull();
    expect((await app.request(url)).headers.get("location")).toBe(`${WEB}/subscribe/confirmed`);
  });

  it("sends a forged or garbage token to the expired page", async () => {
    await signup({ email: "a@example.org" });
    for (const token of ["", "junk", `${(await rows())[0]!.id}.9999999999999.forged`]) {
      const res = await app.request(`/subscribers/confirm?token=${token}`);
      expect(res.headers.get("location")).toBe(`${WEB}/subscribe/expired`);
    }
    expect((await rows())[0]!.status).toBe("pending");
  });

  it("sends an expired token to the expired page", async () => {
    await signup({ email: "a@example.org" });
    const id = (await rows())[0]!.id;
    const old = signSubscriberToken(SECRET, "confirm", id, Date.now() - 3 * 24 * 3600 * 1000);
    await db.update(subscribers).set({ confirmToken: old }).where(eq(subscribers.id, id));
    const res = await app.request(`/subscribers/confirm?token=${old}`);
    expect(res.headers.get("location")).toBe(`${WEB}/subscribe/expired`);
  });

  it("unsubscribes and redirects", async () => {
    await signup({ email: "a@example.org" });
    const res = await app.request(path(sent[0]!.unsubscribeUrl));
    expect(res.headers.get("location")).toBe(`${WEB}/subscribe/unsubscribed`);
    expect((await rows())[0]).toMatchObject({ status: "unsubscribed", confirmToken: null });
  });

  it("does not accept a token for the wrong purpose", () => {
    const t = signSubscriberToken(SECRET, "unsubscribe", "id1");
    expect(verifySubscriberToken(SECRET, "confirm", t)).toBeNull();
    expect(verifySubscriberToken(SECRET, "unsubscribe", t)).toBe("id1");
    expect(verifySubscriberToken("other".repeat(10), "unsubscribe", t)).toBeNull();
  });
});

describe("turnstile bot check", () => {
  const reply = (body: unknown, ok = true) =>
    vi.fn().mockResolvedValue({ ok, json: async () => body });

  it("passes only when Cloudflare says success", async () => {
    const f = reply({ success: true });
    expect(await turnstileBotCheck("sec", f as never)({ token: "t", ip: "1.2.3.4" })).toBe(true);
    const form = (f.mock.calls[0]![1] as { body: URLSearchParams }).body;
    expect(form.get("secret")).toBe("sec");
    expect(form.get("response")).toBe("t");
    expect(form.get("remoteip")).toBe("1.2.3.4");
    expect(await turnstileBotCheck("sec", reply({ success: false }) as never)({ token: "t" })).toBe(
      false,
    );
  });

  it("rejects a missing token without calling Cloudflare, and on network errors", async () => {
    const f = reply({ success: true });
    expect(await turnstileBotCheck("sec", f as never)({})).toBe(false);
    expect(f).not.toHaveBeenCalled();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const down = vi.fn().mockRejectedValue(new Error("net"));
    expect(await turnstileBotCheck("sec", down as never)({ token: "t" })).toBe(false);
    err.mockRestore();
  });
});
