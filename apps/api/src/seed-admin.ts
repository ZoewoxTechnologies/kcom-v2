import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { accounts, createDb, users, type CapsuleDb } from "@kcom/db";

/**
 * Creates the first admin sign-in, or resets its password if the email exists.
 * Sign-up is disabled over HTTP, so this writes the rows directly.
 */
export async function seedAdmin(
  db: CapsuleDb,
  { email, password, name = "Admin" }: { email: string; password: string; name?: string },
) {
  if (password.length < 12) throw new Error("ADMIN_PASSWORD must be at least 12 characters");
  const hash = await hashPassword(password);
  const normalized = email.trim().toLowerCase();
  await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(users).where(eq(users.email, normalized));
    const userId = existing?.id ?? crypto.randomUUID();
    if (!existing) {
      await tx.insert(users).values({ id: userId, name, email: normalized, emailVerified: true });
      await tx.insert(accounts).values({
        id: crypto.randomUUID(),
        userId,
        accountId: userId,
        providerId: "credential",
        password: hash,
      });
    } else {
      await tx
        .update(accounts)
        .set({ password: hash })
        .where(eq(accounts.userId, userId));
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD (and optionally ADMIN_NAME).");
    process.exit(1);
  }
  const db = createDb();
  await seedAdmin(db, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, name: ADMIN_NAME });
  console.log(`Admin ready: ${ADMIN_EMAIL.trim().toLowerCase()}`);
  await db.pool.end();
}
