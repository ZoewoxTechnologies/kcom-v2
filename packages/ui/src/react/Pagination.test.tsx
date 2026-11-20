// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Pagination } from "./Pagination";

describe("Pagination", () => {
  it("marks only the current page with aria-current", () => {
    render(<Pagination page={2} pageCount={3} onPageChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Page 1" })).not.toHaveAttribute("aria-current");
  });

  it("disables previous on the first page and next on the last", () => {
    const { rerender } = render(<Pagination page={1} pageCount={3} onPageChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next page" })).toBeEnabled();
    rerender(<Pagination page={3} pageCount={3} onPageChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeEnabled();
  });

  it("shows an ellipsis for long ranges, none for short ones", () => {
    const { container, rerender } = render(
      <Pagination page={1} pageCount={40} onPageChange={() => {}} />,
    );
    expect(container.querySelectorAll(".kc-pagination__gap")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Page 40" })).toBeInTheDocument();
    rerender(<Pagination page={1} pageCount={3} onPageChange={() => {}} />);
    expect(container.querySelectorAll(".kc-pagination__gap")).toHaveLength(0);
  });

  it("is keyboard operable: Tab reaches items, Enter changes page", async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();
    render(<Pagination page={1} pageCount={3} onPageChange={onPageChange} />);
    await user.tab(); // previous is disabled, so focus lands on page 1
    expect(screen.getByRole("button", { name: "Page 1" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Page 2" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onPageChange).toHaveBeenCalledWith(2);
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(onPageChange).toHaveBeenLastCalledWith(2);
  });
});
