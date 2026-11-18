import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import { userRoles } from "@kcom/permissions";
import { createTestDb } from "@kcom/db/test-db";
import { createApp } from "./app.js";
import { createAuth } from "./auth.js";
import { errorHandler } from "./errors.js";
import { can, permissions, rolePermissions } from "./permissions.js";
import { requirePermission, type AuthEnv } from "./require-permission.js";
import { seedUser } from "./seed-users.js";

const PASSWORD = "correct horse battery";
const ORIGIN = "http://admin.test";
const authOpts = { secret: "x".repeat(40), baseURL: "http://api.test" };

let db: Awaited<ReturnType<typeof createTestDb>>;
let app: ReturnType<typeof createApp>;
let guarded: Hono<AuthEnv>;

beforeEach(async () => {
  db = await createTestDb();
  await seedUser(db, { email: "admin@example.test", password: PASSWORD, role: "admin" });
  await seedUser(db, { email: "editor@example.test", password: PASSWORD, role: "editor" });
  app = createApp(db, { corsOrigins: [ORIGIN], auth: authOpts });
  const auth = createAuth(db, { trustedOrigins: [ORIGIN], ...authOpts });
  guarded = new Hono<AuthEnv>().onError(errorHandler);
  for (const p of permissions) {
    guarded.get(`/${p}`, requirePermission(auth, p), (c) => c.json({ role: c.var.user.role }));
  }
});

async function signIn(email: string) {
  const res = await app.request("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, "x-forwarded-for": "10.0.0.1" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  expect(res.status).toBe(200);
  return res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

describe("role table", () => {
  it("defines permissions for exactly the known roles", () => {
    expect(Object.keys(rolePermissions).sort()).toEqual([...userRoles].sort());
  });
  it("lets editors draft and publish but not manage users", () => {
    expect(can("editor", "content:write")).toBe(true);
    expect(can("editor", "content:publish")).toBe(true);
    expect(can("editor", "users:manage")).toBe(false);
  });
  it("gives admins every permission", () => {
    for (const p of permissions) expect(can("admin", p)).toBe(true);
  });
});

describe("requirePermission", () => {
  it.each(permissions)("returns 401 without a session for %s", async (p) => {
    const res = await guarded.request(`/${p}`);
    expect(res.status).toBe(401);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("unauthenticated");
  });

  it("rejects a forged cookie", async () => {
    const res = await guarded.request("/content:read", {
      headers: { cookie: "better-auth.session_token=bogus" },
    });
    expect(res.status).toBe(401);
  });

  it.each(permissions)("admin may use %s", async (p) => {
    const cookie = await signIn("admin@example.test");
    const res = await guarded.request(`/${p}`, { headers: { cookie, origin: ORIGIN } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ role: "admin" });
  });

  it.each(permissions)("editor gets the role's answer for %s", async (p) => {
    const cookie = await signIn("editor@example.test");
    const res = await guarded.request(`/${p}`, { headers: { cookie, origin: ORIGIN } });
    expect(res.status).toBe(can("editor", p) ? 200 : 403);
  });
});

describe("GET /users", () => {
  it("is 401 anonymous, 403 for editors, and lists users for admins", async () => {
    expect((await app.request("/users")).status).toBe(401);
    const editor = await signIn("editor@example.test");
    expect((await app.request("/users", { headers: { cookie: editor } })).status).toBe(403);
    const admin = await signIn("admin@example.test");
    const res = await app.request("/users", { headers: { cookie: admin } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      expect.objectContaining({ email: "admin@example.test", role: "admin" }),
      expect.objectContaining({ email: "editor@example.test", role: "editor" }),
    ]);
  });
});

describe("seedUser", () => {
  it("generates a password once and updates roles without touching it", async () => {
    const first = await seedUser(db, { email: "New@Example.test", role: "editor" });
    expect(first.email).toBe("new@example.test");
    expect(first.generatedPassword).toBeTruthy();
    const again = await seedUser(db, { email: "new@example.test", role: "admin" });
    expect(again.generatedPassword).toBeUndefined();
  });
});
