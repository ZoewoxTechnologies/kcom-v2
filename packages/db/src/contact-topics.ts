/** Single source for contact topics: DB enum, API validation and the web form. No imports, safe for browsers. */
export const contactTopics = ["question", "prayer", "testimony", "invitation", "other"] as const;
export type ContactTopic = (typeof contactTopics)[number];

/** Display name of each topic, shared by the web form and the admin inbox. */
export const contactTopicLabels: Record<ContactTopic, string> = {
  question: "A question",
  prayer: "A prayer request",
  testimony: "A testimony",
  invitation: "Invitation to minister",
  other: "Other",
};
