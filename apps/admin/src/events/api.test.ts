import { describe, expect, it } from "vitest";
import { plainToRichText, richTextToPlain, slugify } from "./api";

describe("event helpers", () => {
  it("slugifies titles", () => {
    expect(slugify("Kingdom Capstone Conference 2027!")).toBe("kingdom-capstone-conference-2027");
    expect(slugify("Café Night")).toBe("cafe-night");
    expect(slugify("***")).toBe("");
  });

  it("round-trips plain text through a rich-text document", () => {
    const doc = plainToRichText("First line\nSecond line");
    expect(doc).toMatchObject({
      type: "doc",
      content: [{ type: "paragraph" }, { type: "paragraph" }],
    });
    expect(richTextToPlain(doc)).toBe("First line\nSecond line");
  });

  it("treats blank text as no description", () => {
    expect(plainToRichText("  \n ")).toBeNull();
    expect(richTextToPlain(null)).toBe("");
  });
});
