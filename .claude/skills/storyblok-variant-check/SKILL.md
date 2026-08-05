---
name: storyblok-variant-check
description: Cross-references every live Storyblok Option field's declared values against the matching Astro component's CSS, and reports values with no matching modifier class — the class of bug where a style variant is selectable in the CMS but silently does nothing.
---

# Storyblok variant CSS check

## Why this exists

`storyblok-drift-check` catches schema/doc/code disagreement, and
`storyblok-build-safety-check` catches unguarded optional fields that crash
at request time. Neither catches a third, quieter class of bug: a
component's `background`/`layout`/`columns`/etc. Option field can offer a
value in the live Storyblok schema that the matching `.astro` file's
`<style>` block never got a rule for. Nothing crashes, `astro check` stays
clean, `check:build-safety` stays clean — the section just silently renders
with its default styling no matter what the editor picks.

Found by hand on 2026-07-29, prompted by James noticing some style variants
"don't seem to do anything": `background: dark` was selectable in the live
schema of 8 components — CardGrid, FAQ, FeatureGrid, StatsBar, Tabs, Team,
TestimonialBlock, TwoColumn — with zero matching CSS in any of them. Only
Hero and RichText had ever actually implemented it. This also wasn't part
of the documented pattern (CLAUDE.md's "Background field pattern" only ever
specified 3 values); `dark` must have been added to those 8 live schemas at
some point — copy-paste from Hero's schema, or a batch edit — without the
CSS ever being built. The same audit also turned up an unrelated Team
`columns` data bug: an option that *displayed* "3" in the dropdown but
actually submitted `value: "4"`, silently duplicating the real 4-column
option — worth checking for while you're in the schema anyway (see
Procedure step 4).

## Procedure

1. Run the checker:
   ```
   npm run check:storyblok-variants
   ```
   Same auth/space pattern as `check-drift.js` — needs
   `STORYBLOK_MANAGEMENT_TOKEN`, defaults to Primer Block Space, `--space
   <id>` to check a client/demo space instead.

2. The script prints `{ components: { name: { file, missing: [{field,
   value, matchingClasses: []}] } } }` — only components with at least one
   missing modifier appear. It already excludes values that correctly need
   no modifier because they match the component's effective default (the
   base/unmodified CSS rule already covers the default state — not a bug),
   checking both Storyblok's own `default_value` and the component's own JS
   fallback (`blok.field || 'value'`), since in practice the JS fallback is
   often the real default when Storyblok's own field default is unset.

3. For each real finding, read the component's existing modifier pattern
   for a *different*, working value of the same field, and match it exactly
   rather than inventing a new convention. In practice this means two
   things, mirrored from the 2026-07-29 fix:
   - A background/color modifier needs the swap **plus** a second rule
     flipping foreground text/border color — `--bg-dark` (or whichever
     value) alone only changes the background, and text colors like
     `--p-color-text-primary` assume a light section. Check whether content
     sits **directly on the section background** (needs the flip: FAQ
     questions, StatsBar stat labels, TwoColumn headline/body — none of
     these have their own card) versus **nested inside the component's own
     independently-colored card** (`.card`, `.feature-card`,
     `.testimonial-card` — deliberately left unchanged, since those keep
     their own background regardless of section context). Team is the one
     component with both shapes in one file — its `card` layout has a real
     card, its `minimal` layout doesn't (`background: transparent`) — so
     the flip there is scoped precisely to
     `.team--bg-{value} .team__list--minimal .member__*`, not applied
     unconditionally.
   - Leave accent-colored elements (buttons, links, active-state
     indicators) alone — they're designed to read against varied
     backgrounds already, same convention Hero/RichText used before this
     fix existed.

4. **While reading each component's live schema for step 1's fetch, also
   glance at non-Option fields for the same class of live-data bug the Team
   `columns` case turned up** — an option whose *displayed* `name` doesn't
   match its submitted `value` (mislabeled dropdown entry), or a
   `default_value` that doesn't match any real option (e.g. a stray
   trailing newline). This script only checks Option-field *coverage*
   (does a value have CSS), not option *correctness* (does the option
   submit what it says) — the latter has no automated check yet, catch it
   by eye against the raw `component.schema.<field>.options` JSON.

5. Fix directly (local `.astro` edits) rather than just describing —
   these aren't live-Storyblok writes, so unlike drift-check's schema pushes
   they don't need per-item confirmation, *unless* the fix also touches live
   schema/content (e.g. correcting a mislabeled option's `value`, which
   changes what gets submitted for existing/future content) — that class of
   change is shared-state, same risk tier as `check-drift.js`'s Management
   API pushes, and does need confirmation first.

## Known non-findings (don't flag these as bugs)

- **A value with no matching class where the browser's own default styling
  already produces the right look.** `hero: layout="left-aligned"` is the
  reference case — no `.hero--left-aligned` rule exists because default
  `text-align: left` already renders left-aligned text; the class simply
  isn't needed, unlike `dark`, which genuinely needed CSS that never
  existed. Distinguish by asking "does the base/unmodified state already
  look correct for this value?" — if yes, it's a non-finding, not a gap.
- **Non-visual Option fields** (`video_type`, `resource_type`, `platform`,
  `linktype`) are excluded from the script already — they categorize
  content or configure behavior, not visual style, so no CSS was ever
  expected.
- **Nested blocks not in `astro.config.mjs`** (`card_item`, `pricing_plan`,
  etc.) are reported as `skipped`, not silently dropped — they render
  inline inside their parent component rather than through Storyblok's
  resolver, so this script can't map them to a file automatically. Check
  these by hand the same way the original 2026-07-29 audit did (grep the
  parent component's `<style>` block for the nested field's expected
  classes).

## Verification

- `npm run check:storyblok-variants` should currently report exactly one
  finding: `hero: layout="left-aligned"` — see "Known non-findings" above
  for why that's expected, not a bug.
- If you need to confirm the detector still works: temporarily rename one
  occurrence of `.faq--bg-dark` to `.faq--bg-darkX` in `FAQ.astro`, re-run —
  should report `faq` with a `background="dark"` finding. Revert the exact
  edit by hand afterward (change the name back) rather than
  `git checkout`/`git restore` on the whole file — this repo routinely has
  real uncommitted work sitting in these files, and a whole-file revert
  would silently discard it along with your test edit.
