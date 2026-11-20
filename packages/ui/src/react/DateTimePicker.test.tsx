// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DateTimePicker } from "./DateTimePicker";

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
afterEach(cleanup);

// 14 Nov 2026, 10:00 in Lagos.
const now = new Date("2026-11-14T09:00:00Z");
const day = (n: number) => screen.getByRole("button", { name: new RegExp(`^${n} November 2026`) });

function setup(props: Partial<React.ComponentProps<typeof DateTimePicker>> = {}) {
  const onChange = vi.fn();
  render(<DateTimePicker value={null} onChange={onChange} now={now} defaultOpen {...props} />);
  return onChange;
}

describe("DateTimePicker", () => {
  it("shows the value in the zone, or a prompt when empty", () => {
    setup({ value: new Date("2026-11-20T05:00:00Z"), defaultOpen: false });
    expect(screen.getByText(/20 Nov 2026/).textContent).toContain("06:00");
    cleanup();
    setup({ defaultOpen: false });
    expect(screen.getByText("Choose date and time")).toBeTruthy();
  });

  it("picks a day, keeping the time of day", () => {
    const onChange = setup({ value: new Date("2026-11-20T05:00:00Z") });
    fireEvent.click(day(24));
    expect(onChange).toHaveBeenCalledWith(new Date("2026-11-24T05:00:00Z"));
  });

  it("defaults to the next midnight and offers it as a shortcut", () => {
    const onChange = setup({ value: new Date("2026-11-20T05:00:00Z") });
    fireEvent.click(screen.getByRole("button", { name: "Next midnight" }));
    expect(onChange).toHaveBeenCalledWith(new Date("2026-11-14T23:00:00Z"));
  });

  it("blocks past days and clamps times earlier than now", () => {
    const onChange = setup();
    expect(day(13).getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(day(13));
    expect(onChange).not.toHaveBeenCalled();

    // Today at midnight is already past, so it clamps to now.
    fireEvent.click(day(14));
    expect(onChange).toHaveBeenLastCalledWith(now);

    fireEvent.change(screen.getByLabelText(/^Time/), { target: { value: "08:00" } });
    expect(onChange.mock.calls.at(-1)![0].getTime()).toBeGreaterThanOrEqual(now.getTime());
  });

  it("moves focus with the arrow keys, across month ends", () => {
    setup({ value: new Date("2026-11-30T05:00:00Z") });
    const grid = screen.getByRole("grid");
    const active = () => document.querySelector('[role="gridcell"] [tabindex="0"]')!.textContent;
    expect(active()).toBe("30");
    fireEvent.keyDown(grid, { key: "ArrowLeft" });
    expect(active()).toBe("29");
    fireEvent.keyDown(grid, { key: "ArrowDown" });
    expect(active()).toBe("6"); // 29 + 7 rolls into December
    expect(screen.getByText("December 2026")).toBeTruthy();
    fireEvent.keyDown(grid, { key: "ArrowUp" });
    expect(active()).toBe("29");
    expect(screen.getByText("November 2026")).toBeTruthy();
  });

  it("marks days that already have something scheduled", () => {
    setup({ scheduledDates: ["2026-11-17"] });
    expect(day(17).hasAttribute("data-scheduled")).toBe(true);
    expect(day(17).getAttribute("aria-label")).toContain("has a scheduled item");
    expect(day(18).hasAttribute("data-scheduled")).toBe(false);
  });

  it("drives labels and conversions from the timeZone prop", () => {
    // New York is UTC-5 in November: 17:00 UTC on 20 Nov is noon there.
    const onChange = setup({
      timeZone: "America/New_York",
      value: new Date("2026-11-20T17:00:00Z"),
    });
    expect(screen.getByText("Time (New York)")).toBeTruthy();
    expect(screen.getByRole("dialog").getAttribute("aria-label")).toContain("New York time");
    fireEvent.click(day(24));
    expect(onChange).toHaveBeenCalledWith(new Date("2026-11-24T17:00:00Z"));
  });
});

describe("DateTimePicker error", () => {
  it("marks the trigger invalid and describes it with the error", () => {
    render(
      <DateTimePicker
        label="Starts"
        value={null}
        onChange={() => {}}
        error="Choose a start time."
      />,
    );
    const trigger = screen.getByRole("button", { name: "Starts" });
    expect(trigger).toHaveAttribute("aria-invalid", "true");
    const error = screen.getByRole("alert");
    expect(error).toHaveTextContent("Choose a start time.");
    expect(trigger).toHaveAttribute("aria-describedby", error.id);
  });
});
