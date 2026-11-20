import type { ReactNode } from "react";
import { ConfirmDialog } from "./ConfirmDialog";

export interface UnsavedChangesPromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Name of the thing being edited, quoted in the message. */
  subject?: ReactNode;
  /** Label for the save action; "Save draft" unless the item is already live. */
  saveLabel?: ReactNode;
  onSaveDraft: () => void;
  /** A draft save is in flight: every action is disabled. */
  saving?: boolean;
  onKeepEditing?: () => void;
  onDiscard: () => void;
}

/** ConfirmDialog preset: "Discard your changes?" with Save draft, Keep editing and Discard. */
export function UnsavedChangesPrompt({
  open,
  onOpenChange,
  subject,
  saveLabel = "Save draft",
  onSaveDraft,
  saving = false,
  onKeepEditing,
  onDiscard,
}: UnsavedChangesPromptProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      variant="danger"
      busy={saving}
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
      actions={[{ label: saveLabel, onSelect: onSaveDraft }]}
      cancelLabel="Keep editing"
      onCancel={onKeepEditing}
      confirmLabel="Discard"
      onConfirm={onDiscard}
    />
  );
}
