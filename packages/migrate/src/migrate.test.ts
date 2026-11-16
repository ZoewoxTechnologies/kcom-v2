import { describe, expect, it } from "vitest";
import { extractNodes, summarize } from "./extract.ts";
import { dumpSql } from "./fixture.ts";
import { parseDump } from "./sql.ts";

describe("parseDump", () => {
  it("handles escapes, NULL and multi-row inserts", () => {
    const tables = parseDump(dumpSql);
    expect(tables.get("node")).toHaveLength(4);
    expect(tables.get("node")?.[0]?.title).toBe("It's a 'test'");
    const body = tables.get("field_data_body")?.[0];
    expect(body?.body_value).toBe('<p>Line one\nLine "two"; (x), y</p>');
    expect(body?.body_summary).toBeNull();
  });
});

describe("extractNodes", () => {
  const nodes = extractNodes(parseDump(dumpSql));

  it("keeps only published nodes", () => {
    expect(nodes.map((n) => n.nid)).toEqual([1, 2, 4]);
  });

  it("attaches fields, aliases, terms and files", () => {
    const capsule = nodes[0];
    expect(capsule?.aliases).toEqual(["capsules/its-a-test"]);
    expect(capsule?.terms).toEqual([{ tid: 5, name: "Faith", vocabulary: "tags" }]);
    expect(capsule?.fields.body?.[0]).not.toHaveProperty("entity_id");
    expect(nodes[2]?.fields.body?.[0]?.body_value).toBe("<p>About us</p>");
    expect(nodes[2]?.files["9"]?.filename).toBe("cover.jpg");
  });
});

describe("summarize", () => {
  it("counts types and real capsules with their date range", () => {
    expect(summarize(extractNodes(parseDump(dumpSql)))).toEqual({
      countsByType: { daily_digest: 2, page: 1 },
      capsules: { total: 2, real: 1, oldest: "2010-03-05", newest: "2010-03-05" },
    });
  });
});
