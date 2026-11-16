import { describe, expect, it } from "vitest";
import { nextLagosMidnight } from "./publish";

const next = (iso: string) => nextLagosMidnight(new Date(iso)).toISOString();

describe("nextLagosMidnight", () => {
  it("evening in Lagos goes live at that night's midnight", () => {
    expect(next("2026-11-16T21:00:00Z")).toBe("2026-11-16T23:00:00.000Z"); // 22:00 WAT
  });

  it("morning in Lagos goes live at the next midnight", () => {
    expect(next("2026-11-16T08:00:00Z")).toBe("2026-11-16T23:00:00.000Z");
  });

  it("just after Lagos midnight rolls to the following day", () => {
    expect(next("2026-11-16T23:00:00Z")).toBe("2026-11-17T23:00:00.000Z"); // exactly 00:00 WAT
    expect(next("2026-11-16T23:30:00Z")).toBe("2026-11-17T23:00:00.000Z");
  });

  it("is strictly after now, one millisecond before midnight included", () => {
    expect(next("2026-11-16T22:59:59.999Z")).toBe("2026-11-16T23:00:00.000Z");
  });

  it("handles year and month boundaries", () => {
    expect(next("2026-12-31T23:30:00Z")).toBe("2027-01-01T23:00:00.000Z");
    expect(next("2028-02-28T12:00:00Z")).toBe("2028-02-28T23:00:00.000Z");
  });
});
