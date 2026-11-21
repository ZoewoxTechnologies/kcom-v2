import { describe, expect, it } from "vitest";
import { can, permissions, rolePermissions, userRoles, type UserRole } from "./index";

describe("permissions", () => {
  it("maps exactly the known roles", () => {
    expect(Object.keys(rolePermissions).sort()).toEqual([...userRoles].sort());
  });
  it("gives admin everything and editor no user management", () => {
    for (const p of permissions) expect(can("admin", p)).toBe(true);
    expect(can("editor", "users:manage")).toBe(false);
    expect(can("editor", "content:write")).toBe(true);
  });
  it("lets editors and admins read the inbox, including private prayer requests", () => {
    expect(can("editor", "inbox:read")).toBe(true);
    expect(can("editor", "prayer:read")).toBe(true);
    expect(can("admin", "prayer:read")).toBe(true);
  });
  it("keeps the subscriber export to admins", () => {
    expect(can("admin", "subscribers:export")).toBe(true);
    expect(can("editor", "subscribers:export")).toBe(false);
  });
  it("fails closed for anything that is not a known role", () => {
    for (const bad of ["owner", "", undefined, null, "toString", "__proto__", "constructor"]) {
      for (const p of permissions) expect(can(bad as unknown as UserRole, p)).toBe(false);
    }
  });
});
