// Monthly activity-log retention, run by .github/workflows/activity-archive.yml.
// Reads DATABASE_URL and the same S3_* / AWS_* variables as the nightly backup. Archives are kept
// under activity/ in the backup bucket. Exits non-zero on any failure.
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { runActivityRetention, type ArchiveStore } from "./activity-archive.js";
import { createDb } from "./client.js";

const run = promisify(execFile);

/** Object storage through the AWS CLI, which the backup workflow already relies on. */
export function awsStore(
  { bucket, endpoint, prefix }: { bucket: string; endpoint: string; prefix: string },
  exec: (args: string[]) => Promise<{ stdout: string }> = (args) =>
    run("aws", ["--endpoint-url", endpoint, ...args]),
): ArchiveStore {
  const key = (name: string) => `${prefix.replace(/\/+$/, "")}/${name}`;
  return {
    async exists(name) {
      try {
        await exec(["s3api", "head-object", "--bucket", bucket, "--key", key(name)]);
        return true;
      } catch (err) {
        // Only "not found" means missing; any other error (auth, network) must stop the run.
        const text = `${(err as { stderr?: string }).stderr ?? ""} ${(err as Error).message}`;
        if (/\b404\b|Not Found|NoSuchKey/i.test(text)) return false;
        throw err;
      }
    },
    async get(name) {
      const dir = await mkdtemp(join(tmpdir(), "kcom-activity-"));
      try {
        const file = join(dir, "archive.json");
        await exec(["s3api", "get-object", "--bucket", bucket, "--key", key(name), file]);
        return await readFile(file, "utf8");
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
    async put(name, body) {
      const dir = await mkdtemp(join(tmpdir(), "kcom-activity-"));
      try {
        const file = join(dir, "archive.json");
        await writeFile(file, body);
        await exec([
          "s3api",
          "put-object",
          "--bucket",
          bucket,
          "--key",
          key(name),
          "--body",
          file,
          "--content-type",
          "application/json",
        ]);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  };
}

async function main() {
  const bucket = process.env.S3_BUCKET;
  const endpoint = process.env.S3_ENDPOINT;
  if (!bucket || !endpoint) throw new Error("S3_BUCKET and S3_ENDPOINT must be set");
  const db = createDb();
  try {
    await runActivityRetention(
      db,
      awsStore({
        bucket,
        endpoint,
        prefix: "activity",
      }),
    );
  } finally {
    await db.pool.end();
  }
}

// Only run when started directly, so tests can import `awsStore`.
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((err) => {
    console.error(err instanceof AggregateError ? err.errors.map(String).join("\n") : err);
    process.exit(1);
  });
}
