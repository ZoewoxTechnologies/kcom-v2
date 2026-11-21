import type { ButtonHTMLAttributes } from "react";

export interface SwitchProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "role" | "aria-checked"> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name, e.g. "Show From the blog". */
  label: string;
}

/** On/off switch with a 44px hit area. Import "@kcom/ui/switch.css" once per app. */
export function Switch({ checked, onChange, label, className, ...rest }: SwitchProps) {
  return (
    <button
      {...rest}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={["kc-switch", className].filter(Boolean).join(" ")}
      onClick={() => onChange(!checked)}
    >
      <span className="kc-switch__track" aria-hidden="true">
        <span className="kc-switch__thumb" />
      </span>
    </button>
  );
}
