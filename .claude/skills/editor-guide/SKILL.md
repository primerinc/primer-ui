---
name: editor-guide
description: Writes the client team's Storyblok editing guide (one self-contained HTML page, Forte's 17-section structure) from the live space, schema-reference.md and the site's own pages, and serves it at /guide behind a password (HTTP Basic auth against GUIDE_PASSWORD, noindex, never cached). Use near handover or launch, when the client team gets Storyblok access, or when blocks, folders or publishing rules change and the guide needs updating.
---

# Client editor guide

## Why this exists

Forte's team needed one place that explained:

- their space: which folders hold what
- every block, in their own page names
- how publishing works (the workflow stages, archive instead of unpublish)
- forms, SEO, redirects, images, and what to ask Primer for

Serving it from the site, at `/guide`, means the guide ships with the code it
describes, and it can't be lost the way an email attachment can.

## Build it

1. **Start from `references/forte-storyblok-guide.html`.** Keep its structure
   and its self-contained styling. Replace the content. The 17 sections:

   1. Finding your way around the space
   2. Every page on the site
   3. Menu, footer and site settings
   4. Editing and adding pages
   5. The section blocks
   6. Resources
   7. Adding and editing a resource
   8. Testimonials
   9. Images, logos, icons and illustrations
   10. Forms and HubSpot
   11. SEO and search
   12. Redirects
   13. Publishing, history and removing
   14. What to ask Primer for
   15. Before launch
   16. Good habits
   17. Learn more

   Drop the sections the client doesn't have, for example Testimonials or
   Resources.
2. **Gather the facts from the live space,** not from memory:
   - the folders and the story list (Management API)
   - the component schemas and their display names
   - the Option values (Background: White / Light grey)
   - the presets on Post
   - the workflow stages
   - the datasources

   `storyblok/schema-reference.md` has the field meanings.
3. **Write for editors, not developers:**
   - plain words
   - the client's page names
   - "click X › Y" paths that match the Storyblok UI
   - no field keys unless the UI shows them

   Say what *not* to do: don't unpublish before launch, archive instead of
   deleting, and keep images under the size limit. Run the
   `stop-slop:stop-slop` skill over the text.
4. **Images in the guide:** use small inline SVG diagrams or screenshots
   stored next to the HTML. The guide must work offline.

## Serve it at /guide

- Copy `references/guide-route.ts` to `src/pages/guide.ts`, and point the
  `?raw` import at `docs/guides/<client>-storyblok-guide.html`.
- In Netlify, set the `GUIDE_PASSWORD` env var and mark it secret. Any
  username works.
  - With no password set, the route stays locked, except on the local dev
    server.
  - Responses are `private, no-store` and `X-Robots-Tag: noindex`.
- Leave `/guide` out of the sitemap, the nav and CDN caching. The
  launch-cutover cache middleware already skips `/guide`.
- Send the password to the client through a separate channel from the link.
  James decides how; never put it in a commit, the guide itself or chat.

## Keep it current

When a block, folder, publishing rule or launch step changes, update the
guide in the same PR. It's cheap then and easy to forget later. Before
handover, read it once against the live space and click every
"Storyblok › …" path.
