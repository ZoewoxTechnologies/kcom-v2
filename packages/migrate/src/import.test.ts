import { createTestDb } from "@kcom/db/test-db";
import { blogPosts, capsules, redirects } from "@kcom/db";
import { describe, expect, it } from "vitest";
import { transformBlog } from "./blog.ts";
import type { RawNode } from "./extract.ts";
import { importContent, type ImportInput } from "./import.ts";
import { buildRedirects } from "./redirects.ts";
import { transformCapsules } from "./transform.ts";

const at = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);
const node = (
  nid: number,
  type: string,
  title: string,
  aliases: string[],
  fields: RawNode["fields"] = {},
  created = "2020-03-05T09:00:00Z",
): RawNode => ({
  nid,
  vid: nid,
  language: "und",
  promote: 0,
  sticky: 0,
  uid: 1,
  type,
  title,
  created: at(created),
  changed: at(created),
  aliases,
  fields,
  terms: [],
  files: {},
});
const body = (html: string) => ({
  body: [{ body_value: html, body_summary: null, body_format: "full_html" }],
});

const nodes: RawNode[] = [
  node(1, "daily_digest", "Peace", ["capsules/peace"], {
    ...body("<p>You will keep him in perfect peace – Isaiah 26:3</p><p>Rest today.</p>"),
    field_daily_digest_date: [{ field_daily_digest_date_value: "2020-03-05 00:00:00" }],
  }),
  node(
    2,
    "blog",
    "A Good Post",
    ["blog/a-good-post"],
    body("<p>Hello world</p>"),
    "2019-06-01T10:00:00Z",
  ),
  node(3, "blog", "Empty", ["blog/empty"], body("<p>&nbsp;</p>")),
  node(4, "page", "Who we are", ["who-we-are"], body("<p>Us</p>")),
  node(5, "events", "Conference", ["events/conference"]),
  node(6, "page", "Unmapped", ["mystery"]),
];

function input(list = nodes): ImportInput {
  const { capsules, series } = transformCapsules(list);
  const { posts } = transformBlog(list);
  return { series, capsules, posts, redirects: buildRedirects(list, capsules, posts).redirects };
}

describe("transformBlog", () => {
  it("keeps nid and path, and skips empty bodies", () => {
    const { posts, issues } = transformBlog(nodes);
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({
      legacyNid: 2,
      legacyPath: "blog/a-good-post",
      slug: "a-good-post",
      date: "2019-06-01",
    });
    expect(issues.some((i) => i.code === "empty-body")).toBe(true);
  });
});

describe("buildRedirects", () => {
  const { capsules: caps, series } = transformCapsules(nodes);
  void series;
  const { posts } = transformBlog(nodes);
  const map = buildRedirects(nodes, caps, posts);
  const to = (from: string) => map.redirects.find((r) => r.from === from)?.to;

  it("maps aliases, node ids, archives and the digest index", () => {
    expect(to("/capsules/peace")).toBeUndefined();
    expect(to("/node/1")).toBe("/capsules/peace");
    expect(to("/archive/202003")).toBe("/capsules/month/2020-03");
    expect(to("/daily-digest")).toBe("/capsules");
    expect(to("/blog/a-good-post")).toBe(undefined);
    expect(to("/node/2")).toBe("/blog/a-good-post");
  });

  it("maps /content/* aliases to the new capsule or post page", () => {
    const list = [
      node(10, "daily_digest", "Grace", ["content/grace-abounds"], {
        ...body("<p>Grace is enough – 2 Corinthians 12:9</p><p>Rest.</p>"),
        field_daily_digest_date: [{ field_daily_digest_date_value: "2020-04-02 00:00:00" }],
      }),
      node(11, "blog", "Old Post", ["content/old-post"], body("<p>Hi</p>")),
      node(12, "events", "Retreat", ["content/retreat"]),
      node(13, "page", "Info", ["content/info"], body("<p>Info</p>")),
    ];
    const c = transformCapsules(list).capsules;
    const p = transformBlog(list).posts;
    const m = buildRedirects(list, c, p);
    const find = (from: string) => m.redirects.find((r) => r.from === from);
    expect(find("/content/grace-abounds")).toMatchObject({
      to: "/capsules/grace-abounds",
      kind: "capsule",
    });
    expect(find("/content/old-post")).toMatchObject({ to: "/blog/old-post", kind: "blog" });
    expect(find("/content/retreat")?.to).toBe("/events");
    expect(find("/content/info")?.to).toBe("/");
  });

  it("sends draft capsules to the digest index, not a page that is not public", () => {
    const list = [
      node(20, "daily_digest", "Dup", ["content/dup"], {
        ...body("<p>Grace – John 1:1</p><p>Rest.</p>"),
        field_daily_digest_date: [{ field_daily_digest_date_value: "2020-04-02 00:00:00" }],
      }),
    ];
    const c = transformCapsules(list).capsules.map((x) => ({ ...x, status: "draft" as const }));
    expect(buildRedirects(list, c, []).redirects.find((r) => r.from === "/content/dup")?.to).toBe(
      "/capsules",
    );
  });

  it("sends unimported nodes to the closest page or listing", () => {
    expect(to("/who-we-are")).toBe("/about");
    expect(to("/node/5")).toBe("/events");
    expect(to("/node/6")).toBe("/");
    expect(to("/node/3")).toBe("/blog");
  });

  it("leaves paths that already match and never loops", () => {
    expect(map.redirects.every((r) => r.from !== r.to)).toBe(true);
    expect(map.unchanged).toContain("/rss.xml");
  });
});

describe("importContent", () => {
  it("imports, then a second run changes nothing", async () => {
    const db = await createTestDb();
    const data = input();
    const first = await importContent(db, data);
    expect(first.capsules).toEqual({ inserted: 1, updated: 0, unchanged: 0 });
    expect(first.posts.inserted).toBe(1);
    expect(first.inDatabase).toMatchObject({
      capsules: 1,
      posts: 1,
      redirects: data.redirects.length,
    });

    const second = await importContent(db, input());
    for (const k of ["series", "capsules", "posts", "redirects"] as const) {
      expect(second[k].inserted + second[k].updated).toBe(0);
    }
    expect(second.capsules.unchanged).toBe(1);
    expect(await db.select().from(capsules)).toHaveLength(1);
  });

  it("updates a changed row and keeps legacy keys", async () => {
    const db = await createTestDb();
    await importContent(db, input());
    const edited = input();
    edited.posts[0]!.title = "A Better Title";
    const res = await importContent(db, edited);
    expect(res.posts).toEqual({ inserted: 0, updated: 1, unchanged: 0 });
    const [row] = await db.select().from(blogPosts);
    expect(row).toMatchObject({
      title: "A Better Title",
      legacyNid: 2,
      legacyPath: "blog/a-good-post",
    });
  });

  it("final sync touches only items changed after the cutoff", async () => {
    const db = await createTestDb();
    await importContent(db, input());
    const res = await importContent(db, input(), { since: new Date("2030-01-01") });
    expect(res.capsules).toEqual({ inserted: 0, updated: 0, unchanged: 0 });
    expect(res.inDatabase.capsules).toBe(1);
  });

  it("counts only legacy series and redirects, ignoring editors' rows", async () => {
    const db = await createTestDb();
    await db.insert(redirects).values({ fromPath: "/editor-made", toPath: "/x" });
    const res = await importContent(db, input());
    const data = input();
    expect(res.inDatabase.redirects).toBe(data.redirects.length);
  });

  it("names the clashing slug and imports nothing", async () => {
    const db = await createTestDb();
    const data = input();
    const post = data.posts[0]!;
    await db
      .insert(blogPosts)
      .values({
        slug: post.slug,
        title: "Editor post",
        date: "2024-01-01",
        body: post.body as never,
        status: "draft",
      });
    await expect(importContent(db, data)).rejects.toThrow(`"${post.slug}"`);
    expect(await db.select().from(capsules)).toHaveLength(0);
  });

  it("dry run rolls back", async () => {
    const db = await createTestDb();
    const res = await importContent(db, input(), { dryRun: true });
    expect(res.capsules.inserted).toBe(1);
    expect(await db.select().from(capsules)).toHaveLength(0);
    expect(await db.select().from(redirects)).toHaveLength(0);
  });
});
