import { contactTopics, type ContactTopic } from "@kcom/db/contact-topics";

/** Shaped like the future settings API; replace `contactSettings` with that fetch when it lands. */
export interface ContactSettings {
  email: string | null;
  phone: string | null;
  address: string | null;
  social: { label: string; href: string }[];
}

export const contactSettings: ContactSettings = {
  email: "hello@example.org",
  phone: "+00 000 000 0000",
  address: "Sample Street, Sample City",
  social: [
    { label: "Facebook", href: "https://facebook.com" },
    { label: "YouTube", href: "https://youtube.com" },
  ],
};

export interface Row { label: string; value: string }

/** Contact rows with a value; empty list hides the block. */
export const contactRows = (s: ContactSettings): Row[] =>
  ([["Email", s.email], ["Phone / WhatsApp", s.phone], ["Address", s.address]] as [string, string | null][])
    .flatMap(([label, v]) => (v?.trim() ? [{ label, value: v.trim() }] : []));

const topicCopy: Record<ContactTopic, { label: string; message: string }> = {
  question: { label: "A question", message: "Your question" },
  prayer: { label: "A prayer request", message: "Your prayer request" },
  testimony: { label: "A testimony", message: "Your testimony" },
  invitation: { label: "Invitation to minister", message: "Your invitation" },
  other: { label: "Other", message: "Your message" },
};

/** Topics in display order; the values come from the shared DB list. */
export const topics = contactTopics.map((value) => ({ value, ...topicCopy[value] }));

export type Topic = ContactTopic;

export interface ContactInput { topic: string; name: string; email: string; message: string }
export type ContactErrors = Partial<Record<"topic" | "name" | "email" | "message", string>>;

export function validateContact(i: ContactInput): ContactErrors {
  const e: ContactErrors = {};
  if (!topics.some((t) => t.value === i.topic)) e.topic = "Choose what you are writing about.";
  if (!i.name.trim()) e.name = "Please enter your name.";
  if (!i.email.trim()) e.email = "Please enter your email address.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(i.email.trim())) e.email = "Please enter a full email address.";
  if (!i.message.trim()) e.message = "Please write a message.";
  return e;
}

export type ContactResult =
  | { ok: true }
  | { ok: false; fieldErrors: ContactErrors; message: string };

export const RATE_LIMITED = "You have sent several messages recently. Please try again later.";
export const VERIFY_FAILED = "We couldn't verify your submission. Please try again.";

/** Spam-protection fields sent with the message: the hidden honeypot and the reCAPTCHA v3 token. */
export interface SpamFields { website?: string; recaptchaToken?: string }

declare global {
  interface Window {
    grecaptcha?: { ready(cb: () => void): void; execute(siteKey: string, o: { action: string }): Promise<string> };
  }
}

let recaptchaLoad: Promise<void> | undefined;
const loadRecaptcha = (siteKey: string) =>
  (recaptchaLoad ??= new Promise<void>((resolve, reject) => {
    const el = document.createElement("script");
    el.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => { recaptchaLoad = undefined; reject(new Error("reCAPTCHA failed to load")); };
    document.head.append(el);
  }));

/** Invisible reCAPTCHA v3 token for `action`; undefined without a site key or when Google can't be reached (the API decides). */
export async function getRecaptchaToken(siteKey: string | undefined, action: string): Promise<string | undefined> {
  if (!siteKey) return undefined;
  try {
    await loadRecaptcha(siteKey);
    const g = window.grecaptcha!;
    await new Promise<void>((r) => g.ready(r));
    return await g.execute(siteKey, { action });
  } catch {
    return undefined;
  }
}

export const SEND_FAILED = "Sorry, your message could not be sent. Please try again in a moment.";

/** POST the message to the API. Only a 2xx response is `ok`; everything else, including network errors, is a failure. */
export async function submitContact(
  apiUrl: string | undefined,
  input: ContactInput,
  keepPrivate: boolean,
  spam: SpamFields = {},
  fetcher: typeof fetch = fetch,
): Promise<ContactResult> {
  const fail = (fieldErrors: ContactErrors = {}, message = SEND_FAILED): ContactResult => ({ ok: false, fieldErrors, message });
  if (!apiUrl) return fail();
  try {
    const res = await fetcher(`${apiUrl.replace(/\/+$/, "")}/contact`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        topic: input.topic,
        name: input.name.trim(),
        email: input.email.trim(),
        message: input.message.trim(),
        keepPrivate,
        ...(spam.website ? { website: spam.website } : {}),
        ...(spam.recaptchaToken ? { recaptchaToken: spam.recaptchaToken } : {}),
      }),
    });
    if (res.ok) return { ok: true };
    if (res.status === 400) {
      const data = (await res.json().catch(() => null)) as { error?: { details?: { path: string; message: string }[] } } | null;
      const fieldErrors: ContactErrors = {};
      for (const d of data?.error?.details ?? []) {
        if (d.path === "topic" || d.path === "name" || d.path === "email" || d.path === "message") fieldErrors[d.path] ??= d.message;
      }
      return fail(fieldErrors);
    }
    if (res.status === 429) return fail({}, RATE_LIMITED);
    if (res.status === 403) return fail({}, VERIFY_FAILED);
    return fail();
  } catch {
    return fail();
  }
}
