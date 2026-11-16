import { beforeEach, describe, expect, it } from "vitest";
import { sessions } from "@kcom/db";
import { createTestDb } from "@kcom/db/test-db";
import { createApp } from "./app.js";
import { seedUser } from "./seed-users.js";
import type { Mailer } from "./auth.js";

const EMAIL = "admin@example.test";
const PASSWORD = "correct horse battery";
const ORIGIN = "http://admin.test";

let db: Awaited<ReturnType<typeof createTestDb>>;
let app: ReturnType<typeof createApp>;
let resets: string[];

beforeEach(async () => {
  db = await createTestDb();
  await seedUser(db, { email: EMAIL, password: PASSWORD, role: "admin" });
  resets = [];
  const mailer: Mailer = { sendPasswordReset: async (_to, url) => void resets.push(url) };
  app = createApp(db, {
    corsOrigins: [ORIGIN],
    auth: { secret: "x".repeat(40), baseURL: "http://api.test", mailer },
  });
});

const post = (path: string, body: unknown, cookie = "", ip = "10.0.0.1") =>
  app.request(`/api/auth${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, cookie, "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
const get = (path: string, cookie = "") =>
  app.request(`/api/auth${path}`, { headers: { origin: ORIGIN, cookie } });
const cookieOf = (res: Response) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");

async function signIn() {
  const res = await post("/sign-in/email", { email: EMAIL, password: PASSWORD });
  return { res, cookie: cookieOf(res) };
}

describe("auth", () => {
  it("signs in with a secure, httpOnly, cross-site session cookie", async () => {
    const { res, cookie } = await signIn();
    expect(res.status).toBe(200);
    const set = res.headers.getSetCookie().join("\n");
    expect(set).toMatch(/HttpOnly/i);
    expect(set).toMatch(/Secure/i);
    expect(set).toMatch(/SameSite=None/i);
    const session = (await (await get("/get-session", cookie)).json()) as {
      user: { email: string };
    };
    expect(session.user.email).toBe(EMAIL);
  });

  it("allows credentialed CORS from the admin origin only", async () => {
    const ok = await get("/get-session");
    expect(ok.headers.get("access-control-allow-credentials")).toBe("true");
    expect(ok.headers.get("access-control-allow-origin")).toBe(ORIGIN);
  });

  it("rejects a wrong password in the API error shape", async () => {
    const res = await post("/sign-in/email", { email: EMAIL, password: "wrong password!!" });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: unknown; message: unknown } };
    expect(body.error.code).toBeTypeOf("string");
    expect(body.error.message).toBeTypeOf("string");
    expect(res.headers.getSetCookie()).toHaveLength(0);
  });

  it("signs out and invalidates the session", async () => {
    const { cookie } = await signIn();
    expect((await post("/sign-out", {}, cookie)).status).toBe(200);
    expect(await (await get("/get-session", cookie)).json()).toBeNull();
  });

  it("treats an expired session as signed out", async () => {
    const { cookie } = await signIn();
    await db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) });
    expect(await (await get("/get-session", cookie)).json()).toBeNull();
  });

  it("has no public sign-up", async () => {
    const res = await post("/sign-up/email", {
      email: "new@example.test",
      password: PASSWORD,
      name: "New",
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("rate-limits repeated failed sign-ins", async () => {
    const bad = { email: EMAIL, password: "wrong password!!" };
    for (let i = 0; i < 5; i++) await post("/sign-in/email", bad, "", "10.0.0.9");
    const res = await post("/sign-in/email", { email: EMAIL, password: PASSWORD }, "", "10.0.0.9");
    expect(res.status).toBe(429);
    expect(((await res.json()) as { error?: unknown }).error).toBeDefined();
  });

  it("emails a reset link and accepts the new password", async () => {
    await post("/request-password-reset", { email: EMAIL, redirectTo: `${ORIGIN}/reset` });
    expect(resets).toHaveLength(1);
    const token = new URL(resets[0]!).pathname.split("/").pop();
    const next = "a brand new passphrase";
    const reset = await post("/reset-password", { newPassword: next, token });
    expect(reset.status).toBe(200);
    expect((await post("/sign-in/email", { email: EMAIL, password: next })).status).toBe(200);
    expect((await post("/sign-in/email", { email: EMAIL, password: PASSWORD })).status).toBe(401);
  });

  it("does not leak whether an email exists", async () => {
    const res = await post("/request-password-reset", { email: "nobody@example.test" });
    expect(res.status).toBe(200);
    expect(resets).toHaveLength(0);
  });
});
