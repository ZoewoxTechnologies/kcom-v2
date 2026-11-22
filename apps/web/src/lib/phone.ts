import { parsePhoneNumberFromString } from "libphonenumber-js/min";

/** International format with spaces (+234 805 800 9879); unparseable input is shown as entered. */
export function formatPhone(raw: string): string {
  const value = raw.trim();
  return parsePhoneNumberFromString(value)?.formatInternational() ?? value;
}

/** `tel:` link target: digits and a leading plus only. */
export const phoneHref = (raw: string): string => `tel:${raw.replace(/[^\d+]/g, "")}`;
