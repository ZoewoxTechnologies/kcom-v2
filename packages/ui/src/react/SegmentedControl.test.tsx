import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SegmentedControl } from "./SegmentedControl";

const options = [
  { value: "a", label: "Upcoming" },
  { value: "b", label: "Past" },
] as const;

function Host() {
  const [value, setValue] = useState<"a" | "b">("a");
  return <SegmentedControl label="Show" options={options} value={value} onChange={setValue} />;
}

describe("SegmentedControl", () => {
  it("is a radiogroup with the active option checked", () => {
    render(<Host />);
    expect(screen.getByRole("radiogroup", { name: "Show" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Upcoming" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Past" })).not.toBeChecked();
  });

  it("changes on click", async () => {
    render(<Host />);
    await userEvent.click(screen.getByRole("radio", { name: "Past" }));
    expect(screen.getByRole("radio", { name: "Past" })).toBeChecked();
  });

  it("moves with arrow keys, wrapping, with roving tabindex", async () => {
    const user = userEvent.setup();
    render(<Host />);
    expect(screen.getByRole("radio", { name: "Past" })).toHaveAttribute("tabindex", "-1");
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Past" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Past" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Upcoming" })).toBeChecked();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("radio", { name: "Past" })).toBeChecked();
  });
});
