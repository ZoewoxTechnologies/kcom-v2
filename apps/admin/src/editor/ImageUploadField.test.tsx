import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
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
});
