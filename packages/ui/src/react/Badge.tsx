import type { HTMLAttributes } from "react";

export type BadgeStatus =
  | "draft"
  | "scheduled"
  | "published"
  | "confirmed"
  | "pending"
  | "unsubscribed";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  status: BadgeStatus;
}

/** Status badge. Each status has its own marker shape as well as colour.
    Import "@kcom/ui/badge.css". */
export function Badge({ status, className, children, ...rest }: BadgeProps) {
  const classes = ["kc-badge", `kc-badge--${status}`, className].filter(Boolean).join(" ");
  return (
    <span {...rest} className={classes}>
      {children}
    </span>
  );
}
