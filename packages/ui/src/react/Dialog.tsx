import * as RadixDialog from "@radix-ui/react-dialog";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

export type DialogVariant = "modal" | "panel";
export type DialogSize = "sm" | "md" | "lg";

export interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** Centered modal or a panel docked to the inline end. */
  variant?: DialogVariant;
  /** Width of a modal; panels have a fixed width. */
  size?: DialogSize;
  /**
   * When false, Esc and clicks outside never close the dialog; only controls
   * inside do. Use it for editors that guard closing behind a confirmation.
   */
  dismissible?: boolean;
  /**
   * Shows a × button in the corner that calls this instead of closing the
   * dialog itself, so callers can confirm first. Omit for no × button.
   */
  onClose?: () => void;
  /** Element that opens the dialog; focus returns to it on close. */
  trigger?: ReactNode;
  className?: string;
  children?: ReactNode;
}

/** Modal dialog on Radix. Import "@kcom/ui/tokens.css" and "@kcom/ui/dialog.css" once per app. */
export function Dialog({
  trigger,
  title,
  description,
  variant = "modal",
  size = "sm",
  dismissible = true,
  onClose,
  className,
  children,
  ...root
}: DialogProps) {
  const classes = [
    "kc-dialog",
    `kc-dialog--${variant}`,
    `kc-dialog--${size}`,
    onClose && "kc-dialog--closable",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const lock = !dismissible
    ? {
        onEscapeKeyDown: (event: Event) => event.preventDefault(),
        onPointerDownOutside: (event: Event) => event.preventDefault(),
        onInteractOutside: (event: Event) => event.preventDefault(),
      }
    : {};
  return (
    <RadixDialog.Root {...root}>
      {trigger && <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger>}
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="kc-dialog-overlay" />
        <RadixDialog.Content
          className={classes}
          {...lock}
          aria-describedby={description ? undefined : undefined}
        >
          {onClose ? (
            <button type="button" className="kc-dialog__close" aria-label="Close" onClick={onClose}>
              ×
            </button>
          ) : null}
          <RadixDialog.Title className="kc-dialog__title">{title}</RadixDialog.Title>
          {description ? (
            <RadixDialog.Description className="kc-dialog__description">
              {description}
            </RadixDialog.Description>
          ) : null}
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

export const DialogClose = RadixDialog.Close;

export function DialogActions(props: ComponentPropsWithoutRef<"div">) {
  const { className, ...rest } = props;
  return <div {...rest} className={["kc-dialog__actions", className].filter(Boolean).join(" ")} />;
}
