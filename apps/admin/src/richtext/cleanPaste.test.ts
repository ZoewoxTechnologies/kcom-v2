import { describe, expect, it } from "vitest";
import { cleanPastedHtml } from "./cleanPaste";

describe("cleanPastedHtml", () => {
  it("strips Google Docs wrapper and turns style spans into real marks", () => {
    const html = `<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-1"><p dir="ltr" style="line-height:1.38"><span style="font-weight:700;">Bold</span><span style="font-style:italic;"> it</span><span style="text-decoration:underline;"> un</span></p></b>`;
    expect(cleanPastedHtml(html)).toBe("<p><strong>Bold</strong><em> it</em><u> un</u></p>");
  });

  it("removes Word comments, styles, o:p, classes and empty nbsp paragraphs", () => {
    const html = `<html><head><style>p.MsoNormal{margin:0}</style></head><body><!--[if gte mso 9]><xml>x</xml><![endif]--><p class="MsoNormal" style="mso-margin-top-alt:auto">Hello&nbsp;world<o:p></o:p></p><p class="MsoNormal">&nbsp;</p></body></html>`;
    expect(cleanPastedHtml(html)).toBe("<p>Hello world</p>");
  });

  it("keeps only href on links and drops other attributes", () => {
    expect(
      cleanPastedHtml(`<p><a href="https://a.test" style="color:blue" target="_blank">x</a></p>`),
    ).toBe(`<p><a href="https://a.test">x</a></p>`);
  });
});
