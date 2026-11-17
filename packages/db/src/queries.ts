import { and, desc, eq, gte, lt, lte, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
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

const isLive = () =>
  and(eq(schema.capsules.status, "published"), lte(schema.capsules.publishAt, sql`now()`));

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
        isLive(),
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
    .where(and(isLive(), gte(schema.capsules.publishAt, from), lt(schema.capsules.publishAt, to)))
    .orderBy(desc(schema.capsules.publishAt), desc(schema.capsules.createdAt))
    .limit(1);
  return row ?? null;
}
