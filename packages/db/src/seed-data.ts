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

  const [author] = await db.select().from(people).where(eq(people.name, SAMPLE_AUTHOR));
  if (!author) {
    await db.insert(people).values({ name: SAMPLE_AUTHOR, role: "Sample data" });
  }

  const samples = [1, 2, 3].map((n) => ({
    title: `[SAMPLE] Capstone Capsule ${n}`,
    slug: `sample-capsule-${n}`,
    publishAt: new Date(`2026-01-0${n}T00:00:00+01:00`),
    scriptureRef: "Romans 12:1-2",
    scriptureText: doc("Sample scripture text."),
    body: doc(`This is sample capsule ${n}. Not real content.`),
    decrees: ["I decree this is sample data."],
    prayer: doc("Sample prayer."),
    authorSource: SAMPLE_AUTHOR,
    bibleMeditation: "Romans 12:1-2",
    status: "published" as const,
  }));
  await db.insert(capsules).values(samples).onConflictDoNothing({ target: capsules.slug });
}
