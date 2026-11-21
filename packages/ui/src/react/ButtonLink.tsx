import type { AnchorHTMLAttributes } from "react";
import type { ButtonSize, ButtonVariant } from "./Button";

export interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/** A link that looks like a Button, for navigation such as mailto: or downloads.
    Import "@kcom/ui/button.css". */
export function ButtonLink({
  variant = "primary",
  size = "sm",
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  const classes = ["kc-btn", `kc-btn--${variant}`, size !== "sm" && `kc-btn--${size}`, className]
    .filter(Boolean)
    .join(" ");
  return (
    <a {...rest} className={classes}>
      <span className="kc-btn__label">{children}</span>
    </a>
  );
}
