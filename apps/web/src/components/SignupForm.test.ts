import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import SignupForm from "./SignupForm.astro";
import SignupState from "./SignupState.astro";
import CheckInbox from "../pages/subscribe/check-inbox.astro";
import Confirmed from "../pages/subscribe/confirmed.astro";
import Expired from "../pages/subscribe/expired.astro";
import Unsubscribed from "../pages/subscribe/unsubscribed.astro";

describe("SignupForm", () => {
  it("posts an email field and a hidden honeypot to /subscribe", async () => {
    const html = await (await AstroContainer.create()).renderToString(SignupForm, { props: { id: "e1" } });
    expect(html).toContain('action="/subscribe"');
    expect(html).toContain('method="post"');
    expect(html).toMatch(/<label[^>]*for="e1"/);
    expect(html).toContain('name="email"');
    expect(html).toContain('name="hp_url"');
    expect(html).not.toContain("disabled");
    expect(html).not.toContain("coming soon");
  });
  it("shows an error tied to the input and keeps the typed value", async () => {
    const html = await (await AstroContainer.create()).renderToString(SignupForm, { props: { id: "e1", value: "grace@", error: "Please enter a full email address." } });
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="e1-error"');
    expect(html).toContain('value="grace@"');
    expect(html).toContain("Please enter a full email address.");
  });
});

describe("signup state pages", () => {
  const render = async (page: Parameters<AstroContainer["renderToString"]>[0], cookie?: string) =>
    (await AstroContainer.create()).renderToString(page, { request: new Request("http://localhost/subscribe/x", { headers: cookie ? { cookie } : {} }) });

  it("card renders its heading and text", async () => {
    const html = await (await AstroContainer.create()).renderToString(SignupState, { props: { title: "Hi", icon: "✓" }, slots: { default: "Body" } });
    expect(html).toContain("<h1");
    expect(html).toContain("Body");
  });
  it("check-inbox names the address from the cookie and offers a resend", async () => {
    const html = await render(CheckInbox, "kc_signup_email=grace%40example.org");
    expect(html).toContain("Check your inbox");
    expect(html).toContain("grace@example.org");
    expect(html).toContain("send it again");
  });
  it("check-inbox without a cookie sends the reader back to the form", async () => {
    const html = await render(CheckInbox);
    expect(html).toContain('href="/subscribe"');
  });
  it("confirmed links to today's capsule", async () => {
    const html = await render(Confirmed);
    expect(html).toContain("You’re subscribed");
    expect(html).toContain('href="/capsules/today"');
  });
  it("expired offers a fresh link by email", async () => {
    const html = await render(Expired);
    expect(html).toContain("This link has expired");
    expect(html).toContain('action="/subscribe"');
    expect(html).toContain("Resend");
  });
  it("unsubscribed offers to subscribe again", async () => {
    const html = await render(Unsubscribed);
    expect(html).toContain("You’ve been unsubscribed");
    expect(html).toContain("Subscribe again");
  });
});
