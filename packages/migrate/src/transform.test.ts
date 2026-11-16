import { describe, expect, it } from "vitest";
import { capsuleSchema } from "@kcom/content";
import type { RawNode } from "./extract.ts";
import { htmlToDoc, nodeText } from "./html.ts";
import { findMissingFiles, parseSeriesTitle, splitScripture, transformCapsules } from "./transform.ts";

const node = (nid: number, title: string, body: string | null, extra: Partial<RawNode["fields"]> = {}, over: Partial<RawNode> = {}): RawNode => ({
  nid, vid: nid, type: "daily_digest", language: "und", title,
  created: 1262304000, changed: 1262304000, promote: 0, sticky: 0, uid: 1,
  aliases: [`content/${title.toLowerCase().replace(/\W+/g, "-").replace(/-$/, "")}`],
  fields: {
    ...(body === null ? {} : { body: [{ body_value: body }] }),
    field_daily_digest_date: [{ field_daily_digest_date_value: "2015-03-01 00:00:00" }],
    field_prayer: [{ field_prayer_value: "Lord, help me &amp; mine." }],
    field_bible_meditation: [{ field_bible_meditation_value: "John 14:1-31" }],
    field_excerpt: [{ field_excerpt_value: "\tAdetokunbo O. Ilesanmi (Meditations)\r\n\tAdapted from: A Book." }],
    ...extra,
  },
  terms: [], files: {}, ...over,
});

const scripture = '<p class="rtecenter"><em>Thou wilt keep him in <strong>perfect peace</strong></em> &ndash; Isaiah 26:3</p>';

describe("htmlToDoc", () => {
  it("converts marks, lists and entities and drops empty paragraphs", () => {
    const doc = htmlToDoc("<p>A <strong>b</strong> &amp; <em>c</em></p><p>&nbsp;</p><ul><li>one</li><li>two</li></ul>");
    expect(doc.content.map((n) => n.type)).toEqual(["paragraph", "bulletList"]);
    expect(nodeText(doc.content[0]!)).toBe("A b & c");
    expect(doc.content[0]?.content?.[1]?.marks).toEqual([{ type: "bold" }]);
    expect(doc.content[1]?.content).toHaveLength(2);
  });
});

describe("splitScripture", () => {
  it("splits dash-separated and parenthesised references", () => {
    const a = splitScripture(htmlToDoc(scripture).content[0]);
    expect(a?.ref).toBe("Isaiah 26:3");
    expect(a && nodeText(a.text)).toBe("Thou wilt keep him in perfect peace");
    const b = splitScripture(htmlToDoc("<p><em>In the beginning was the Word</em> (John 1:1)</p>").content[0]);
    expect(b?.ref).toBe("John 1:1");
  });
  it("keeps text that runs on after the reference", () => {
    const r = splitScripture(htmlToDoc("<p>He dreamed – Genesis 28:12 God dealt with Jacob.</p>").content[0]);
    expect(r?.ref).toBe("Genesis 28:12");
    expect(r?.rest && nodeText(r.rest)).toBe("God dealt with Jacob.");
  });
  it("returns null without a reference", () => {
    expect(splitScripture(htmlToDoc("<p>Just a paragraph.</p>").content[0])).toBeNull();
  });
});

describe("parseSeriesTitle", () => {
  it("reads trailing part numbers", () => {
    expect(parseSeriesTitle("PEAK PERFORMANCE 10")).toEqual({ base: "PEAK PERFORMANCE", part: 10 });
    expect(parseSeriesTitle("JESUS IS THE DOOR (2)")).toEqual({ base: "JESUS IS THE DOOR", part: 2 });
    expect(parseSeriesTitle("DIVINE 9-1-1")).toBeNull();
    expect(parseSeriesTitle("THE PRIMACY OF LOVE")).toBeNull();
  });
});

describe("transformCapsules", () => {
  const nodes = [
    node(1, "Door (1)", `${scripture}<p>Body one.</p>`),
    node(2, "Door (2)", `${scripture}<p>Body two.</p>`),
    node(3, "Lonely 1", `${scripture}<p>Body.</p>`),
    node(4, "Empty", "<p>&nbsp;</p>"),
    node(5, "No scripture", "<p>Only text.</p>", { field_prayer: [] }),
    node(6, "Blog", "<p>x</p>", {}, { type: "blog" }),
  ];
  const r = transformCapsules(nodes);

  it("maps fields onto valid capsules", () => {
    const c = r.capsules.find((x) => x.legacyNid === 1)!;
    expect(capsuleSchema.safeParse(c).success).toBe(true);
    expect(c).toMatchObject({
      slug: "door-1", status: "published", scriptureRef: "Isaiah 26:3", bibleMeditation: "John 14:1-31",
      authorSource: "Adetokunbo O. Ilesanmi (Meditations) — Adapted from: A Book.", legacyPath: "content/door-1",
    });
    expect(c.publishAt.toISOString()).toBe("2015-02-28T23:00:00.000Z");
    expect(c.body.content).toHaveLength(1);
    expect(nodeText(c.prayer as never)).toBe("Lord, help me & mine.");
  });

  it("groups series of two or more and ignores lone numbered titles", () => {
    expect(r.series).toEqual([{ id: "door", slug: "door", title: "Door", parts: 2 }]);
    expect(r.capsules.filter((c) => c.seriesId === "door").map((c) => c.partNumber)).toEqual([1, 2]);
    expect(r.capsules.find((c) => c.legacyNid === 3)?.seriesId).toBeNull();
  });

  it("skips empty capsules and reports issues", () => {
    expect(r.capsules.map((c) => c.legacyNid)).toEqual([1, 2, 3, 5]);
    expect(r.issues.map((i) => `${i.nid}:${i.code}`)).toEqual(["4:empty-body", "5:no-scripture", "5:no-prayer"]);
    expect(r.stats).toMatchObject({ nodes: 5, migrated: 4, skipped: 1 });
  });

  it("de-duplicates slugs", () => {
    const d = transformCapsules([node(1, "Same", `${scripture}<p>a</p>`), node(2, "Same", `${scripture}<p>b</p>`, {}, { aliases: [] })]);
    expect(new Set(d.capsules.map((c) => c.slug)).size).toBe(2);
  });
});

describe("findMissingFiles", () => {
  it("lists private and absent files", () => {
    const n = node(9, "Book", null, {}, {
      type: "kcom_books",
      files: {
        "1": { fid: 1, filename: "a.pdf", uri: "private://books/a.pdf", filemime: null, filesize: null },
        "2": { fid: 2, filename: "b.jpg", uri: "public://b.jpg", filemime: null, filesize: null },
        "3": { fid: 3, filename: "c.jpg", uri: "public://c.jpg", filemime: null, filesize: null },
      },
    });
    expect(findMissingFiles([n], (f) => f === "b.jpg")).toEqual([
      { nid: 9, type: "kcom_books", uri: "private://books/a.pdf" },
      { nid: 9, type: "kcom_books", uri: "public://c.jpg" },
    ]);
  });
});
