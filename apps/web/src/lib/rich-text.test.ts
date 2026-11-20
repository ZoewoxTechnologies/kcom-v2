import { describe, expect, it } from "vitest";
import { richTextToHtml } from "./rich-text";

describe("richTextToHtml", () => {
  it("renders blocks and marks, escaping text", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "a <b> & c", marks: [{ type: "bold" }, { type: "italic" }] },
          ],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "x" }] }],
            },
          ],
        },
      ],
    };
    expect(richTextToHtml(doc)).toBe(
      "<p><em><strong>a &lt;b&gt; &amp; c</strong></em></p><ul><li><p>x</p></li></ul>",
    );
  });
  it("drops unknown nodes and unsafe links", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "script", content: [{ type: "text", text: "alert(1)" }] },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "hi",
              marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
            },
          ],
        },
      ],
    };
    expect(richTextToHtml(doc)).toBe("<p>hi</p>");
  });
  it("renders Cloudinary images lazily with srcset, and drops other sources", () => {
    const src = "https://res.cloudinary.com/demo/image/upload/v1/a.jpg";
    const html = richTextToHtml({
      type: "doc",
      content: [{ type: "image", attrs: { src, alt: 'A "pic"', width: 800, height: 600 } }],
    });
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('alt="A &quot;pic&quot;" width="800" height="600"');
    expect(html).toContain("/image/upload/c_limit,w_480,f_auto,q_auto/v1/a.jpg 480w");
    expect(
      richTextToHtml({
        type: "doc",
        content: [{ type: "image", attrs: { src: "https://evil.test/a.jpg", alt: "x" } }],
      }),
    ).toBe("");
  });
  it("ignores image dimensions above the 20k cap", () => {
    const src = "https://res.cloudinary.com/demo/image/upload/v1/a.jpg";
    const html = richTextToHtml({
      type: "doc",
      content: [{ type: "image", attrs: { src, alt: "x", width: 30000, height: 600 } }],
    });
    expect(html).not.toContain("width=");
  });
  it("is empty for null", () => expect(richTextToHtml(null)).toBe(""));
});
