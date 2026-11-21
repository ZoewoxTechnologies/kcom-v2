/**
 * Cleans HTML pasted from Word and Google Docs before the editor parses it.
 * Drops office markup, comments, styles and classes, and turns the style-only
 * formatting those apps use (bold/italic/underline spans) into real tags.
 */
export function cleanPastedHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const body = doc.body;

  body
    .querySelectorAll("style, script, meta, link, title, xml, o\\:p, w\\:sdt")
    .forEach((n) => n.remove());
  const walker = doc.createTreeWalker(body, NodeFilter.SHOW_COMMENT);
  const comments: Node[] = [];
  while (walker.nextNode()) comments.push(walker.currentNode);
  comments.forEach((c) => c.parentNode?.removeChild(c));

  // Google Docs wraps everything in <b style="font-weight:normal" id="docs-internal-guid-...">.
  body
    .querySelectorAll("b[id^='docs-internal-guid']")
    .forEach((b) => b.replaceWith(...b.childNodes));

  body.querySelectorAll<HTMLElement>("span").forEach((span) => {
    const s = span.style;
    const bold = s.fontWeight === "bold" || Number(s.fontWeight) >= 600;
    const italic = s.fontStyle === "italic";
    const underline =
      s.textDecorationLine.includes("underline") || s.textDecoration.includes("underline");
    let inner: Node[] = [...span.childNodes];
    const wrap = (tag: string) => {
      const el = doc.createElement(tag);
      el.append(...inner);
      inner = [el];
    };
    if (underline && !span.closest("a")) wrap("u");
    if (italic) wrap("em");
    if (bold) wrap("strong");
    span.replaceWith(...inner);
  });

  // Word marks list paragraphs with mso classes and a bullet glyph; keep them as text paragraphs minus the glyph.
  body.querySelectorAll<HTMLElement>("p").forEach((p) => {
    if (/MsoListParagraph/i.test(p.className)) {
      p.querySelectorAll<HTMLElement>("span[style*='mso-list:Ignore']").forEach((n) => n.remove());
    }
  });

  body.querySelectorAll<HTMLElement>("*").forEach((el) => {
    for (const attr of [...el.attributes]) {
      const keep =
        (el.tagName === "A" && attr.name === "href") ||
        (el.tagName === "IMG" && ["src", "alt"].includes(attr.name));
      if (!keep) el.removeAttribute(attr.name);
    }
  });

  // Drop empty paragraphs and nbsp-only runs Word likes to emit.
  body.querySelectorAll("p").forEach((p) => {
    if (!p.querySelector("img") && !(p.textContent ?? "").replace(/[\s]/g, "")) p.remove();
  });
  body.innerHTML = body.innerHTML.replace(/&nbsp;/g, " ");
  return body.innerHTML;
}
