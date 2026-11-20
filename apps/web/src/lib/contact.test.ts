import { describe, expect, it } from "vitest";
import { contactRows, contactSettings, validateContact } from "./contact";

const ok = { topic: "prayer", name: "Grace", email: "grace@example.org", message: "Hi" };

describe("contact", () => {
  it("drops blank contact values", () => {
    expect(contactRows(contactSettings).map((r) => r.label)).toEqual(["Email", "Phone / WhatsApp", "Address"]);
    expect(contactRows({ email: " ", phone: null, address: null, social: [] })).toEqual([]);
  });
  it("accepts a complete message", () => expect(validateContact(ok)).toEqual({}));
  it("flags each problem", () => {
    expect(Object.keys(validateContact({ topic: "", name: " ", email: "grace@", message: "" }))).toEqual(["topic", "name", "email", "message"]);
    expect(validateContact({ ...ok, email: "" }).email).toMatch(/enter your email/);
  });
});
