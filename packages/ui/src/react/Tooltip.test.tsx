import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tooltip } from "./Tooltip";

describe("Tooltip", () => {
  it("shows on hover and hides on leave, describing the control", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip label="Delete event">
        <button aria-label="Delete event">x</button>
      </Tooltip>,
    );
    const button = screen.getByRole("button", { name: "Delete event" });
    expect(screen.queryByRole("tooltip")).toBeNull();
    await user.hover(button);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Delete event");
    expect(button).toHaveAttribute("aria-describedby", screen.getByRole("tooltip").id);
    await user.unhover(button);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("shows on keyboard focus and hides on Escape", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip label="Hint">
        <button>x</button>
      </Tooltip>,
    );
    await user.tab();
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
