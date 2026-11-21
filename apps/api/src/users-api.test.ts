import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@kcom/db/test-db";
import { createApp } from "./app.js";
import type { Mailer } from "./auth.js";
import { seedUser } from "./seed-users.js";

const PASSWORD = "correct horse battery";
const ORIGIN = "http://admin.test";

type User = { id: string; email: string; role: string; deactivatedAt: string | null };

let app: ReturnType<typeof createApp>;
let admin: string;
let editor: string;
let resets: string[];
let mailerFails = false;

async function signInRes(email: string) {
  return app.request("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, "x-forwarded-for": "10.0.0.9" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
}
async function signIn(email: string) {
  const res = await signInRes(email);
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

const listUsers = async () => (await (await call("/users", admin)).json()) as User[];
const idOf = async (email: string) => (await listUsers()).find((u) => u.email === email)!.id;

beforeEach(async () => {
  const db = await createTestDb();
  resets = [];
  mailerFails = false;
  const mailer: Mailer = {
    sendPasswordReset: async (_to, url) => {
      if (mailerFails) throw new Error("mail down");
      resets.push(url);
    },
  };
  await seedUser(db, { email: "admin@example.test", password: PASSWORD, role: "admin" });
  await seedUser(db, { email: "editor@example.test", password: PASSWORD, role: "editor" });
  app = createApp(db, {
    corsOrigins: [ORIGIN],
    auth: { secret: "x".repeat(40), baseURL: "http://api.test", mailer },
  });
  admin = await signIn("admin@example.test");
  editor = await signIn("editor@example.test");
});

describe("role checks", () => {
  it("rejects anonymous with 401 and editors with 403 on every route", async () => {
    const id = await idOf("editor@example.test");
    const routes: [string, string, unknown?][] = [
      ["/users", "GET"],
      ["/users", "POST", { email: "x@example.test", role: "editor" }],
      [`/users/${id}`, "PATCH", { role: "admin" }],
      [`/users/${id}/deactivate`, "POST"],
      [`/users/${id}/reactivate`, "POST"],
      [`/users/${id}/resend-invite`, "POST"],
    ];
    for (const [path, method, body] of routes) {
      expect((await call(path, null, method, body)).status).toBe(401);
      expect((await call(path, editor, method, body)).status).toBe(403);
    }
    expect((await listUsers()).find((u) => u.id === id)!.role).toBe("editor");
  });
});

describe("invite", () => {
  it("lets an admin invite an editor, who can then set a password", async () => {
    const res = await call("/users", admin, "POST", { email: "New@Example.test", role: "editor" });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ email: "new@example.test", role: "editor" });
    expect(resets).toHaveLength(1);
  });

  it("rejects duplicates and bad input", async () => {
    const dup = await call("/users", admin, "POST", {
      email: "editor@example.test",
      role: "editor",
    });
    expect(dup.status).toBe(409);
    expect((await call("/users", admin, "POST", { email: "nope", role: "editor" })).status).toBe(
      400,
    );
    expect(
      (await call("/users", admin, "POST", { email: "a@example.test", role: "owner" })).status,
    ).toBe(400);
  });
});

describe("invite failures", () => {
  it("returns 409 for two racing invites, not 500", async () => {
    const body = { email: "race@example.test", role: "editor" };
    const results = await Promise.all([
      call("/users", admin, "POST", body),
      call("/users", admin, "POST", body),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  });

  it("keeps the user and returns 201 when the mailer throws, and allows a resend", async () => {
    mailerFails = true;
    const res = await call("/users", admin, "POST", { email: "mail@example.test", role: "editor" });
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as User;
    mailerFails = false;
    expect((await call(`/users/${id}/resend-invite`, admin, "POST")).status).toBe(204);
    expect(resets).toHaveLength(1);
    expect((await call(`/users/${id}/resend-invite`, editor, "POST")).status).toBe(403);
  });
});

describe("change role", () => {
  it("lets an admin promote and demote when another admin remains", async () => {
    const id = await idOf("editor@example.test");
    const up = await call(`/users/${id}`, admin, "PATCH", { role: "admin" });
    expect(up.status).toBe(200);
    expect(((await up.json()) as User).role).toBe("admin");
    const adminId = await idOf("admin@example.test");
    expect((await call(`/users/${adminId}`, admin, "PATCH", { role: "editor" })).status).toBe(200);
  });

  it("404s for an unknown user", async () => {
    expect((await call("/users/nope", admin, "PATCH", { role: "editor" })).status).toBe(404);
  });
});

describe("last admin", () => {
  it("cannot be demoted or deactivated", async () => {
    const id = await idOf("admin@example.test");
    const demote = await call(`/users/${id}`, admin, "PATCH", { role: "editor" });
    expect(demote.status).toBe(409);
    expect(await demote.json()).toMatchObject({ error: { code: "last_admin" } });
    expect((await call(`/users/${id}/deactivate`, admin, "POST")).status).toBe(409);
    expect((await listUsers()).find((u) => u.id === id)).toMatchObject({
      role: "admin",
      deactivatedAt: null,
    });
  });

  it("does not count a deactivated admin as an active one", async () => {
    const editorId = await idOf("editor@example.test");
    await call(`/users/${editorId}`, admin, "PATCH", { role: "admin" });
    expect((await call(`/users/${editorId}/deactivate`, admin, "POST")).status).toBe(200);
    const adminId = await idOf("admin@example.test");
    expect((await call(`/users/${adminId}`, admin, "PATCH", { role: "editor" })).status).toBe(409);
  });
});

describe("deactivate", () => {
  it("revokes sessions, blocks sign-in, and can be reversed", async () => {
    const id = await idOf("editor@example.test");
    expect((await call(`/users/${id}/deactivate`, admin, "POST")).status).toBe(200);
    expect((await call("/users", editor)).status).toBe(401);
    const blocked = await signInRes("editor@example.test");
    expect(blocked.status).toBe(403);
    expect(await blocked.json()).toMatchObject({ error: { message: "account deactivated" } });
    expect((await call(`/users/${id}/reactivate`, admin, "POST")).status).toBe(200);
    expect((await signInRes("editor@example.test")).status).toBe(200);
  });
});
