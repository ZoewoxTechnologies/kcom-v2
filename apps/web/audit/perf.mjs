// On-demand Lighthouse run (never in CI). Usage: pnpm --filter @kcom/web audit:perf -- --url https://example.org
// Without --url, BASE_URL or http://localhost:4321 is used. Extra flags go to lhci autorun.
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const i = args.indexOf("--url");
const env = { ...process.env };
if (i !== -1) {
  env.BASE_URL = args[i + 1];
  args.splice(i, 2);
}
const run = spawnSync("pnpm", ["dlx", "@lhci/cli@0.16.1", "autorun", ...args], { stdio: "inherit", env });
process.exit(run.status ?? 1);
