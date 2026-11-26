---
name: redirect-map
description: Maps every URL on a client's old site to its new page — builds the list from the old sitemap/WordPress, reconciles it with the client's redirect sheet, syncs it into Storyblok › Datasources › Redirects (read by the site's redirect middleware, no deploy), checks every old URL lands on a 200 in one or two 301 hops, and produces the final spreadsheet for the client's developer. Use when a rebuild replaces an existing site, when the client sends a redirect sheet, or before a domain move.
---

# Redirect map

## Why this exists

Forte replaced energysys.com and moved to a new domain.

- The client's sheet had 245 rows. 44 of them weren't in Storyblok yet, and a
  few conflicted with later slug renames.
- Old internal links inside 49 posts still pointed at energysys.com.
- Redirects live in a Storyblok datasource, not in code, so editors can add
  one without a deploy and the middleware picks it up within a minute.

The check script catches what's still wrong.

## How redirects work on a primer site

- **Storyblok › Datasources › Redirects** (slug `redirects`): the Name is the
  old path and the Value is the new path (or a full URL).
  - `/blog/*` → `/posts/*` keeps the rest of the path.
  - `/old/*` → `/resources` sends everything under `/old/` to one page.
- **Middleware** (`src/lib/redirects.ts`, called from `src/middleware.ts`):
  - matching ignores case and trailing slashes, and keeps the query string
  - an exact entry wins
  - a wildcard only fires when the site has no page of its own at that
    address (it renders first and redirects only on a 404)
  - the list is cached for 60 seconds

  If the repo doesn't have this yet, port it from
  `.claude/skills/launch-cutover/references/` (`redirects.ts` and the
  `redirects` middleware in `middleware.ts`), and create the datasource.
- **Old domain → new domain** is a host-level 301 in `netlify.toml`
  (`references/netlify-old-domain-redirects.toml` in the launch-cutover
  skill). The path then goes through the datasource on the new domain, so
  it's two hops at most.

## Procedure

1. **Collect every old URL:**
   - the old site's sitemap(s)
   - the WordPress REST API: `/wp-json/wp/v2/posts?per_page=100`, pages, and
     category/tag archives if they were indexed
   - the client's sheet, if they have one
   - Search Console top pages, if the client can export them

   De-duplicate on the lower-cased path without the trailing slash.
2. **Map** each URL to a live page:
   - Prefer the specific page. Use a section index only when nothing fits.
   - Never send a whole old section to the home page.
   - Where the client's sheet disagrees with a rename that happened later,
     keep the live target and list the row for James (Forte had 11).
3. **Sync**: export the sheet as CSV (two columns: old, new), then:

   ```bash
   node --env-file=.env scripts/check-redirects.mjs --csv redirects.csv --sync           # dry run
   node --env-file=.env scripts/check-redirects.mjs --csv redirects.csv --sync --apply   # writes; backs up first
   ```

   - It never deletes entries.
   - Show James the add and change lists before running `--apply`.
4. **Check** that every row lands:

   ```bash
   node --env-file=.env scripts/check-redirects.mjs --base https://<site>.netlify.app --csv redirects.csv
   node --env-file=.env scripts/check-redirects.mjs --base https://<site>.netlify.app --from-storyblok
   ```

   - It flags a non-200 end, no redirect, more than 2 hops, a 302 instead of
     a 301, loops, and landing somewhere other than the sheet's target.
   - Wildcards are skipped, so test one sample path of each by hand.
   - Forte's final pass: 257 entries, 0 problems.
5. **Repoint links inside content**:
   - Search every story for links to the old domain and repoint them to the
     new internal paths (Forte: 89 links in 49 posts). Back up first.
   - Files under `/wp-content/uploads/` must move into Storyblok assets, or
     they die when the old server goes. A free Starter space refuses PDFs
     until a card is on the account.
6. **Final sheet for the client's developer:**
   - Write an .xlsx with the old URL, the new URL, the status and notes.
   - Keep it untracked in `docs/`. Sending it to anyone needs James's OK.

## Rules

- Back up the datasource before any write (the script does this; one-offs
  use `storyblok/lib/backup.js`).
- Slug renames add their own redirect at the same time: old `/use-cases/x` →
  new `/use-cases/y`.
- No redirect should point at a page that's in `archive/` or unpublished.
