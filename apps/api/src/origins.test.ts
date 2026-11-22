import { describe, expect, it } from "vitest";
import { createTestDb } from "@kcom/db/test-db";
import { createApp } from "./app.js";
import { corsOriginPolicy, trustedOriginList } from "./origins.js";
import { seedUser } from "./seed-users.js";

const LISTED = "http://admin.test";

describe("corsOriginPolicy", () => {
  it("allows only the configured origins when localhost is off (production)", () => {
    const allow = corsOriginPolicy([LISTED], false);
    expect(allow(LISTED)).toBe(LISTED);
    expect(allow("http://localhost:5193")).toBeNull();
    expect(allow("http://127.0.0.1:5193")).toBeNull();
  });

  it("also allows any loopback port when localhost is on", () => {
    const allow = corsOriginPolicy([LISTED], true);
    expect(allow("http://localhost:5193")).toBe("http://localhost:5193");
    expect(allow("http://127.0.0.1:4341")).toBe("http://127.0.0.1:4341");
    expect(allow(LISTED)).toBe(LISTED);
  });

  it("still rejects look-alike and non-loopback origins when localhost is on", () => {
    const allow = corsOriginPolicy([], true);
    for (const origin of [
      "https://localhost:5193",
      "http://localhost",
      "http://localhost:5193.evil.example",
      "http://evil.example:5193",
      "http://localhost.evil.example:5193",
      "http://sub.localhost:5193",
    ]) {
      expect(allow(origin)).toBeNull();
    }
  });
});

describe("trustedOriginList", () => {
  it("adds loopback wildcards only when localhost is on", () => {
    expect(trustedOriginList([LISTED], false)).toEqual([LISTED]);
    expect(trustedOriginList([LISTED], true)).toEqual([
      LISTED,
      "http://localhost:*",
      "http://127.0.0.1:*",
    ]);
  });
});

describe("createApp with an unlisted localhost origin", () => {
  const WORKTREE = "http://localhost:5193";
  const signIn = async (allowLocalhostOrigins: boolean) => {
    const db = await createTestDb();
    await seedUser(db, {
      email: "a@example.test",
      password: "correct horse battery",
      role: "admin",
    });
    const app = createApp(db, {
      corsOrigins: [LISTED],
      allowLocalhostOrigins,
      auth: { secret: "x".repeat(40), baseURL: "http://api.test" },
    });
    return app.request("/api/auth/sign-in/email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: WORKTREE,
        "x-forwarded-for": "10.0.0.2",
      },
      body: JSON.stringify({ email: "a@example.test", password: "correct horse battery" }),
    });
  };

  it("signs in with CORS headers when localhost origins are allowed", async () => {
    const res = await signIn(true);
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe(WORKTREE);
  });

  it("sends no CORS headers for the same origin in production mode", async () => {
    const res = await signIn(false);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});
