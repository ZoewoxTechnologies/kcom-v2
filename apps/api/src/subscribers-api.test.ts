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
let admin: string;

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
  await seedUser(db, { email: "admin@example.test", password: PASSWORD, role: "admin" });
  app = createApp(db, { corsOrigins: [ORIGIN], auth: authOpts });
  editor = await signIn("editor@example.test");
  admin = await signIn("admin@example.test");
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

type ListBody = {
  items: { email: string; name: string | null }[];
  total: number;
  counts: Record<string, number>;
};
const json = async (res: Response) => (await res.json()) as ListBody;

const req = (path: string, cookie: string | null) =>
  app.request(`/admin/subscribers${path}`, {
    headers: { origin: ORIGIN, ...(cookie ? { cookie } : {}) },
  });

async function seedMany() {
  await db.insert(subscribers).values([
    {
      email: "grace@example.org",
      name: "Grace Adeyemi",
      status: "confirmed",
      subscribedAt: new Date("2026-11-14T10:00:00Z"),
    },
    {
      email: "ruth@example.org",
      name: "Ruth Bello",
      status: "pending",
      subscribedAt: new Date("2026-11-11T10:00:00Z"),
    },
    {
      email: "esther@example.org",
      name: "Esther 100%",
      status: "unsubscribed",
      subscribedAt: new Date("2026-10-28T10:00:00Z"),
    },
  ]);
}

describe("GET /admin/subscribers", () => {
  it("needs a session", async () => {
    expect((await req("", null)).status).toBe(401);
  });

  it("lists newest first with total and per-status counts", async () => {
    await seedMany();
    const body = await json(await req("", editor));
    expect(body.items.map((i) => i.email)).toEqual([
      "grace@example.org",
      "ruth@example.org",
      "esther@example.org",
    ]);
    expect(body.total).toBe(3);
    expect(body.counts).toEqual({ pending: 1, confirmed: 1, unsubscribed: 1 });
    expect(body.items[0]).not.toHaveProperty("confirmToken");
  });

  it("filters by status, searches name or email, and pages", async () => {
    await seedMany();
    expect((await json(await req("?status=pending", editor))).total).toBe(1);
    expect((await json(await req("?q=ADEYEMI", editor))).items).toHaveLength(1);
    expect((await json(await req("?q=ruth%40", editor))).items).toHaveLength(1);
    const paged = await json(await req("?limit=1&offset=1&sort=email&dir=asc", editor));
    expect(paged.items[0]!.email).toBe("grace@example.org");
    expect(paged.total).toBe(3);
  });

  it("treats % in the search text literally", async () => {
    await seedMany();
    const body = await json(await req("?q=%25", editor));
    expect(body.items.map((i) => i.name)).toEqual(["Esther 100%"]);
  });
});

describe("GET /admin/subscribers/export.csv", () => {
  it("is admin only", async () => {
    expect((await req("/export.csv", null)).status).toBe(401);
    expect((await req("/export.csv", editor)).status).toBe(403);
  });

  it("includes status and signup date, honours filters, and neutralises formulas", async () => {
    await seedMany();
    await db.insert(subscribers).values({
      email: "x@example.org",
      name: "=HYPERLINK(1)",
      status: "confirmed",
      subscribedAt: new Date("2026-01-02T10:00:00Z"),
    });
    const res = await req("/export.csv", admin);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("subscribers.csv");
    const lines = (await res.text()).trim().split("\r\n");
    expect(lines[0]).toBe("email,name,status,signup_date,confirmed_date");
    expect(lines[1]).toBe("grace@example.org,Grace Adeyemi,confirmed,2026-11-14,");
    expect(lines).toContain("x@example.org,'=HYPERLINK(1),confirmed,2026-01-02,");
    const pending = (await (await req("/export.csv?status=pending", admin)).text())
      .trim()
      .split("\r\n");
    expect(pending).toHaveLength(2);
  });
});
