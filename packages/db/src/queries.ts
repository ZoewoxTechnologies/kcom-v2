import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  gt,
  gte,
  isNull,
  lt,
  lte,
  max,
  min,
  or,
  sql,
} from "drizzle-orm";
import type { AnyPgColumn, PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema.js";

/** Any drizzle Postgres database (node-postgres in prod, pglite in tests). */
export type CapsuleDb = PgDatabase<PgQueryResultHKT, typeof schema>;

export async function latestCapsule(db: CapsuleDb) {
  const [row] = await db
    .select()
    .from(schema.capsules)
    .where(and(eq(schema.capsules.status, "published"), lte(schema.capsules.publishAt, sql`now()`)))
    .orderBy(desc(schema.capsules.publishAt), desc(schema.capsules.createdAt))
    .limit(1);
  return row ?? null;
}

export async function capsuleBySlug(db: CapsuleDb, slug: string) {
  const [row] = await db
    .select()
    .from(schema.capsules)
    .where(
      and(
        eq(schema.capsules.slug, slug),
        eq(schema.capsules.status, "published"),
        lte(schema.capsules.publishAt, sql`now()`),
      ),
    )
    .limit(1);
  return row ?? null;
}

export type CapsuleFilters = {
  /** Half-open publish_at range [from, to). */
  from?: Date;
  to?: Date;
  seriesSlug?: string;
  limit: number;
  offset: number;
};

/**
 * Public-read filter for any publishable table: status is published and the
 * publish time has passed (a null publish time counts as live).
 */
export const isLive = (table: { status: AnyPgColumn; publishAt: AnyPgColumn }) =>
  and(eq(table.status, "published"), or(isNull(table.publishAt), lte(table.publishAt, sql`now()`)));

/** Published, already-live capsules, newest first. Never returns drafts or future capsules. */
export async function listPublishedCapsules(
  db: CapsuleDb,
  { from, to, seriesSlug, limit, offset }: CapsuleFilters,
) {
  return db
    .select({ capsule: schema.capsules })
    .from(schema.capsules)
    .leftJoin(schema.series, eq(schema.capsules.seriesId, schema.series.id))
    .where(
      and(
        isLive(schema.capsules),
        from ? gte(schema.capsules.publishAt, from) : undefined,
        to ? lt(schema.capsules.publishAt, to) : undefined,
        seriesSlug ? eq(schema.series.slug, seriesSlug) : undefined,
      ),
    )
    .orderBy(desc(schema.capsules.publishAt), desc(schema.capsules.createdAt))
    .limit(limit)
    .offset(offset)
    .then((rows) => rows.map((r) => r.capsule));
}

/** The published, live capsule whose publish_at falls in [from, to). */
export async function capsuleByRange(db: CapsuleDb, from: Date, to: Date) {
  const [row] = await db
    .select()
    .from(schema.capsules)
    .where(
      and(
        isLive(schema.capsules),
        gte(schema.capsules.publishAt, from),
        lt(schema.capsules.publishAt, to),
      ),
    )
    .orderBy(desc(schema.capsules.publishAt), desc(schema.capsules.createdAt))
    .limit(1);
  return row ?? null;
}

/**
 * The live capsules just before and just after `capsule` in publishing order (publish_at, then id,
 * so capsules sharing a timestamp each see the other). Null at either end.
 */
export async function capsuleNeighbours(db: CapsuleDb, capsule: { id: string; publishAt: Date }) {
  const c = schema.capsules;
  const nearest = (before: boolean) =>
    db
      .select()
      .from(c)
      .where(
        and(
          isLive(c),
          before
            ? or(
                lt(c.publishAt, capsule.publishAt),
                and(eq(c.publishAt, capsule.publishAt), lt(c.id, capsule.id)),
              )
            : or(
                gt(c.publishAt, capsule.publishAt),
                and(eq(c.publishAt, capsule.publishAt), gt(c.id, capsule.id)),
              ),
        ),
      )
      .orderBy(...(before ? [desc(c.publishAt), desc(c.id)] : [asc(c.publishAt), asc(c.id)]))
      .limit(1)
      .then(([row]) => row ?? null);
  const [prev, next] = await Promise.all([nearest(true), nearest(false)]);
  return { prev, next };
}

/**
 * Series with at least one live capsule (draft-only series stay private), each with
 * figures computed over its live capsules: how many, when the first and latest went live,
 * and the highest part number.
 */
function liveSeriesWithStats(db: CapsuleDb) {
  return db
    .select({
      ...getTableColumns(schema.series),
      capsuleCount: count(),
      firstPublishAt: min(schema.capsules.publishAt),
      lastPublishAt: max(schema.capsules.publishAt),
      latestPart: max(schema.capsules.partNumber),
    })
    .from(schema.series)
    .innerJoin(
      schema.capsules,
      and(eq(schema.capsules.seriesId, schema.series.id), isLive(schema.capsules)),
    )
    .groupBy(schema.series.id);
}

export async function listLiveSeries(db: CapsuleDb) {
  return liveSeriesWithStats(db).orderBy(asc(schema.series.title));
}

export async function liveSeriesBySlug(db: CapsuleDb, slug: string) {
  const [row] = await liveSeriesWithStats(db).where(eq(schema.series.slug, slug)).limit(1);
  return row ?? null;
}
