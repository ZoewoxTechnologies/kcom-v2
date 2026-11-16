import type { ReactNode, ThHTMLAttributes } from "react";

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
        <button
          type="button"
          className="kc-pager__btn"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          ‹
        </button>
        {pageItems(page, pageCount).map((item, i) =>
          item === "gap" ? (
            <span key={`gap-${i}`} className="kc-pager__gap" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              className="kc-pager__btn"
              aria-current={item === page ? "page" : undefined}
              aria-label={`Page ${item}`}
              onClick={() => onPageChange(item)}
            >
              {fmt(item)}
            </button>
          ),
        )}
        <button
          type="button"
          className="kc-pager__btn"
          aria-label="Next page"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          ›
        </button>
      </nav>
    </div>
  );
}
