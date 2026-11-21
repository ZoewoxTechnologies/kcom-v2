-- Full-text search over public content. The tsvector functions are the single definition of what is
-- searchable: the GIN indexes and the search query both call them, so they always match. Titles
-- weigh most (A), then scripture references and summaries (B), then body text (C).

-- Functions are called schema-qualified: index builds run with a restricted search_path.
-- Every "text" value anywhere inside a rich-text document, space-joined. Declared IMMUTABLE so it
-- can be indexed; it only reads its argument.
CREATE FUNCTION kcom_rich_text(doc jsonb) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT coalesce(string_agg(t #>> '{}', ' '), '')
  FROM jsonb_path_query(coalesce(doc, 'null'::jsonb), 'strict $.**.text') AS t
$$;
--> statement-breakpoint
CREATE FUNCTION kcom_join_text(items text[]) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT coalesce(array_to_string(items, ' '), '')
$$;
--> statement-breakpoint
CREATE FUNCTION kcom_capsule_tsv(
  title text, scripture_ref text, bible_meditation text, body jsonb, scripture_text jsonb,
  prayer jsonb, decrees text[]
) RETURNS tsvector
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT setweight(to_tsvector('english', coalesce(title, '')), 'A')
    || setweight(to_tsvector('english', coalesce(scripture_ref, '') || ' ' || coalesce(bible_meditation, '')), 'B')
    || setweight(to_tsvector('english', public.kcom_rich_text(body) || ' ' || public.kcom_rich_text(scripture_text)
         || ' ' || public.kcom_rich_text(prayer) || ' ' || public.kcom_join_text(decrees)), 'C')
$$;
--> statement-breakpoint
CREATE FUNCTION kcom_blog_tsv(title text, excerpt text, tags text[], body jsonb) RETURNS tsvector
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT setweight(to_tsvector('english', coalesce(title, '')), 'A')
    || setweight(to_tsvector('english', coalesce(excerpt, '') || ' ' || public.kcom_join_text(tags)), 'B')
    || setweight(to_tsvector('english', public.kcom_rich_text(body)), 'C')
$$;
--> statement-breakpoint
CREATE FUNCTION kcom_event_tsv(title text, place text, description jsonb, programme text) RETURNS tsvector
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT setweight(to_tsvector('english', coalesce(title, '')), 'A')
    || setweight(to_tsvector('english', coalesce(place, '')), 'B')
    || setweight(to_tsvector('english', public.kcom_rich_text(description) || ' ' || coalesce(programme, '')), 'C')
$$;
--> statement-breakpoint
CREATE FUNCTION kcom_book_tsv(title text, description jsonb) RETURNS tsvector
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT setweight(to_tsvector('english', coalesce(title, '')), 'A')
    || setweight(to_tsvector('english', public.kcom_rich_text(description)), 'C')
$$;
--> statement-breakpoint
CREATE FUNCTION kcom_series_tsv(title text, description text) RETURNS tsvector
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT setweight(to_tsvector('english', coalesce(title, '')), 'A')
    || setweight(to_tsvector('english', coalesce(description, '')), 'C')
$$;
--> statement-breakpoint
CREATE INDEX "capsules_search_idx" ON "capsules" USING gin (public.kcom_capsule_tsv("title", "scripture_ref", "bible_meditation", "body", "scripture_text", "prayer", "decrees"));
--> statement-breakpoint
CREATE INDEX "blog_posts_search_idx" ON "blog_posts" USING gin (public.kcom_blog_tsv("title", "excerpt", "tags", "body"));
--> statement-breakpoint
CREATE INDEX "events_search_idx" ON "events" USING gin (public.kcom_event_tsv("title", "place", "description", "programme"));
--> statement-breakpoint
CREATE INDEX "books_search_idx" ON "books" USING gin (public.kcom_book_tsv("title", "description"));
--> statement-breakpoint
CREATE INDEX "series_search_idx" ON "series" USING gin (public.kcom_series_tsv("title", "description"));
