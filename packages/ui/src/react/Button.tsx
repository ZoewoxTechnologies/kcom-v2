import type { ButtonHTMLAttributes, MouseEvent } from "react";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "give";

export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

/** Brand button. Import "@kcom/ui/tokens.css" and "@kcom/ui/button.css" once per app. */
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  onClick,
  type = "button",
  ...rest
}: ButtonProps) {
  const classes = ["kc-btn", `kc-btn--${variant}`, size !== "md" && `kc-btn--${size}`, className]
    .filter(Boolean)
    .join(" ");
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (loading) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };
  return (
    <button
      {...rest}
      type={type}
      className={classes}
      aria-busy={loading || undefined}
      onClick={handleClick}
    >
      {loading && <span className="kc-btn__spinner" aria-hidden="true" />}
      <span className="kc-btn__label">{children}</span>
    </button>
  );
}
