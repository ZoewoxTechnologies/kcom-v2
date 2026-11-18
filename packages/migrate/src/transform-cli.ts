import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { RawNode } from "./extract.ts";
import { findMissingFiles, transformCapsules } from "./transform.ts";

const extractDir = resolve(process.env.EXTRACT_DIR ?? "data/legacy/extract");
const filesDir = resolve(process.env.LEGACY_FILES ?? "data/legacy/files");
const out = resolve(process.env.TRANSFORM_DIR ?? "data/legacy/transform");

const nodes: RawNode[] = [];
for (const type of readdirSync(extractDir)) {
  for (const f of readdirSync(join(extractDir, type))) {
    nodes.push(JSON.parse(readFileSync(join(extractDir, type, f), "utf8")) as RawNode);
  }
}
nodes.sort((a, b) => a.nid - b.nid);

const result = transformCapsules(nodes);
const missingFiles = findMissingFiles(nodes, (name) => existsSync(join(filesDir, name)));

mkdirSync(out, { recursive: true });
const { capsules, series, issues, stats } = result;
writeFileSync(join(out, "capsules.json"), JSON.stringify(capsules, null, 2) + "\n");
writeFileSync(join(out, "series.json"), JSON.stringify(series, null, 2) + "\n");
const byCode: Record<string, number> = {};
for (const i of issues) byCode[`${i.level}:${i.code}`] = (byCode[`${i.level}:${i.code}`] ?? 0) + 1;
writeFileSync(
  join(out, "report.json"),
  JSON.stringify({ stats, seriesCount: series.length, issueCounts: byCode, issues, missingFiles }, null, 2) + "\n",
);
console.log(JSON.stringify({ stats, seriesCount: series.length, issueCounts: byCode, missingFiles: missingFiles.length }, null, 2));
console.log(`Wrote ${out}`);
