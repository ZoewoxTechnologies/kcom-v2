import type { ReactNode } from "react";
import { ConfirmDialog } from "./ConfirmDialog";

export interface UnsavedChangesPromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Name of the thing being edited, quoted in the message. */
  subject?: ReactNode;
  onSaveDraft: () => void;
  onKeepEditing?: () => void;
  onDiscard: () => void;
}

/** ConfirmDialog preset: "Discard your changes?" with Save draft, Keep editing and Discard. */
export function UnsavedChangesPrompt({
  open,
  onOpenChange,
  subject,
  onSaveDraft,
  onKeepEditing,
  onDiscard,
}: UnsavedChangesPromptProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      tone="danger"
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
      actions={[{ label: "Save draft", onSelect: onSaveDraft }]}
      cancelLabel="Keep editing"
      onCancel={onKeepEditing}
      confirmLabel="Discard"
      onConfirm={onDiscard}
    />
  );
}
