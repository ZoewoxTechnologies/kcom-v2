import { describe, expect, it } from "vitest";
import { quoteVerse, stripQuotes } from "./verse";

describe("verse quotes", () => {
  it("strips straight and curly quotes at both ends", () => {
    expect(stripQuotes('"The Lord is my shepherd"')).toBe("The Lord is my shepherd");
    expect(stripQuotes("“The Lord is my shepherd”")).toBe("The Lord is my shepherd");
    expect(stripQuotes(' “"The Lord"” ')).toBe("The Lord");
  });
  it("keeps quotes inside the verse", () => {
    expect(stripQuotes('He said, "Peace" to them')).toBe('He said, "Peace" to them');
  });
  it("wraps once, and not at all when empty", () => {
    expect(quoteVerse('"Peace"')).toBe("“Peace”");
    expect(quoteVerse("Peace")).toBe("“Peace”");
    expect(quoteVerse('""')).toBe("");
  });
});
