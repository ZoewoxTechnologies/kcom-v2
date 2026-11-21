import { beforeEach, describe, expect, it } from "vitest";
import { subscribers } from "@kcom/db";
import { createTestDb } from "@kcom/db/test-db";
import { createApp } from "./app.js";
import { seedUser } from "./seed-users.js";

const PASSWORD = "correct horse battery";
const ORIGIN = "http://admin.test";
const authOpts = { secret: "x".repeat(40), baseURL: "http://api.test" };

let db: Awaited<ReturnType<typeof createTestDb>>;
let app: ReturnType<typeof createApp>;
let editor: string;

async function signIn(email: string) {
  const res = await app.request("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, "x-forwarded-for": "10.0.0.1" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  return res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}
const get = (cookie: string | null) =>
  app.request("/admin/subscribers/count", {
    headers: { origin: ORIGIN, ...(cookie ? { cookie } : {}) },
  });

beforeEach(async () => {
  db = await createTestDb();
  await seedUser(db, { email: "editor@example.test", password: PASSWORD, role: "editor" });
  app = createApp(db, { corsOrigins: [ORIGIN], auth: authOpts });
  editor = await signIn("editor@example.test");
});

describe("GET /admin/subscribers/count", () => {
  it("needs a session", async () => {
    expect((await get(null)).status).toBe(401);
  });

  it("is zero with no subscribers", async () => {
    const res = await get(editor);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ confirmed: 0, addedThisMonth: 0 });
  });

  it("counts confirmed subscribers only, and those confirmed this month", async () => {
    const now = new Date();
    const old = new Date("2020-01-15T12:00:00Z");
    await db.insert(subscribers).values([
      { email: "a@example.org", status: "confirmed", confirmedAt: now },
      { email: "b@example.org", status: "confirmed", confirmedAt: old },
      { email: "c@example.org", status: "pending" },
      { email: "d@example.org", status: "unsubscribed", confirmedAt: now },
    ]);
    const body = await (await get(editor)).json();
    expect(body).toEqual({ confirmed: 2, addedThisMonth: 1 });
  });
});
