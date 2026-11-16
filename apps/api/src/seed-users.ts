import { randomBytes } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { accounts, createDb, users, type CapsuleDb, type UserRole } from "@kcom/db";

export type SeedUser = { email: string; role: UserRole; name?: string; password?: string };

/**
 * Creates a sign-in with the given role, or updates the role of an existing
 * one. An existing user's password only changes when one is passed.
 * Sign-up is disabled over HTTP, so this writes the rows directly.
 * Returns the password when it was generated, so the caller can show it once.
 */
export async function seedUser(
  db: CapsuleDb,
  { email, role, name, password }: SeedUser,
): Promise<{ email: string; generatedPassword?: string }> {
  if (password !== undefined && password.length < 12) {
    throw new Error("passwords must be at least 12 characters");
  }
  const normalized = email.trim().toLowerCase();
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(users).where(eq(users.email, normalized));
    if (existing) {
      await tx.update(users).set({ role }).where(eq(users.id, existing.id));
      if (password) {
        await tx
          .update(accounts)
          .set({ password: await hashPassword(password) })
          .where(eq(accounts.userId, existing.id));
      }
      return { email: normalized };
    }
    const generatedPassword = password ? undefined : randomBytes(18).toString("base64url");
    const userId = crypto.randomUUID();
    await tx.insert(users).values({
      id: userId,
      name: name ?? normalized.split("@")[0]!,
      email: normalized,
      emailVerified: true,
      role,
    });
    await tx.insert(accounts).values({
      id: crypto.randomUUID(),
      userId,
      accountId: userId,
      providerId: "credential",
      password: await hashPassword((password ?? generatedPassword)!),
    });
    return { email: normalized, generatedPassword };
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { ADMIN_EMAIL, ADMIN_PASSWORD, EDITOR_EMAIL, EDITOR_PASSWORD } = process.env;
  if (!ADMIN_EMAIL || !EDITOR_EMAIL) {
    console.error(
      "Set ADMIN_EMAIL and EDITOR_EMAIL (passwords optional: ADMIN_PASSWORD, EDITOR_PASSWORD).",
    );
    process.exit(1);
  }
  const db = createDb();
  const wanted: SeedUser[] = [
    { email: ADMIN_EMAIL, role: "admin", password: ADMIN_PASSWORD || undefined },
    {
      email: EDITOR_EMAIL,
      role: "editor",
      password: EDITOR_PASSWORD || undefined,
    },
  ];
  for (const user of wanted) {
    const { email, generatedPassword } = await seedUser(db, user);
    console.log(`${user.role}: ${email}`);
    if (generatedPassword) console.log(`  generated password (shown once): ${generatedPassword}`);
  }
  await db.pool.end();
}
