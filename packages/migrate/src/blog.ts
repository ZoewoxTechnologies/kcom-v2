import { lagosDate, slugify } from "@kcom/content";
import type { RawNode } from "./extract.ts";
import { decodeEntities, htmlToDoc, type RichDoc } from "./html.ts";
import type { Issue } from "./transform.ts";

export const BLOG_TYPE = "blog";

export interface BlogRecord {
  legacyNid: number;
  legacyPath: string | null;
  slug: string;
  title: string;
  /** Lagos calendar day, YYYY-MM-DD. */
  date: string;
  body: RichDoc;
  tags: string[];
  publishAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const fromUnix = (s: number) => new Date(s * 1000);

/** Maps legacy blog nodes onto the blog post model; posts with no body text are skipped and reported. */
export function transformBlog(nodes: RawNode[]): { posts: BlogRecord[]; issues: Issue[] } {
  const posts: BlogRecord[] = [];
  const issues: Issue[] = [];
  const usedSlugs = new Set<string>();
  const usedPaths = new Set<string>();

  for (const node of nodes.filter((n) => n.type === BLOG_TYPE).sort((a, b) => a.nid - b.nid)) {
    const issue = (level: Issue["level"], code: string, detail?: string) =>
      issues.push({ nid: node.nid, title: node.title, level, code, ...(detail ? { detail } : {}) });

    const html = node.fields.body?.[0]?.body_value;
    const doc =
      typeof html === "string"
        ? htmlToDoc(html, (code, detail) => issue("warning", code, code === "image" ? `image dropped: ${detail}` : `link dropped, text kept: ${detail}`))
        : null;
    if (!doc || doc.content.length === 0) {
      issue("error", "empty-body", "no body text; skipped");
      continue;
    }

    const title = decodeEntities(node.title).replace(/\s+/g, " ").trim();
    const legacyPath = node.aliases[0] ?? null;
    const fromPath = legacyPath ? slugify(legacyPath.split("/").pop() ?? "") : "";
    let slug = fromPath || slugify(title) || `post-${node.nid}`;
    if (usedSlugs.has(slug)) {
      issue("warning", "slug-collision", `"${slug}" already used; suffixed with nid`);
      slug = `${slug}-${node.nid}`;
    }
    usedSlugs.add(slug);
    let path = legacyPath;
    if (path && usedPaths.has(path)) {
      issue("warning", "path-collision", `"${path}" already used; dropped`);
      path = null;
    }
    if (path) usedPaths.add(path);

    const created = fromUnix(node.created);
    posts.push({
      legacyNid: node.nid,
      legacyPath: path,
      slug,
      title,
      date: lagosDate(created),
      body: doc,
      tags: [...new Set(node.terms.map((t) => (t.name ?? "").trim()).filter(Boolean))],
      publishAt: created,
      createdAt: created,
      updatedAt: fromUnix(node.changed || node.created),
    });
  }
  return { posts, issues };
}
