import { cloneElement, useCallback, useEffect, useId, useState } from "react";
import type { ReactElement } from "react";

export interface TooltipProps {
  /** Short text shown on hover or keyboard focus. */
  label: string;
  /** One focusable element; it gets `aria-describedby` while the tooltip is open. */
  children: ReactElement<{ "aria-describedby"?: string; "aria-label"?: string }>;
}

/** Small hint for icon-only controls. Import "@kcom/ui/tooltip.css" once per app. */
export function Tooltip({ label, children }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  // Don't announce the same words twice when the tooltip repeats the control's own name.
  const sameAsName = children.props["aria-label"] === label;
  const hide = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && hide();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, hide]);

  return (
    <span
      className="kc-tooltip"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={hide}
      onFocus={() => setOpen(true)}
      onBlur={hide}
    >
      {cloneElement(children, open && !sameAsName ? { "aria-describedby": id } : {})}
      {open && (
        <span role="tooltip" id={id} className="kc-tooltip__bubble">
          {label}
        </span>
      )}
    </span>
  );
}
