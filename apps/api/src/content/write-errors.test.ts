import { describe, expect, it } from "vitest";
import { HttpError } from "../errors.js";
import { rethrowWriteError } from "./write-errors.js";

const caught = (err: unknown, opts?: Parameters<typeof rethrowWriteError>[1]) => {
  try {
    rethrowWriteError(err, opts);
  } catch (e) {
    return e;
  }
};

describe("rethrowWriteError", () => {
  it("maps unique violations to 409 with the label", () => {
    const e = caught({ code: "23505" }, { label: "book slug" }) as HttpError;
    expect([e.status, e.code, e.message]).toEqual([409, "conflict", "book slug already exists"]);
  });

  it("maps foreign-key violations to 422 without leaking resource names", () => {
    const e = caught({ code: "23503" }) as HttpError;
    expect(e.status).toBe(422);
    expect(e.message).not.toMatch(/series/);
  });

  it("maps check violations to 422", () => {
    expect((caught({ code: "23514" }) as HttpError).status).toBe(422);
  });

  it("uses per-resource messages when given", () => {
    const messages = { reference: "series does not exist", check: "part number needs a series" };
    expect((caught({ code: "23503" }, { messages }) as HttpError).message).toBe(
      "series does not exist",
    );
    expect((caught({ code: "23514" }, { messages }) as HttpError).message).toBe(
      "part number needs a series",
    );
  });

  it("finds the code on a wrapped cause", () => {
    expect((caught({ cause: { code: "23505" } }) as HttpError).status).toBe(409);
  });

  it("rethrows anything else unchanged", () => {
    const err = new Error("boom");
    expect(caught(err)).toBe(err);
    expect(caught({ code: "40001" })).toEqual({ code: "40001" });
  });
});
