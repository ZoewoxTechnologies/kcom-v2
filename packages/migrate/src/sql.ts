export type Row = Record<string, string | number | null>;
export type Tables = Map<string, Row[]>;

const ESCAPES: Record<string, string> = {
  "0": "\0",
  b: "\b",
  n: "\n",
  r: "\r",
  t: "\t",
  Z: "\x1a",
};

const INSERT = /INSERT INTO `([^`]+)` \(([^)]*)\) VALUES\s*/g;

/**
 * Parses the INSERT statements of a MySQL/MariaDB dump (phpMyAdmin or mysqldump
 * style, with column lists) into rows keyed by table name. Everything else in
 * the dump is ignored.
 */
export function parseDump(sql: string): Tables {
  const tables: Tables = new Map();
  INSERT.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = INSERT.exec(sql)) !== null) {
    const table = m[1] as string;
    const columns = (m[2] as string).split(",").map((c) => c.trim().replace(/`/g, ""));
    const rows = tables.get(table) ?? [];
    tables.set(table, rows);
    INSERT.lastIndex = readTuples(sql, INSERT.lastIndex, columns, rows);
  }
  return tables;
}

function readTuples(sql: string, start: number, columns: string[], rows: Row[]): number {
  let i = start;
  const n = sql.length;
  while (i < n) {
    const c = sql[i];
    if (c === ";") return i + 1;
    if (c !== "(") {
      i++;
      continue;
    }
    i++;
    const row: Row = {};
    let col = 0;
    while (i < n) {
      const ch = sql[i];
      let value: string | number | null;
      if (ch === "'") {
        let out = "";
        i++;
        for (;;) {
          const q = sql.indexOf("'", i);
          const b = sql.indexOf("\\", i);
          if (b !== -1 && b < q) {
            out += sql.slice(i, b);
            const next = sql[b + 1] as string;
            out += ESCAPES[next] ?? next;
            i = b + 2;
          } else if (sql[q + 1] === "'") {
            out += sql.slice(i, q + 1);
            i = q + 2;
          } else {
            out += sql.slice(i, q);
            i = q + 1;
            break;
          }
        }
        value = out;
      } else {
        let j = i;
        while (sql[j] !== "," && sql[j] !== ")") j++;
        const raw = sql.slice(i, j).trim();
        value = raw.toUpperCase() === "NULL" ? null : Number(raw);
        i = j;
      }
      row[columns[col++] as string] = value;
      if (sql[i] === ",") {
        i++;
        while (sql[i] === " ") i++;
        continue;
      }
      i++; // closing paren
      break;
    }
    rows.push(row);
  }
  return i;
}
