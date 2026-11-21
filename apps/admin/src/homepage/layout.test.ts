import { describe, expect, it } from "vitest";
import { moveSection, setVisible, type SectionRow } from "./layout";

const rows: SectionRow[] = [
  { key: "todays_capsule", visible: true },
  { key: "current_series", visible: true },
  { key: "past_series", visible: true },
  { key: "blog", visible: true },
];
const keys = (r: SectionRow[]) => r.map((x) => x.key);

describe("moveSection", () => {
  it("moves a section and keeps Today's Capsule first", () => {
    expect(keys(moveSection(rows, "blog", 0))).toEqual([
      "todays_capsule",
      "blog",
      "current_series",
      "past_series",
    ]);
  });
  it("clamps to the ends and ignores the fixed section", () => {
    expect(keys(moveSection(rows, "current_series", 99)).at(-1)).toBe("current_series");
    expect(moveSection(rows, "todays_capsule", 2)).toBe(rows);
  });
});

describe("setVisible", () => {
  it("hides a section but never Today's Capsule", () => {
    expect(setVisible(rows, "blog", false).find((r) => r.key === "blog")?.visible).toBe(false);
    expect(setVisible(rows, "todays_capsule", false)).toBe(rows);
  });
});
