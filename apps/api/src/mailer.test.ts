import { beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

const { createResendMailer, mailerFromEnv, noopMailer } = await import("./mailer.js");

const to = { email: "a@example.test", name: "Ada" };

beforeEach(() => {
  send.mockReset().mockResolvedValue({ data: { id: "1" }, error: null });
});

describe("resend mailer", () => {
  it("sends the password reset link", async () => {
    await createResendMailer({ apiKey: "k", from: "Site <hi@example.test>" }).sendPasswordReset(
      to,
      "http://x/reset",
    );
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Site <hi@example.test>",
        to: "a@example.test",
        subject: "Reset your password",
        text: expect.stringContaining("http://x/reset"),
      }),
    );
  });

  it("sends the invite with its own subject", async () => {
    await createResendMailer({ apiKey: "k", from: "Site <hi@example.test>" }).sendInvite(
      to,
      "http://x/set",
    );
    expect(send.mock.calls[0]![0].subject).toMatch(/invited/);
  });

  it("alerts the notification address and escapes the message", async () => {
    await createResendMailer({
      apiKey: "k",
      contactNotificationEmail: "team@example.test",
    }).sendContactAlert({
      topic: "prayer",
      name: "Bo",
      email: "bo@example.test",
      message: "<b>hi</b>",
    });
    const msg = send.mock.calls[0]![0];
    expect(msg).toMatchObject({ to: "team@example.test", replyTo: "bo@example.test" });
    expect(msg.html).toContain("&#60;b&#62;hi");
    expect(msg.html).not.toContain("<b>hi");
  });

  it("skips the contact alert without a notification address", async () => {
    await createResendMailer({ apiKey: "k", from: "Site <hi@example.test>" }).sendContactAlert({
      topic: "t",
      name: "n",
      email: "e@example.test",
      message: "m",
    });
    expect(send).not.toHaveBeenCalled();
  });

  it("throws when Resend reports an error", async () => {
    send.mockResolvedValue({ data: null, error: { message: "bad" } });
    await expect(
      createResendMailer({ apiKey: "k", from: "Site <hi@example.test>" }).sendInvite(to, "u"),
    ).rejects.toThrow("bad");
  });

  it("falls back to the no-op mailer without an API key", () => {
    expect(mailerFromEnv({})).toBe(noopMailer);
    expect(mailerFromEnv({ RESEND_API_KEY: "k", EMAIL_FROM: "a@example.test" })).not.toBe(
      noopMailer,
    );
  });

  it("refuses to start with an API key but no sender", () => {
    expect(() => mailerFromEnv({ RESEND_API_KEY: "k" })).toThrow(/EMAIL_FROM/);
  });
});
