import { useCallback, useEffect, useState } from "react";
import { apiJson } from "../api/client";
import { listCapsules } from "../capsules/api";
import type { CapsuleSummary } from "../capsules/api";
import { listEvents } from "../events/api";
import type { EventRecord } from "../events/api";

export interface SubscriberCount {
  confirmed: number;
  addedThisMonth: number;
}

export interface DashboardData {
  capsules: CapsuleSummary[];
  events: EventRecord[];
  subscribers: SubscriberCount;
}

/** Everything the dashboard shows, loaded together. */
export function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(() => {
    setState("loading");
    Promise.all([
      listCapsules(),
      listEvents(),
      apiJson<SubscriberCount>("/admin/subscribers/count"),
    ]).then(
      ([capsules, events, subscribers]) => {
        setData({ capsules, events, subscribers });
        setState("ready");
      },
      () => setState("error"),
    );
  }, []);
  useEffect(load, [load]);

  return { data, state, reload: load };
}
