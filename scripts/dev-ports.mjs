#!/usr/bin/env node
// Sets up this checkout's dev ports, env files and .claude/launch.json so several worktrees
// can run next to the main checkout (API 3000, site 4321, admin 5173).
//
// A worktree gets its own site and admin ports. By default it shares the main checkout's API on
// port 3000 and its database. It gets its own API (port 3000 + offset) when:
//   - you pass --own-api,
//   - the branch changes apps/api or packages/db, or
//   - nothing is listening on port 3000.
// If the branch adds a file under packages/db/migrations, the own API also gets its own local
// Postgres database (kcom_<worktree>), created and migrated here, so the shared one is never migrated.
//
// Usage: pnpm dev:ports [--own-api] [--reassign]
//   --own-api   run this worktree's own API instead of the shared one.
//   --reassign  pick a new port set even if this checkout already has one.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createConnection, createServer } from "node:net";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = { api: 3000, web: 4321, admin: 5173 };
const STEP = 10;
const MAX_OFFSET = 500;
// Test hook: the port treated as "the main checkout's API" (default 3000).
const SHARED_API_PORT = Number(process.env.KCOM_SHARED_API_PORT) || BASE.api;

const args = new Set(process.argv.slice(2));
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const run = (cmd, argv, opts = {}) =>
  execFileSync(cmd, argv, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...opts,
  }).trim();
const git = (...argv) => run("git", argv);

const gitDir = resolve(root, git("rev-parse", "--git-dir"));
const commonDir = resolve(root, git("rev-parse", "--git-common-dir"));
const mainRoot = resolve(commonDir, "..");
const isMain = gitDir === commonDir;

const readLines = (file) => (existsSync(file) ? readFileSync(file, "utf8").split("\n") : []);
const readValue = (file, key) => {
  const line = readLines(file).find((l) => l.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1).trim() : undefined;
};
const envFile = (base, app) => join(base, "apps", app, ".env.local");

// ---- ports -------------------------------------------------------------------------------------

/** Offsets already claimed by other checkouts' env files, running or not. */
function claimedOffsets() {
  const claimed = new Set();
  const paths = git("worktree", "list", "--porcelain")
    .split("\n")
    .filter((l) => l.startsWith("worktree "))
    .map((l) => l.slice("worktree ".length));
  for (const path of paths) {
    if (resolve(path) === root) continue;
    const web = Number(readValue(envFile(path, "web"), "DEV_PORT"));
    if (web > BASE.web) claimed.add(web - BASE.web);
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

const accepts = (port, host) =>
  new Promise((done) => {
    const socket = createConnection({ port, host });
    socket.setTimeout(500);
    socket.once("connect", () => (socket.destroy(), done(true)));
    socket.once("timeout", () => (socket.destroy(), done(false)));
    socket.once("error", () => done(false));
  });
const isListening = async (port) =>
  (await Promise.all(["127.0.0.1", "::1"].map((h) => accepts(port, h)))).some(Boolean);

async function chooseOffset(needApi) {
  if (isMain) return 0;
  const current = Number(readValue(envFile(root, "web"), "DEV_PORT")) - BASE.web;
  const claimed = claimedOffsets();
  const portsFor = (offset) => [
    BASE.web + offset,
    BASE.admin + offset,
    ...(needApi ? [BASE.api + offset] : []),
  ];
  const free = async (offset) => (await Promise.all(portsFor(offset).map(isFree))).every(Boolean);
  if (!args.has("--reassign") && current > 0 && !claimed.has(current)) return current;
  for (let offset = STEP; offset <= MAX_OFFSET; offset += STEP) {
    if (!claimed.has(offset) && (await free(offset))) return offset;
  }
  throw new Error(`No free port set found up to offset ${MAX_OFFSET}`);
}

// ---- what the branch changes -------------------------------------------------------------------

function mergeBase() {
  for (const ref of ["origin/main", "main"]) {
    try {
      return git("merge-base", ref, "HEAD");
    } catch {
      // try the next ref
    }
  }
  return "";
}
const lines = (out) => out.split("\n").filter(Boolean);
const untracked = (...paths) =>
  lines(git("ls-files", "--others", "--exclude-standard", "--", ...paths));

/** Files this branch changes against main, committed or not. */
function changedFiles() {
  const base = mergeBase();
  return [...(base ? lines(git("diff", "--name-only", base)) : []), ...untracked(".")];
}

/** True when the branch adds a migration file, committed or not. */
function addsMigrations() {
  const dir = "packages/db/migrations";
  const base = mergeBase();
  const added = base ? lines(git("diff", "--name-only", "--diff-filter=A", base, "--", dir)) : [];
  return added.length + untracked(dir).length > 0;
}
const touches = (files, ...prefixes) => files.some((f) => prefixes.some((p) => f.startsWith(p)));

// ---- env and launch files ----------------------------------------------------------------------

/**
 * Replaces `KEY=` lines in place, appends missing keys, keeps every other line. `onlyIfPresent`
 * keys are updated but never added. A missing file starts from the main checkout's copy, then
 * from `.env.example`.
 */
function writeEnv(app, values, onlyIfPresent = {}) {
  const file = envFile(root, app);
  const seed = [file, envFile(mainRoot, app), join(root, "apps", app, ".env.example")].find(
    existsSync,
  );
  const lines = readLines(seed);
  if (lines.at(-1) === "") lines.pop();
  const set = (key, value, add) => {
    const at = lines.findIndex((l) => l.startsWith(`${key}=`));
    if (at >= 0) lines[at] = `${key}=${value}`;
    else if (add) lines.push(`${key}=${value}`);
  };
  for (const [key, value] of Object.entries(onlyIfPresent)) set(key, value, false);
  for (const [key, value] of Object.entries(values)) set(key, value, true);
  writeFileSync(file, `${lines.join("\n")}\n`);
}

function writeLaunch(ports, ownApi) {
  const file = join(root, ".claude/launch.json");
  const existing = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  const apps = ownApi ? ["api", "web", "admin"] : ["web", "admin"];
  const ours = apps.map((app) => ({
    name: `kcom-${app}`,
    runtimeExecutable: "pnpm",
    runtimeArgs: ["--filter", `@kcom/${app}`, "dev"],
    port: ports[app],
  }));
  const keep = (existing.configurations ?? []).filter((c) => !c.name?.startsWith("kcom-"));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(
    file,
    `${JSON.stringify({ version: "0.0.1", ...existing, configurations: [...keep, ...ours] }, null, 2)}\n`,
  );
}

// ---- database ----------------------------------------------------------------------------------

/** A local Postgres database for a branch that adds migrations; created and migrated here. */
function setUpOwnDatabase() {
  const name = `kcom_${basename(root)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")}`;
  const url = `postgres://localhost:5432/${name}`;
  if (spawnSync("pg_isready", ["-q", "-h", "localhost"]).status !== 0) {
    throw new Error(
      `This branch adds migrations, so it needs its own local Postgres database (${name}), but Postgres is not running on localhost:5432.`,
    );
  }
  const exists = run("psql", [
    "-h",
    "localhost",
    "-d",
    "postgres",
    "-tAc",
    `SELECT 1 FROM pg_database WHERE datname='${name}'`,
  ]);
  if (!exists) run("createdb", ["-h", "localhost", name]);
  return { name, url };
}

/** Migrates and seeds the own database, using the admin credentials from the API's env file. */
function migrateAndSeed(url) {
  const file = envFile(root, "api");
  const env = { ...process.env, DATABASE_URL: url };
  for (const key of ["ADMIN_EMAIL", "ADMIN_PASSWORD", "EDITOR_EMAIL", "EDITOR_PASSWORD"]) {
    const value = readValue(file, key);
    if (value) env[key] = value;
  }
  for (const script of [
    ["--filter", "@kcom/db", "db:migrate"],
    ["--filter", "@kcom/db", "db:seed"],
    ["--filter", "@kcom/api", "seed:users"],
  ]) {
    run("pnpm", script, { env });
  }
}

// ---- main --------------------------------------------------------------------------------------

const files = isMain ? [] : changedFiles();
const addedMigrations = !isMain && addsMigrations();
const sharedUp = isMain || (await isListening(SHARED_API_PORT));
const reasons = [];
if (isMain) reasons.push("main checkout");
if (args.has("--own-api")) reasons.push("--own-api");
if (touches(files, "apps/api/", "packages/db/"))
  reasons.push("branch changes apps/api or packages/db");
if (!sharedUp) reasons.push(`nothing is listening on ${SHARED_API_PORT}`);
const ownApi = reasons.length > 0;

const offset = await chooseOffset(ownApi);
const ports = {
  api: ownApi ? BASE.api + offset : SHARED_API_PORT,
  web: BASE.web + offset,
  admin: BASE.admin + offset,
};
const origin = (app) => `http://localhost:${ports[app]}`;

let database = "none (no API of its own)";
if (ownApi) {
  writeEnv("api", {
    PORT: ports.api,
    CORS_ORIGINS: `${origin("web")},${origin("admin")}`,
    BETTER_AUTH_URL: origin("api"),
  });
  if (!isMain) {
    if (addedMigrations) {
      const own = setUpOwnDatabase();
      writeEnv("api", { DATABASE_URL: own.url });
      migrateAndSeed(own.url);
      database = `own local database ${own.name} (branch adds migrations)`;
    } else {
      const shared = readValue(envFile(mainRoot, "api"), "DATABASE_URL");
      if (shared) writeEnv("api", { DATABASE_URL: shared });
      database = "main checkout's database (shared)";
    }
  } else {
    database = "main checkout's database";
  }
}
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
writeLaunch(ports, ownApi);

console.log(
  `${isMain ? "Main checkout" : "Worktree"} ports: site ${ports.web}, admin ${ports.admin}`,
);
console.log(
  ownApi
    ? `API: own, port ${ports.api} (${reasons.join("; ")}). Database: ${database}. Run: pnpm dev`
    : `API: shared main-checkout API on port ${ports.api}. Run: pnpm dev:front`,
);
