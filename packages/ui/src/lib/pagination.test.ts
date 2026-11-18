import { describe, expect, it } from "vitest";
import { pageWindow, paginate } from "./pagination";

describe("pagination", () => {
  it("clamps and survives garbage", () => {
    expect(paginate([1, 2, 3, 4, 5], "2", 2)).toEqual({ page: 2, pages: 3, items: [3, 4] });
    expect(paginate([1, 2, 3], "99", 2).page).toBe(2);
    expect(paginate([1, 2, 3], "abc", 2).page).toBe(1);
    expect(paginate([], "1", 9)).toEqual({ page: 1, pages: 1, items: [] });
  });
  it("windows with gaps", () => {
    expect(pageWindow(1, 21)).toEqual([1, 2, null, 21]);
    expect(pageWindow(10, 21)).toEqual([1, null, 9, 10, 11, null, 21]);
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
  });
});
