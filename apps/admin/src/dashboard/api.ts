import { useCallback, useEffect, useState } from "react";
import { apiJson } from "../api/client";
import { listCapsulesBetween, listDrafts } from "../capsules/api";
import { addDays, lagosDay, lagosMidnight } from "../capsules/days";
import type { CapsuleSummary } from "../capsules/api";
import { upcomingEventsSummary } from "../events/api";

/** Days listed under Coming up, today included. */
export const COMING_UP_DAYS = 4;

export interface SubscriberCount {
  confirmed: number;
  addedThisMonth: number;
}

export interface ActivityItem {
  at: string;
  text: string;
  href: string | null;
  badge: "New" | null;
}

export interface DashboardData {
  /** Today and the next few Lagos days. */
  capsules: CapsuleSummary[];
  drafts: CapsuleSummary[];
  events: { total: number; next: string | null };
  subscribers: SubscriberCount;
  activity: ActivityItem[];
}

/** Everything the dashboard shows, loaded together. */
export function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(() => {
    setState("loading");
    const today = lagosDay(new Date());
    Promise.all([
      listCapsulesBetween(lagosMidnight(today), lagosMidnight(addDays(today, COMING_UP_DAYS))),
      listDrafts(),
      upcomingEventsSummary(),
      apiJson<SubscriberCount>("/admin/subscribers/count"),
      apiJson<{ items: ActivityItem[] }>("/admin/activity"),
    ]).then(
      ([capsules, drafts, events, subscribers, activity]) => {
        setData({ capsules, drafts, events, subscribers, activity: activity.items });
        setState("ready");
      },
      () => setState("error"),
    );
  }, []);
  useEffect(load, [load]);

  return { data, state, reload: load };
}
