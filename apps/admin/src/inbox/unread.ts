import { useEffect, useSyncExternalStore } from "react";
import { fetchUnreadCount } from "./api";

let count = 0;
const listeners = new Set<() => void>();
const set = (n: number) => {
  count = n;
  listeners.forEach((l) => l());
};

/** Re-reads the unread count; call after anything that changes a message's state. */
export const refreshUnread = () => fetchUnreadCount().then(set, () => {});

/** Nudges the shared count without a round trip, for instant feedback. */
export const bumpUnread = (by: number) => set(Math.max(0, count + by));

/** The unread count for the nav. Fetches when `enabled` and again whenever `refreshOn` changes. */
export function useUnreadCount(enabled: boolean, refreshOn?: unknown) {
  useEffect(() => {
    if (enabled) void refreshUnread();
  }, [enabled, refreshOn]);
  return useSyncExternalStore(
    (cb) => (listeners.add(cb), () => void listeners.delete(cb)),
    () => count,
  );
}
