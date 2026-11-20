import { pageWindow } from "../lib/pagination";

export interface PaginationProps {
  /** Current page, 1-based. */
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  /** Accessible name of the nav landmark. */
  label?: string;
}

const fmt = (n: number) => n.toLocaleString("en-US");

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d={dir === "left" ? "M10 3 5 8l5 5" : "M6 3l5 5-5 5"} />
    </svg>
  );
}

/** Borderless page list: numbers, filled current page, chevron prev/next, ellipsis for long ranges. */
export function Pagination({ page, pageCount, onPageChange, label = "Pages" }: PaginationProps) {
  return (
    <nav className="kc-pagination" aria-label={label}>
      <button
        type="button"
        className="kc-pagination__item"
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <Chevron dir="left" />
      </button>
      {pageWindow(page, pageCount).map((n, i) =>
        n === null ? (
          <span key={`gap-${i}`} className="kc-pagination__gap" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={n}
            type="button"
            className="kc-pagination__item"
            aria-current={n === page ? "page" : undefined}
            aria-label={`Page ${n}`}
            onClick={() => onPageChange(n)}
          >
            {fmt(n)}
          </button>
        ),
      )}
      <button
        type="button"
        className="kc-pagination__item"
        aria-label="Next page"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        <Chevron dir="right" />
      </button>
    </nav>
  );
}
