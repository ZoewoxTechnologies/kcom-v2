import type { Role } from "../auth/api";

export interface NavItem {
  label: string;
  path: string;
  /** Roles allowed to see and open the page. */
  roles: readonly Role[];
}

const everyone: readonly Role[] = ["admin", "editor"];

export const navItems: readonly NavItem[] = [
  { label: "Dashboard", path: "/", roles: everyone },
  { label: "Capsules", path: "/capsules", roles: everyone },
  { label: "Calendar", path: "/calendar", roles: everyone },
  { label: "Blog", path: "/blog", roles: everyone },
  { label: "Homepage", path: "/homepage", roles: everyone },
  { label: "Events", path: "/events", roles: everyone },
  { label: "Books", path: "/books", roles: everyone },
  { label: "Subscribers", path: "/subscribers", roles: everyone },
  { label: "Users", path: "/users", roles: ["admin"] },
  { label: "Settings", path: "/settings", roles: ["admin"] },
];

export const navFor = (role: Role) => navItems.filter((item) => item.roles.includes(role));
