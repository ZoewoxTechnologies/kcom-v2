import type { AnchorHTMLAttributes, HTMLAttributes } from "react";

export type TagProps =
  | ({ href: string } & AnchorHTMLAttributes<HTMLAnchorElement>)
  | ({ href?: undefined } & HTMLAttributes<HTMLSpanElement>);

/** Tag or series chip; a link when `href` is given. Import "@kcom/ui/badge.css". */
export function Tag({ className, ...props }: TagProps) {
  const classes = ["kc-tag", className].filter(Boolean).join(" ");
  if (props.href !== undefined) {
    return <a {...props} className={classes} />;
  }
  return <span {...props} className={classes} />;
}
