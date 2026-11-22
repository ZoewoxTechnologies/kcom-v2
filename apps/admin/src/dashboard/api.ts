import { apiJson } from "../api/client";
import { listCapsulesBetween } from "../capsules/api";
import { addDays, lagosMidnight } from "../capsules/days";
import type { DayKey } from "../capsules/days";

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

/** Each dashboard panel loads its own data, so one failing request only breaks that panel. */
export const loadSubscribers = () => apiJson<SubscriberCount>("/admin/subscribers/count");
export const loadActivity = () =>
  apiJson<{ items: ActivityItem[] }>("/admin/activity").then((r) => r.items);
export const loadUpcomingCapsules = (today: DayKey) =>
  listCapsulesBetween(lagosMidnight(today), lagosMidnight(addDays(today, COMING_UP_DAYS)));
/** The capsule(s) due on one Lagos day. */
export const loadCapsulesOn = (day: DayKey) =>
  listCapsulesBetween(lagosMidnight(day), lagosMidnight(addDays(day, 1)));
