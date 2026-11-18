import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, Link, RouterProvider } from "react-router";
import { ToastProvider } from "@kcom/ui";
import { EditorContainer } from "./EditorContainer";
import { useDirtyState } from "./useDirtyState";

function Harness({
  onClose,
  onSaveDraft,
}: {
  onClose: () => void;
  onSaveDraft: () => void | Promise<void>;
}) {
  const form = useDirtyState({ title: "Conference" });
  return (
    <EditorContainer
      title="Edit event"
      subject={form.value.title}
      dirty={form.dirty}
      onClose={onClose}
      onSaveDraft={onSaveDraft}
    >
      <input
        aria-label="Title"
        value={form.value.title}
        onChange={(e) => form.setValue({ title: e.target.value })}
      />
      <Link to="/elsewhere">Elsewhere</Link>
    </EditorContainer>
  );
}

function setup(onSaveDraft: () => void | Promise<void> = vi.fn()) {
  const onClose = vi.fn();
  const router = createMemoryRouter([
    { path: "/", element: <Harness onClose={onClose} onSaveDraft={onSaveDraft} /> },
    { path: "/elsewhere", element: <p>Elsewhere page</p> },
  ]);
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  );
  return { onClose, onSaveDraft, router, user: userEvent.setup() };
}

describe("EditorContainer", () => {
  it("closes straight away when clean, via × and Cancel", async () => {
    const { onClose, user } = setup();
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Discard your changes?")).toBeNull();
  });

  it("asks first when dirty, naming the item", async () => {
    const { onClose, user } = setup();
    await user.type(screen.getByLabelText("Title"), " 2027");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("Discard your changes?")).toBeInTheDocument();
    expect(screen.getByText(/Conference 2027/)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("Keep editing dismisses the prompt, Discard closes, Save draft saves then closes", async () => {
    const { onClose, onSaveDraft, user } = setup();
    await user.type(screen.getByLabelText("Title"), "x");
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.queryByText("Discard your changes?")).toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    expect(onSaveDraft).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("Esc and click-outside never close the editor", async () => {
    const { onClose, user } = setup();
    await user.keyboard("{Escape}");
    await user.pointer({
      target: document.querySelector(".kc-dialog-overlay")!,
      keys: "[MouseLeft]",
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText("Edit event")).toBeInTheDocument();
  });

  it("blocks in-app navigation when dirty and lets it through when clean", async () => {
    const { router, user } = setup();
    await user.type(screen.getByLabelText("Title"), "x");
    await user.click(screen.getByRole("link", { name: "Elsewhere" }));
    expect(router.state.location.pathname).toBe("/");
    expect(screen.getByText("Discard your changes?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(router.state.location.pathname).toBe("/elsewhere");
  });

  it("navigates freely when clean", async () => {
    const { router, user } = setup();
    await user.click(screen.getByRole("link", { name: "Elsewhere" }));
    expect(router.state.location.pathname).toBe("/elsewhere");
  });

  it("warns on browser unload only when dirty", async () => {
    const { user } = setup();
    const fire = () => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(fire()).toBe(false);
    await user.type(screen.getByLabelText("Title"), "x");
    expect(fire()).toBe(true);
  });

  it("Keep editing on a blocked navigation stays put and can be blocked again", async () => {
    const { router, user } = setup();
    await user.type(screen.getByLabelText("Title"), "x");
    await user.click(screen.getByRole("link", { name: "Elsewhere" }));
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(router.state.location.pathname).toBe("/");
    expect(screen.queryByText("Discard your changes?")).toBeNull();
    await user.click(screen.getByRole("link", { name: "Elsewhere" }));
    expect(screen.getByText("Discard your changes?")).toBeInTheDocument();
  });

  it("Save draft on a blocked navigation waits for the save, then navigates", async () => {
    let finishSave!: () => void;
    const { router, user } = setup(() => new Promise<void>((resolve) => (finishSave = resolve)));
    await user.type(screen.getByLabelText("Title"), "x");
    await user.click(screen.getByRole("link", { name: "Elsewhere" }));
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    expect(screen.getByText("Discard your changes?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
    expect(router.state.location.pathname).toBe("/");
    finishSave();
    await waitFor(() => expect(router.state.location.pathname).toBe("/elsewhere"));
  });

  it("a failed save stays in the editor and shows an error toast", async () => {
    const { onClose, router, user } = setup(() => Promise.reject(new Error("offline")));
    await user.type(screen.getByLabelText("Title"), "x");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    expect(await screen.findByText(/save your draft/)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(router.state.location.pathname).toBe("/");
    expect(screen.getByRole("button", { name: "Save draft" })).toBeEnabled();
  });
});
