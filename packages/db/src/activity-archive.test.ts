import { beforeEach, describe, expect, it } from "vitest";
import { activityLog } from "./schema.js";
import { createTestDb } from "./test-db.js";
import {
  archiveKey,
  monthOf,
  monthStartBefore,
  runActivityRetention,
  type ArchiveStore,
} from "./activity-archive.js";
import { awsStore } from "./activity-archive-cli.js";

const NOW = new Date("2026-11-01T03:30:00Z");
let db: Awaited<ReturnType<typeof createTestDb>>;

function memoryStore(files: Record<string, string> = {}) {
  const puts: string[] = [];
  const store: ArchiveStore & { files: Record<string, string>; puts: string[] } = {
    files,
    puts,
    exists: async (k) => k in files,
    get: async (k) => files[k]!,
    put: async (k, body) => {
      puts.push(k);
      files[k] = body;
    },
  };
  return store;
}

const row = (at: string, title = "T") => ({
  userName: "Grace",
  action: "update" as const,
  entityType: "blog",
  entityId: "x",
  title,
  at: new Date(at),
});
const remaining = async () =>
  (await db.select().from(activityLog)).map((r) => monthOf(r.at)).sort();
const quiet = () => {};

beforeEach(async () => {
  db = await createTestDb();
});

describe("month helpers", () => {
  it("computes UTC month boundaries", () => {
    expect(monthOf(new Date("2026-05-31T23:59:59Z"))).toBe("2026-05");
    expect(monthStartBefore(NOW, 6).toISOString()).toBe("2026-05-01T00:00:00.000Z");
    expect(monthStartBefore(new Date("2026-02-10T00:00:00Z"), 6).toISOString()).toBe(
      "2025-08-01T00:00:00.000Z",
    );
  });
});

describe("runActivityRetention: archive", () => {
  it("archives the month that has just turned 6 months old as one file and keeps its rows", async () => {
    await db
      .insert(activityLog)
      .values([
        row("2026-04-02T10:00:00Z", "A"),
        row("2026-04-30T23:00:00Z", "B"),
        row("2026-05-01T00:00:00Z", "C"),
      ]);
    const store = memoryStore();
    const res = await runActivityRetention(db, store, NOW, quiet);
    expect(res.archived).toEqual([{ month: "2026-04", rows: 2 }]);
    expect(Object.keys(store.files)).toEqual([archiveKey("2026-04")]);
    const file = JSON.parse(store.files["activity-2026-04.json"]!);
    expect(file.month).toBe("2026-04");
    expect(file.rows.map((r: { title: string }) => r.title)).toEqual(["A", "B"]);
    expect(Object.keys(file.rows[0]).sort()).toEqual(
      ["action", "at", "entityId", "entityType", "id", "title", "userId", "userName"].sort(),
    );
    expect(await remaining()).toEqual(["2026-04", "2026-04", "2026-05"]);
  });

  it("leaves months that are not yet 6 months old alone", async () => {
    await db.insert(activityLog).values([row("2026-05-15T00:00:00Z"), row("2026-10-20T00:00:00Z")]);
    const store = memoryStore();
    await runActivityRetention(db, store, NOW, quiet);
    expect(store.puts).toEqual([]);
  });

  it("catches up on every due month, oldest first", async () => {
    await db
      .insert(activityLog)
      .values([
        row("2026-03-10T00:00:00Z"),
        row("2026-01-10T00:00:00Z"),
        row("2026-04-10T00:00:00Z"),
      ]);
    const store = memoryStore();
    const res = await runActivityRetention(db, store, NOW, quiet);
    expect(res.archived.map((a) => a.month)).toEqual(["2026-01", "2026-03", "2026-04"]);
  });

  it("never overwrites an existing archive", async () => {
    await db.insert(activityLog).values(row("2026-04-02T10:00:00Z"));
    const store = memoryStore({ "activity-2026-04.json": "ORIGINAL" });
    const res = await runActivityRetention(db, store, NOW, quiet);
    expect(res.alreadyArchived).toEqual(["2026-04"]);
    expect(store.puts).toEqual([]);
    expect(store.files["activity-2026-04.json"]).toBe("ORIGINAL");
  });

  it("is a no-op when run again", async () => {
    await db.insert(activityLog).values(row("2026-04-02T10:00:00Z"));
    const store = memoryStore();
    await runActivityRetention(db, store, NOW, quiet);
    const again = await runActivityRetention(db, store, NOW, quiet);
    expect(again.archived).toEqual([]);
    expect(store.puts).toHaveLength(1);
  });

  it("logs the counts", async () => {
    await db.insert(activityLog).values([row("2026-04-02T10:00:00Z"), row("2025-10-02T10:00:00Z")]);
    const lines: string[] = [];
    await runActivityRetention(db, memoryStore(), NOW, (l) => lines.push(l));
    expect(lines).toContain("2025-10: archived 1 rows");
    expect(lines).toContain("2025-10: deleted 1 rows");
    expect(lines).toContain("2026-04: archived 1 rows");
    expect(lines.at(-1)).toBe("done: archived 2 month(s), deleted 1 month(s), 0 already archived");
  });
});

describe("runActivityRetention: delete", () => {
  it("deletes a month older than 12 months once its archive exists", async () => {
    await db
      .insert(activityLog)
      .values([
        row("2025-10-05T00:00:00Z"),
        row("2025-10-20T00:00:00Z"),
        row("2025-11-01T00:00:00Z"),
      ]);
    const store = memoryStore();
    const res = await runActivityRetention(db, store, NOW, quiet);
    expect(res.deleted).toEqual([{ month: "2025-10", rows: 2 }]);
    // November 2025 turns 12 months old on 1 December 2026, so it stays.
    expect(await remaining()).toEqual(["2025-11"]);
    expect(store.files["activity-2025-10.json"]).toBeDefined();
  });

  it("keeps rows and fails loudly when the archive is missing", async () => {
    await db.insert(activityLog).values(row("2025-10-05T00:00:00Z"));
    const failing: ArchiveStore = {
      exists: async () => false,
      get: async () => "",
      put: async () => {
        throw new Error("upload refused");
      },
    };
    const lines: string[] = [];
    const err = await runActivityRetention(db, failing, NOW, (l) => lines.push(l)).catch((e) => e);
    expect(err).toBeInstanceOf(AggregateError);
    expect(err.errors.map((e: Error) => e.message)).toEqual([
      "archive 2025-10 failed: upload refused",
      "delete 2025-10 failed: no archive file, rows kept",
    ]);
    expect(await remaining()).toEqual(["2025-10"]);
    expect(lines.filter((l) => l.startsWith("ERROR"))).toHaveLength(2);
  });

  it("keeps rows when the database holds more than the archive", async () => {
    await db.insert(activityLog).values([row("2025-10-05T00:00:00Z"), row("2025-10-06T00:00:00Z")]);
    const store = memoryStore({
      "activity-2025-10.json": JSON.stringify({ month: "2025-10", count: 1, rows: [] }),
    });
    await expect(runActivityRetention(db, store, NOW, quiet)).rejects.toThrow(
      "1 retention step(s) failed",
    );
    expect(await remaining()).toEqual(["2025-10", "2025-10"]);
  });

  it("keeps going past one bad month and still reports the failure", async () => {
    await db.insert(activityLog).values([row("2026-02-05T00:00:00Z"), row("2026-03-05T00:00:00Z")]);
    const store = memoryStore();
    const put = store.put;
    store.put = async (k, b) => {
      if (k.includes("2026-02")) throw new Error("boom");
      return put(k, b);
    };
    await expect(runActivityRetention(db, store, NOW, quiet)).rejects.toThrow();
    expect(store.puts).toEqual(["activity-2026-03.json"]);
  });
});

describe("awsStore", () => {
  const make = (exec: (args: string[]) => Promise<{ stdout: string }>) =>
    awsStore({ bucket: "b", endpoint: "https://s3.test", prefix: "activity/" }, exec);

  it("treats a 404 as missing and anything else as an error", async () => {
    const notFound = Object.assign(new Error("failed"), {
      stderr: "An error occurred (404) when calling the HeadObject operation: Not Found",
    });
    expect(await make(async () => Promise.reject(notFound)).exists("a.json")).toBe(false);
    const denied = Object.assign(new Error("failed"), {
      stderr: "An error occurred (403) Forbidden",
    });
    await expect(make(async () => Promise.reject(denied)).exists("a.json")).rejects.toBe(denied);
    expect(await make(async () => ({ stdout: "{}" })).exists("a.json")).toBe(true);
  });

  it("puts under the prefix with server-side encryption", async () => {
    const calls: string[][] = [];
    await make(async (a) => (calls.push(a), { stdout: "" })).put("a.json", "{}");
    expect(calls[0]).toContain("activity/a.json");
    expect(calls[0]!.join(" ")).toContain("--server-side-encryption AES256");
  });

  it("can skip encryption for a bucket that rejects it", async () => {
    const calls: string[][] = [];
    const store = awsStore(
      { bucket: "b", endpoint: "https://s3.test", prefix: "activity", encryption: "none" },
      async (a) => (calls.push(a), { stdout: "" }),
    );
    await store.put("a.json", "{}");
    expect(calls[0]!.join(" ")).not.toContain("server-side-encryption");
  });
});
