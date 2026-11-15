import { and, desc, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema.js";

/** Any drizzle Postgres database (node-postgres in prod, pglite in tests). */
export type CapsuleDb = PgDatabase<PgQueryResultHKT, typeof schema>;

export async function latestCapsule(db: CapsuleDb) {
  const [row] = await db
    .select()
    .from(schema.capsules)
    .where(and(eq(schema.capsules.status, "published")))
    .orderBy(desc(schema.capsules.date), desc(schema.capsules.createdAt))
    .limit(1);
  return row ?? null;
}
