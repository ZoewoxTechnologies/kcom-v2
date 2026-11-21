import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Badge, Banner, Button, DataTable, TextField, SelectField } from "@kcom/ui";
import type { DataTableColumn, DataTableSort } from "@kcom/ui";
import { capsuleEditPath, useCapsules } from "./api";
import type { CapsuleStatus, CapsuleSummary } from "./api";
import { lagosDay } from "./days";

const PAGE_SIZE = 10;
const STATUSES: CapsuleStatus[] = ["draft", "scheduled", "published"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type Row = CapsuleSummary & { day: string; seriesTitle: string };

/** Searchable, filterable list of every capsule. Dates are Africa/Lagos days. */
export function CapsulesPage() {
  const { capsules, series, state, reload } = useCapsules();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [seriesId, setSeriesId] = useState("");
  const [date, setDate] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<DataTableSort | null>({ key: "day", direction: "descending" });

  const rows = useMemo(() => {
    const titles = new Map(series.map((s) => [s.id, s.title]));
    const needle = q.trim().toLowerCase();
    const out: Row[] = capsules
      .map((c) => ({
        ...c,
        day: lagosDay(c.publishAt),
        seriesTitle: c.seriesId ? (titles.get(c.seriesId) ?? "") : "",
      }))
      .filter(
        (c) =>
          (!needle || c.title.toLowerCase().includes(needle)) &&
          (!status || c.status === status) &&
          (!seriesId || c.seriesId === seriesId) &&
          (!date || c.day === date),
      );
    const key = (sort?.key ?? "day") as "title" | "status" | "day" | "seriesTitle";
    const factor = sort?.direction === "ascending" ? 1 : -1;
    // Status sorts in workflow order (draft, scheduled, published), not alphabetically.
    const value = (r: Row) => (key === "status" ? String(STATUSES.indexOf(r.status)) : r[key]);
    return out.sort((a, b) => value(a).localeCompare(value(b)) * factor);
  }, [capsules, series, q, status, seriesId, date, sort]);

  const filter =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
    };

  const columns: DataTableColumn<Row>[] = [
    { key: "title", header: "Title", sortable: true },
    {
      key: "seriesTitle",
      header: "Series",
      sortable: true,
      render: (r) =>
        r.seriesTitle ? `${r.seriesTitle}${r.partNumber ? ` · Part ${r.partNumber}` : ""}` : "—",
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (r) => <Badge variant={r.status}>{cap(r.status)}</Badge>,
    },
    { key: "day", header: "Date (Lagos)", sortable: true },
  ];

  return (
    <section className="kc-capsules">
      <header className="kc-capsules__head">
        <h1>Capsules</h1>
        <Link to="/calendar">View calendar</Link>
      </header>
      <form className="kc-capsules__filters" role="search" onSubmit={(e) => e.preventDefault()}>
        <TextField
          size="sm"
          label="Search"
          type="search"
          placeholder="Title"
          value={q}
          onChange={(e) => filter(setQ)(e.target.value)}
        />
        <SelectField
          size="sm"
          label="Status"
          value={status}
          onChange={(e) => filter(setStatus)(e.target.value)}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {cap(s)}
            </option>
          ))}
        </SelectField>
        <SelectField
          size="sm"
          label="Series"
          value={seriesId}
          onChange={(e) => filter(setSeriesId)(e.target.value)}
        >
          <option value="">All series</option>
          {series.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </SelectField>
        <TextField
          size="sm"
          label="Date (Lagos)"
          type="date"
          value={date}
          onChange={(e) => filter(setDate)(e.target.value)}
        />
      </form>
      {state === "error" ? (
        <Banner
          variant="danger"
          action={
            <Button variant="tertiary" onClick={reload}>
              Try again
            </Button>
          }
        >
          Could not load capsules.
        </Banner>
      ) : state === "loading" ? (
        <p className="kc-admin-loading">Loading capsules…</p>
      ) : (
        <DataTable
          caption="Capsules"
          columns={columns}
          rows={rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)}
          getRowId={(r) => r.id}
          sort={sort}
          onSortChange={(s) => {
            setSort(s);
            setPage(1);
          }}
          pagination={{ page, pageSize: PAGE_SIZE, total: rows.length, onPageChange: setPage }}
          onRowClick={(r) => navigate(capsuleEditPath(r.id))}
          emptyTitle="No capsules match"
          emptyMessage="Try a different search or filter."
        />
      )}
    </section>
  );
}
