import type { HTMLAttributes } from "react";

export interface CountBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  count: number;
  /** Spoken in place of the bare number, such as "unread messages". */
  label: string;
  /** Largest number shown before "99+"-style capping. */
  max?: number;
}

/** Small pill with a count, for nav items and tabs. Renders nothing at zero.
    Import "@kcom/ui/badge.css". */
export function CountBadge({ count, label, max = 99, className, ...rest }: CountBadgeProps) {
  if (count <= 0) return null;
  const classes = ["kc-count", className].filter(Boolean).join(" ");
  return (
    <span {...rest} className={classes}>
      <span aria-hidden="true">{count > max ? `${max}+` : count}</span>
      <span className="kc-visually-hidden">{`${count} ${label}`}</span>
    </span>
  );
}
