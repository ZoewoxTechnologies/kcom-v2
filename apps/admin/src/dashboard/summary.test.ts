import { describe, expect, it } from "vitest";
import type { CapsuleSummary } from "../capsules/api";
import { activityWhen, comingUp, draftsOf, greeting } from "./summary";

const cap = (id: string, status: CapsuleSummary["status"], publishAt: string): CapsuleSummary => ({
  id,
  title: id,
  slug: id,
  status,
  seriesId: null,
  partNumber: null,
  publishAt,
});
// 23:30 on 19 Nov in Lagos.
const NOW = new Date("2026-11-19T22:30:00Z");

describe("comingUp", () => {
  it("lists today and three more Lagos days, matching capsules by Lagos day", () => {
    const rows = comingUp(
      [
        cap("a", "published", "2026-11-18T23:00:00Z"),
        cap("b", "scheduled", "2026-11-20T23:00:00Z"),
      ],
      NOW,
    );
    expect(rows.map((r) => r.day)).toEqual([
      "2026-11-19",
      "2026-11-20",
      "2026-11-21",
      "2026-11-22",
    ]);
    expect(rows.map((r) => r.capsule?.id ?? null)).toEqual(["a", null, "b", null]);
  });
});

describe("draftsOf", () => {
  it("keeps drafts only, soonest first", () => {
    const list = [
      cap("late", "draft", "2026-12-01T00:00:00Z"),
      cap("done", "published", "2026-11-01T00:00:00Z"),
      cap("soon", "draft", "2026-11-20T00:00:00Z"),
    ];
    expect(draftsOf(list).map((c) => c.id)).toEqual(["soon", "late"]);
  });
});

describe("greeting", () => {
  it("follows the Lagos hour", () => {
    expect(greeting(new Date("2026-11-19T05:00:00Z"))).toBe("Good morning"); // 06:00
    expect(greeting(new Date("2026-11-19T12:00:00Z"))).toBe("Good afternoon"); // 13:00
    expect(greeting(new Date("2026-11-19T22:30:00Z"))).toBe("Good evening"); // 23:30
    expect(greeting(new Date("2026-11-19T23:30:00Z"))).toBe("Good morning"); // 00:30
  });
});

describe("activityWhen", () => {
  const now = new Date("2026-11-19T10:00:00Z");
  it("shows the Lagos time today, Yesterday, then the date", () => {
    expect(activityWhen("2026-11-19T08:12:00Z", now)).toBe("09:12");
    expect(activityWhen("2026-11-18T09:00:00Z", now)).toBe("Yesterday");
    expect(activityWhen("2026-11-12T09:00:00Z", now)).toBe("12 Nov");
  });
});
