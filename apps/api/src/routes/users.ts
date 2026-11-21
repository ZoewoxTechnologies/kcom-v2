import { Hono } from "hono";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { userRoles, users, sessions, type CapsuleDb, type UserRole } from "@kcom/db";
import type { Auth } from "../auth.js";
import { HttpError } from "../errors.js";
import { requirePermission, type AuthEnv } from "../require-permission.js";
import { rethrowWriteError } from "../content/write-errors.js";
import { validate } from "../validate.js";

const columns = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  deactivatedAt: users.deactivatedAt,
  createdAt: users.createdAt,
};

const inviteBody = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  name: z.string().trim().min(1).max(120).optional(),
  role: z.enum(userRoles),
});
const roleBody = z.object({ role: z.enum(userRoles) });
const idParam = z.object({ id: z.string().min(1) });

type Tx = Parameters<Parameters<CapsuleDb["transaction"]>[0]>[0];

/**
 * Loads the user and, when the change would leave no active admin, refuses it.
 * Active admins are locked first so two concurrent demotions cannot both pass.
 */
async function loadGuardingLastAdmin(
  tx: Tx,
  id: string,
  removesAdmin: (u: { role: UserRole }) => boolean,
) {
  const admins = await tx
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "admin"), isNull(users.deactivatedAt)))
    .for("update");
  const [user] = await tx.select(columns).from(users).where(eq(users.id, id));
  if (!user) throw new HttpError(404, "not_found", "user not found");
  const isActiveAdmin = user.role === "admin" && !user.deactivatedAt;
  if (isActiveAdmin && removesAdmin(user) && admins.length <= 1) {
    throw new HttpError(
      409,
      "last_admin",
      "the last active admin cannot be demoted or deactivated",
    );
  }
  return user;
}

/** Admin-only user management. Behind `users:manage`. */
export function userRoutes(db: CapsuleDb, auth: Auth) {
  return new Hono<AuthEnv>()
    .use(requirePermission(auth, "users:manage"))
    .get("/", async (c) => c.json(await db.select(columns).from(users).orderBy(users.email)))
    .post("/", validate("json", inviteBody), async (c) => {
      const { email, name, role } = c.req.valid("json");
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email));
      if (existing)
        throw new HttpError(409, "email_taken", "a user with this email already exists");
      const created = await db
        .insert(users)
        .values({
          id: crypto.randomUUID(),
          name: name ?? email.split("@")[0]!,
          email,
          emailVerified: true,
          role,
        })
        .returning(columns)
        .then(([row]) => row!)
        .catch((err) => rethrowWriteError(err, { label: "user with this email" }));
      // The invitee sets a password through the password-reset flow. Delivery
      // goes through the auth Mailer (see `sendPasswordReset`), so wiring an
      // email provider needs no change here. A delivery failure must not undo
      // the invite: the user exists and the admin can resend.
      try {
        await auth.api.requestPasswordReset({ body: { email } });
      } catch (err) {
        console.error("invite link could not be sent:", err);
      }
      return c.json(created, 201);
    })
    .post("/:id/resend-invite", validate("param", idParam), async (c) => {
      const { id } = c.req.valid("param");
      const [user] = await db.select(columns).from(users).where(eq(users.id, id));
      if (!user) throw new HttpError(404, "not_found", "user not found");
      if (user.deactivatedAt) throw new HttpError(409, "deactivated", "user is deactivated");
      try {
        await auth.api.requestPasswordReset({ body: { email: user.email } });
      } catch (err) {
        console.error("invite link could not be sent:", err);
        throw new HttpError(503, "mail_unavailable", "the invite could not be sent, try again");
      }
      return c.body(null, 204);
    })
    .patch("/:id", validate("param", idParam), validate("json", roleBody), async (c) => {
      const { id } = c.req.valid("param");
      const { role } = c.req.valid("json");
      const updated = await db.transaction(async (tx) => {
        await loadGuardingLastAdmin(tx, id, () => role !== "admin");
        const [row] = await tx
          .update(users)
          .set({ role, updatedAt: new Date() })
          .where(eq(users.id, id))
          .returning(columns);
        return row!;
      });
      return c.json(updated);
    })
    .post("/:id/deactivate", validate("param", idParam), async (c) => {
      const { id } = c.req.valid("param");
      const updated = await db.transaction(async (tx) => {
        await loadGuardingLastAdmin(tx, id, () => true);
        await tx.delete(sessions).where(eq(sessions.userId, id));
        const [row] = await tx
          .update(users)
          .set({ deactivatedAt: new Date(), updatedAt: new Date() })
          .where(eq(users.id, id))
          .returning(columns);
        return row!;
      });
      return c.json(updated);
    })
    .post("/:id/reactivate", validate("param", idParam), async (c) => {
      const { id } = c.req.valid("param");
      const [row] = await db
        .update(users)
        .set({ deactivatedAt: null, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning(columns);
      if (!row) throw new HttpError(404, "not_found", "user not found");
      return c.json(row);
    });
}
