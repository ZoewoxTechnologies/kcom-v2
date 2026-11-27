-- The footer links to /privacy on every page, so the page must always exist.
-- Existing rows (an edited policy) are left alone.
WITH p AS (
  INSERT INTO "pages" ("title", "slug", "status")
  VALUES ('Privacy policy', 'privacy', 'published')
  ON CONFLICT ("slug") DO NOTHING
  RETURNING "id"
)
INSERT INTO "page_sections" ("page_id", "position", "type", "props")
SELECT "id", 0, 'richText', $json${"body":{"type":"doc","content":[
  {"type":"paragraph","content":[{"type":"text","text":"Kingdom Capstone Outreach Ministries respects your privacy. This page explains what we collect and why."}]},
  {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"What we collect"}]},
  {"type":"paragraph","content":[{"type":"text","text":"If you subscribe to the daily Capstone Capsule we keep your email address. If you write to us through the contact form we keep your name, email address and message."}]},
  {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"How we use it"}]},
  {"type":"paragraph","content":[{"type":"text","text":"We use your email address to send the Capsule and to reply to you. We do not sell or share it."}]},
  {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Unsubscribing"}]},
  {"type":"paragraph","content":[{"type":"text","text":"Every email carries a one-click unsubscribe link. Once you unsubscribe we stop sending to that address."}]}
]}}$json$::jsonb
FROM p;
