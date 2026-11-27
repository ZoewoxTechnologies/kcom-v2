import type { Capsule, DataSource } from "./data/types";

/**
 * The capsule that stands for "today": the one published on the Lagos day, or, before it goes
 * live or on a gap day, the latest published one. The top bar, the home hero and /capsules/today
 * all read it here so they can never show different days.
 */
export async function todaysCapsule(source: DataSource, today: string): Promise<Capsule | null> {
  const exact = await source.capsuleByDate(today);
  if (exact) return exact;
  const latest = await source.latestCapsule();
  return latest ? source.capsuleBySlug(latest.slug) : null;
}
