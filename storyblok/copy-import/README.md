# Copy importer

Puts the client's copy (the copywriter's "Copy Master Document" Google Doc) into the Storyblok page drafts, replacing the Figma filler. Re-runnable: run it whenever the doc changes, until a page is signed off. The `copy-doc-sync` skill (`.claude/skills/copy-doc-sync/`) walks through a full round.

## Run it

1. In the Google Doc: **File › Download › Microsoft Word (.docx)**.
2. Save it in `storyblok/copy-import/input/` (git-ignored, so client copy is never committed). The newest `.docx` there is used; `--doc <path>` picks another.
3. Dry run (changes nothing, writes a report):
   ```bash
   npm run copy:import
   ```
4. Read the report in `storyblok/copy-import/reports/` (also git-ignored).
5. Write the changes to the drafts (nothing is published):
   ```bash
   npm run copy:import -- --apply
   ```
   Limit either run to some pages with `--pages "Home,Platform"` (the doc's tab names).

Needs `STORYBLOK_MANAGEMENT_TOKEN` and `STORYBLOK_SPACE_ID` in `.env`.

## What it does

- Reads every page (Heading 1) and section (Heading 2) and the labelled fields under them (`Headline (max 40 characters):` and so on). Only known labels count; see `LABELS` in `parse.js`. The doc conventions are in `docs/copy-doc-template.md`: share that with the copywriter before they start.
- `mapping.js` says which story and block each doc section goes into. A doc section with copy and no mapping is listed as **UNMAPPED** in the report rather than dropped.
- A page's "SEO title tag" line goes into that page's SEO block as its Meta title (a new SEO block is added if the page has none).
- "Universal Element" sections take their copy from the Universal Elements tab; templates can take theirs from another page (`from`).
- Empty or "TBC" fields leave Storyblok's current copy alone.
- If only the line breaks differ, Storyblok's copy is kept (designers' deliberate breaks survive).
- Repeating items (FAQ pairs, benefits, rows, offices): the block ends up with exactly the doc's items; new ones copy the last item's icon and settings.
- Page references in rich text (FAQ answers), such as "see the Platform page", become links to that page's story (`PAGE_LINKS`).
- The report flags copy over the copywriter's own limits, unused "OR" alternatives, notes in the doc, and headings that are plain text instead of Heading 2.

## Not imported

Testimonials (their own stories), post lists (data-driven), single-post templates, gated forms, and pages with no copy. Handle those with one-off scripts, and back up first (`storyblok/lib/backup.js`).

## Once a page is signed off

Do a last `--apply` for it, then stop importing it (leave it off `--pages`, or remove it from `PAGES`). From then on edits happen in Storyblok, and a later run must not overwrite them. Exception: if the copywriter sends a newer doc, the newest doc wins over hand edits in Storyblok; import it in full and tell the team which hand edits were replaced (the report lists every change).
