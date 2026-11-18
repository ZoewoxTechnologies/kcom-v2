import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const full = fileURLToPath(new URL("../migrations", import.meta.url));

describe("migrator", () => {
  it("applies homepage sections on top of a database already at 0004", async () => {
    const dir = mkdtempSync(join(tmpdir(), "kcom-migrations-"));
    try {
      // A copy of the folder as it was before the homepage sections migration.
      cpSync(full, dir, { recursive: true });
      const journalPath = join(dir, "meta", "_journal.json");
      const journal = JSON.parse(readFileSync(journalPath, "utf8")) as {
        entries: { tag: string }[];
      };
      const target = journal.entries.findIndex((e) => e.tag === "0005_homepage_sections");
      expect(target).toBeGreaterThan(0);
      writeFileSync(
        journalPath,
        JSON.stringify({ ...journal, entries: journal.entries.slice(0, target) }),
      );

      const pg = new PGlite();
      const db = drizzle(pg);
      await migrate(db, { migrationsFolder: dir });
      const before = await pg.query("select to_regclass('public.homepage_sections') as t");
      expect(before.rows[0]).toEqual({ t: null });

      await migrate(db, { migrationsFolder: full });
      const after = await pg.query("select key from homepage_sections order by position");
      expect(after.rows.map((r) => (r as { key: string }).key)).toEqual([
        "todays_capsule",
        "current_series",
        "past_series",
        "blog",
        "events_books",
        "email_signup",
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
