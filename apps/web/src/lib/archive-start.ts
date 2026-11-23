import { lagosDate } from "@kcom/content";
import { data } from "./data";
import type { DataSource } from "./data/types";
import { createTtlCache } from "./ttl-cache";

/** The year the archive starts: the earliest published capsule's, or this year when there are none. */
export function archiveStartYear(earliest: string | null, now: Date = new Date()): number {
  return Number((earliest ?? lagosDate(now)).slice(0, 4));
}

export function createArchiveStart(source: DataSource) {
  const cache = createTtlCache(() => source.earliestCapsuleDate(), { ttlMs: 60 * 60_000 });
  return async () => archiveStartYear(await cache.get());
}

/** Cached for an hour: the earliest capsule rarely changes. */
export const getArchiveStartYear = createArchiveStart(data);
