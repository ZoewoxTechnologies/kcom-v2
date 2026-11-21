import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Banner, Button, DataTable, SegmentedControl, TextField, useToast } from "@kcom/ui";
import type { DataTableColumn, DataTableSort } from "@kcom/ui";
import { can } from "@kcom/permissions";
import { useAuth } from "../auth/AuthProvider";
import {
  exportSubscribers,
  listSubscribers,
  PAGE_SIZE,
  type SubscriberPage,
  type SubscriberRecord,
  type SubscriberSortKey,
  type SubscriberStatus,
} from "./api";

const SEARCH_DELAY_MS = 300;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fmt = (n: number) => n.toLocaleString("en");

/** "14 Nov 2026" */
export const formatJoined = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));

type StatusFilter = SubscriberStatus | "all";
const STATUSES: SubscriberStatus[] = ["confirmed", "pending", "unsubscribed"];

/** Searchable, filterable subscriber list. Admins can export the current view as CSV. */
export function SubscribersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canExport = !!user && can(user.role, "subscribers:export");
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<DataTableSort | null>({
    key: "joined",
    direction: "descending",
  });
  const [data, setData] = useState<SubscriberPage | null>(null);
  const [failed, setFailed] = useState(false);
  const [exporting, setExporting] = useState(false);
  const latest = useRef<AbortController | null>(null);

  // Typing searches after a short pause; there is no submit button.
  useEffect(() => {
    if (input === q) return;
    const t = setTimeout(() => {
      setQ(input);
      setPage(1);
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(t);
  }, [input, q]);

  const filters = { q, status: status === "all" ? ("" as const) : status };
  const load = useCallback(async () => {
    latest.current?.abort();
    const controller = new AbortController();
    latest.current = controller;
    try {
      const next = await listSubscribers(
        { q, status: status === "all" ? "" : status },
        page,
        {
          key: (sort?.key ?? "joined") as SubscriberSortKey,
          direction: (sort?.direction ?? "descending") === "ascending" ? "asc" : "desc",
        },
        controller.signal,
      );
      setData(next);
      setFailed(false);
    } catch {
      if (!controller.signal.aborted) setFailed(true);
    }
  }, [q, status, page, sort]);
  useEffect(() => {
    void load();
    return () => latest.current?.abort();
  }, [load]);

  const onExport = async () => {
    setExporting(true);
    try {
      await exportSubscribers(filters);
    } catch {
      toast({ variant: "error", title: "Couldn’t export subscribers", description: "Try again." });
    } finally {
      setExporting(false);
    }
  };

  const counts = data?.counts;
  const all = counts ? counts.confirmed + counts.pending + counts.unsubscribed : null;
  const label = (name: string, n: number | null | undefined) =>
    n == null ? name : `${name} ${fmt(n)}`;
  const options = [
    { value: "all", label: label("All", all) },
    ...STATUSES.map((s) => ({ value: s, label: label(cap(s), counts?.[s]) })),
  ] as const;

  const columns: DataTableColumn<SubscriberRecord>[] = [
    { key: "name", header: "Name", sortable: true, render: (s) => s.name ?? "—" },
    { key: "email", header: "Email", sortable: true },
    {
      key: "joined",
      header: "Joined",
      sortable: true,
      width: "9rem",
      render: (s) => formatJoined(s.subscribedAt),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      width: "9rem",
      render: (s) => <Badge variant={s.status}>{cap(s.status)}</Badge>,
    },
  ];

  const filtered = q.trim() !== "" || status !== "all";
  return (
    <section className="kc-subscribers">
      <header className="kc-subscribers__head">
        <h1>Subscribers</h1>
        {canExport && (
          <Button variant="secondary" loading={exporting} onClick={() => void onExport()}>
            Export CSV
          </Button>
        )}
      </header>
      <div className="kc-subscribers__filters" role="search">
        <TextField
          size="sm"
          label="Search"
          type="search"
          placeholder="Search name or email"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <SegmentedControl
          label="Status"
          options={options}
          value={status}
          onChange={(v: StatusFilter) => {
            setStatus(v);
            setPage(1);
          }}
        />
      </div>
      {failed ? (
        <Banner
          variant="danger"
          action={
            <Button variant="tertiary" onClick={() => void load()}>
              Try again
            </Button>
          }
        >
          Could not load subscribers.
        </Banner>
      ) : data === null ? (
        <p className="kc-admin-loading">Loading subscribers…</p>
      ) : (
        <DataTable
          caption="Subscribers"
          columns={columns}
          rows={data.items}
          getRowId={(s) => s.id}
          sort={sort}
          onSortChange={(s) => {
            setSort(s);
            setPage(1);
          }}
          pagination={{ page, pageSize: PAGE_SIZE, total: data.total, onPageChange: setPage }}
          emptyTitle={filtered ? "No subscribers match" : "No subscribers yet"}
          emptyMessage={
            filtered
              ? "Try a different search or status."
              : "People who sign up on the site appear here."
          }
        />
      )}
    </section>
  );
}
