import type { ReactNode } from "react";
import { Button, type ButtonProps } from "./Button";
import { Tooltip } from "./Tooltip";

export interface IconButtonProps extends Omit<ButtonProps, "children" | "aria-label"> {
  /** Names the button for screen readers and shows as its tooltip. */
  label: string;
  /** The icon, usually an aria-hidden svg. */
  icon: ReactNode;
}

/** Icon-only secondary action: a tertiary Button with a tooltip. */
export function IconButton({ label, icon, variant = "tertiary", ...rest }: IconButtonProps) {
  return (
    <Tooltip label={label}>
      <Button {...rest} variant={variant} aria-label={label}>
        {icon}
      </Button>
    </Tooltip>
  );
}
