import { Hono } from "hono";
import { and, count, eq, type SQL } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import type { ZodType } from "zod";
import { z } from "zod";
import { isLive, type CapsuleDb } from "@kcom/db";
import { requireCan, type AuthEnv } from "../require-permission.js";
import { validate } from "../validate.js";
import { assertCanChange, findById, notFound, publicCache } from "./access.js";
import { rethrowWriteError, type WriteErrorOptions } from "./write-errors.js";
import { idParam, pagination, publishStatus, slugParam } from "./schemas.js";

type Status = "draft" | "scheduled" | "published";
type Publishable = PgTable & { id: AnyPgColumn; status: AnyPgColumn };
/** Columns or SQL expressions such as `desc(col)`. */
type OrderBy = AnyPgColumn | SQL;
type Row<T extends PgTable> = T["$inferSelect"];

export type AdminCrudOptions<
  T extends Publishable,
  C extends ZodType,
  U extends ZodType,
  Out = Row<T>,
> = {
  db: CapsuleDb;
  table: T;
  /** Singular name used in 404 messages, e.g. "post". */
  label: string;
  /** Full body for create (defaults applied). Must be a strict object. */
  createBody: C;
  /** Partial body for update. Must be a strict object. */
  updateBody: U;
  /** List ordering. */
  orderBy: OrderBy[];
  /** Messages for unique/foreign-key/check violations. */
  errors?: WriteErrorOptions;
  /** Shape a row before it is returned (e.g. add a computed field). */
  present?: (row: Row<T>) => Out;
};

/**
 * Editor/admin CRUD for a publishable table: list (`{ items, total }`, status
 * filter, pagination), get, create, patch and delete. Sign-in and role are
 * checked by the /admin group; writes need `content:write` and go through
 * `assertCanChange`. Chain extra routes on the returned router if needed.
 */
export function adminCrudRoutes<
  T extends Publishable,
  C extends ZodType,
  U extends ZodType,
  Out = Row<T>,
>(opts: AdminCrudOptions<T, C, U, Out>) {
  const { db, table, label, createBody, updateBody, orderBy, errors } = opts;
  const present = (opts.present ?? ((row: Row<T>) => row)) as (row: Row<T>) => Out;
  const write = requireCan("content:write");
  const listQuery = z.object({ status: publishStatus.optional(), ...pagination() });
  const writeErrors = { label: `${label} slug`, ...errors };
  const byId = (id: string) => findById(db, table, id, label);
  const publishAtOf = (b: Record<string, unknown>) => b.publishAt ?? undefined;

  return new Hono<AuthEnv>()
    .get("/", validate("query", listQuery), async (c) => {
      const { status, limit, offset } = c.req.valid("query");
      const where = status ? eq(table.status, status) : undefined;
      const [rows, [counted]] = await Promise.all([
        db
          .select()
          .from(table as PgTable)
          .where(where)
          .orderBy(...orderBy)
          .limit(limit)
          .offset(offset),
        db
          .select({ total: count() })
          .from(table as PgTable)
          .where(where),
      ]);
      return c.json({ items: (rows as Row<T>[]).map(present), total: counted?.total ?? 0 });
    })
    .get("/:id", validate("param", idParam), async (c) =>
      c.json(present(await byId(c.req.valid("param").id))),
    )
    .post("/", write, validate("json", createBody), async (c) => {
      const body = c.req.valid("json");
      const fields = body as Record<string, unknown>;
      assertCanChange(c, null, fields.status as Status | undefined, publishAtOf(fields));
      try {
        const rows = (await db
          .insert(table)
          .values(body as unknown as T["$inferInsert"])
          .returning()) as Row<T>[];
        return c.json(present(rows[0]!), 201);
      } catch (err) {
        rethrowWriteError(err, writeErrors);
      }
    })
    .patch("/:id", write, validate("param", idParam), validate("json", updateBody), async (c) => {
      const { id } = c.req.valid("param");
      const patch = c.req.valid("json");
      const fields = patch as Record<string, unknown>;
      const existing = (await byId(id)) as { status: Status };
      assertCanChange(c, existing.status, fields.status as Status | undefined, publishAtOf(fields));
      try {
        const rows = (await db
          .update(table)
          .set(patch as unknown as Partial<T["$inferInsert"]>)
          .where(eq(table.id, id))
          .returning()) as Row<T>[];
        return c.json(present(rows[0]!));
      } catch (err) {
        rethrowWriteError(err, writeErrors);
      }
    })
    .delete("/:id", write, validate("param", idParam), async (c) => {
      const { id } = c.req.valid("param");
      assertCanChange(c, ((await byId(id)) as { status: Status }).status);
      const rows = await db.delete(table).where(eq(table.id, id)).returning({ id: table.id });
      if (rows.length === 0) throw notFound(label);
      return c.body(null, 204);
    });
}

type Live = PgTable & { slug: AnyPgColumn; status: AnyPgColumn; publishAt: AnyPgColumn };

export type PublicRoutesOptions<T extends Live, Out = Row<T>> = {
  db: CapsuleDb;
  table: T;
  label: string;
  orderBy: OrderBy[];
  present?: (row: Row<T>) => Out;
};

/**
 * Public, read-only, cacheable: a paginated list and a by-slug lookup, both
 * limited to live content (published, publish time passed).
 */
export function publicContentRoutes<T extends Live, Out = Row<T>>(
  opts: PublicRoutesOptions<T, Out>,
) {
  const { db, table, label, orderBy } = opts;
  const present = (opts.present ?? ((row: Row<T>) => row)) as (row: Row<T>) => Out;
  const listQuery = z.object(pagination());

  return new Hono()
    .use(publicCache)
    .get("/", validate("query", listQuery), async (c) => {
      const { limit, offset } = c.req.valid("query");
      const rows = await db
        .select()
        .from(table as PgTable)
        .where(isLive(table))
        .orderBy(...orderBy)
        .limit(limit)
        .offset(offset);
      return c.json((rows as Row<T>[]).map(present));
    })
    .get("/:slug", validate("param", slugParam), async (c) => {
      const [row] = await db
        .select()
        .from(table as PgTable)
        .where(and(eq(table.slug, c.req.valid("param").slug), isLive(table)))
        .limit(1);
      if (!row) throw notFound(label);
      return c.json(present(row as Row<T>));
    });
}
