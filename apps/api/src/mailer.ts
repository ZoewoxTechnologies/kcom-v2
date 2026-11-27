import { Resend } from "resend";

type Recipient = { email: string; name: string };

export type ContactAlert = {
  topic: string;
  name: string;
  email: string;
  message: string;
};

/** Delivers the site's transactional email. */
export type Mailer = {
  /** Reset link for a user who already has a password. */
  sendPasswordReset(to: Recipient, url: string): Promise<void>;
  /** Link for a user invited by an admin, who sets a first password with it. */
  sendInvite(to: Recipient, url: string): Promise<void>;
  /** Tells the team a contact message arrived. Does nothing without a notification address. */
  sendContactAlert(message: ContactAlert): Promise<void>;
};

/** Drops the message: links are bearer tokens and must not land in logs. */
export const noopMailer: Mailer = {
  async sendPasswordReset() {
    console.warn("password reset requested but no mailer is configured");
  },
  async sendInvite() {
    console.warn("invite requested but no mailer is configured");
  },
  async sendContactAlert() {},
};

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

/** Test sender that Resend accepts before a domain is verified. */
const DEFAULT_FROM = "Kingdom Capstone Outreach Ministries <onboarding@resend.dev>";

export type ResendMailerOptions = {
  apiKey: string;
  from?: string;
  /** Where contact message alerts go. Unset disables them. */
  contactNotificationEmail?: string;
};

export function createResendMailer({
  apiKey,
  from = DEFAULT_FROM,
  contactNotificationEmail,
}: ResendMailerOptions): Mailer {
  const resend = new Resend(apiKey);
  async function send(msg: {
    to: string;
    subject: string;
    text: string;
    html: string;
    replyTo?: string;
  }) {
    const { error } = await resend.emails.send({ from, ...msg });
    if (error) throw new Error(`email send failed: ${error.message}`);
  }
  const linkEmail = (to: Recipient, url: string, subject: string, intro: string) => {
    const name = to.name.trim() || "there";
    return send({
      to: to.email,
      subject,
      text: `Hello ${name},\n\n${intro}\n\n${url}\n\nIf you did not expect this email, you can ignore it.`,
      html: `<p>Hello ${escapeHtml(name)},</p><p>${escapeHtml(intro)}</p><p><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p><p>If you did not expect this email, you can ignore it.</p>`,
    });
  };
  return {
    sendPasswordReset: (to, url) =>
      linkEmail(
        to,
        url,
        "Reset your password",
        "Use the link below to choose a new password. It expires in one hour.",
      ),
    sendInvite: (to, url) =>
      linkEmail(
        to,
        url,
        "You have been invited to the admin site",
        "You have been invited to the Kingdom Capstone admin site. Use the link below to set your password.",
      ),
    async sendContactAlert(m) {
      if (!contactNotificationEmail) return;
      await send({
        to: contactNotificationEmail,
        replyTo: m.email,
        subject: `New contact message (${m.topic}) from ${m.name}`,
        text: `Topic: ${m.topic}\nFrom: ${m.name} <${m.email}>\n\n${m.message}`,
        html: `<p><strong>Topic:</strong> ${escapeHtml(m.topic)}<br><strong>From:</strong> ${escapeHtml(m.name)} &lt;${escapeHtml(m.email)}&gt;</p><p style="white-space:pre-wrap">${escapeHtml(m.message)}</p>`,
      });
    },
  };
}

/** Resend when RESEND_API_KEY is set, otherwise the no-op mailer (dev, tests). */
export function mailerFromEnv(env: NodeJS.ProcessEnv = process.env): Mailer {
  if (!env.RESEND_API_KEY) return noopMailer;
  return createResendMailer({
    apiKey: env.RESEND_API_KEY,
    from: env.EMAIL_FROM || undefined,
    contactNotificationEmail: env.CONTACT_NOTIFICATION_EMAIL || undefined,
  });
}
