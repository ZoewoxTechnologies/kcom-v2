import { createMiddleware } from "hono/factory";
import { userRoles, type UserRole } from "@kcom/db";
import type { Auth } from "./auth.js";
import { HttpError } from "./errors.js";
import { can, type Permission } from "./permissions.js";

export type AuthedUser = { id: string; email: string; name: string; role: UserRole };
export type AuthEnv = { Variables: { user: AuthedUser } };

/**
 * Guards a route: 401 without a valid session, 403 when the user's role lacks
 * the permission. Sets `c.var.user` for the handler.
 */
export const requirePermission = (auth: Auth, permission: Permission) =>
  createMiddleware<AuthEnv>(async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) throw new HttpError(401, "unauthenticated", "sign in required");
    const { id, email, name } = session.user;
    const role = (session.user as { role?: string }).role;
    if (!userRoles.includes(role as UserRole) || !can(role as UserRole, permission)) {
      throw new HttpError(403, "forbidden", "you do not have permission to do this");
    }
    c.set("user", { id, email, name, role: role as UserRole });
    c.header("Cache-Control", "no-store");
    await next();
  });
