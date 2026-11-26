---
name: prelaunch-audit
description: One pass over a client site before launch — sitemap crawl (broken and `#` links, old-domain and /wp-content/ links that die at cutover, titles over 65, thin or missing meta descriptions and share images, h1 count, placeholder Latin, non-breaking-space runs), unpublished Storyblok content, axe and Lighthouse, security headers and robots — sorted into "Primer fixes" and "client decisions". Use in the last two weeks before a launch, after a big content import, or when James asks "is the site ready" / "run the checks".
---

# Pre-launch audit

## Why this exists

On Forte these checks ran in pieces across about six sessions, and each pass
turned up something real:

- 1,500 WordPress non-breaking spaces overflowing on phones
- 89 links still pointing at the old domain
- 4 PDFs that would die at cutover
- an announcement bar linking to `#`
- titles over 65 characters

One command and one report make that a single step.

## Procedure

Run everything against the preview host (it reads drafts before launch).
Nothing here writes anything.

1. **Crawl:**

   ```bash
   node scripts/prelaunch-audit.mjs --base https://<site>.netlify.app --old <olddomain.com>
   ```

   - `--max N` caps the page count; `--skip-external` makes it quick.
   - It writes `.audit/prelaunch-<date>.md`; add `.audit/` to `.gitignore`.
2. **Content still unpublished:** `npm run check:unpublished`. Pages never
   published will 404 after the switch to `CONTENT_VERSION=published`.
   Changed pages will show their older published version.
3. **Storyblok code checks:** `npm run check:build-safety`,
   `npm run check:storyblok-drift` and `npm run check:storyblok-variants`
   (their own skills explain the output).
4. **Accessibility:**
   - Run axe on a sample: home, one page per template, one post per type,
     and the contact form.

     ```bash
     npx @axe-core/cli <url> --exit
     ```

   - Or drive the built-in browser and inject axe from cdnjs. On Forte, axe
     was clean on 72 pages apart from one.
   - Also check by hand:
     - keyboard tab order through the header and mega menus
     - a visible focus ring
     - any auto-moving content (logo marquees and carousels) needs a pause
       control (WCAG 2.2.2)
5. **Lighthouse** on about 10 pages, mobile and desktop:

   ```bash
   npx lighthouse <url> --only-categories=performance,accessibility,best-practices,seo --output=json --quiet
   ```

   Expected on the preview host, so don't report these as issues:
   - SEO is low only because robots.txt disallows the preview host.
   - Best Practices may drop to 96 when a local GTM blocker is running.
   - TTFB is slow because SSR isn't cached until launch.
6. **By hand:**
   - Safari, plus a real phone pass (iOS Safari): header, menus, forms, video.
   - Click-test the interactive blocks: FAQ, tabs, carousel, pricing toggle
     and stat count-ups.

## The report to James

Never dump the raw report. Group it like this:

- **Primer fixes**, with a count each. These are code bugs, broken internal
  links, missing alt text, overflow and contrast that comes from code.
- **Content fixes we can make in Storyblok**, with a count each:
  - non-breaking-space runs: strip them with a backed-up script
  - old-domain links: repoint them to the new paths
  - `#` links
- **Client or copywriter decisions:**
  - over-long titles, thin descriptions and missing share images (a list
    for the copywriter)
  - dead external links (their content)
  - files still on the old server that need a home (PDFs in
    `/wp-content/uploads/`)
  - placeholder copy that is still live
  - contrast pairs that are design choices (for the designer)
- **Expected on preview / fine:** robots Disallow, preview canonicals,
  external 403s (bot protection on Gartner, McKinsey, LinkedIn, etc.).

Fix only what James OKs. Content changes in Storyblok go through
`storyblok-safe-edit` (back up first). Run the audit again before the launch
deploy.
