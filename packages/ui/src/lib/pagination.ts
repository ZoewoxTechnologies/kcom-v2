/** A 1-based page request (garbage counts as page 1) clamped into range. */
export function paginate<T>(items: readonly T[], rawPage: string | null | undefined, size: number) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const asked = Number.parseInt(rawPage ?? "1", 10);
  const page = Number.isFinite(asked) ? Math.min(Math.max(asked, 1), pages) : 1;
  return { page, pages, items: items.slice((page - 1) * size, page * size) };
}

/** Page numbers to show with gaps as null: 1 … 4 5 6 … 21. */
export function pageWindow(page: number, pages: number): (number | null)[] {
  const keep = new Set([1, pages, page - 1, page, page + 1]);
  const out: (number | null)[] = [];
  let prev = 0;
  for (const n of [...keep].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b)) {
    if (n - prev > 1) out.push(null);
    out.push(n);
    prev = n;
  }
  return out;
}
