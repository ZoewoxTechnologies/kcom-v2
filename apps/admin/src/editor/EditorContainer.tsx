import { useId, useRef, useState, type ReactNode } from "react";
import { Button, Dialog, useToast, DialogActions, UnsavedChangesPrompt } from "@kcom/ui";
import type { DialogSize, DialogVariant } from "@kcom/ui";
import { useEditorGuard } from "./useEditorGuard";

export interface EditorContainerProps {
  title: ReactNode;
  description?: ReactNode;
  /** Name of the item being edited, quoted in the unsaved-changes prompt. */
  subject?: ReactNode;
  dirty: boolean;
  /** Called once the editor may close: clean close, or after Save draft / Discard. */
  onClose: () => void;
  /** Label for the prompt's save action; use "Save changes" for an item that is already live. */
  saveLabel?: ReactNode;
  /** Saves without publishing. The editor closes when it resolves. */
  onSaveDraft: () => void | Promise<void>;
  /** "inline" renders in place (no overlay) instead of as a dialog. */
  variant?: DialogVariant | "inline";
  size?: DialogSize;
  /** Primary actions shown beside Cancel, such as Save. */
  actions?: ReactNode;
  children?: ReactNode;
}

/**
 * Shell every admin editor renders in. Esc and clicks outside never close it.
 * Closing with × or Cancel asks first when `dirty`; browser unload and in-app
 * navigation are guarded the same way. Must render inside a data router.
 */
export function EditorContainer({
  title,
  description,
  subject,
  saveLabel,
  dirty,
  onClose,
  onSaveDraft,
  variant = "panel",
  size,
  actions,
  children,
}: EditorContainerProps) {
  const headingId = useId();
  const [closePrompt, setClosePrompt] = useState(false);
  const [saving, setSaving] = useState(false);
  const { blocker, allowNavigation } = useEditorGuard(dirty);
  const { toast } = useToast();
  const blocked = blocker.state === "blocked";
  const promptOpen = closePrompt || blocked;
  // Set once Discard or a successful save has been chosen, so the dialog's own
  // close event that follows can't undo it.
  const settled = useRef(false);
  // A ref, because the dialog reports its close in the same event as the click that starts a save.
  const savingRef = useRef(false);
  if (!promptOpen) settled.current = false;

  const finish = (navigating: boolean) => {
    if (settled.current) return;
    settled.current = true;
    allowNavigation();
    setClosePrompt(false);
    if (navigating) blocker.proceed?.();
    else onClose();
  };
  const keepEditing = () => {
    if (settled.current || savingRef.current) return;
    setClosePrompt(false);
    if (blocked) blocker.reset?.();
  };
  const saveDraft = async () => {
    // Remember whether this was a blocked navigation before the save settles.
    const navigating = blocked;
    savingRef.current = true;
    setSaving(true);
    try {
      await onSaveDraft();
    } catch {
      toast({
        variant: "error",
        title: "Couldn\u2019t save your draft",
        description: "Your changes are still here. Try again.",
      });
      return;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
    finish(navigating);
  };
  const requestClose = () => (dirty ? setClosePrompt(true) : onClose());

  const prompt = (
    <UnsavedChangesPrompt
      open={promptOpen}
      onOpenChange={(open) => !open && keepEditing()}
      subject={subject}
      saveLabel={saveLabel}
      saving={saving}
      onSaveDraft={saveDraft}
      onKeepEditing={keepEditing}
      onDiscard={() => finish(blocked)}
    />
  );
  const cancel = (
    <Button variant="secondary" onClick={requestClose}>
      Cancel
    </Button>
  );

  if (variant === "inline") {
    return (
      <>
        <section className="kc-editor-inline" aria-labelledby={headingId}>
          <header className="kc-editor-inline__head">
            <h2 id={headingId} className="kc-editor-inline__title">
              {title}
            </h2>
            <button
              type="button"
              className="kc-editor-inline__close"
              aria-label="Close panel"
              onClick={requestClose}
            >
              ×
            </button>
          </header>
          {description ? <p>{description}</p> : null}
          {children}
          <div className="kc-dialog__actions">
            {actions}
            {cancel}
          </div>
        </section>
        {prompt}
      </>
    );
  }

  return (
    <>
      <Dialog
        open
        dismissible={false}
        variant={variant}
        size={size}
        title={title}
        description={description}
        onOpenChange={() => {}}
        onClose={requestClose}
      >
        {children}
        <DialogActions>
          {actions}
          {cancel}
        </DialogActions>
      </Dialog>
      {prompt}
    </>
  );
}
