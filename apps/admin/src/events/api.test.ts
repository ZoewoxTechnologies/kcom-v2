import { describe, expect, it } from "vitest";
import { plainToRichText, richTextToPlain } from "./api";

describe("event helpers", () => {
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
