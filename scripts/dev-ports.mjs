#!/usr/bin/env node
// Picks a free dev port set for this checkout and writes it to the apps' .env.local
// files and .claude/launch.json, so several worktrees can run the API, site and admin
// side by side. The main checkout keeps 3000 / 4321 / 5173.
//
// Usage: pnpm dev:ports [--reassign]
//   --reassign  pick a new port set even if this checkout already has one.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = { api: 3000, web: 4321, admin: 5173 };
const STEP = 10;
const MAX_OFFSET = 500;

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

const gitDir = resolve(root, git("rev-parse", "--git-dir"));
const commonDir = resolve(root, git("rev-parse", "--git-common-dir"));
const isMain = gitDir === commonDir;

const readLines = (file) => (existsSync(file) ? readFileSync(file, "utf8").split("\n") : []);
const readValue = (file, key) => {
  const line = readLines(file).find((l) => l.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1).trim() : undefined;
};

/** Offsets already claimed by other checkouts' env files, running or not. */
function claimedOffsets() {
  const claimed = new Set();
  const paths = git("worktree", "list", "--porcelain")
    .split("\n")
    .filter((l) => l.startsWith("worktree "))
    .map((l) => l.slice("worktree ".length));
  for (const path of paths) {
    if (resolve(path) === root) continue;
    const port = Number(readValue(join(path, "apps/api/.env.local"), "PORT"));
    if (port >= BASE.api) claimed.add(port - BASE.api);
  }
  return claimed;
}

// Servers bind differently (Vite on ::1, Astro on all interfaces), so probe each.
const HOSTS = ["0.0.0.0", "127.0.0.1", "::1"];
const probe = (port, host) =>
  new Promise((done) => {
    const server = createServer();
    server.once("error", (e) => done(e.code === "EADDRNOTAVAIL" || e.code === "EAFNOSUPPORT"));
    server.listen({ port, host, exclusive: true }, () => server.close(() => done(true)));
  });
const isFree = async (port) => (await Promise.all(HOSTS.map((h) => probe(port, h)))).every(Boolean);

const portsFor = (offset) => ({
  api: BASE.api + offset,
  web: BASE.web + offset,
  admin: BASE.admin + offset,
});

async function allFree(ports) {
  const results = await Promise.all(Object.values(ports).map(isFree));
  return results.every(Boolean);
}

async function choosePorts() {
  if (isMain) return portsFor(0);
  const current = Number(readValue(join(root, "apps/api/.env.local"), "PORT")) - BASE.api;
  const claimed = claimedOffsets();
  if (!process.argv.includes("--reassign") && current > 0 && !claimed.has(current)) {
    return portsFor(current);
  }
  for (let offset = STEP; offset <= MAX_OFFSET; offset += STEP) {
    if (claimed.has(offset)) continue;
    const ports = portsFor(offset);
    if (await allFree(ports)) return ports;
  }
  throw new Error(`No free port set found up to offset ${MAX_OFFSET}`);
}

/** Replaces `KEY=` lines in place, appends missing keys, keeps every other line. `onlyIfPresent` keys are updated but never added. */
function writeEnv(app, values, onlyIfPresent = {}) {
  const dir = join(root, "apps", app);
  const file = join(dir, ".env.local");
  const main = join(commonDir, "..", "apps", app, ".env.local");
  const seed = [file, main, join(dir, ".env.example")].find(existsSync);
  const lines = readLines(seed);
  if (lines.at(-1) === "") lines.pop();
  for (const [key, value] of Object.entries(onlyIfPresent)) {
    const at = lines.findIndex((l) => l.startsWith(`${key}=`));
    if (at >= 0) lines[at] = `${key}=${value}`;
  }
  for (const [key, value] of Object.entries(values)) {
    const at = lines.findIndex((l) => l.startsWith(`${key}=`));
    if (at >= 0) lines[at] = `${key}=${value}`;
    else lines.push(`${key}=${value}`);
  }
  writeFileSync(file, `${lines.join("\n")}\n`);
}

function writeLaunch(ports) {
  const file = join(root, ".claude/launch.json");
  const existing = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  const ours = ["api", "web", "admin"].map((app) => ({
    name: `kcom-${app}`,
    runtimeExecutable: "pnpm",
    runtimeArgs: ["--filter", `@kcom/${app}`, "dev"],
    port: ports[app],
  }));
  const keep = (existing.configurations ?? []).filter((c) => !ours.some((o) => o.name === c.name));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(
    file,
    `${JSON.stringify({ version: "0.0.1", ...existing, configurations: [...keep, ...ours] }, null, 2)}\n`,
  );
}

const ports = await choosePorts();
const origin = (app) => `http://localhost:${ports[app]}`;

writeEnv("api", {
  PORT: ports.api,
  CORS_ORIGINS: `${origin("web")},${origin("admin")}`,
  BETTER_AUTH_URL: origin("api"),
});
writeEnv(
  "web",
  { PUBLIC_API_URL: origin("api"), DEV_PORT: ports.web },
  { PUBLIC_SITE_URL: origin("web") },
);
writeEnv("admin", {
  VITE_API_URL: origin("api"),
  VITE_SITE_URL: origin("web"),
  DEV_PORT: ports.admin,
});
writeLaunch(ports);

console.log(
  `${isMain ? "Main checkout" : "Worktree"} ports: api ${ports.api}, web ${ports.web}, admin ${ports.admin}`,
);
console.log("Wrote apps/{api,web,admin}/.env.local and .claude/launch.json. Run: pnpm dev");
