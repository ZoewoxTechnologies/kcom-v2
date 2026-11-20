import { contactTopicLabels, contactTopics, type ContactTopic } from "@kcom/db/contact-topics";

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

export const SEND_FAILED = "Sorry, your message could not be sent. Please try again in a moment.";

/** POST the message to the API. Only a 2xx response is `ok`; everything else, including network errors, is a failure. */
export async function submitContact(
  apiUrl: string | undefined,
  input: ContactInput,
  keepPrivate: boolean,
  fetcher: typeof fetch = fetch,
): Promise<ContactResult> {
  const fail = (fieldErrors: ContactErrors = {}): ContactResult => ({ ok: false, fieldErrors, message: SEND_FAILED });
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
    return fail();
  } catch {
    return fail();
  }
}
