import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImageUploadField } from "./ImageUploadField";

const preview = () => document.querySelector<HTMLImageElement>(".kc-image-field__preview")!;
const props = {
  label: "Image",
  value: "https://res.cloudinary.com/x/image/upload/a.jpg",
  onChange: () => {},
};

describe("ImageUploadField", () => {
  it("previews at 16/9 by default", () => {
    render(<ImageUploadField {...props} />);
    expect(preview().style.aspectRatio).toMatch(/^1\.7777\d* \/ 1$/);
    expect(screen.getByRole("button", { name: "Replace image" })).toBeInTheDocument();
  });

  it("uses the given aspect ratio", () => {
    render(<ImageUploadField {...props} aspectRatio={1} />);
    expect(preview().style.aspectRatio).toBe("1 / 1");
    expect(preview()).toHaveClass("kc-image-field__preview--narrow");
  });

  it("offers Choose when empty and Remove clears a set image", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<ImageUploadField {...props} value={null} onChange={onChange} />);
    expect(screen.getByRole("button", { name: "Choose image" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
    rerender(<ImageUploadField {...props} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("shows an optional marker and a visible label when asked", () => {
    render(<ImageUploadField {...props} optional visibleLabel />);
    expect(screen.getByText("(optional)")).toBeInTheDocument();
    expect(screen.getByText("Image", { selector: ".kc-label" })).toBeInTheDocument();
  });

  it("rejects a file type that is not allowed", async () => {
    const onChange = vi.fn();
    render(<ImageUploadField {...props} value={null} onChange={onChange} />);
    const file = new File(["x"], "a.gif", { type: "image/gif" });
    await userEvent.upload(screen.getByLabelText(/Image/), file, { applyAccept: false });
    expect(await screen.findByRole("alert")).toHaveTextContent("Use a PNG, JPEG or WebP image.");
    expect(onChange).not.toHaveBeenCalled();
  });
});
