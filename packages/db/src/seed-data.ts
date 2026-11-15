import { capsules, people, siteSettings, type RichText } from "./schema.js";
import type { CapsuleDb } from "./queries.js";
import { eq } from "drizzle-orm";

/** Minimal rich-text doc: one paragraph. */
const doc = (text: string): RichText => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

const SAMPLE_AUTHOR = "Sample Author";

/** Idempotent. Every capsule is clearly marked as a sample. */
export async function seed(db: CapsuleDb) {
  await db
    .insert(siteSettings)
    .values({
      id: 1,
      siteName: "Kingdom Capstone",
      tagline: "Sample tagline",
      copyrightText: "Sample copyright",
    })
    .onConflictDoNothing();

  let [author] = await db.select().from(people).where(eq(people.name, SAMPLE_AUTHOR));
  if (!author) {
    [author] = await db
      .insert(people)
      .values({ name: SAMPLE_AUTHOR, role: "Sample data" })
      .returning();
  }

  const samples = [1, 2, 3].map((n) => ({
    title: `[SAMPLE] Capstone Capsule ${n}`,
    slug: `sample-capsule-${n}`,
    date: `2026-01-0${n}`,
    scriptureRef: "Romans 12:1-2",
    scriptureText: doc("Sample scripture text."),
    body: doc(`This is sample capsule ${n}. Not real content.`),
    decrees: ["I decree this is sample data."],
    prayer: doc("Sample prayer."),
    authorId: author!.id,
    status: "published" as const,
  }));
  await db.insert(capsules).values(samples).onConflictDoNothing({ target: capsules.slug });
}
