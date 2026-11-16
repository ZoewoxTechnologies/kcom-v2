import { useMemo, useState } from "react";
import { SortableTh, TableEmpty, TablePagination, TableWrap } from "@kcom/ui";
import type { SortDirection } from "@kcom/ui";

type Row = { id: number; name: string; email: string; joined: string; status: string };
type Key = "name" | "email" | "joined" | "status";

const STATUSES = ["Active", "Active", "Pending", "Unsubscribed"];
const ROWS: Row[] = Array.from({ length: 1312 }, (_, i) => {
  const day = (i % 28) + 1;
  return {
    id: i,
    name: `Subscriber ${String(i + 1).padStart(4, "0")}`,
    email: `subscriber${i + 1}@example.com`,
    joined: `2026-11-${String(day).padStart(2, "0")}`,
    status: STATUSES[i % STATUSES.length]!,
  };
});
const PAGE_SIZE = 6;

export function DataTableDemo() {
  const [sort, setSort] = useState<{ key: Key; dir: "ascending" | "descending" }>({
    key: "name",
    dir: "ascending",
  });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number | null>(1);

  const sorted = useMemo(() => {
    const factor = sort.dir === "ascending" ? 1 : -1;
    return [...ROWS].sort((a, b) => a[sort.key].localeCompare(b[sort.key]) * factor);
  }, [sort]);
  const rows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const dirFor = (key: Key): SortDirection => (sort.key === key ? sort.dir : "none");
  const toggle = (key: Key) => {
    setSort((s) => ({
      key,
      dir: s.key === key && s.dir === "ascending" ? "descending" : "ascending",
    }));
    setPage(1);
  };

  return (
    <section
      aria-labelledby="data-table-demo"
      style={{
        marginBlockStart: "2rem",
        padding: "1rem",
        background: "var(--color-page)",
        color: "var(--color-text)",
      }}
    >
      <h2 id="data-table-demo">Data table</h2>
      <TableWrap>
        <table className="kc-table">
          <thead>
            <tr>
              <SortableTh direction={dirFor("name")} onSort={() => toggle("name")}>
                Name
              </SortableTh>
              <SortableTh direction={dirFor("email")} onSort={() => toggle("email")}>
                Email
              </SortableTh>
              <SortableTh direction={dirFor("joined")} onSort={() => toggle("joined")}>
                Joined
              </SortableTh>
              <SortableTh direction={dirFor("status")} onSort={() => toggle("status")}>
                Status
              </SortableTh>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} aria-selected={selected === r.id} onClick={() => setSelected(r.id)}>
                <td>{r.name}</td>
                <td>{r.email}</td>
                <td>{r.joined}</td>
                <td>{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <TablePagination
          page={page}
          pageSize={PAGE_SIZE}
          total={ROWS.length}
          onPageChange={setPage}
        />
      </TableWrap>

      <h3>Empty</h3>
      <TableWrap>
        <table className="kc-table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Email</th>
            </tr>
          </thead>
          <tbody>
            <TableEmpty colSpan={2} title="No subscribers match">
              Try a different search or filter.
            </TableEmpty>
          </tbody>
        </table>
      </TableWrap>
    </section>
  );
}
