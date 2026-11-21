import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Badge, Banner, Button, DataTable, SelectField, TextField } from "@kcom/ui";
import type { DataTableColumn, DataTableSort } from "@kcom/ui";
import { can } from "@kcom/permissions";
import { useAuth } from "../auth/AuthProvider";
import { listPosts, postEditPath, type PostRecord, type PostStatus } from "./api";

const PAGE_SIZE = 10;
const STATUSES: PostStatus[] = ["draft", "scheduled", "published"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "6 Dec 2026" from a YYYY-MM-DD date. */
export const formatPostDate = (date: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));

/** Searchable, filterable list of every blog post. */
export function BlogPage() {
  const { user } = useAuth();
  const canWrite = !!user && can(user.role, "content:write");
  const navigate = useNavigate();
  const [posts, setPosts] = useState<PostRecord[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<DataTableSort | null>({ key: "date", direction: "descending" });

  const load = useCallback(async () => {
    try {
      setPosts(await listPosts());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const key = (sort?.key ?? "date") as "title" | "status" | "date";
    const factor = sort?.direction === "ascending" ? 1 : -1;
    // Status sorts in workflow order, not alphabetically.
    const value = (r: PostRecord) =>
      key === "status" ? String(STATUSES.indexOf(r.status)) : r[key];
    return (posts ?? [])
      .filter(
        (p) =>
          (!needle || p.title.toLowerCase().includes(needle)) && (!status || p.status === status),
      )
      .sort((a, b) => value(a).localeCompare(value(b)) * factor);
  }, [posts, q, status, sort]);

  const columns: DataTableColumn<PostRecord>[] = [
    { key: "title", header: "Title", sortable: true },
    {
      key: "status",
      header: "Status",
      sortable: true,
      width: "8rem",
      render: (p) => <Badge variant={p.status}>{cap(p.status)}</Badge>,
    },
    {
      key: "date",
      header: "Date",
      sortable: true,
      width: "9rem",
      render: (p) => formatPostDate(p.date),
    },
  ];

  return (
    <section className="kc-blog">
      <header className="kc-blog__head">
        <h1>Blog</h1>
        {canWrite && <Button onClick={() => navigate("/blog/new")}>New post</Button>}
      </header>
      <form className="kc-blog__filters" role="search" onSubmit={(e) => e.preventDefault()}>
        <TextField
          size="sm"
          label="Search"
          type="search"
          placeholder="Title"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <SelectField
          size="sm"
          label="Status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {cap(s)}
            </option>
          ))}
        </SelectField>
      </form>
      {failed ? (
        <Banner
          variant="danger"
          action={
            <Button variant="tertiary" onClick={() => void load()}>
              Try again
            </Button>
          }
        >
          Could not load posts.
        </Banner>
      ) : posts === null ? (
        <p className="kc-admin-loading">Loading posts…</p>
      ) : (
        <DataTable
          caption="Blog posts"
          columns={columns}
          rows={rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)}
          getRowId={(p) => p.id}
          sort={sort}
          onSortChange={(s) => {
            setSort(s);
            setPage(1);
          }}
          pagination={{ page, pageSize: PAGE_SIZE, total: rows.length, onPageChange: setPage }}
          onRowClick={(p) => navigate(postEditPath(p.id))}
          emptyTitle={posts.length === 0 ? "No posts yet" : "No posts match"}
          emptyMessage={
            posts.length === 0
              ? "Create a post to see it here."
              : "Try a different search or filter."
          }
        />
      )}
    </section>
  );
}
