import { describe, expect, it } from "vitest";
import { can, permissions, rolePermissions, userRoles } from "./index";

describe("permissions", () => {
  it("maps exactly the known roles", () => {
    expect(Object.keys(rolePermissions).sort()).toEqual([...userRoles].sort());
  });
  it("gives admin everything and editor no user management", () => {
    for (const p of permissions) expect(can("admin", p)).toBe(true);
    expect(can("editor", "users:manage")).toBe(false);
    expect(can("editor", "content:write")).toBe(true);
  });
});
