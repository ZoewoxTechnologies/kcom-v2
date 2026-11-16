import { Button } from "./Button";
import type { KeyboardEvent, ReactNode, ThHTMLAttributes } from "react";

export type SortDirection = "ascending" | "descending" | "none";

export interface SortableThProps extends Omit<ThHTMLAttributes<HTMLTableCellElement>, "onClick"> {
  direction?: SortDirection;
  onSort: () => void;
  children: ReactNode;
}

/** Column header with a sort button; sets aria-sort. Parent owns the sort state. */
export function SortableTh({ direction = "none", onSort, children, ...rest }: SortableThProps) {
  return (
    <th {...rest} scope="col" aria-sort={direction}>
      <button type="button" className="kc-table__sort" onClick={onSort}>
        {children}
      </button>
    </th>
  );
}

/** Scroll container for a <table className="kc-table">. Put TablePagination inside it as a footer. */
export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="kc-table-wrap">{children}</div>;
}

/** Full-width row shown when a list has no rows. */
export function TableEmpty({
  colSpan,
  title,
  children,
}: {
  colSpan: number;
  title: string;
  children?: ReactNode;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="kc-table__empty">
        <strong>{title}</strong>
        {children}
      </td>
    </tr>
  );
}

/** Page numbers to show: first, last, and a window around the current page. */
export function pageItems(page: number, pageCount: number): (number | "gap")[] {
  const keep = new Set([1, pageCount, page - 1, page, page + 1]);
  const pages = [...keep].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const items: (number | "gap")[] = [];
  pages.forEach((p, i) => {
    if (i > 0 && p - pages[i - 1]! > 1) items.push("gap");
    items.push(p);
  });
  return items;
}

export interface TablePaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

/** "Showing 1–25 of 1,312" with previous/next and page buttons. Pages are 1-based. */
export function TablePagination({ page, pageSize, total, onPageChange }: TablePaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const fmt = (n: number) => n.toLocaleString("en-US");
  return (
    <div className="kc-table__foot">
      <span>
        Showing {fmt(from)}–{fmt(to)} of {fmt(total)}
      </span>
      <nav className="kc-pager" aria-label="Pages">
        <Button
          variant="secondary"
          size="sm"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          ‹
        </Button>
        {pageItems(page, pageCount).map((item, i) =>
          item === "gap" ? (
            <span key={`gap-${i}`} className="kc-pager__gap" aria-hidden="true">
              …
            </span>
          ) : (
            <Button
              key={item}
              variant={item === page ? "primary" : "secondary"}
              size="sm"
              aria-current={item === page ? "page" : undefined}
              aria-label={`Page ${item}`}
              onClick={() => onPageChange(item)}
            >
              {fmt(item)}
            </Button>
          ),
        )}
        <Button
          variant="secondary"
          size="sm"
          aria-label="Next page"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          ›
        </Button>
      </nav>
    </div>
  );
}

export interface DataTableSort {
  key: string;
  direction: "ascending" | "descending";
}

export interface DataTableColumn<T> {
  /** Stable id; also the sort key reported to onSortChange. */
  key: string;
  header: ReactNode;
  /** Reads the cell value when no render function is given. */
  accessor?: (row: T) => ReactNode;
  /** Custom cell content; wins over accessor and the row[key] fallback. */
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  align?: "start" | "end";
  width?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string | number;
  /** Accessible name for the table. */
  caption: string;
  sort?: DataTableSort | null;
  onSortChange?: (sort: DataTableSort | null) => void;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
  };
  emptyTitle?: string;
  emptyMessage?: ReactNode;
  /** Makes rows clickable (and keyboard-activatable). */
  onRowClick?: (row: T) => void;
  selectedRowId?: string | number | null;
  /** Extra trailing column, e.g. an edit button. */
  rowAction?: (row: T) => ReactNode;
  rowActionHeader?: string;
}

/** Generic admin list table: controlled sort and pagination, empty state, optional row click/action. */
export function DataTable<T>({
  columns,
  rows,
  getRowId,
  caption,
  sort = null,
  onSortChange,
  pagination,
  emptyTitle = "Nothing to show",
  emptyMessage,
  onRowClick,
  selectedRowId = null,
  rowAction,
  rowActionHeader = "Actions",
}: DataTableProps<T>) {
  const colCount = columns.length + (rowAction ? 1 : 0);
  const next = (key: string): DataTableSort | null => {
    if (sort?.key !== key) return { key, direction: "ascending" };
    return sort.direction === "ascending" ? { key, direction: "descending" } : null;
  };
  const cell = (col: DataTableColumn<T>, row: T): ReactNode =>
    col.render
      ? col.render(row)
      : col.accessor
        ? col.accessor(row)
        : (row as Record<string, ReactNode>)[col.key];
  const alignClass = (col: DataTableColumn<T>) =>
    col.align === "end" ? "kc-table__num" : undefined;
  const onKey = (event: KeyboardEvent<HTMLTableRowElement>, row: T) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onRowClick?.(row);
    }
  };

  return (
    <TableWrap>
      <table className="kc-table">
        <caption className="kc-table__caption">{caption}</caption>
        <thead>
          <tr>
            {columns.map((col) =>
              col.sortable && onSortChange ? (
                <SortableTh
                  key={col.key}
                  className={alignClass(col)}
                  style={col.width ? { inlineSize: col.width } : undefined}
                  direction={sort?.key === col.key ? sort.direction : "none"}
                  onSort={() => onSortChange(next(col.key))}
                >
                  {col.header}
                </SortableTh>
              ) : (
                <th
                  key={col.key}
                  scope="col"
                  className={alignClass(col)}
                  style={col.width ? { inlineSize: col.width } : undefined}
                >
                  {col.header}
                </th>
              ),
            )}
            {rowAction && (
              <th scope="col">
                <span className="kc-table__sr">{rowActionHeader}</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <TableEmpty colSpan={colCount} title={emptyTitle}>
              {emptyMessage}
            </TableEmpty>
          ) : (
            rows.map((row) => {
              const id = getRowId(row);
              const selected = selectedRowId === id;
              return (
                <tr
                  key={id}
                  data-selected={selected ? "true" : undefined}
                  className={onRowClick ? "kc-table__row--click" : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={onRowClick ? (e) => onKey(e, row) : undefined}
                >
                  {columns.map((col, i) => (
                    <td key={col.key} className={alignClass(col)}>
                      {selected && i === 0 && <span className="kc-table__sr">Selected: </span>}
                      {cell(col, row)}
                    </td>
                  ))}
                  {rowAction && <td onClick={(e) => e.stopPropagation()}>{rowAction(row)}</td>}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      {pagination && <TablePagination {...pagination} />}
    </TableWrap>
  );
}
