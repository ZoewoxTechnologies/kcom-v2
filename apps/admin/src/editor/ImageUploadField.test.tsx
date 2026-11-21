import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImageUploadField } from "./ImageUploadField";

describe("ImageUploadField", () => {
  it("offers Choose when empty and Replace/Remove when set", async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ImageUploadField label="Cover" value={null} onChange={onChange} />,
    );
    expect(screen.getByRole("button", { name: "Choose image" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
    rerender(<ImageUploadField label="Cover" value="https://x.test/a.png" onChange={onChange} />);
    expect(screen.getByRole("button", { name: "Replace image" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("shows an optional marker and applies the preview aspect ratio", () => {
    const { container } = render(
      <ImageUploadField
        label="Cover"
        optional
        aspectRatio="2 / 3"
        value="https://x.test/a.png"
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("(optional)")).toBeInTheDocument();
    expect(container.querySelector("img")).toHaveStyle({ aspectRatio: "2 / 3" });
  });

  it("rejects a file type that is not allowed", async () => {
    const onChange = vi.fn();
    render(<ImageUploadField label="Cover" value={null} onChange={onChange} />);
    const file = new File(["x"], "a.gif", { type: "image/gif" });
    await userEvent.upload(screen.getByLabelText(/Cover/), file, { applyAccept: false });
    expect(await screen.findByRole("alert")).toHaveTextContent("Use a PNG, JPEG or WebP image.");
    expect(onChange).not.toHaveBeenCalled();
  });
});
