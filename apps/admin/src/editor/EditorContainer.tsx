import { useId, useRef, useState, type ReactNode } from "react";
import { Button, Dialog, DialogActions, UnsavedChangesPrompt } from "@kcom/ui";
import type { DialogSize, DialogVariant } from "@kcom/ui";
import { useEditorGuard } from "./useEditorGuard";

export interface EditorContainerProps {
  title: ReactNode;
  description?: ReactNode;
  /** Name of the item being edited, quoted in the unsaved-changes prompt. */
  subject?: ReactNode;
  dirty: boolean;
  /** Called once the editor may close: a clean close, or after Discard. */
  onClose: () => void;
  /** "inline" renders in place (no overlay) instead of as a dialog. */
  variant?: DialogVariant | "inline";
  size?: DialogSize;
  /** Primary actions, such as Publish and Save draft. */
  actions?: ReactNode;
  /** Inline only: extra controls beside the × in the header. */
  headerActions?: ReactNode;
  children?: ReactNode;
}

/**
 * Shell every admin editor renders in. Esc and clicks outside never close it.
 * Closing with × (or Cancel, in a dialog) asks first when `dirty`; browser
 * unload and in-app navigation are guarded the same way. Must render inside a
 * data router.
 */
export function EditorContainer({
  title,
  description,
  subject,
  dirty,
  onClose,
  variant = "panel",
  size,
  actions,
  headerActions,
  children,
}: EditorContainerProps) {
  const headingId = useId();
  const [closePrompt, setClosePrompt] = useState(false);
  const { blocker, allowNavigation } = useEditorGuard(dirty);
  const blocked = blocker.state === "blocked";
  const promptOpen = closePrompt || blocked;
  // Set once Discard has been chosen, so the prompt's own close event that follows can't undo it.
  const settled = useRef(false);
  if (!promptOpen) settled.current = false;

  const discard = () => {
    if (settled.current) return;
    settled.current = true;
    allowNavigation();
    setClosePrompt(false);
    if (blocked) blocker.proceed?.();
    else onClose();
  };
  const keepEditing = () => {
    if (settled.current) return;
    setClosePrompt(false);
    if (blocked) blocker.reset?.();
  };
  const requestClose = () => (dirty ? setClosePrompt(true) : onClose());

  const prompt = (
    <UnsavedChangesPrompt
      open={promptOpen}
      onOpenChange={(open) => !open && keepEditing()}
      subject={subject}
      onKeepEditing={keepEditing}
      onDiscard={discard}
    />
  );

  if (variant === "inline") {
    return (
      <>
        <section className="kc-editor-inline" aria-labelledby={headingId}>
          <header className="kc-editor-inline__head">
            <h2 id={headingId} className="kc-editor-inline__title">
              {title}
            </h2>
            <div className="kc-editor-inline__tools">
              {headerActions}
              <button
                type="button"
                className="kc-editor-inline__close"
                aria-label="Close panel"
                onClick={requestClose}
              >
                ×
              </button>
            </div>
          </header>
          {description ? <p>{description}</p> : null}
          {children}
          <div className="kc-dialog__actions">{actions}</div>
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
          <Button variant="secondary" onClick={requestClose}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
      {prompt}
    </>
  );
}
