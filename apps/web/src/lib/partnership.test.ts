import { describe, expect, it } from "vitest";
import { bankRows, contactRows, sampleSettings } from "./partnership";

describe("partnership rows", () => {
  it("drops empty and blank values", () => {
    expect(bankRows(sampleSettings).map((r) => r.label)).toEqual(["Bank", "Account name", "Account number"]);
    expect(contactRows({ ...sampleSettings, contact: { email: " ", phone: null, address: null } })).toEqual([]);
  });
});
