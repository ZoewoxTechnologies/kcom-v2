import { Hono } from "hono";
import { users, type CapsuleDb } from "@kcom/db";
import type { Auth } from "../auth.js";
import { requirePermission, type AuthEnv } from "../require-permission.js";

export function userRoutes(db: CapsuleDb, auth: Auth) {
  return new Hono<AuthEnv>().get("/", requirePermission(auth, "users:manage"), async (c) => {
    const rows = await db
      .select({ id: users.id, name: users.name, email: users.email, role: users.role })
      .from(users)
      .orderBy(users.email);
    return c.json(rows);
  });
}
