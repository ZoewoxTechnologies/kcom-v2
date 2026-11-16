import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useRef, type ReactNode } from "react";
import { Button } from "./Button";

export interface UnsavedChangesPromptProps {
  open: boolean;
  /** Called when the prompt is dismissed without a choice (same as Keep editing). */
  onOpenChange: (open: boolean) => void;
  /** Name of the thing being edited, quoted in the message. */
  subject?: ReactNode;
  onSaveDraft: () => void;
  onKeepEditing?: () => void;
  onDiscard: () => void;
}

/** "Discard your changes?" prompt: Save draft, Keep editing, Discard. Focus starts on Keep editing. */
export function UnsavedChangesPrompt({
  open,
  onOpenChange,
  subject,
  onSaveDraft,
  onKeepEditing,
  onDiscard,
}: UnsavedChangesPromptProps) {
  // The prompt has no trigger, so remember what had focus and hand it back on close.
  const returnFocus = useRef<HTMLElement | null>(null);
  if (open && !returnFocus.current && typeof document !== "undefined") {
    returnFocus.current = document.activeElement as HTMLElement | null;
  }
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="kc-dialog-overlay" />
        <AlertDialog.Content
          className="kc-dialog"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocus.current?.focus();
            returnFocus.current = null;
          }}
        >
          <AlertDialog.Title className="kc-dialog__title">Discard your changes?</AlertDialog.Title>
          <AlertDialog.Description className="kc-dialog__description">
            {subject ? (
              <>You&rsquo;ve edited &ldquo;{subject}&rdquo; but haven&rsquo;t saved.</>
            ) : (
              <>You haven&rsquo;t saved your edits.</>
            )}{" "}
            If you close now, those changes will be lost.
          </AlertDialog.Description>
          <div className="kc-dialog__actions">
            <AlertDialog.Action asChild>
              <Button variant="primary" onClick={onSaveDraft}>
                Save draft
              </Button>
            </AlertDialog.Action>
            <AlertDialog.Cancel asChild>
              <Button variant="secondary" onClick={onKeepEditing}>
                Keep editing
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button variant="tertiary" className="kc-dialog__actions-end" onClick={onDiscard}>
                Discard
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
