/** Roles and the permissions they grant, shared by the API and the admin UI. */
export const userRoles = ["admin", "editor"] as const;
export type UserRole = (typeof userRoles)[number];

/**
 * Every guarded capability. `inbox:read` opens contact messages; `prayer:read`
 * additionally shows the ones senders marked private. Editors and admins both have it for now; a narrower prayer-team role comes later.
 * Routes and menu items declare which of these they need.
 */
export const permissions = [
  "content:read",
  "content:write",
  "content:publish",
  "users:manage",
  "settings:manage",
  "inbox:read",
  "prayer:read",
] as const;
export type Permission = (typeof permissions)[number];

/**
 * The one place that maps roles to permissions. Adding a role (for example a
 * draft-only author) means adding a key here and to `userRoles`.
 */
export const rolePermissions: Record<UserRole, readonly Permission[]> = {
  admin: permissions,
  editor: ["content:read", "content:write", "content:publish", "inbox:read", "prayer:read"],
};

/** Fails closed: an unknown, empty or missing role is granted nothing. */
export const can = (role: UserRole, permission: Permission): boolean =>
  typeof role === "string" && Object.hasOwn(rolePermissions, role)
    ? rolePermissions[role].includes(permission)
    : false;
