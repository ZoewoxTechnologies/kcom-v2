import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { extractNodes, summarize } from "./extract.ts";
import { parseDump } from "./sql.ts";

const sql = process.env.LEGACY_SQL;
if (!sql) {
  console.error("Set LEGACY_SQL to the path of the Drupal MySQL dump.");
  process.exit(1);
}
const out = resolve(process.env.EXTRACT_DIR ?? "data/legacy/extract");

const nodes = extractNodes(parseDump(readFileSync(sql, "utf8")));
rmSync(out, { recursive: true, force: true });
for (const n of nodes) {
  const dir = join(out, n.type);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${n.nid}.json`), JSON.stringify(n, null, 2) + "\n");
}
console.log(`Wrote ${nodes.length} nodes to ${out}`);
console.log(JSON.stringify(summarize(nodes), null, 2));
