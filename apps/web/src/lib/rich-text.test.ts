import { describe, expect, it } from "vitest";
import { richTextToHtml } from "./rich-text";

describe("richTextToHtml", () => {
  it("renders blocks and marks, escaping text", () => {
    const doc = { type: "doc", content: [
      { type: "paragraph", content: [{ type: "text", text: "a <b> & c", marks: [{ type: "bold" }, { type: "italic" }] }] },
      { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "x" }] }] }] },
    ] };
    expect(richTextToHtml(doc)).toBe("<p><em><strong>a &lt;b&gt; &amp; c</strong></em></p><ul><li><p>x</p></li></ul>");
  });
  it("drops unknown nodes and unsafe links", () => {
    const doc = { type: "doc", content: [
      { type: "script", content: [{ type: "text", text: "alert(1)" }] },
      { type: "paragraph", content: [{ type: "text", text: "hi", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }] },
    ] };
    expect(richTextToHtml(doc)).toBe("<p>hi</p>");
  });
  it("is empty for null", () => expect(richTextToHtml(null)).toBe(""));
});
