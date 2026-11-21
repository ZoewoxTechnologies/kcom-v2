import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "@kcom/db/test-db";
import { imageUploadConfig } from "@kcom/media";
import { createApp } from "./app.js";
import { seedUser } from "./seed-users.js";

const PASSWORD = "correct horse battery";
const ORIGIN = "http://admin.test";
const cloudinary = {
  cloudName: "demo",
  apiKey: "key123",
  apiSecret: "secret456",
  uploadPreset: "kcom_signed",
};

let app: ReturnType<typeof createApp>;
let db: Awaited<ReturnType<typeof createTestDb>>;
let viewer: string;
let editor: string;

async function signIn(email: string) {
  const res = await app.request("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, "x-forwarded-for": "10.0.0.3" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  return res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

beforeEach(async () => {
  db = await createTestDb();
  await seedUser(db, { email: "viewer@example.test", password: PASSWORD, role: "editor" });
  await seedUser(db, { email: "editor@example.test", password: PASSWORD, role: "editor" });
  app = createApp(db, {
    corsOrigins: [ORIGIN],
    auth: { secret: "x".repeat(40), baseURL: "http://api.test" },
    cloudinary,
  });
  editor = await signIn("editor@example.test");
  viewer = await signIn("viewer@example.test");
});

const sign = (body: unknown, cookie: string | null = editor) =>
  app.request("/admin/uploads/sign", {
    method: "POST",
    headers: { origin: ORIGIN, "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });

describe("admin uploads", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await sign({ contentType: "image/png", size: 10 }, null);
    expect(res.status).toBe(401);
  });

  it("rejects users whose role lacks content:write", async () => {
    // Every real role can write, so drop the role check constraint and use an unknown role.
    await db.execute(sql`ALTER TABLE users DROP CONSTRAINT users_role_valid`);
    await db.execute(sql`UPDATE users SET role = 'viewer' WHERE email = 'viewer@example.test'`);
    const res = await sign({ contentType: "image/png", size: 10 }, viewer);
    expect(res.status).toBe(403);
  });

  it("rejects unsupported types", async () => {
    const res = await sign({ contentType: "image/gif", size: 10 });
    expect(res.status).toBe(400);
  });

  it("rejects prototype keys and unknown fields", async () => {
    for (const contentType of ["toString", "constructor", "__proto__"]) {
      expect((await sign({ contentType, size: 10 })).status, contentType).toBe(400);
    }
    expect((await sign({ contentType: "image/png", size: 10, extra: 1 })).status).toBe(400);
  });

  it("rejects oversize files", async () => {
    const res = await sign({ contentType: "image/png", size: imageUploadConfig.maxBytes + 1 });
    expect(res.status).toBe(422);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("file_too_large");
  });

  it("rejects malformed bodies", async () => {
    expect((await sign({ contentType: "image/png" })).status).toBe(400);
  });

  it("signs without an upload preset when none is configured", async () => {
    const noPreset = {
      cloudName: cloudinary.cloudName,
      apiKey: cloudinary.apiKey,
      apiSecret: cloudinary.apiSecret,
    };
    app = createApp(db, {
      corsOrigins: [ORIGIN],
      auth: { secret: "x".repeat(40), baseURL: "http://api.test" },
      cloudinary: noPreset,
    });
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    const res = await sign({ contentType: "image/png", size: 1000 });
    vi.restoreAllMocks();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { signature: string; params: Record<string, unknown> };
    expect(body.params).not.toHaveProperty("upload_preset");
    const expected = createHash("sha1")
      .update(`context=${body.params.context}&timestamp=1700000000secret456`)
      .digest("hex");
    expect(body.signature).toBe(expected);
  });

  it("returns a valid signature without leaking the secret", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    const res = await sign({ contentType: "image/webp", size: 1000 });
    vi.restoreAllMocks();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = (await res.json()) as { signature: string; params: { context: string } };
    expect(body).toMatchObject({
      uploadUrl: "https://api.cloudinary.com/v1_1/demo/image/upload",
      apiKey: "key123",
      maxBytes: imageUploadConfig.maxBytes,
      params: { upload_preset: "kcom_signed", timestamp: 1_700_000_000 },
    });
    const expected = createHash("sha1")
      .update(
        `context=${body.params.context}&timestamp=1700000000&upload_preset=kcom_signedsecret456`,
      )
      .digest("hex");
    expect(body.signature).toBe(expected);
    expect(JSON.stringify(body)).not.toContain("secret456");
  });

  it("returns 503 when Cloudinary is not configured", async () => {
    const db = await createTestDb();
    await seedUser(db, { email: "e2@example.test", password: PASSWORD, role: "editor" });
    app = createApp(db, {
      corsOrigins: [ORIGIN],
      auth: { secret: "x".repeat(40), baseURL: "http://api.test" },
    });
    const res = await sign({ contentType: "image/png", size: 10 }, await signIn("e2@example.test"));
    expect(res.status).toBe(503);
  });

  it("rate limits signing per user", async () => {
    let last = 0;
    for (let n = 0; n < 21; n++) last = (await sign({ contentType: "image/png", size: 10 })).status;
    expect(last).toBe(429);
    expect((await sign({ contentType: "image/png", size: 10 }, viewer)).status).toBe(200);
  });
});
