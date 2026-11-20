import type { ReactNode } from "react";
import { ConfirmDialog } from "./ConfirmDialog";

export interface UnsavedChangesPromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Name of the thing being edited, quoted in the message. */
  subject?: ReactNode;
  onKeepEditing?: () => void;
  onDiscard: () => void;
}

/** ConfirmDialog preset: "Discard your changes?" with Keep editing and Discard. */
export function UnsavedChangesPrompt({
  open,
  onOpenChange,
  subject,
  onKeepEditing,
  onDiscard,
}: UnsavedChangesPromptProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      variant="danger"
      title="Discard your changes?"
      message={
        <>
          {subject ? (
            <>You&rsquo;ve edited &ldquo;{subject}&rdquo; but haven&rsquo;t saved.</>
          ) : (
            <>You haven&rsquo;t saved your edits.</>
          )}{" "}
          If you close now, those changes will be lost.
        </>
      }
      cancelLabel="Keep editing"
      onCancel={onKeepEditing}
      confirmLabel="Discard"
      onConfirm={onDiscard}
    />
  );
}
