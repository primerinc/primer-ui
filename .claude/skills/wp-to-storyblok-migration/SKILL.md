---
name: wp-to-storyblok-migration
description: Moves a client's old WordPress blog (posts, case studies, white papers) into Storyblok resource stories with scripts/import-wordpress-posts.mjs — page-builder shortcodes cleaned to plain rich text, images and PDFs copied into Storyblok assets, categories to resource types and tags, internal links repointed, and a redirect for every old URL — then the clean-up passes Forte needed (non-breaking spaces, subtitles as h4, old-domain links, card logos). Use when a rebuild replaces a WordPress site that has a blog or resource library.
---

# WordPress → Storyblok posts migration

## Why this exists

Forte's old energysys.com blog had about 90 posts written in Salient /
WPBakery shortcodes. The import script moved all of them in one run and was
safe to re-run. The clean-up afterwards (the second half of this skill) took
longer than the import itself, so plan for it.

## Before you run it

- **Storyblok:**
  - a folder for the posts (default slug `posts`)
  - a datasource with the slug `redirects`
  - the primer-ui `resource` content type with `resource_header`,
    `case_study_layout` and `cta_banner`
- **Plan:** a free Starter space refuses PDF uploads until a card is on the
  account. Those files are listed and stay linked to the old site, which
  breaks at launch. Get the plan sorted first, or move them later.
- **Types:** agree with James how WordPress categories map to
  `resource_type` (`success_story`, `white_paper`, `learning_hub`).
  Everything unlisted becomes `learning_hub`.
- **Old site:** check the REST API is public:
  `https://<old>/wp-json/wp/v2/posts?per_page=1`.

## Run it

```bash
node --env-file=.env scripts/import-wordpress-posts.mjs --wp https://www.<old>.com --dry-run --limit 5
node --env-file=.env scripts/import-wordpress-posts.mjs --wp https://www.<old>.com \
  --types "Customer Story=success_story,Whitepaper=white_paper" \
  --cta-text "See how <Client> can work for your operation."
```

- `--slug a,b` re-runs specific posts.
- Existing stories are matched by slug, backed up, then updated.
- Uploaded files are cached in `scripts/.wp-import-cache.json`; add it to
  `.gitignore`.
- The report goes to `scripts/.wp-import-report.txt`.
- Shortcodes the script doesn't know are stripped and their text kept. For a
  different page builder (Elementor, Divi, Gutenberg blocks), extend
  `cleanHtml()` first and dry-run on 5 posts.

## Clean-up passes (each one backed up and reported, drafts only)

These all came up on Forte:

1. **Non-breaking spaces:** WordPress glued words together with `&nbsp;`
   (about 1,500 in 40 posts). That makes long unbreakable lines that
   overflow on phones. Replace them with normal spaces, but keep the 1–2
   that orphan prevention adds deliberately.
2. **Subtitles as headings:** about 10 posts opened with a WordPress
   subtitle typed as an `h4`. Ask James whether to drop it, make it the dek,
   or keep it.
3. **Links to the old domain:** repoint them to the new internal paths
   (Forte: 89 links in 49 posts). Links to old posts are handled during the
   import; links to pages need the redirect map.
4. **Card images:** success-story card images were often a logo with wide
   padding, or a generic company logo. List them for the client.
5. **Card excerpts:** WordPress excerpts carry shortcode junk, so the script
   uses the first real paragraph, cut near 220 characters. The meta
   description falls back to this excerpt. Thin ones go on the copywriter's
   SEO list.
6. **Tags:** tag stories by type in Storyblok (Success story, White paper,
   Learning Hub, Job, Partner), so editors can filter the Posts folder. The
   site itself doesn't read tags.
7. **Unwanted posts:** move them to `archive/` (noindex, out of lists and the
   sitemap). Before launch don't unpublish them, because the site reads
   drafts. Add a redirect for each to the section index.
8. **Publishing:** with a custom workflow, a story must be in the "Ready to
   Publish" stage before it can be published. The Growth plan can't change
   workflow stages via the API.

## Check

- Spot-check 5 posts of each type on the preview site: images load from
  `a.storyblok.com`, there are no shortcode leftovers (`[vc_`, `[nectar`),
  and the table of contents builds.
- Run the redirect check against `--from-storyblok`.
- Run the `prelaunch-audit` crawl: old-domain links, `/wp-content/` files,
  and non-breaking-space runs should all be 0.
