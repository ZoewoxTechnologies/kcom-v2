import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { and, eq, isNotNull } from "drizzle-orm";
import { CLIENT_IP_HEADER } from "./client-ip.js";
import { noopMailer, type Mailer } from "./mailer.js";
import { accounts, rateLimits, sessions, users, verifications, type CapsuleDb } from "@kcom/db";

export type { Mailer } from "./mailer.js";

export type AuthOptions = {
  /** Signs cookies and tokens. At least 32 chars. */
  secret?: string;
  /** Public URL of this API, including scheme. */
  baseURL?: string;
  /** Origins (admin UI) allowed to call auth endpoints with credentials. */
  trustedOrigins?: string[];
  mailer?: Mailer;
  cookies?: {
    /** Marks cookies Secure. Keep true outside local http development. */
    secure?: boolean;
    /**
     * Set when admin and API are subdomains of one registrable domain
     * (e.g. ".example.org"): cookies become SameSite=Lax. Leave unset when they
     * are on unrelated sites: cookies become SameSite=None, which needs Secure.
     */
    domain?: string;
  };
};

export const SESSION_DAYS = 7;

export function createAuth(db: CapsuleDb, opts: AuthOptions = {}) {
  const { secure = true, domain } = opts.cookies ?? {};
  const mailer = opts.mailer ?? noopMailer;
  return betterAuth({
    secret: opts.secret ?? process.env.BETTER_AUTH_SECRET,
    baseURL: opts.baseURL ?? process.env.BETTER_AUTH_URL,
    basePath: "/api/auth",
    trustedOrigins: opts.trustedOrigins ?? [],
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: users,
        session: sessions,
        account: accounts,
        verification: verifications,
        rateLimit: rateLimits,
      },
    }),
    user: {
      // Read-only to clients: only the seed script and admin tools assign roles.
      additionalFields: { role: { type: "string", required: false, input: false } },
    },
    databaseHooks: {
      session: {
        create: {
          // Deactivated users cannot start a session, whatever their password.
          before: async (session) => {
            const [user] = await db
              .select({ deactivatedAt: users.deactivatedAt })
              .from(users)
              .where(eq(users.id, session.userId));
            if (user?.deactivatedAt)
              throw new APIError("FORBIDDEN", { message: "account deactivated" });
          },
        },
      },
    },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      // A user with no password yet was invited by an admin and gets the invite wording.
      sendResetPassword: async ({ user, url }) => {
        const [hasPassword] = await db
          .select({ id: accounts.id })
          .from(accounts)
          .where(and(eq(accounts.userId, user.id), isNotNull(accounts.password)))
          .limit(1);
        await (hasPassword ? mailer.sendPasswordReset(user, url) : mailer.sendInvite(user, url));
      },
    },
    session: { expiresIn: 60 * 60 * 24 * SESSION_DAYS },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/email": { window: 15 * 60, max: 5 },
        "/request-password-reset": { window: 60 * 60, max: 5 },
        "/reset-password": { window: 15 * 60, max: 10 },
      },
    },
    advanced: {
      useSecureCookies: secure,
      ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
      defaultCookieAttributes: {
        httpOnly: true,
        secure,
        sameSite: domain ? "lax" : secure ? "none" : "lax",
      },
      ...(domain ? { crossSubDomainCookies: { enabled: true, domain } } : {}),
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
