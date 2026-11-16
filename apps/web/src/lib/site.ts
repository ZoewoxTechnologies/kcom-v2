export const siteName = "Kingdom Capstone Outreach Ministries";

export function pageTitle(title?: string): string {
  return title ? `${title} | ${siteName}` : siteName;
}

/** Top-level links only; dropdowns are added with the site navigation. */
export const navLinks = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Capstone Capsules", href: "/capsules" },
  { label: "Blog", href: "/blog" },
  { label: "Events", href: "/events" },
  { label: "Books", href: "/books" },
  { label: "Partner With Us", href: "/partner" },
  { label: "Contact", href: "/contact" },
] as const;

export const footerColumns = [
  {
    heading: "Read",
    links: [
      { label: "Today’s Capsule", href: "/capsules/today" },
      { label: "Archive", href: "/capsules" },
      { label: "Blog", href: "/blog" },
      { label: "Events", href: "/events" },
    ],
  },
  {
    heading: "Ministry",
    links: [
      { label: "About", href: "/about" },
      { label: "Partner With Us", href: "/partner" },
      { label: "Contact", href: "/contact" },
    ],
  },
] as const;

/** Placeholders until the real social links are supplied. */
export const socialLinks = [
  { label: "Facebook", href: "#facebook-placeholder" },
  { label: "YouTube", href: "#youtube-placeholder" },
] as const;

/** Placeholder until the real contact details are supplied. */
export const contactPlaceholder = "Contact details coming soon";
