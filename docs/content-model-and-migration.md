# KCOM v2: Content Model and Migration Plan

Draft, 2026-11-14. Source site: kingdomcapstone.org (Drupal 7).

## 1. Repository layout (monorepo)

pnpm workspaces + Turborepo. The framework choices are still open; the layout works with any of them.

```
kcom-v2/
  apps/
    web/          public site (framework TBD)
    cms/          admin / editing app (CMS TBD)
  packages/
    content/      shared schema + TypeScript types (Zod) used by web, cms and migrate
    ui/           shared components and design tokens
    migrate/      Drupal export, transform, import scripts
    config/       shared eslint / tsconfig / prettier
  docs/
```

Why: one schema package is the single source of truth for the content model; the migration
scripts validate against that same schema before anything is imported.

## 2. Content model

### Devotional ("Capstone Capsule"), about 873 entries

| Field | Type | Notes |
|---|---|---|
| title | string, required | |
| slug | string, unique | Old slugs kept; see redirects below |
| date | date, required | Publish date; more than one capsule per day is allowed |
| scriptureRef | string | e.g. "Romans 12:1-8" |
| scriptureText | rich text | The quoted verse(s) |
| body | rich text | Main meditation |
| decrees | list of strings | The affirmation block |
| prayer | rich text | |
| author | reference → Person | Default: Adetokunbo O. Ilesanmi |
| series | reference → Series, optional | e.g. "Peak Performance", with order number |
| tags | list of references → Topic | New; optional |
| audio | file, optional | Future podcast/audio version |
| legacy | { nid, path } | Drupal node ID and old URL, used for redirects and debugging |

### Series
title, slug, description.

### Blog post (yearly prophetic messages, about 10)
title, slug, date, author, body (rich text), heroImage, legacy { nid, path }.

### Page (About sub-pages, Partnership, etc.)
title, slug, body (rich text or blocks), seo { title, description }.

### Book
title, slug, cover, description, purchaseLink, publishedYear.

### Gallery album
title, date, images[] (image, caption).

### Event (calendar is currently empty)
title, start, end, location, description. Low priority.

### Person
name, role, photo, bio. Used for authors and the Ministry Team page.

### Site settings (singleton)
giving info (bank details, online giving link), social links, contact email, footer text.
Bank details go on the Partnership page only, not on every page.

## 3. Migration plan

1. **Get the data.** Preferred: a MySQL dump of the Drupal database plus the `sites/kcom/files` folder.
   Fallback: crawl the `/archive/YYYYMM` pages and the capsule pages.
2. **Extract.** Script in `packages/migrate` reads `node`, `field_data_*`, `url_alias` and `file_managed`
   tables to raw JSON, one file per node.
3. **Transform.**
   - Split the capsule body into scripture / body / decrees / prayer by its labels
     ("Bible Meditation:", "Prayer:", the decrees block, the credit line).
   - Detect series from titles that end in "-N" or a number.
   - Turn base64 inline images into real image files.
   - Clean the HTML (strip stray `</body></html>`, inline styles) and convert it to the CMS rich-text format.
   - Validate every record against the `packages/content` schema; write failures to a report.
4. **Review.** Manually check a sample of about 50 capsules plus every record that failed parsing.
5. **Import** into the CMS through its API. The script can be re-run safely (upsert by legacy nid).
6. **Redirects.** Build a 301 map from `legacy.path` to each new URL: `/content/*`, `/blog/*`,
   `/archive/YYYYMM`, `/daily-digest`, `/node/<nid>`, `/rss.xml`.
7. **Freeze and final sync.** Freeze editing on the old site, re-run extract and import for anything new,
   then switch DNS.
8. **After launch.** Watch 404 logs, fix missing redirects, and submit sitemap.xml to search engines.

## 4. Open decisions

- Web framework (not Next.js). Options: Astro, SvelteKit, React Router (Remix), Nuxt.
- CMS: Sanity (hosted), Directus or Strapi (self-hosted). Note: Payload 3 runs on Next.js.
- Hosting and where the database and media live.
- Keep user accounts and comments? (Currently used only for commenting.)
- Email delivery for a daily devotional newsletter.
- Online giving provider.
