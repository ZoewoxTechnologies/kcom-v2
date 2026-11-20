import type { HTMLAttributes } from "react";

export type BadgeVariant =
  "draft" | "scheduled" | "published" | "missing" | "confirmed" | "pending" | "unsubscribed";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant: BadgeVariant;
}

/** Status badge; `variant` is the status. Each status has its own marker shape as well as colour.
    Import "@kcom/ui/badge.css". */
export function Badge({ variant, className, children, ...rest }: BadgeProps) {
  const classes = ["kc-badge", `kc-badge--${variant}`, className].filter(Boolean).join(" ");
  return (
    <span {...rest} className={classes}>
      {children}
    </span>
  );
}
