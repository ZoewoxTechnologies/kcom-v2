import { Hono } from "hono";
import { hc } from "hono/client";
import { beforeEach, describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import { books } from "@kcom/db";
import { createTestDb } from "@kcom/db/test-db";
import { errorHandler } from "../errors.js";
import type { AuthEnv } from "../require-permission.js";
import { adminCrudRoutes, publicContentRoutes } from "./crud.js";

const fields = {
  title: z.string().min(1),
  slug: z.string().min(1),
  status: z.enum(["draft", "scheduled", "published"]),
  publishAt: z.coerce.date().nullable(),
};
const createBody = z.strictObject({
  ...fields,
  status: fields.status.default("draft"),
  publishAt: fields.publishAt.default(null),
});
const updateBody = z.strictObject(fields).partial();

function build(db: Awaited<ReturnType<typeof createTestDb>>) {
  const admin = adminCrudRoutes({
    db,
    table: books,
    label: "book",
    createBody,
    updateBody,
    orderBy: [books.title],
    present: (row) => ({ id: row.id, title: row.title, shout: row.title.toUpperCase() }),
  });
  const asEditor = new Hono<AuthEnv>().use(async (c, next) => {
    c.set("user", { id: "u", email: "e@example.test", name: "E", role: "editor" });
    await next();
  });
  return new Hono()
    .onError(errorHandler)
    .route("/admin", asEditor.route("/", admin))
    .route(
      "/pub",
      publicContentRoutes({ db, table: books, label: "book", orderBy: [books.title] }),
    );
}

let app: ReturnType<typeof build>;

beforeEach(async () => {
  app = build(await createTestDb());
});

const send = (method: string, path: string, body?: unknown) =>
  app.request(path, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

describe("content CRUD factories", () => {
  it("serves admin CRUD, listing, errors and public reads for any publishable table", async () => {
    const created = await send("POST", "/admin", { title: "B", slug: "b" });
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as { id: string };
    expect((await send("POST", "/admin", { title: "B", slug: "b" })).status).toBe(409);
    expect((await send("POST", "/admin", { title: "B", slug: "c", extra: 1 })).status).toBe(400);

    expect(await (await send("GET", "/admin?status=draft")).json()).toMatchObject({ total: 1 });
    expect(await (await send("GET", "/admin?status=published")).json()).toMatchObject({
      total: 0,
    });
    expect(await (await send("GET", "/pub")).json()).toEqual([]);
    expect((await send("GET", "/pub/b")).status).toBe(404);

    await send("PATCH", `/admin/${id}`, { status: "published" });
    expect(await (await send("GET", "/pub")).json()).toHaveLength(1);
    const one = await send("GET", "/pub/b");
    expect(one.headers.get("cache-control")).toBe("public, max-age=60");
    expect(one.status).toBe(200);

    expect((await send("DELETE", `/admin/${id}`)).status).toBe(204);
    expect((await send("DELETE", `/admin/${id}`)).status).toBe(404);
  });

  it("keeps response types for RPC clients", async () => {
    const client = hc<typeof app>("http://api.test", { fetch: app.request.bind(app) });
    type Presented = { id: string; title: string; shout: string };

    const created = await client.admin.$post({
      json: { title: "B", slug: "b", status: "draft", publishAt: null },
    });
    if (created.status !== 201) throw new Error("expected 201");
    expectTypeOf(await created.json()).toEqualTypeOf<Presented>();

    const list = await client.admin.$get({ query: { limit: "10", offset: "0" } });
    expectTypeOf(await list.json()).toEqualTypeOf<{ items: Presented[]; total: number }>();

    const pub = await client.pub.$get({ query: { limit: "10", offset: "0" } });
    const rows = await pub.json();
    expectTypeOf(rows).items.toHaveProperty("slug");
    expectTypeOf(rows).not.toBeUnknown();
  });
});
