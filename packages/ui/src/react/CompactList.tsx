import type { ReactNode } from "react";

export interface CompactListProps<T> {
  rows: T[];
  getRowId: (row: T) => string | number;
  /** First line, left: usually a name or title. */
  title: (row: T) => ReactNode;
  /** First line, right: usually a status badge. */
  trailing?: (row: T) => ReactNode;
  /** Second line. */
  subtitle?: (row: T) => ReactNode;
  /** Accessible name of the list. */
  caption: string;
  onRowClick?: (row: T) => void;
  selectedRowId?: string | number | null;
  /** Marks rows that need attention, such as unread ones, in bold. */
  isEmphasised?: (row: T) => boolean;
  emptyTitle?: string;
  emptyMessage?: ReactNode;
}

/** Two-line list items for phone width, where a table is too wide. No column headers.
    Import "@kcom/ui/compact-list.css". */
export function CompactList<T>({
  rows,
  getRowId,
  title,
  trailing,
  subtitle,
  caption,
  onRowClick,
  selectedRowId,
  isEmphasised,
  emptyTitle = "Nothing here",
  emptyMessage,
}: CompactListProps<T>) {
  if (rows.length === 0) {
    return (
      <div className="kc-compact-list__empty">
        <strong>{emptyTitle}</strong>
        {emptyMessage && <p>{emptyMessage}</p>}
      </div>
    );
  }
  return (
    <ul className="kc-compact-list" aria-label={caption}>
      {rows.map((row) => {
        const id = getRowId(row);
        const classes = [
          "kc-compact-list__item",
          isEmphasised?.(row) && "kc-compact-list__item--emphasised",
        ]
          .filter(Boolean)
          .join(" ");
        const body = (
          <>
            <span className="kc-compact-list__line">
              <span className="kc-compact-list__title">{title(row)}</span>
              {trailing?.(row)}
            </span>
            {subtitle && <span className="kc-compact-list__sub">{subtitle(row)}</span>}
          </>
        );
        return (
          <li key={id}>
            {onRowClick ? (
              <button
                type="button"
                className={classes}
                aria-current={selectedRowId === id ? "true" : undefined}
                onClick={() => onRowClick(row)}
              >
                {body}
              </button>
            ) : (
              <div className={classes}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
