import { useMemo, useState } from "react";
import { Button, DataTable } from "@kcom/ui";
import type { DataTableColumn, DataTableSort } from "@kcom/ui";

type Subscriber = { id: number; name: string; email: string; joined: string; status: string };
type Key = "name" | "email" | "joined" | "status";

const STATUSES = ["Active", "Active", "Pending", "Unsubscribed"];
const ROWS: Subscriber[] = Array.from({ length: 1312 }, (_, i) => ({
  id: i,
  name: `Subscriber ${String(i + 1).padStart(4, "0")}`,
  email: `subscriber${i + 1}@example.com`,
  joined: `2026-11-${String((i % 28) + 1).padStart(2, "0")}`,
  status: STATUSES[i % STATUSES.length]!,
}));
const PAGE_SIZE = 6;

const COLUMNS: DataTableColumn<Subscriber>[] = [
  { key: "name", header: "Name", sortable: true },
  { key: "email", header: "Email", sortable: true },
  { key: "joined", header: "Joined", sortable: true },
  { key: "status", header: "Status", sortable: true },
];

export function DataTableDemo() {
  const [sort, setSort] = useState<DataTableSort | null>({ key: "name", direction: "ascending" });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number | null>(1);

  const pageRows = useMemo(() => {
    const sorted = [...ROWS];
    if (sort) {
      const factor = sort.direction === "ascending" ? 1 : -1;
      const key = sort.key as Key;
      sorted.sort((a, b) => a[key].localeCompare(b[key]) * factor);
    }
    return sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [sort, page]);

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
      <DataTable
        caption="Subscribers"
        columns={COLUMNS}
        rows={pageRows}
        getRowId={(r) => r.id}
        sort={sort}
        onSortChange={(s) => {
          setSort(s);
          setPage(1);
        }}
        pagination={{ page, pageSize: PAGE_SIZE, total: ROWS.length, onPageChange: setPage }}
        selectedRowId={selected}
        onRowClick={(r) => setSelected(r.id)}
        rowAction={(r) => (
          <Button variant="secondary" size="sm" aria-label={`Edit ${r.name}`}>
            Edit
          </Button>
        )}
      />

      <h3>Empty</h3>
      <DataTable
        caption="No results"
        columns={COLUMNS.slice(0, 2)}
        rows={[]}
        getRowId={(r: Subscriber) => r.id}
        emptyTitle="No subscribers match"
        emptyMessage="Try a different search or filter."
      />
    </section>
  );
}
