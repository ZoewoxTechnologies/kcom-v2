import { describe, expect, it, vi } from "vitest";
import { visitorIp, EMAIL_INVALID, EMAIL_REQUIRED, SIGNUP_FAILED, SIGNUP_RATE_LIMITED, submitSignup, validateEmail } from "./signup";

const reply = (status: number) => vi.fn(async () => new Response("{}", { status }));

describe("validateEmail", () => {
  it("accepts a full address, trimmed", () => expect(validateEmail(" grace@example.org ")).toBeNull());
  it("asks for an address when blank", () => expect(validateEmail("  ")).toBe(EMAIL_REQUIRED));
  it("rejects a partial address", () => {
    expect(validateEmail("grace@")).toBe(EMAIL_INVALID);
    expect(validateEmail("grace@example")).toBe(EMAIL_INVALID);
  });
});

describe("visitorIp", () => {
  it("takes the last forwarded entry, else the socket address", () => {
    expect(visitorIp("1.1.1.1, 2.2.2.2", "9.9.9.9")).toBe("2.2.2.2");
    expect(visitorIp(null, "9.9.9.9")).toBe("9.9.9.9");
    expect(visitorIp("", undefined)).toBeUndefined();
  });
});

describe("submitSignup", () => {
  it("forwards the visitor address", async () => {
    const f = reply(202);
    await submitSignup("http://api.test", { email: "grace@example.org", clientIp: "2.2.2.2" }, f);
    const init = (f.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>)["x-forwarded-for"]).toBe("2.2.2.2");
  });
  it("posts the trimmed email with the Turnstile token and honeypot", async () => {
    const f = reply(202);
    const res = await submitSignup("http://api.test/", { email: " grace@example.org ", turnstileToken: "tok", hp_url: "x" }, f);
    expect(res).toEqual({ ok: true });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://api.test/subscribers");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ email: "grace@example.org", turnstileToken: "tok", hp_url: "x" });
  });
  it("leaves out an empty token and honeypot", async () => {
    const f = reply(202);
    await submitSignup("http://api.test", { email: "grace@example.org", turnstileToken: "", hp_url: "" }, f);
    expect(JSON.parse(((f.mock.calls[0] as unknown as [string, RequestInit])[1]).body as string)).toEqual({ email: "grace@example.org" });
  });
  it("does not call the API for a bad address", async () => {
    const f = reply(202);
    expect(await submitSignup("http://api.test", { email: "nope" }, f)).toEqual({ ok: false, message: EMAIL_INVALID, status: 400 });
    expect(f).not.toHaveBeenCalled();
  });
  it("maps 400, 429 and other failures to messages", async () => {
    const input = { email: "grace@example.org" };
    expect(await submitSignup("http://api.test", input, reply(400))).toEqual({ ok: false, message: EMAIL_INVALID, status: 400 });
    expect(await submitSignup("http://api.test", input, reply(429))).toEqual({ ok: false, message: SIGNUP_RATE_LIMITED, status: 429 });
    expect(await submitSignup("http://api.test", input, reply(500))).toEqual({ ok: false, message: SIGNUP_FAILED, status: 502 });
  });
  it("fails on a network error or with no API url", async () => {
    const boom = vi.fn(async () => { throw new Error("down"); });
    expect(await submitSignup("http://api.test", { email: "grace@example.org" }, boom)).toEqual({ ok: false, message: SIGNUP_FAILED, status: 502 });
    expect(await submitSignup(undefined, { email: "grace@example.org" })).toEqual({ ok: false, message: SIGNUP_FAILED, status: 502 });
  });
});
