import { describe, expect, it } from "vitest";
import { bankRows, sampleSettings } from "./partnership";

describe("partnership rows", () => {
  it("drops empty and blank values", () => {
    expect(bankRows(sampleSettings).map((r) => r.label)).toEqual(["Bank", "Account name", "Account number"]);
    expect(bankRows({ bank: { bankName: " ", accountName: null, accountNumber: null, sortOrSwift: null } })).toEqual([]);
  });
});
