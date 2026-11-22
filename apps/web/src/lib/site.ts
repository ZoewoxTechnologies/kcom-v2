export const siteName = "Kingdom Capstone Outreach Ministries";

export function pageTitle(title?: string): string {
  return title ? `${title} | ${siteName}` : siteName;
}

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
    ],
  },
] as const;

/** Placeholders until the real social links are supplied. */
export const socialLinks = [
  { label: "Facebook", href: "#facebook-placeholder" },
  { label: "YouTube", href: "#youtube-placeholder" },
] as const;
