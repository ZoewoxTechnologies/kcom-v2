import type { ContactDetails } from "./data/types";
import { formatPhone, phoneHref } from "./phone";
import { contactTopicLabels, contactTopics, type ContactTopic } from "@kcom/db/contact-topics";

export interface Row {
  label: string;
  value: string;
  /** mailto: or tel: target; absent for plain text. */
  href?: string;
}

/** Contact rows with a value, in display order; an empty list hides the card. */
export function contactRows(d: ContactDetails | null): Row[] {
  const email = d?.email?.trim();
  const phone = d?.phone?.trim();
  const address = d?.address?.trim();
  return [
    ...(email ? [{ label: "Email", value: email, href: `mailto:${email}` }] : []),
    ...(phone
      ? [{ label: "Phone / WhatsApp", value: formatPhone(phone), href: phoneHref(phone) }]
      : []),
    ...(address ? [{ label: "Address", value: address }] : []),
  ];
}

const topicMessage: Record<ContactTopic, string> = {
  question: "Your question",
  prayer: "Your prayer request",
  testimony: "Your testimony",
  invitation: "Your invitation",
  other: "Your message",
};

/** Topics in display order; values and labels come from the shared DB list. */
export const topics = contactTopics.map((value) => ({
  value,
  label: contactTopicLabels[value],
  message: topicMessage[value],
}));

export type Topic = ContactTopic;

export interface ContactInput {
  topic: string;
  name: string;
  email: string;
  message: string;
}
export type ContactErrors = Partial<Record<"topic" | "name" | "email" | "message", string>>;

export function validateContact(i: ContactInput): ContactErrors {
  const e: ContactErrors = {};
  if (!topics.some((t) => t.value === i.topic)) e.topic = "Choose what you are writing about.";
  if (!i.name.trim()) e.name = "Please enter your name.";
  if (!i.email.trim()) e.email = "Please enter your email address.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(i.email.trim()))
    e.email = "Please enter a full email address.";
  if (!i.message.trim()) e.message = "Please write a message.";
  return e;
}

export type ContactResult =
  { ok: true } | { ok: false; fieldErrors: ContactErrors; message: string };

export const RATE_LIMITED = "You have sent several messages recently. Please try again later.";
/** Spam-protection fields sent with the message: the hidden honeypot and the Turnstile token. */
export interface SpamFields {
  hp_url?: string;
  botToken?: string;
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
  const fail = (fieldErrors: ContactErrors = {}, message = SEND_FAILED): ContactResult => ({
    ok: false,
    fieldErrors,
    message,
  });
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
        ...(spam.hp_url ? { hp_url: spam.hp_url } : {}),
        ...(spam.botToken ? { botToken: spam.botToken } : {}),
      }),
    });
    if (res.ok) return { ok: true };
    if (res.status === 400) {
      const data = (await res.json().catch(() => null)) as {
        error?: { details?: { path: string; message: string }[] };
      } | null;
      const fieldErrors: ContactErrors = {};
      for (const d of data?.error?.details ?? []) {
        if (d.path === "topic" || d.path === "name" || d.path === "email" || d.path === "message")
          fieldErrors[d.path] ??= d.message;
      }
      return fail(fieldErrors);
    }
    if (res.status === 429) return fail({}, RATE_LIMITED);
    return fail();
  } catch {
    return fail();
  }
}
