import { can } from "@kcom/permissions";
import type { Permission, UserRole } from "@kcom/permissions";

export interface NavItem {
  label: string;
  path: string;
  /** Permission needed to see and open the page. */
  permission: Permission;
}

export const navItems: readonly NavItem[] = [
  { label: "Dashboard", path: "/", permission: "content:read" },
  { label: "Capsules", path: "/capsules", permission: "content:read" },
  { label: "Calendar", path: "/calendar", permission: "content:read" },
  { label: "Homepage", path: "/homepage", permission: "content:read" },
  { label: "Blog", path: "/blog", permission: "content:read" },
  { label: "Events", path: "/events", permission: "content:read" },
  { label: "Books", path: "/books", permission: "content:read" },
  { label: "Inbox", path: "/inbox", permission: "inbox:read" },
  { label: "Subscribers", path: "/subscribers", permission: "content:read" },
  { label: "Users", path: "/users", permission: "users:manage" },
  { label: "Settings", path: "/settings", permission: "users:manage" },
];

export const navFor = (role: UserRole) => navItems.filter((item) => can(role, item.permission));

/** The nav item whose path is this pathname or a parent of it. */
export const navItemFor = (pathname: string) =>
  navItems.find((i) =>
    i.path === "/" ? pathname === "/" : pathname === i.path || pathname.startsWith(`${i.path}/`),
  );
