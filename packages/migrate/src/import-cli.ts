import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { createDb } from "@kcom/db";
import { transformBlog } from "./blog.ts";
import type { RawNode } from "./extract.ts";
import { importContent } from "./import.ts";
import { buildRedirects } from "./redirects.ts";
import { transformCapsules } from "./transform.ts";

const extractDir = resolve(process.env.EXTRACT_DIR ?? "data/legacy/extract");
const out = resolve(process.env.TRANSFORM_DIR ?? "data/legacy/transform");
const statePath = join(out, "import-state.json");
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const final = args.includes("--final");
const sinceArg = args.find((a) => a.startsWith("--since="))?.slice("--since=".length);

// Final sync imports only what changed since the last run (or the given date).
let since: Date | undefined;
if (sinceArg) since = new Date(sinceArg);
else if (final && existsSync(statePath)) since = new Date((JSON.parse(readFileSync(statePath, "utf8")) as { lastSync: string }).lastSync);
if (since && Number.isNaN(since.getTime())) throw new Error("--since must be a valid date");

const nodes: RawNode[] = [];
for (const type of readdirSync(extractDir)) {
  for (const f of readdirSync(join(extractDir, type))) nodes.push(JSON.parse(readFileSync(join(extractDir, type, f), "utf8")) as RawNode);
}
nodes.sort((a, b) => a.nid - b.nid);

const startedAt = new Date();
const { capsules, series } = transformCapsules(nodes);
const { posts } = transformBlog(nodes);
const map = buildRedirects(nodes, capsules, posts);

const db = createDb();
try {
  const result = await importContent(db, { series, capsules, posts, redirects: map.redirects }, { since, dryRun });
  const expected = { series: series.length, capsules: capsules.length, posts: posts.length, redirects: map.redirects.length };
  const matches = !since && JSON.stringify(expected) === JSON.stringify(result.inDatabase);

  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "redirects.json"), JSON.stringify(map.redirects, null, 2) + "\n");
  if (!dryRun) writeFileSync(statePath, JSON.stringify({ lastSync: startedAt.toISOString() }, null, 2) + "\n");

  console.log(JSON.stringify({ mode: dryRun ? "dry-run" : since ? `since ${since.toISOString()}` : "full", result, expected, countsMatch: since ? "n/a" : matches, unchanged: map.unchanged, fallbacks: map.fallbacks }, null, 2));
  if (!since && !matches) process.exitCode = 1;
} finally {
  await db.pool.end();
}
