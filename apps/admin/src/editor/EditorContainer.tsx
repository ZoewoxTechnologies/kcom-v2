import { useState, type ReactNode } from "react";
import { Button, Dialog, DialogActions, UnsavedChangesPrompt } from "@kcom/ui";
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
  /** Saves without publishing. The editor closes when it resolves. */
  onSaveDraft: () => void | Promise<void>;
  variant?: DialogVariant;
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
  dirty,
  onClose,
  onSaveDraft,
  variant = "panel",
  size,
  actions,
  children,
}: EditorContainerProps) {
  const [closePrompt, setClosePrompt] = useState(false);
  const { blocker, allowNavigation } = useEditorGuard(dirty);
  const blocked = blocker.state === "blocked";
  const promptOpen = closePrompt || blocked;

  const finish = () => {
    allowNavigation();
    setClosePrompt(false);
    if (blocked) blocker.proceed();
    else onClose();
  };
  const keepEditing = () => {
    setClosePrompt(false);
    if (blocked) blocker.reset();
  };
  const requestClose = () => (dirty ? setClosePrompt(true) : onClose());

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
      >
        <button
          type="button"
          className="kc-dialog__close"
          aria-label="Close"
          onClick={requestClose}
        >
          ×
        </button>
        {children}
        <DialogActions>
          {actions}
          <Button variant="secondary" onClick={requestClose}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
      <UnsavedChangesPrompt
        open={promptOpen}
        onOpenChange={(open) => !open && keepEditing()}
        subject={subject}
        onSaveDraft={async () => {
          await onSaveDraft();
          finish();
        }}
        onKeepEditing={keepEditing}
        onDiscard={finish}
      />
    </>
  );
}
