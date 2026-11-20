import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useRef, type ReactNode } from "react";
import { Button } from "./Button";

export interface ConfirmAction {
  label: ReactNode;
  onSelect: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
}

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  message: ReactNode;
  confirmLabel?: ReactNode;
  cancelLabel?: ReactNode;
  /** "danger" styles the confirm action as destructive and moves it to the end of the row. */
  variant?: "default" | "danger";
  /** Disables every action, for while work started by one of them is pending. */
  busy?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
  /** Extra actions shown before cancel and confirm; each closes the dialog. */
  actions?: ConfirmAction[];
}

/**
 * Confirmation prompt on Radix AlertDialog. Focus starts on the cancel action
 * and returns to whatever had focus before it opened.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
  busy = false,
  actions = [],
}: ConfirmDialogProps) {
  // There is no trigger, so remember what had focus and hand it back on close.
  const returnFocus = useRef<HTMLElement | null>(null);
  if (open && !returnFocus.current && typeof document !== "undefined") {
    returnFocus.current = document.activeElement as HTMLElement | null;
  }
  const danger = variant === "danger";
  const confirm = (
    <AlertDialog.Action asChild key="confirm">
      <Button
        size="sm"
        variant={danger ? "tertiary" : "primary"}
        className={danger ? "kc-dialog__actions-end" : undefined}
        disabled={busy}
        onClick={onConfirm}
      >
        {confirmLabel}
      </Button>
    </AlertDialog.Action>
  );
  const cancel = (
    <AlertDialog.Cancel asChild key="cancel">
      <Button size="sm" variant="secondary" disabled={busy} onClick={onCancel}>
        {cancelLabel}
      </Button>
    </AlertDialog.Cancel>
  );
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="kc-dialog-overlay" />
        <AlertDialog.Content
          className="kc-dialog kc-dialog--modal kc-dialog--sm"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocus.current?.focus();
            returnFocus.current = null;
          }}
        >
          <AlertDialog.Title className="kc-dialog__title">{title}</AlertDialog.Title>
          <AlertDialog.Description className="kc-dialog__description">
            {message}
          </AlertDialog.Description>
          <div className="kc-dialog__actions">
            {actions.map((action, i) => (
              <AlertDialog.Action asChild key={i}>
                <Button
                  variant={action.variant ?? "primary"}
                  disabled={busy || action.disabled}
                  onClick={action.onSelect}
                >
                  {action.label}
                </Button>
              </AlertDialog.Action>
            ))}
            {danger ? [cancel, confirm] : [confirm, cancel]}
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
