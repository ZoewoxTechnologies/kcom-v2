// @vitest-environment node
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DateTimePicker } from "./DateTimePicker";

const now = new Date("2026-03-01T22:30:00Z"); // 23:30 in Lagos

describe("DateTimePicker", () => {
  it("shows the value in Lagos time", () => {
    const html = renderToStaticMarkup(
      <DateTimePicker value={new Date("2026-03-01T23:00:00Z")} onChange={() => {}} now={now} />,
    );
    expect(html).toContain("Mon, 2 Mar 2026");
    expect(html).toContain("00:00 WAT");
  });

  it("shows a prompt when empty", () => {
    const html = renderToStaticMarkup(
      <DateTimePicker value={null} onChange={() => {}} now={now} />,
    );
    expect(html).toContain("Choose date and time");
  });
});
