---
name: storyblok-drift-check
description: Diffs the live Storyblok space's component schema against this repo's schema-reference.md, component code, and CLAUDE.md, and reports where they've drifted apart — undocumented fields, code assuming fields the space doesn't have, stale docs, unregistered blocks.
---

# Storyblok schema drift check

## Why this exists

Canonical schema lives in the Storyblok space, not in this repo — there's no
committed `.storyblok/` JSON. `storyblok/schema-reference.md`, each
component's `Fields:` docblock, `astro.config.mjs`'s block map, and
`CLAUDE.md`'s component table are all separately hand-maintained copies of
what the space is supposed to contain, and they drift silently. This has
already caused a real bug: `BaseLayout.astro` was written and documented to
read `gtm_container_id`/`head_scripts`/`body_scripts` from the `config`
story before those fields existed in the live space — a gap that would
otherwise only have surfaced as a silent no-op in front of a client.

## Procedure

1. Run the checker:
   ```
   npm run check:storyblok-drift
   ```
   To check a client/demo space (duplicated from Primer Block Space) against
   this repo's docs/code instead of the canonical base, add `-- --space <id>`.

2. The script prints one JSON object, keyed by component name, each with:
   `inLive` / `inDocs` / `inAstroConfig`, `liveOnlyFields`, `docsOnlyFields`,
   `codeOnlyFields`, `typeMismatches`, `notInAstroConfig`, `notInClaudeTable`.
   It is a plain reporting script — it always exits 0 unless the Storyblok
   API call itself fails (auth/network). Interpreting which findings matter
   is this skill's job, not the script's.

3. Triage the JSON into three tiers before showing the user anything —
   never dump the raw JSON:

   - **Critical — `codeOnlyFields`**: a component's code (its `Fields:`
     docblock or actual `blok.` access) references a field the live space
     doesn't have. This is the class of bug that motivated this skill —
     it renders as a silent no-op or blank section for a client, not an
     error. Lead with these.
   - **Documentation drift — `liveOnlyFields`, `docsOnlyFields`,
     `typeMismatches`**: safe (nothing breaks) but stale. `liveOnlyFields`
     means someone added a field in the Storyblok UI without documenting
     it; `docsOnlyFields` usually means a field was removed live but the
     doc wasn't updated; `typeMismatches` usually means a field's type was
     changed in Storyblok after the doc was written.
   - **Housekeeping — `notInAstroConfig`, `notInClaudeTable`**: a
     component exists (live, or documented at `##` level) but isn't wired
     into `astro.config.mjs`'s resolver map, or is registered but missing
     from `CLAUDE.md`'s inventory table.

4. A component with `inDocs: false` and `inAstroConfig: false` — live in
   Storyblok but absent from both docs and code entirely — is usually
   leftover cruft (e.g. Storyblok's default starter components like
   `feature`/`grid`/`teaser`, which ship in every new space and were never
   cleaned out of Primer Block Space). Call these out separately as
   "probably safe to delete from the space," not as a code/doc gap to fix.

5. For each real finding, propose the specific fix rather than describing
   the category:
   - Doc/table gaps → a concrete edit to `storyblok/schema-reference.md` or
     `CLAUDE.md`.
   - A field missing live that code/docs expect → the exact Management API
     call to add it (same shape as the `PUT
     /v1/spaces/{space}/components/{id}` calls used earlier to add the
     HubSpot gate and GTM fields — read the component first, merge the new
     field into its `schema`, PUT the whole schema back).

   Do not make any of these edits without the user confirming first — a
   live-space write is shared-state, same risk class as a `git push`; a doc
   edit is cheap to reverse but still confirm which fix they want when a
   finding could be resolved from either direction (e.g. `docsOnlyFields`
   could mean "re-add the field live" or "the doc is stale, delete the
   row" — the script can't tell which is correct, only the user can).

## Known non-findings (don't flag these as drift)

- Components documented at `###` level in `schema-reference.md` (nested
  blocks like `feature_item`, `pricing_plan`, `table_of_contents`) are
  rendered inline by their parent component, not through Storyblok's
  `StoryblokComponent` resolver — they're correctly absent from
  `astro.config.mjs` and from `CLAUDE.md`'s table. The script already
  excludes these from `notInAstroConfig`/`notInClaudeTable`.
- `config` is a singleton story fetched directly by slug in
  `BaseLayout.astro` (`cdn/stories/config`), not resolved as a block — it's
  correctly absent from `astro.config.mjs`. The script excludes it too.
- `page`, `resource`, and `campaign_page` all resolve to the same
  `Page.astro`, which is why `page` shows up with `codeOnlyFields:
  ["gate_enabled"]` (and any other resource/campaign_page-only field
  `Page.astro` touches) — the field genuinely doesn't exist on `page`'s live
  schema, and `Page.astro` already documents why at the `blok.gate_enabled`
  read. The script can't tell "used only for two of the three content types
  this file renders" apart from a real bug; treat `codeOnlyFields` on `page`
  as expected unless the field isn't one of the known resource/campaign_page
  extras (currently just the `gate_*` fields).

## Verification

- `npm run check:storyblok-drift` should complete and print valid JSON.
- `config`'s `gtm_container_id`/`head_scripts`/`body_scripts` fields should
  show zero drift (they were pushed live, documented, and coded in the same
  session) — if they show up as `codeOnlyFields` or `docsOnlyFields`,
  something in the parser broke.
