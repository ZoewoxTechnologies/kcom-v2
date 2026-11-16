import * as RadixDialog from "@radix-ui/react-dialog";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

export interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** Side panel instead of a centered modal. */
  panel?: boolean;
  /** Wider centered modal. */
  wide?: boolean;
  /**
   * Editor container: Esc and clicks outside never close it. Closing happens
   * only through controls inside, usually behind an unsaved-changes prompt.
   */
  editor?: boolean;
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
  panel = false,
  wide = false,
  editor = false,
  className,
  children,
  ...root
}: DialogProps) {
  const classes = ["kc-dialog", panel && "kc-dialog--panel", wide && "kc-dialog--wide", className]
    .filter(Boolean)
    .join(" ");
  const lock = editor
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
