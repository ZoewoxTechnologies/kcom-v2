import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "@kcom/db/test-db";
import { imageUploadConfig } from "@kcom/media";
import { createApp } from "./app.js";
import { seedUser } from "./seed-users.js";

const PASSWORD = "correct horse battery";
const ORIGIN = "http://admin.test";
const cloudinary = { cloudName: "demo", apiKey: "key123", apiSecret: "secret456" };

let app: ReturnType<typeof createApp>;
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
  const db = await createTestDb();
  await seedUser(db, { email: "editor@example.test", password: PASSWORD, role: "editor" });
  app = createApp(db, {
    corsOrigins: [ORIGIN],
    auth: { secret: "x".repeat(40), baseURL: "http://api.test" },
    cloudinary,
  });
  editor = await signIn("editor@example.test");
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

  it("rejects users without content:write", async () => {
    const { rolePermissions } = await import("./permissions.js");
    const original = rolePermissions.editor;
    (rolePermissions as { editor: readonly string[] }).editor = ["content:read"];
    try {
      const res = await sign({ contentType: "image/png", size: 10 });
      expect(res.status).toBe(403);
    } finally {
      (rolePermissions as { editor: readonly string[] }).editor = original;
    }
  });

  it("rejects unsupported types", async () => {
    const res = await sign({ contentType: "image/gif", size: 10 });
    expect(res.status).toBe(422);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("unsupported_type");
  });

  it("rejects oversize files", async () => {
    const res = await sign({ contentType: "image/png", size: imageUploadConfig.maxBytes + 1 });
    expect(res.status).toBe(422);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("file_too_large");
  });

  it("rejects malformed bodies", async () => {
    expect((await sign({ contentType: "image/png" })).status).toBe(400);
  });

  it("returns a valid signature without leaking the secret", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    const res = await sign({ contentType: "image/webp", size: 1000 });
    vi.restoreAllMocks();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = (await res.json()) as { signature: string };
    expect(body).toMatchObject({
      uploadUrl: "https://api.cloudinary.com/v1_1/demo/image/upload",
      apiKey: "key123",
      maxBytes: imageUploadConfig.maxBytes,
      params: { allowed_formats: "png,jpg,webp", folder: "kcom", timestamp: 1_700_000_000 },
    });
    const expected = createHash("sha1")
      .update("allowed_formats=png,jpg,webp&folder=kcom&timestamp=1700000000secret456")
      .digest("hex");
    expect(body.signature).toBe(expected);
    expect(JSON.stringify(body)).not.toContain("secret456");
  });

  it("fails loudly (500, reported) when Cloudinary is not configured", async () => {
    const db = await createTestDb();
    await seedUser(db, { email: "e2@example.test", password: PASSWORD, role: "editor" });
    app = createApp(db, {
      corsOrigins: [ORIGIN],
      auth: { secret: "x".repeat(40), baseURL: "http://api.test" },
    });
    const res = await sign({ contentType: "image/png", size: 10 }, await signIn("e2@example.test"));
    expect(res.status).toBe(500);
  });
});
