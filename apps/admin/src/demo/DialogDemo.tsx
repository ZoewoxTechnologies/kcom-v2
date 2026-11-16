import { useEffect, useState } from "react";
import { Button, Dialog, DialogActions, DialogClose, UnsavedChangesPrompt } from "@kcom/ui";

// ?dialog=modal|panel|editor opens that state on load; ?theme=light|dark forces a theme.
// Both exist for review screenshots.
const initialDialog = () =>
  typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("dialog");

export function DialogDemo() {
  const initial = initialDialog();
  useEffect(() => {
    const theme = new URLSearchParams(window.location.search).get("theme");
    if (!theme) return;
    document.documentElement.dataset.theme = theme;
    // Screenshots are taken immediately, so skip the open animations.
    const style = document.createElement("style");
    style.textContent = "*, *::before, *::after { animation: none !important; }";
    document.head.append(style);
    return () => style.remove();
  }, []);
  const [editorOpen, setEditorOpen] = useState(initial === "editor");
  const [promptOpen, setPromptOpen] = useState(initial === "editor");
  const close = () => {
    setPromptOpen(false);
    setEditorOpen(false);
  };
  return (
    <section>
      <h2>Dialog</h2>
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <Dialog
          defaultOpen={initial === "modal"}
          title="Edit event"
          description="Changes are saved as a draft until you publish."
          trigger={<Button>Modal</Button>}
        >
          <DialogActions>
            <DialogClose asChild>
              <Button>Save</Button>
            </DialogClose>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
          </DialogActions>
        </Dialog>

        <Dialog
          panel
          defaultOpen={initial === "panel"}
          title="Event details"
          description="Side panel for longer editing flows."
          trigger={<Button variant="secondary">Side panel</Button>}
        >
          <DialogActions>
            <DialogClose asChild>
              <Button variant="secondary">Close</Button>
            </DialogClose>
          </DialogActions>
        </Dialog>

        <Dialog
          editor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          title="Edit event"
          description="Esc and clicks outside never close the editor."
          trigger={<Button variant="secondary">Editor + unsaved prompt</Button>}
        >
          <DialogActions>
            <Button variant="secondary" onClick={() => setPromptOpen(true)}>
              Close
            </Button>
          </DialogActions>
        </Dialog>
        <UnsavedChangesPrompt
          open={promptOpen}
          onOpenChange={setPromptOpen}
          subject="Kingdom Capstone Conference 2027"
          onSaveDraft={close}
          onDiscard={close}
        />
      </div>
    </section>
  );
}
