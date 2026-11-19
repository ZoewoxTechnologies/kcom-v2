import { useState } from "react";
import { Link } from "react-router";
import { Button } from "@kcom/ui";
import { EditorContainer, useDirtyState } from "../editor";

/** Editor kit: edit the title to make it dirty, then try ×, Cancel, Esc, a link or a reload. */
export function EditorKitDemo() {
  const [open, setOpen] = useState(false);
  const form = useDirtyState({ title: "Kingdom Capstone Conference 2027" });
  return (
    <section>
      <h2>Editor kit</h2>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Open editor
      </Button>
      {open && (
        <EditorContainer
          title="Edit event: Kingdom Capstone Conference 2027 regional gathering and leaders’ summit"
          subject={form.value.title}
          dirty={form.dirty}
          onClose={() => {
            form.reset();
            setOpen(false);
          }}
          onSaveDraft={() => form.markSaved()}
          actions={<Button onClick={() => form.markSaved()}>Save</Button>}
        >
          <label>
            Title
            <input
              value={form.value.title}
              onChange={(e) => form.setValue({ title: e.target.value })}
            />
          </label>
          <p>
            <Link to="/sign-in">Leave via a link</Link>
          </p>
        </EditorContainer>
      )}
    </section>
  );
}
