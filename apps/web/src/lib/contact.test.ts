import { describe, expect, it, vi } from "vitest";
import { RATE_LIMITED, contactRows, contactSettings, submitContact, validateContact } from "./contact";

const ok = { topic: "prayer", name: "Grace", email: "grace@example.org", message: "Hi" };

describe("contact", () => {
  it("drops blank contact values", () => {
    expect(contactRows(contactSettings).map((r) => r.label)).toEqual(["Email", "Phone / WhatsApp", "Address"]);
    expect(contactRows({ email: " ", phone: null, address: null, social: [] })).toEqual([]);
  });
  it("accepts a complete message", () => expect(validateContact(ok)).toEqual({}));
  it("requires a topic", () => {
    expect(validateContact({ ...ok, topic: "" }).topic).toMatch(/Choose/);
    expect(validateContact({ ...ok, topic: "other" })).toEqual({});
  });
  it("flags each problem", () => {
    expect(Object.keys(validateContact({ topic: "", name: " ", email: "grace@", message: "" }))).toEqual(["topic", "name", "email", "message"]);
    expect(validateContact({ ...ok, email: "" }).email).toMatch(/enter your email/);
  });
});

describe("submitContact", () => {
  const input = { topic: "prayer", name: " Grace ", email: "grace@example.org", message: " Hi " };
  const reply = (status: number, body: unknown = {}) =>
    vi.fn(async () => new Response(JSON.stringify(body), { status }));

  it("posts the trimmed values and succeeds on 201", async () => {
    const f = reply(201, { id: "1" });
    expect(await submitContact("http://api.test/", input, true, {}, f)).toEqual({ ok: true });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://api.test/contact");
    expect(JSON.parse(init.body as string)).toEqual({ topic: "prayer", name: "Grace", email: "grace@example.org", message: "Hi", keepPrivate: true });
  });
  it("sends the honeypot only when filled", async () => {
    const f = reply(201);
    await submitContact("http://api.test", input, false, { website: "spam"}, f);
    const [, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({ website: "spam"});
  });
  it("explains rate limiting", async () => {
    expect(await submitContact("http://api.test", input, false, {}, reply(429))).toMatchObject({ ok: false, message: RATE_LIMITED });
  });
  it("fails on a server error", async () => {
    expect(await submitContact("http://api.test", input, false, {}, reply(500))).toMatchObject({ ok: false });
  });
  it("surfaces field errors from a 400", async () => {
    const f = reply(400, { error: { details: [{ path: "email", message: "Bad email" }] } });
    expect(await submitContact("http://api.test", input, false, {}, f)).toMatchObject({ ok: false, fieldErrors: { email: "Bad email" } });
  });
  it("fails when the network throws", async () => {
    const f = vi.fn(async () => { throw new TypeError("offline"); });
    expect(await submitContact("http://api.test", input, false, {}, f)).toMatchObject({ ok: false });
  });
  it("fails without an API url, never posting", async () => {
    const f = reply(201);
    expect(await submitContact(undefined, input, false, {}, f)).toMatchObject({ ok: false });
    expect(f).not.toHaveBeenCalled();
  });
});
