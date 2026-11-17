import { and, asc, desc, eq, gte, isNull, lt, lte, or, sql } from "drizzle-orm";
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

const hasLiveCapsule = () =>
  sql`exists (select 1 from ${schema.capsules} where ${schema.capsules.seriesId} = ${schema.series.id} and ${isLive(schema.capsules)})`;

/** Series that have at least one live capsule, so draft-only series stay private. */
export async function listLiveSeries(db: CapsuleDb) {
  return db.select().from(schema.series).where(hasLiveCapsule()).orderBy(asc(schema.series.title));
}

export async function liveSeriesBySlug(db: CapsuleDb, slug: string) {
  const [row] = await db
    .select()
    .from(schema.series)
    .where(and(eq(schema.series.slug, slug), hasLiveCapsule()))
    .limit(1);
  return row ?? null;
}
