import { and, asc, gte, lt, sql } from "drizzle-orm";
import { activityLog } from "./schema.js";
import type { CapsuleDb } from "./queries.js";

/** A month turns this old before its rows are archived, then this old before they are deleted. */
export const ARCHIVE_AFTER_MONTHS = 6;
export const DELETE_AFTER_MONTHS = 12;

/** Where archives live: object storage, or a fake in tests. Keys are relative to the archive prefix. */
export interface ArchiveStore {
  exists(key: string): Promise<boolean>;
  /** Reads an archive's text; only called for keys that exist. */
  get(key: string): Promise<string>;
  put(key: string, body: string): Promise<void>;
}

export interface MonthResult {
  month: string;
  rows: number;
}
export interface RetentionResult {
  archived: MonthResult[];
  deleted: MonthResult[];
  /** Months that already had an archive, so were left alone. */
  alreadyArchived: string[];
}

/** UTC calendar month as "YYYY-MM". */
export const monthOf = (d: Date) => d.toISOString().slice(0, 7);
export const archiveKey = (month: string) => `activity-${month}.json`;

/** First instant of the UTC month `months` before the month containing `now`. */
export function monthStartBefore(now: Date, months: number): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months, 1));
}
const nextMonthStart = (month: string) => {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 1));
};
const monthStart = (month: string) => {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1, 1));
};

const monthRows = (db: CapsuleDb, month: string) =>
  db
    .select()
    .from(activityLog)
    .where(and(gte(activityLog.at, monthStart(month)), lt(activityLog.at, nextMonthStart(month))))
    .orderBy(asc(activityLog.at), asc(activityLog.id));

/** Months (oldest first) that still have rows older than `before`. */
async function monthsBefore(db: CapsuleDb, before: Date): Promise<string[]> {
  const month = sql<string>`to_char(${activityLog.at} AT TIME ZONE 'UTC', 'YYYY-MM')`;
  const rows = await db
    .selectDistinct({ month })
    .from(activityLog)
    .where(lt(activityLog.at, before))
    .orderBy(month);
  return rows.map((r) => r.month);
}

/** The archive file for one month: the month and its rows, nothing else, so it is reproducible. */
export const archiveBody = (month: string, rows: (typeof activityLog.$inferSelect)[]) =>
  JSON.stringify({ month, count: rows.length, rows }, null, 2) + "\n";

/**
 * Monthly retention for the activity log. Order matters:
 *  1. Archive every month that has turned 6 months old and has no archive yet (so a missed run
 *     is caught up). An archive is written once and never overwritten.
 *  2. Delete the rows of every month that has turned 12 months old, but only when its archive
 *     exists and holds at least as many rows as the database does.
 * A failure in one month never stops the others; all failures are thrown together at the end.
 */
export async function runActivityRetention(
  db: CapsuleDb,
  store: ArchiveStore,
  now = new Date(),
  log: (line: string) => void = console.log,
): Promise<RetentionResult> {
  const result: RetentionResult = { archived: [], deleted: [], alreadyArchived: [] };
  const errors: Error[] = [];
  const fail = (month: string, step: string, err: unknown) => {
    const e = new Error(
      `${step} ${month} failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    log(`ERROR ${e.message}`);
    errors.push(e);
  };

  for (const month of await monthsBefore(db, monthStartBefore(now, ARCHIVE_AFTER_MONTHS))) {
    try {
      if (await store.exists(archiveKey(month))) {
        result.alreadyArchived.push(month);
        log(`${month}: archive already exists, left as is`);
        continue;
      }
      const rows = await monthRows(db, month);
      await store.put(archiveKey(month), archiveBody(month, rows));
      // Read it back so a silent upload failure cannot lead to a delete.
      const back = JSON.parse(await store.get(archiveKey(month))) as { count: number };
      if (back.count !== rows.length)
        throw new Error(`archive holds ${back.count}, expected ${rows.length}`);
      result.archived.push({ month, rows: rows.length });
      log(`${month}: archived ${rows.length} rows`);
    } catch (err) {
      fail(month, "archive", err);
    }
  }

  for (const month of await monthsBefore(db, monthStartBefore(now, DELETE_AFTER_MONTHS))) {
    try {
      if (!(await store.exists(archiveKey(month)))) {
        throw new Error("no archive file, rows kept");
      }
      const archived = (JSON.parse(await store.get(archiveKey(month))) as { count: number }).count;
      const rows = await monthRows(db, month);
      if (rows.length > archived) {
        throw new Error(
          `database has ${rows.length} rows but the archive holds ${archived}, rows kept`,
        );
      }
      await db
        .delete(activityLog)
        .where(
          and(gte(activityLog.at, monthStart(month)), lt(activityLog.at, nextMonthStart(month))),
        );
      result.deleted.push({ month, rows: rows.length });
      log(`${month}: deleted ${rows.length} rows`);
    } catch (err) {
      fail(month, "delete", err);
    }
  }

  log(
    `done: archived ${result.archived.length} month(s), deleted ${result.deleted.length} month(s), ${result.alreadyArchived.length} already archived`,
  );
  if (errors.length) throw new AggregateError(errors, `${errors.length} retention step(s) failed`);
  return result;
}
