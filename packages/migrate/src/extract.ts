import type { Row, Tables } from "./sql.ts";

export interface RawFile {
  fid: number;
  filename: string | null;
  uri: string | null;
  filemime: string | null;
  filesize: number | null;
}

export interface RawTerm {
  tid: number;
  name: string | null;
  vocabulary: string | null;
}

export interface RawNode {
  nid: number;
  vid: number | null;
  type: string;
  language: string;
  title: string;
  created: number;
  changed: number;
  promote: number;
  sticky: number;
  /** Drupal user id of the author; no user data is part of the dump. */
  uid: number;
  /** url_alias paths pointing at this node. */
  aliases: string[];
  /** Field name (without the field_data_ prefix) to its ordered values. */
  fields: Record<string, Row[]>;
  terms: RawTerm[];
  /** Files referenced by any *_fid column, keyed by fid. */
  files: Record<string, RawFile>;
}

const FIELD_META = new Set(["entity_type", "bundle", "deleted", "entity_id", "revision_id"]);

function groupBy<T extends Row>(rows: T[], key: (r: T) => string | number | null) {
  const out = new Map<string | number, T[]>();
  for (const r of rows) {
    const k = key(r);
    if (k === null) continue;
    const list = out.get(k);
    if (list) list.push(r);
    else out.set(k, [r]);
  }
  return out;
}

const num = (v: Row[string] | undefined) => (typeof v === "number" ? v : null);
const str = (v: Row[string] | undefined) => (v === null || v === undefined ? null : String(v));

/** Builds one raw record per published node from the parsed dump tables. */
export function extractNodes(tables: Tables): RawNode[] {
  const get = (name: string) => tables.get(name) ?? [];

  const files = new Map<number, RawFile>();
  for (const f of get("file_managed")) {
    const fid = num(f.fid);
    if (fid === null) continue;
    files.set(fid, {
      fid,
      filename: str(f.filename),
      uri: str(f.uri),
      filemime: str(f.filemime),
      filesize: num(f.filesize),
    });
  }

  const vocabularies = new Map<number, string | null>();
  for (const v of get("taxonomy_vocabulary")) {
    const vid = num(v.vid);
    if (vid !== null) vocabularies.set(vid, str(v.machine_name));
  }
  const termsById = new Map<number, RawTerm>();
  for (const t of get("taxonomy_term_data")) {
    const tid = num(t.tid);
    if (tid === null) continue;
    const vid = num(t.vid);
    termsById.set(tid, {
      tid,
      name: str(t.name),
      vocabulary: vid === null ? null : (vocabularies.get(vid) ?? null),
    });
  }
  const termsByNode = groupBy(get("taxonomy_index"), (r) => num(r.nid));

  const aliasesByNode = new Map<number, string[]>();
  for (const a of get("url_alias")) {
    const m = /^node\/(\d+)$/.exec(String(a.source ?? ""));
    if (!m || a.alias === null || a.alias === undefined) continue;
    const nid = Number(m[1]);
    const list = aliasesByNode.get(nid) ?? [];
    list.push(String(a.alias));
    aliasesByNode.set(nid, list);
  }

  const fieldsByNode = new Map<number, Record<string, Row[]>>();
  for (const [table, rows] of tables) {
    if (!table.startsWith("field_data_")) continue;
    const name = table.slice("field_data_".length);
    for (const r of rows) {
      if (r.entity_type !== "node" || r.deleted !== 0) continue;
      const nid = num(r.entity_id);
      if (nid === null) continue;
      const value: Row = {};
      for (const [k, v] of Object.entries(r)) if (!FIELD_META.has(k)) value[k] = v;
      const fields = fieldsByNode.get(nid) ?? {};
      (fields[name] ??= []).push(value);
      fieldsByNode.set(nid, fields);
    }
  }
  for (const fields of fieldsByNode.values()) {
    for (const list of Object.values(fields)) {
      list.sort((a, b) => (num(a.delta) ?? 0) - (num(b.delta) ?? 0));
    }
  }

  const nodes: RawNode[] = [];
  for (const n of get("node")) {
    const nid = num(n.nid);
    if (nid === null || n.status !== 1) continue;
    const fields = fieldsByNode.get(nid) ?? {};
    const nodeFiles: Record<string, RawFile> = {};
    for (const list of Object.values(fields)) {
      for (const value of list) {
        for (const [k, v] of Object.entries(value)) {
          const file = k.endsWith("_fid") && typeof v === "number" ? files.get(v) : undefined;
          if (file) nodeFiles[String(file.fid)] = file;
        }
      }
    }
    const terms = (termsByNode.get(nid) ?? [])
      .map((r) => termsById.get(num(r.tid) ?? -1))
      .filter((t): t is RawTerm => t !== undefined);
    nodes.push({
      nid,
      vid: num(n.vid),
      type: String(n.type),
      language: String(n.language),
      title: String(n.title),
      created: num(n.created) ?? 0,
      changed: num(n.changed) ?? 0,
      promote: num(n.promote) ?? 0,
      sticky: num(n.sticky) ?? 0,
      uid: num(n.uid) ?? 0,
      aliases: aliasesByNode.get(nid) ?? [],
      fields,
      terms,
      files: nodeFiles,
    });
  }
  return nodes.sort((a, b) => a.nid - b.nid);
}

export interface Summary {
  countsByType: Record<string, number>;
  capsules: { total: number; real: number; oldest: string | null; newest: string | null };
}

/** The Drupal content type that holds the daily devotionals. */
export const CAPSULE_TYPE = "daily_digest";

const hasText = (html: unknown) =>
  typeof html === "string" && html.replace(/<[^>]*>|&nbsp;|\s/g, "").length > 0;

/**
 * A capsule is "real" when it has a body with text. Dates come from the
 * daily-digest date field, falling back to the node creation time.
 */
export function summarize(nodes: RawNode[]): Summary {
  const countsByType: Record<string, number> = {};
  let total = 0;
  let real = 0;
  let oldest: string | null = null;
  let newest: string | null = null;
  for (const n of nodes) {
    countsByType[n.type] = (countsByType[n.type] ?? 0) + 1;
    if (n.type !== CAPSULE_TYPE) continue;
    total++;
    if (!hasText(n.fields.body?.[0]?.body_value)) continue;
    real++;
    const raw = n.fields.field_daily_digest_date?.[0]?.field_daily_digest_date_value;
    const date =
      typeof raw === "string" && raw ? raw.slice(0, 10) : new Date(n.created * 1000).toISOString().slice(0, 10);
    if (oldest === null || date < oldest) oldest = date;
    if (newest === null || date > newest) newest = date;
  }
  return { countsByType, capsules: { total, real, oldest, newest } };
}
