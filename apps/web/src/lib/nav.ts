export interface NavItem {
  label: string;
  href: string;
  /** Dropdown entries; the parent href is where the label itself links on phone. */
  children?: readonly { label: string; href: string }[];
}

/** Gallery is intentionally absent. */
export const navItems: readonly NavItem[] = [
  { label: "Home", href: "/" },
  {
    label: "About",
    href: "/about",
    children: [
      { label: "Who We Are", href: "/about" },
      { label: "Ministry Team", href: "/about/team" },
      { label: "Ministry Arms", href: "/about/arms" },
      { label: "Mandate and Message", href: "/about/mandate" },
      { label: "Vision and Mission", href: "/about/vision" },
    ],
  },
  {
    label: "Capstone Capsules",
    href: "/capsules",
    children: [
      { label: "Today’s Capsule", href: "/capsules/today" },
      { label: "Browse by month", href: "/capsules" },
      { label: "Browse by series", href: "/series" },
    ],
  },
  { label: "Blog", href: "/blog" },
  { label: "Events", href: "/events" },
  { label: "Books", href: "/books" },
  { label: "Partner With Us", href: "/partner" },
  { label: "Contact", href: "/contact" },
];

/** True when the item or one of its children is the current page. */
export function isCurrent(item: NavItem, path: string): boolean {
  const norm = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : p);
  const cur = norm(path);
  if (item.href === "/") return cur === "/";
  return [item.href, ...(item.children?.map((c) => c.href) ?? [])].some(
    (h) => cur === norm(h) || cur.startsWith(`${norm(h)}/`),
  );
}
