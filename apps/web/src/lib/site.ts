export const siteName = "Kingdom Capstone";

export function pageTitle(title?: string): string {
  return title ? `${title} | ${siteName}` : siteName;
}
