import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button";
import { Dialog, DialogActions, DialogClose } from "./Dialog";
import { ConfirmDialog } from "./ConfirmDialog";
import { UnsavedChangesPrompt } from "./UnsavedChangesPrompt";

function Demo({ dismissible = true }: { dismissible?: boolean }) {
  return (
    <Dialog
      dismissible={dismissible}
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
  it("shows a × button only when onClose is given, and calls it", async () => {
    const onClose = vi.fn();
    const { rerender } = render(<Dialog open title="T" onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.querySelector(".kc-dialog--closable")).not.toBeNull();
    rerender(<Dialog open title="T" />);
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
  });

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

  it("ignores Escape and outside click when not dismissible", async () => {
    const user = userEvent.setup();
    render(<Demo dismissible={false} />);
    await user.click(screen.getByRole("button", { name: "Open" }));
    await user.keyboard("{Escape}");
    await user.click(document.querySelector(".kc-dialog-overlay") as HTMLElement);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("applies the panel class", async () => {
    const user = userEvent.setup();
    render(
      <Dialog variant="panel" title="Panel" description="x" trigger={<Button>Open</Button>} />,
    );
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

describe("ConfirmDialog", () => {
  function Host({ variant }: { variant?: "default" | "danger" }) {
    const [open, setOpen] = useState(true);
    const [log, setLog] = useState<string[]>([]);
    const add = (e: string) => setLog((l) => [...l, e]);
    return (
      <>
        <output>{log.join(",")}</output>
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          variant={variant}
          title="Delete this capsule?"
          message="Gone for good."
          confirmLabel="Delete"
          onConfirm={() => add("confirm")}
          onCancel={() => add("cancel")}
          actions={[{ label: "Archive", onSelect: () => add("archive") }]}
        />
      </>
    );
  }

  it("renders title, message and custom labels", () => {
    render(<Host />);
    const dialog = screen.getByRole("alertdialog", { name: "Delete this capsule?" });
    expect(dialog).toHaveTextContent("Gone for good.");
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("fires confirm, cancel and extra actions and closes", async () => {
    for (const [name, event] of [
      ["Delete", "confirm"],
      ["Cancel", "cancel"],
      ["Archive", "archive"],
    ] as const) {
      const user = userEvent.setup();
      const { unmount } = render(<Host />);
      await user.click(screen.getByRole("button", { name }));
      expect(screen.getByRole("status")).toHaveTextContent(event);
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      unmount();
    }
  });

  it("danger variant pushes confirm to the end", () => {
    render(<Host variant="danger" />);
    expect(screen.getByRole("button", { name: "Delete" })).toHaveClass("kc-dialog__actions-end");
  });
});
