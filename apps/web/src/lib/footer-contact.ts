import { data } from "./data";
import type { ContactDetails } from "./data/types";
import { createTtlCache } from "./ttl-cache";

/** Contact details for the footer, kept in memory for a minute so the footer costs no request per page. */
export const footerContact = createTtlCache<ContactDetails>(() => data.contactDetails());
