import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImageUploadField } from "./ImageUploadField";

describe("ImageUploadField", () => {
  it("offers Upload when empty and Replace/Remove when set", async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ImageUploadField label="Cover" value={null} onChange={onChange} />,
    );
    expect(screen.getByRole("button", { name: "Upload image" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
    rerender(<ImageUploadField label="Cover" value="https://x.test/a.png" onChange={onChange} />);
    expect(screen.getByRole("button", { name: "Replace" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("rejects a file type that is not allowed", async () => {
    const onChange = vi.fn();
    render(<ImageUploadField label="Cover" value={null} onChange={onChange} />);
    const file = new File(["x"], "a.gif", { type: "image/gif" });
    await userEvent.upload(screen.getByLabelText(/Cover/), file, { applyAccept: false });
    expect(await screen.findByText("Use a PNG, JPEG or WebP image.")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
