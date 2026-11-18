import type { BlogPost } from "./types";

const p = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
const h = (text: string) => ({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text }] });
const li = (text: string) => ({ type: "listItem", content: [p(text)] });
const doc = (...content: unknown[]) => ({ type: "doc", content });

const make = (slug: string, title: string, date: string, tags: string[], excerpt: string, extra: Partial<BlogPost> = {}): BlogPost => ({
  slug,
  title,
  date,
  excerpt,
  heroImageUrl: null,
  tags,
  body: doc(p(excerpt), p("Sample text for layout purposes. Line length is held near seventy characters for comfortable reading.")),
  ...extra,
});

export const sampleBlogPosts: BlogPost[] = [
  make("2026-year-of-divine-acceleration", "2026: The Year of Divine Acceleration", "2026-01-01", ["New Year Message", "Prophetic"],
    "As we step into this new year, the Spirit of the Lord is calling His people to rise and run with the vision He has given.",
    {
      body: doc(
        p("As we step into this new year, the Spirit of the Lord is calling His people to rise and run with the vision He has given."),
        { type: "blockquote", content: [p("Write the vision, and make it plain upon tables, that he may run that readeth it."), p("Habakkuk 2:2")] },
        h("1. Run with the vision"),
        p("Sample text for layout purposes. Line length is held near seventy characters for comfortable reading."),
        { type: "bulletList", content: [li("Seek the Lord early every morning"), li("Write down what He shows you"), li("Move when He says move")] },
        h("2. Let patience have her perfect work"),
        p("Sample text for layout purposes."),
      ),
    }),
  make("walking-in-the-realms-of-grace", "Walking in the Realms of Grace", "2025-09-12", ["Teaching"], "Grace is not only the doorway into the Christian life; it is the ground we walk on every day."),
  make("2025-year-of-restoration", "2025: The Year of Restoration", "2025-01-01", ["New Year Message"], "God is restoring what the locust has eaten, and He is doing it in this season."),
  make("the-power-of-a-quiet-morning", "The Power of a Quiet Morning", "2024-10-03", ["Devotional"], "Before the day speaks, let the Lord speak first."),
  make("faith-that-endures", "Faith That Endures", "2024-06-21", ["Teaching"], "Endurance is not the absence of struggle but the presence of trust."),
];
