import { and, eq, inArray, isNotNull } from "drizzle-orm";
import type { Capsule } from "@kcom/content";
import { blogPosts, capsules, redirects, series, type CapsuleDb } from "@kcom/db";
import type { BlogRecord } from "./blog.ts";
import type { Redirect } from "./redirects.ts";
import type { SeriesRecord } from "./transform.ts";

export interface KindCounts {
  inserted: number;
  updated: number;
  unchanged: number;
}

export interface ImportResult {
  series: KindCounts;
  capsules: KindCounts;
  posts: KindCounts;
  redirects: KindCounts;
  /** Rows in the database that came from the legacy site, after the run. */
  inDatabase: { series: number; capsules: number; posts: number; redirects: number };
}

export interface ImportInput {
  series: SeriesRecord[];
  capsules: Capsule[];
  posts: BlogRecord[];
  redirects: Redirect[];
}

export interface ImportOptions {
  /** Final-sync mode: import only capsules and posts changed after this instant (Drupal `changed`). */
  since?: Date;
  /** Run everything, then roll back. */
  dryRun?: boolean;
}

const CHUNK = 200;
const chunks = <T>(list: T[]) => Array.from({ length: Math.ceil(list.length / CHUNK) }, (_, i) => list.slice(i * CHUNK, (i + 1) * CHUNK));
const none = (): KindCounts => ({ inserted: 0, updated: 0, unchanged: 0 });

/** Compares values the way they are stored: dates by instant, everything else as JSON. */
const same = (a: unknown, b: unknown) => JSON.stringify(a, replacer) === JSON.stringify(b, replacer);
/** Dates by instant; object keys sorted, because jsonb does not keep key order. */
const replacer = (_: string, v: unknown) => {
  if (v instanceof Date) return v.toISOString();
  if (v && typeof v === "object" && !Array.isArray(v)) return Object.fromEntries(Object.entries(v).sort(([x], [y]) => x.localeCompare(y)));
  return v;
};

/**
 * Writes the legacy content to the database. Rows are matched on their legacy node id (series and
 * redirects on slug and old path), inserted when new and updated only when a field differs, so a
 * second run reports everything unchanged and touches nothing.
 */
export async function importContent(db: CapsuleDb, input: ImportInput, options: ImportOptions = {}): Promise<ImportResult> {
  const { since, dryRun = false } = options;
  const changed = <T extends { updatedAt: Date }>(rows: T[]) => (since ? rows.filter((r) => r.updatedAt > since) : rows);

  class DryRun extends Error {}
  let result: ImportResult | undefined;
  try {
    await db.transaction(async (tx) => {
      const res: ImportResult = { series: none(), capsules: none(), posts: none(), redirects: none(), inDatabase: { series: 0, capsules: 0, posts: 0, redirects: 0 } };

      // Series first: capsules point at them. The transform's stand-in id is the slug.
      const existingSeries = new Map((await tx.select().from(series)).map((s) => [s.slug, s]));
      for (const s of input.series) {
        const row = existingSeries.get(s.slug);
        if (!row) {
          const [made] = await tx.insert(series).values({ slug: s.slug, title: s.title }).returning();
          existingSeries.set(s.slug, made!);
          res.series.inserted++;
        } else if (row.title !== s.title) {
          await tx.update(series).set({ title: s.title }).where(eq(series.id, row.id));
          res.series.updated++;
        } else res.series.unchanged++;
      }
      const seriesId = (stand: string | null) => (stand ? (existingSeries.get(stand)?.id ?? null) : null);

      const capsuleRows = changed(input.capsules).map((c) => ({
        legacyNid: c.legacyNid!,
        legacyPath: c.legacyPath,
        slug: c.slug,
        title: c.title,
        status: c.status,
        publishAt: c.publishAt,
        scriptureRef: c.scriptureRef,
        scriptureText: c.scriptureText,
        body: c.body,
        decrees: c.decrees,
        prayer: c.prayer,
        bibleMeditation: c.bibleMeditation,
        authorSource: c.authorSource,
        seriesId: seriesId(c.seriesId),
        partNumber: c.partNumber,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      }));
      res.capsules = await upsertByNid(tx, capsules, capsuleRows, (nids) => tx.select().from(capsules).where(inArray(capsules.legacyNid, nids)));

      const postRows = changed(input.posts).map((p) => ({
        legacyNid: p.legacyNid,
        legacyPath: p.legacyPath,
        slug: p.slug,
        title: p.title,
        date: p.date,
        body: p.body,
        tags: p.tags,
        status: "published" as const,
        publishAt: p.publishAt,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }));
      res.posts = await upsertByNid(tx, blogPosts, postRows, (nids) => tx.select().from(blogPosts).where(inArray(blogPosts.legacyNid, nids)));

      const existingRedirects = new Map((await tx.select().from(redirects)).map((r) => [r.fromPath, r]));
      const newRedirects = [];
      for (const r of input.redirects) {
        const row = existingRedirects.get(r.from);
        if (!row) newRedirects.push({ fromPath: r.from, toPath: r.to, status: 301 });
        else if (row.toPath !== r.to || row.status !== 301) {
          await tx.update(redirects).set({ toPath: r.to, status: 301 }).where(eq(redirects.id, row.id));
          res.redirects.updated++;
        } else res.redirects.unchanged++;
      }
      for (const batch of chunks(newRedirects)) await tx.insert(redirects).values(batch);
      res.redirects.inserted = newRedirects.length;

      const count = async (table: typeof capsules | typeof blogPosts) => (await tx.select({ n: table.legacyNid }).from(table).where(isNotNull(table.legacyNid))).length;
      res.inDatabase = {
        series: existingSeries.size,
        capsules: await count(capsules),
        posts: await count(blogPosts),
        redirects: (await tx.select({ id: redirects.id }).from(redirects)).length,
      };
      result = res;
      if (dryRun) throw new DryRun();
    });
  } catch (e) {
    if (!(e instanceof DryRun)) throw e;
  }
  return result!;
}

type Writable = typeof capsules | typeof blogPosts;
type Row = { legacyNid: number; updatedAt: Date } & Record<string, unknown>;

/** Inserts rows with a new legacy node id and updates those whose fields differ; counts each outcome. */
async function upsertByNid(
  tx: CapsuleDb,
  table: Writable,
  rows: Row[],
  load: (nids: number[]) => Promise<Record<string, unknown>[]>,
): Promise<KindCounts> {
  const counts = none();
  const existing = new Map<number, Record<string, unknown>>();
  for (const batch of chunks(rows)) for (const r of await load(batch.map((b) => b.legacyNid))) existing.set(r.legacyNid as number, r);

  const fresh: Row[] = [];
  for (const row of rows) {
    const old = existing.get(row.legacyNid);
    if (!old) fresh.push(row);
    else if (Object.keys(row).some((k) => k !== "createdAt" && k !== "updatedAt" && !same(row[k], old[k]))) {
      await tx.update(table).set(row).where(and(eq(table.legacyNid, row.legacyNid)));
      counts.updated++;
    } else counts.unchanged++;
  }
  for (const batch of chunks(fresh)) await tx.insert(table).values(batch as never);
  counts.inserted = fresh.length;
  return counts;
}
