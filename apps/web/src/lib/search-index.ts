/**
 * Search records for Pagefind: one per page worth finding. Pure functions over API rows so the
 * build script (scripts/search-index.ts) only does the fetching and writing.
 */

export interface SearchRecord {
  url: string;
  title: string;
  content: string;
  /** Result chip and date line; `date` is an ISO day, or a plain label for pages. */
  meta: { type: string; date: string };
  filters: { type: string[]; year?: string[]; series?: string[] };
}

type Json = Record<string, unknown>;

const BLOCKS = new Set(["paragraph", "heading", "blockquote", "listItem", "bulletList", "orderedList", "codeBlock", "doc"]);

/** Plain text of a rich-text document (or a plain string); blocks join with a space. */
export function plain(node: unknown): string {
  if (typeof node === "string") return node.replace(/\s+/g, " ").trim();
  const walk = (n: unknown): string => {
    if (!n || typeof n !== "object") return "";
    const o = n as { text?: unknown; content?: unknown };
    if (typeof o.text === "string") return o.text;
    const kids = Array.isArray(o.content) ? o.content : [];
    const blocky = kids.some((k) => BLOCKS.has((k as { type?: string })?.type ?? ""));
    return kids.map(walk).join(blocky ? " " : "");
  };
  return walk(node).replace(/\s+/g, " ").trim();
}

const text = (...parts: unknown[]) => parts.map(plain).filter(Boolean).join(" ");
const str = (v: unknown) => (typeof v === "string" ? v : "");
const day = (v: unknown) => str(v).slice(0, 10);
const year = (iso: string) => (/^\d{4}/.test(iso) ? [iso.slice(0, 4)] : undefined);

export function capsuleRecord(c: Json, seriesTitle: string | null): SearchRecord {
  const date = str(c.displayDate);
  return {
    url: `/capsules/${str(c.slug)}`,
    title: str(c.title),
    content: text(c.scriptureRef, c.scriptureText, c.bibleMeditation, c.body, Array.isArray(c.decrees) ? c.decrees.join(" ") : "", c.prayer),
    meta: { type: "Capsule", date },
    filters: { type: ["Capsule"], year: year(date), ...(seriesTitle ? { series: [seriesTitle] } : {}) },
  };
}

export function blogRecord(p: Json): SearchRecord {
  const date = day(p.date);
  const tags = Array.isArray(p.tags) ? p.tags.join(" ") : "";
  return { url: `/blog/${str(p.slug)}`, title: str(p.title), content: text(p.excerpt, tags, p.body), meta: { type: "Blog", date }, filters: { type: ["Blog"], year: year(date) } };
}

export function seriesRecord(s: Json): SearchRecord {
  return { url: `/series/${str(s.slug)}`, title: str(s.title), content: text(s.description), meta: { type: "Series", date: "" }, filters: { type: ["Series"], series: [str(s.title)] } };
}

export function eventRecord(e: Json): SearchRecord {
  const date = day(e.startsAt);
  return { url: `/events/${str(e.slug)}`, title: str(e.title), content: text(e.place, e.description, e.programme), meta: { type: "Event", date }, filters: { type: ["Event"], year: year(date) } };
}

export function bookRecord(b: Json): SearchRecord {
  const y = typeof b.publishedYear === "number" ? String(b.publishedYear) : "";
  return { url: "/books", title: str(b.title), content: text(b.description), meta: { type: "Book", date: y }, filters: { type: ["Book"], ...(y ? { year: [y] } : {}) } };
}

export function pageRecord(url: string, title: string, content: string): SearchRecord {
  return { url, title, content, meta: { type: "Page", date: "About" }, filters: { type: ["Page"] } };
}

/** The About pages; their copy lives in the page templates, so the searchable text is kept here. */
export const aboutRecords: SearchRecord[] = [
  pageRecord("/about", "Who We Are", "Kingdom Capstone Outreach Ministries is a prophetic, teaching and intercessory outreach with a mandate to encourage, equip and motivate individuals and churches to operate in the realms of grace and glory. Revelation, Restoration, Revival. The vision, the mission, our mandate: publishing and proclaiming the prophetic Word of God."),
  pageRecord("/about/team", "Ministry Team and Arms", "The ministry team and the arms of Kingdom Capstone Outreach Ministries: SALTI Salt and Light Training Institute, F-I-R-E Force Faith-Intercession Revival Force, IPSI Intensive Prophetic Strategic Intercession."),
];
