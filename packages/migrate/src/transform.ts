import { CAPSULE_LIMITS, capsuleSchema, lagosDayRange, slugify, type Capsule } from "@kcom/content";
import { CAPSULE_TYPE, type RawNode } from "./extract.ts";
import { decodeEntities, htmlToDoc, nodeText, textDoc, type RichNode } from "./html.ts";

export type IssueLevel = "error" | "warning";
export interface Issue {
  nid: number;
  title: string;
  level: IssueLevel;
  code: string;
  detail?: string;
}

export interface SeriesRecord {
  /** Stand-in id (the slug); real ids are assigned on load. */
  id: string;
  slug: string;
  title: string;
  parts: number;
}

export interface MissingFile {
  nid: number;
  type: string;
  uri: string;
}

export interface TransformResult {
  capsules: Capsule[];
  series: SeriesRecord[];
  issues: Issue[];
  stats: Record<string, number>;
}

const BOOK = String.raw`(?:[1-3]\s?)?[A-Z][a-z]+\.?(?:\sof\s[A-Z][a-z]+)?`;
const VERSES = String.raw`\s*\d+(?::\s?\d+[a-z]?(?:\s?[-–,;]\s?\d+[a-z]?(?::\d+)?)*)?(?:\s?\((?:[A-Z]{2,6})\))?`;
const REF_AT_START = new RegExp(String.raw`^(${BOOK}${VERSES})`);
const DASH_REF = new RegExp(String.raw`\s*[–—-]+\s*(?=${BOOK}\s*\d)`, "g");
const PAREN_REF = new RegExp(String.raw`\(\s*(${BOOK}${VERSES})\s*\)\s*$`);

/** Slices inline nodes to the character range [from, to). */
function sliceInline(nodes: RichNode[], from: number, to: number): RichNode[] {
  const out: RichNode[] = [];
  let pos = 0;
  for (const n of nodes) {
    const len = nodeText(n).length;
    const start = Math.max(from - pos, 0);
    const end = Math.min(to - pos, len);
    if (end > start || (len === 0 && pos >= from && pos < to)) {
      out.push(n.type === "text" ? { ...n, text: (n.text ?? "").slice(start, end) } : n);
    }
    pos += len;
  }
  return out;
}

const para = (content: RichNode[]): RichNode => ({ type: "paragraph", content });
const trimmedRef = (r: string) => r.replace(/\s+/g, " ").replace(/[.;,\s]+$/, "").trim();

/**
 * The first paragraph of a capsule holds the scripture followed by its
 * reference ("... – Isaiah 26:3" or "... (John 1:1)"). Splits it into the
 * quoted text, the ref, and any text that runs on after the ref.
 */
export function splitScripture(first: RichNode | undefined): { text: RichNode; ref: string; rest: RichNode | null } | null {
  if (!first || first.type !== "paragraph") return null;
  const inline = first.content ?? [];
  const full = nodeText(first);

  const paren = PAREN_REF.exec(full);
  if (paren?.[1] && paren.index > 0) {
    return { text: para(sliceInline(inline, 0, paren.index)), ref: trimmedRef(paren[1]), rest: null };
  }
  for (const m of full.matchAll(DASH_REF)) {
    if (m.index <= 0) continue;
    const after = full.slice(m.index + m[0].length);
    const ref = REF_AT_START.exec(after)?.[1];
    if (!ref || !/\d/.test(ref)) continue;
    const refEnd = m.index + m[0].length + ref.length;
    const restContent = sliceInline(inline, refEnd, full.length);
    const rest = nodeText(para(restContent)).trim() ? para(restContent) : null;
    if (rest?.content?.[0]?.type === "text") rest.content[0].text = (rest.content[0].text ?? "").replace(/^[\s.;,]+/, "");
    return { text: para(sliceInline(inline, 0, m.index)), ref: trimmedRef(ref), rest };
  }
  return null;
}

/** Series marker in a title: "Peak Performance 10" or "Jesus Is The Door (2)". */
export function parseSeriesTitle(title: string): { base: string; part: number } | null {
  const t = title.trim();
  const m = /^(.*\S)\s*\((\d{1,3})\)$/.exec(t) ?? /^(.*[A-Za-z]\S*)\s+(\d{1,3})$/.exec(t);
  if (!m) return null;
  const base = (m[1] ?? "").replace(/[\s:–—-]+$/, "").trim();
  const part = Number(m[2]);
  if (base.length < 3 || part < 1) return null;
  return { base, part };
}

/** Legacy bodies without markup separate paragraphs with blank lines. */
const wrapPlain = (text: string) =>
  text
    .split(/\r?\n\s*\r?\n/)
    .map((p) => `<p>${p}</p>`)
    .join("");

const seriesKey = (base: string) => slugify(base);

function cleanAuthor(raw: string | undefined): string | null {
  if (!raw) return null;
  const text = decodeEntities(raw.replace(/<\/(?:li|p|div)>|<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, ""));
  const lines = text
    .split(/[\r\n]+/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return lines.length ? lines.join(" — ") : null;
}

const fromUnix = (s: number) => new Date(s * 1000);

/** Maps raw capsule nodes onto the capsule model and validates each one. */
export function transformCapsules(nodes: RawNode[]): TransformResult {
  const issues: Issue[] = [];
  const stats: Record<string, number> = {
    nodes: 0, migrated: 0, skipped: 0, withScripture: 0, withPrayer: 0, withMeditation: 0, inSeries: 0,
  };
  const usedSlugs = new Set<string>();
  const usedPaths = new Set<string>();
  const drafts: { capsule: Capsule; date: string; series: { base: string; part: number } | null }[] = [];

  for (const node of nodes) {
    if (node.type !== CAPSULE_TYPE) continue;
    stats.nodes = (stats.nodes ?? 0) + 1;
    const issue = (level: IssueLevel, code: string, detail?: string) =>
      issues.push({ nid: node.nid, title: node.title, level, code, ...(detail ? { detail } : {}) });

    const html = node.fields.body?.[0]?.body_value;
    const doc =
      typeof html === "string"
        ? htmlToDoc(/<p[\s>]/i.test(html) ? html : wrapPlain(html), (code, detail) =>
            issue("warning", code, code === "image" ? `image dropped: ${detail}` : `link dropped, text kept: ${detail}`),
          )
        : null;
    if (!doc || doc.content.length === 0) {
      issue("error", "empty-body", "no body text; skipped");
      stats.skipped = (stats.skipped ?? 0) + 1;
      continue;
    }

    const scripture = splitScripture(doc.content[0]);
    let scriptureRef: string | null = null;
    let scriptureText: Capsule["scriptureText"] = null;
    if (scripture) {
      scriptureRef = scripture.ref;
      scriptureText = { type: "doc", content: [scripture.text] };
      doc.content.shift();
      if (scripture.rest) doc.content.unshift(scripture.rest);
      stats.withScripture = (stats.withScripture ?? 0) + 1;
    } else issue("warning", "no-scripture", "first paragraph is not a scripture with a reference");
    if (doc.content.length === 0) {
      issue("error", "empty-body", "only a scripture; skipped");
      stats.skipped = (stats.skipped ?? 0) + 1;
      continue;
    }

    const prayerRaw = node.fields.field_prayer?.[0]?.field_prayer_value;
    const prayerText = typeof prayerRaw === "string" ? decodeEntities(prayerRaw).trim() : "";
    const prayer = prayerText ? textDoc(prayerText) : null;
    if (prayer) stats.withPrayer = (stats.withPrayer ?? 0) + 1;
    else issue("warning", "no-prayer");

    const medRaw = node.fields.field_bible_meditation?.[0]?.field_bible_meditation_value;
    const bibleMeditation = typeof medRaw === "string" && medRaw.trim() ? decodeEntities(medRaw).replace(/\s+/g, " ").trim() : null;
    if (bibleMeditation) stats.withMeditation = (stats.withMeditation ?? 0) + 1;

    const authorRaw = node.fields.field_excerpt?.[0]?.field_excerpt_value;
    const authorSource = cleanAuthor(typeof authorRaw === "string" ? authorRaw : undefined);
    if (!authorSource) issue("warning", "no-author-credit");

    const dateRaw = node.fields.field_daily_digest_date?.[0]?.field_daily_digest_date_value;
    let date = typeof dateRaw === "string" && /^\d{4}-\d{2}-\d{2}/.test(dateRaw) ? dateRaw.slice(0, 10) : null;
    if (!date) {
      date = fromUnix(node.created).toISOString().slice(0, 10);
      issue("warning", "date-from-created", "no capsule date; used node creation date");
    }

    const legacyPath = node.aliases[0] ?? null;
    const fromPath = legacyPath ? slugify(legacyPath.split("/").pop() ?? "") : "";
    let slug = fromPath || slugify(node.title) || `capsule-${node.nid}`;
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

    const candidate = {
      id: `legacy-${node.nid}`,
      createdAt: fromUnix(node.created),
      updatedAt: fromUnix(node.changed || node.created),
      slug,
      title: decodeEntities(node.title).replace(/\s+/g, " ").trim(),
      status: "published",
      publishAt: lagosDayRange(date)[0],
      scriptureRef,
      scriptureText,
      body: doc,
      decrees: [],
      prayer,
      bibleMeditation,
      authorSource,
      seriesId: null,
      partNumber: null,
      legacyNid: node.nid,
      legacyPath: path,
    };
    const over = (Object.keys(CAPSULE_LIMITS) as (keyof typeof CAPSULE_LIMITS)[]).filter(
      (k) => (candidate[k]?.length ?? 0) > CAPSULE_LIMITS[k],
    );
    if (over.length) {
      issue("error", "over-limit", over.map((k) => `${k} is ${candidate[k]?.length} chars (max ${CAPSULE_LIMITS[k]})`).join("; "));
      stats.skipped = (stats.skipped ?? 0) + 1;
      continue;
    }
    const parsed = capsuleSchema.safeParse(candidate);
    if (!parsed.success) {
      issue("error", "invalid", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
      stats.skipped = (stats.skipped ?? 0) + 1;
      continue;
    }
    drafts.push({ capsule: parsed.data, date, series: parseSeriesTitle(parsed.data.title) });
  }

  // Two capsules on one day would collide; keep both and nudge later ones by a minute each.
  const byDate = new Map<string, typeof drafts>();
  for (const d of drafts) byDate.set(d.date, [...(byDate.get(d.date) ?? []), d]);
  for (const [date, group] of byDate) {
    if (group.length < 2) continue;
    group.sort((a, b) => (a.capsule.legacyNid ?? 0) - (b.capsule.legacyNid ?? 0));
    for (let i = 1; i < group.length; i++) {
      const first = group[0]?.capsule;
      const later = group[i]?.capsule;
      if (!first || !later) continue;
      later.publishAt = new Date(later.publishAt.getTime() + i * 60 * 1000);
      issues.push({
        nid: later.legacyNid ?? 0,
        title: later.title,
        level: "warning",
        code: "duplicate-date",
        detail: `${date} is shared with nid ${first.legacyNid} "${first.title}"; publishAt moved +${i} min`,
      });
    }
  }

  // A series needs at least two capsules sharing a base title.
  const groups = new Map<string, typeof drafts>();
  for (const d of drafts) {
    if (!d.series) continue;
    const key = seriesKey(d.series.base);
    if (!key) continue;
    const g = groups.get(key) ?? [];
    g.push(d);
    groups.set(key, g);
  }
  const series: SeriesRecord[] = [];
  for (const [key, group] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    if (group.length < 2) continue;
    const first = group[0];
    if (!first?.series) continue;
    series.push({ id: key, slug: key, title: first.series.base, parts: group.length });
    const seen = new Set<number>();
    for (const d of group) {
      const part = d.series?.part ?? 0;
      if (seen.has(part)) {
        issues.push({ nid: d.capsule.legacyNid ?? 0, title: d.capsule.title, level: "warning", code: "duplicate-part", detail: `part ${part} of "${first.series.base}" repeats` });
        continue;
      }
      seen.add(part);
      d.capsule.seriesId = key;
      d.capsule.partNumber = part;
      stats.inSeries = (stats.inSeries ?? 0) + 1;
    }
  }

  const capsules = drafts.map((d) => d.capsule).sort((a, b) => a.publishAt.getTime() - b.publishAt.getTime() || (a.legacyNid ?? 0) - (b.legacyNid ?? 0));
  stats.migrated = capsules.length;
  return { capsules, series, issues, stats };
}

/**
 * Files referenced by nodes that are not in the extracted file folders:
 * everything under the Drupal private files folder.
 */
export function findMissingFiles(nodes: RawNode[], exists: (name: string) => boolean): MissingFile[] {
  const out: MissingFile[] = [];
  for (const n of nodes) {
    for (const f of Object.values(n.files)) {
      if (!f.uri) continue;
      const rel = f.uri.replace(/^[a-z]+:\/\//, "");
      if (f.uri.startsWith("private://") || !exists(rel)) out.push({ nid: n.nid, type: n.type, uri: f.uri });
    }
  }
  return out;
}
