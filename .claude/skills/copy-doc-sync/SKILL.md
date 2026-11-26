---
name: copy-doc-sync
description: Imports the copywriter's Copy Master Document (a Google Doc, one tab per page) into the Storyblok page drafts with storyblok/copy-import — maps doc pages and sections to stories and blocks, dry-runs to a change report (over-limit copy, unmapped sections, "OR" alternatives, placeholder Latin), backs up, then writes drafts only. Use whenever the copywriter (Arnie) sends a new or updated copy doc, or someone asks to "pull in the copy", "import the copy doc" or "sync the copy".
---

# Copy doc sync

## Why this exists

On Forte the copy doc changed at least five times before launch. Each round
by hand meant retyping hundreds of fields and missing some. The importer makes
a round take minutes and turns every difference into a reviewable report. The
lessons from Forte are written into the rules below.

## Rules (from Forte)

- **The newest doc wins.** When the copywriter sends a newer doc, import it
  in full, even over hand edits someone made in Storyblok. The report lists
  every replaced value, so tell the team which hand edits were overwritten.
  Pages already signed off and edited in Storyblok are the one exception: ask
  before re-importing those.
- **Drafts only, never publish.** The importer never publishes. Publishing is
  the team's call.
- **Nothing is dropped silently.** A doc section with copy but no mapping is
  listed as UNMAPPED. Never "fix" this by deleting the section from the doc.
  Add a mapping, or say it needs a block.
- **Limits are guidance.** Copy over the copywriter's own `(max N characters)`
  is flagged, never cut. Tell the copywriter. Don't change Storyblok
  `max_length` to enforce it, since live content may already be over.
- **Designer line breaks survive.** When only the line breaks differ, the
  Storyblok value is kept.
- **Back up before writing.** `--apply` saves each story first to
  `~/Documents/<Client>-Storyblok-backups/<date>-copy-import/` (see the
  `storyblok-safe-edit` skill).

## Before the first import (once per client)

1. Send the copywriter `docs/copy-doc-template.md` before they start. It sets
   the conventions the parser reads: Heading 1 per page, Heading 2 per
   section, `Label (max N characters):` fields, `TBC`, `OR`, items with a
   plain line above them, a Universal Elements tab, and `SEO title tag:`.
2. Fill in `storyblok/copy-import/mapping.js`:
   - **`PAGES`:** doc tab title → `{ story: '<full slug>', sections: { '<Heading 2>': [component, nth, opts] } }`.
     Build it from the Figma section order on each screen. The Storyblok body
     order should already match it if the pages came from the wireframe.
   - **`PAGE_LINKS`:** phrases like "Platform page" → slug, for FAQ answers.
   - **`SKIP_PAGES` / `SKIP_SECTIONS`:** templates, legal pages, data-driven lists.
   - `FIELDS` is primer-ui's block map. Only touch it when a block gains a field.
3. **SEO fields:** the importer writes `meta_title` / `meta_description` on the
   `seo` block. Forte added those two Text fields (max 70 / 170) to the seo
   block in Storyblok. If the client space only has primer's `metatags`
   plugin field, add them first, with a backup of the component schema.

## Each round

1. Get the doc: Google Docs › File › Download › Microsoft Word (.docx).
   - With Drive access you can export it directly. The Drive connector's
     `download_file_content` with a .docx export works, but downloading
     needs James's OK.
   - Save it to `storyblok/copy-import/input/` (git-ignored). The newest
     .docx there is used.
2. Dry run: `npm run copy:import`. Optionally add `-- --pages "Home,About"`.
3. Read the report in `storyblok/copy-import/reports/`, and summarise it for
   James rather than pasting it:
   - the number of changes per page
   - UNMAPPED sections, and whether each needs a mapping or a new block
   - over-limit fields, as a list for the copywriter
   - `"OR" alternatives not used`, `note in doc`, and headings typed as plain
     text instead of Heading 2
   - blocks that are missing an item or button to copy from ("add one in
     Storyblok first")
4. Once James is happy: `npm run copy:import -- --apply`. Then spot-check 2–3
   pages in the Visual Editor, or on the preview site, which reads drafts
   before launch.
5. Log the round in the project memory or status notes: the date, the doc
   version, the number of changes, and what's still unmapped.

## What the importer doesn't do (one-off scripts)

These were each done by hand on Forte with small scripts. When you write
one, follow the `storyblok-safe-edit` rules (back up, drafts only, report):

- **Testimonials / quote bank** → one `testimonial` story each in
  `testimonials/`, named `Author, Company: "first words…"`.
- **Single-post tabs** (partners, success stories, jobs) → stories in their
  folder from the post template.
- **SEO copy gaps:** after the import, list titles over 65 characters, thin
  descriptions and missing share images for the copywriter
  (`prelaunch-audit` does this on the preview site).

## Pushing copy back into Figma (optional)

On Forte, once the copy settled, it was also written into the Figma design
pages with `use_figma` (about 520 layers), mapped by section order and the
components' default layer names. Only do this when James asks and the
designer agrees: the Figma file belongs to the designer. Never write
placeholder or Latin values into Figma. Hide extra item slots that have no
copy instead.
