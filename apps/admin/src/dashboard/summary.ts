import type { CapsuleSummary } from "../capsules/api";
import { addDays, lagosDay } from "../capsules/days";
import type { DayKey } from "../capsules/days";
import { COMING_UP_DAYS } from "./api";

export interface ComingUpDay {
  day: DayKey;
  capsule: CapsuleSummary | null;
}

/** Today and the next three Lagos days, each with its capsule (if any). */
export function comingUp(
  capsules: CapsuleSummary[],
  now = new Date(),
  days = COMING_UP_DAYS,
): ComingUpDay[] {
  const today = lagosDay(now);
  return Array.from({ length: days }, (_, i) => {
    const day = addDays(today, i);
    return { day, capsule: capsules.find((c) => lagosDay(c.publishAt) === day) ?? null };
  });
}

/** Drafts, soonest day first. */
export const draftsOf = (capsules: CapsuleSummary[]) =>
  capsules
    .filter((c) => c.status === "draft")
    .sort((a, b) => a.publishAt.localeCompare(b.publishAt));

/** "Good morning", "Good afternoon" or "Good evening" by the Lagos hour. */
export function greeting(now = new Date()): string {
  const hour =
    Number(
      new Intl.DateTimeFormat("en-GB", {
        hour: "numeric",
        hour12: false,
        timeZone: "Africa/Lagos",
      }).format(now),
    ) % 24;
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}
