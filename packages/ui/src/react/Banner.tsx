import type { HTMLAttributes, ReactNode } from "react";

export type BannerVariant = "warning" | "info" | "success" | "danger";

export interface BannerProps extends Omit<HTMLAttributes<HTMLDivElement>, "role"> {
  variant?: BannerVariant;
  /** Link-style actions: pass tertiary buttons or links, never filled ones. */
  action?: ReactNode;
}

const NAMES: Record<BannerVariant, string> = {
  warning: "Warning",
  info: "Information",
  success: "Success",
  danger: "Error",
};

const GLYPHS: Record<BannerVariant, ReactNode> = {
  success: <path d="M5.5 10.5l3 3 6-6.5" />,
  info: (
    <>
      <circle cx="10" cy="10" r="8" />
      <path d="M10 9v5" />
      <path d="M10 6.2v.1" />
    </>
  ),
  warning: (
    <>
      <path d="M10 2.5l8 14H2z" />
      <path d="M10 8v4" />
      <path d="M10 14.4v.1" />
    </>
  ),
  danger: (
    <>
      <circle cx="10" cy="10" r="8" />
      <path d="M10 6v5" />
      <path d="M10 13.8v.1" />
    </>
  ),
};

/** Inline message with a variant icon. Danger is announced as an alert; the others as status.
    Import "@kcom/ui/banner.css" and "@kcom/ui/a11y.css". */
export function Banner({ variant = "warning", action, className, children, ...rest }: BannerProps) {
  const classes = ["kc-banner", `kc-banner--${variant}`, className].filter(Boolean).join(" ");
  return (
    <div {...rest} className={classes} role={variant === "danger" ? "alert" : "status"}>
      <span className="kc-banner__icon">
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {GLYPHS[variant]}
        </svg>
        <span className="kc-visually-hidden">{NAMES[variant]}: </span>
      </span>
      <div className="kc-banner__text">{children}</div>
      {action && <div className="kc-banner__actions">{action}</div>}
    </div>
  );
}
