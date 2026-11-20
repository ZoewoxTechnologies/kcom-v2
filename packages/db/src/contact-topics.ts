/** Single source for contact topics: DB enum, API validation and the web form. No imports, safe for browsers. */
export const contactTopics = ["question", "prayer", "testimony", "invitation", "other"] as const;
export type ContactTopic = (typeof contactTopics)[number];
