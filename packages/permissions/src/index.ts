/** Roles and the permissions they grant, shared by the API and the admin UI. */
export const userRoles = ["admin", "editor"] as const;
export type UserRole = (typeof userRoles)[number];

/** Every guarded capability. Routes and menu items declare which of these they need. */
export const permissions = [
  "content:read",
  "content:write",
  "content:publish",
  "users:manage",
] as const;
export type Permission = (typeof permissions)[number];

/**
 * The one place that maps roles to permissions. Adding a role (for example a
 * draft-only author) means adding a key here and to `userRoles`.
 */
export const rolePermissions: Record<UserRole, readonly Permission[]> = {
  admin: permissions,
  editor: ["content:read", "content:write", "content:publish"],
};

export const can = (role: UserRole, permission: Permission) =>
  rolePermissions[role].includes(permission);
