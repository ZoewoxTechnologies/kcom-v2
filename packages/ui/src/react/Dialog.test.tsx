import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button";
import { Dialog, DialogActions, DialogClose } from "./Dialog";
import { UnsavedChangesPrompt } from "./UnsavedChangesPrompt";

function Demo({ editor = false }: { editor?: boolean }) {
  return (
    <Dialog
      editor={editor}
      title="Edit event"
      description="Details"
      trigger={<Button>Open</Button>}
    >
      <input aria-label="Name" />
      <DialogActions>
        <DialogClose asChild>
          <Button>Close</Button>
        </DialogClose>
      </DialogActions>
    </Dialog>
  );
}

describe("Dialog", () => {
  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<Demo />);
    const trigger = screen.getByRole("button", { name: "Open" });
    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: "Edit event" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("traps focus inside", async () => {
    const user = userEvent.setup();
    render(<Demo />);
    await user.click(screen.getByRole("button", { name: "Open" }));
    for (let i = 0; i < 6; i++) {
      await user.tab();
      expect(screen.getByRole("dialog")).toContainElement(document.activeElement as HTMLElement);
    }
  });

  it("closes on outside click in standard mode", async () => {
    const user = userEvent.setup();
    render(<Demo />);
    await user.click(screen.getByRole("button", { name: "Open" }));
    await user.click(document.querySelector(".kc-dialog-overlay") as HTMLElement);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("ignores Escape and outside click in editor mode", async () => {
    const user = userEvent.setup();
    render(<Demo editor />);
    await user.click(screen.getByRole("button", { name: "Open" }));
    await user.keyboard("{Escape}");
    await user.click(document.querySelector(".kc-dialog-overlay") as HTMLElement);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("applies the panel class", async () => {
    const user = userEvent.setup();
    render(<Dialog panel title="Panel" description="x" trigger={<Button>Open</Button>} />);
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByRole("dialog")).toHaveClass("kc-dialog--panel");
  });
});

describe("UnsavedChangesPrompt", () => {
  function Host(props: { save: () => void; keep: () => void; discard: () => void }) {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Close editor</Button>
        <UnsavedChangesPrompt
          open={open}
          onOpenChange={setOpen}
          subject="Conference 2027"
          onSaveDraft={props.save}
          onKeepEditing={props.keep}
          onDiscard={props.discard}
        />
      </>
    );
  }

  const setup = async () => {
    const fns = { save: vi.fn(), keep: vi.fn(), discard: vi.fn() };
    const user = userEvent.setup();
    render(<Host {...fns} />);
    const opener = screen.getByRole("button", { name: "Close editor" });
    await user.click(opener);
    return { fns, user, opener };
  };

  it("shows the canvas wording and focuses Keep editing", async () => {
    await setup();
    const dialog = screen.getByRole("alertdialog", { name: "Discard your changes?" });
    expect(dialog).toHaveTextContent(
      "You’ve edited “Conference 2027” but haven’t saved. If you close now, those changes will be lost.",
    );
    expect(screen.getByRole("button", { name: "Keep editing" })).toHaveFocus();
  });

  it("Save draft calls onSaveDraft and closes", async () => {
    const { fns, user } = await setup();
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    expect(fns.save).toHaveBeenCalledTimes(1);
    expect(fns.discard).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("Keep editing calls onKeepEditing, closes and returns focus", async () => {
    const { fns, user, opener } = await setup();
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(fns.keep).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("Discard calls onDiscard and closes", async () => {
    const { fns, user } = await setup();
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(fns.discard).toHaveBeenCalledTimes(1);
    expect(fns.save).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
