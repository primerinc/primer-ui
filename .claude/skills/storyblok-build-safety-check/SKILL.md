---
name: storyblok-build-safety-check
description: Scans Storyblok components for optional fields (Asset/Blocks/Link/Richtext/Plugin) accessed without a guard — the class of bug that crashes a live page at request time when an editor leaves an optional field blank, since this project runs SSR with no build step left to catch it first.
---

# Storyblok build-safety check

## Why this exists

This project runs `output: 'server'` (SSR), switched on 2026-07-22 specifically
for Storyblok live-preview (see CLAUDE.md's "Rendering mode" section). That
means there's no static build step left to catch a bad field before deploy —
a component that reads `blok.image.filename` without `?.` doesn't fail a
build, it throws for whichever real visitor requests that page while the
field happens to be blank. Any field documented `Required: No` **will**
eventually be left blank by an editor; that's what optional means.

TypeScript alone doesn't catch this: almost every `src/storyblok/*.astro`
file destructures `const { blok } = Astro.props` untyped (effectively `any`),
so `blok.image.filename` type-checks fine even though it throws at runtime.
Confirmed by running `npx astro check` against this repo — it only flags the
two components that bothered to type `blok` narrowly, and even those two
existing errors turned out to be richtext-library typing nuances, not real
null-safety bugs (both already guarded by a ternary). That's why this skill
exists as a dedicated Storyblok-aware scan rather than "just run astro check."

## Procedure

1. Run the checker:
   ```
   npm run check:build-safety
   ```
   No token or `--env-file` needed — it's pure static analysis over
   `storyblok/schema-reference.md` and `src/storyblok/*.astro`, no Storyblok
   API calls. It trusts `schema-reference.md`'s `Required`/`Type` columns; if
   those might be stale relative to the live space, run
   `storyblok-drift-check` first.

2. The script prints `{ typeErrors: [...], components: { name: { file,
   unsafeOptionalFields: [{field, type, pattern}] } } }`.

3. **Lead with `unsafeOptionalFields`** — this is the actual point of the
   tool, the class of bug that can crash a live page for a real visitor.
   `typeErrors` (from `astro check`) is a secondary, lower-urgency signal.

4. For each real `unsafeOptionalFields` finding, fix it directly rather than
   just describing it — these are local code edits (add `?.`, add a
   `?? []`/`|| []` default, add a ternary/`&&` guard), not live-Storyblok
   writes, so unlike `storyblok-drift-check`'s Management API pushes they
   don't need per-item confirmation. Match the codebase's existing idiom
   rather than inventing a new one — it uses two interchangeably:
   - `const items = blok.field ?? [];` then `items.map(...)` (most
     components), or
   - `blok.field?.length > 0 && (... blok.field.map(...) ...)`
     (`CaseStudyLayout.astro`)

   Give a batch before/after summary once done, consistent with how the
   hero/logo_bar/rich_text drift fixes were handled earlier in this project.

## Known heuristic limitation (not a bug)

The scan is regex-based text matching, not real control-flow analysis: a
field counts as "guarded" if the guarded form (`blok.field?.` for
object-shaped fields, a `?? []`/`|| []` default or an optional-chained
mention for array fields, a ternary/`&&` for richtext) appears **anywhere**
in the file — it doesn't verify the specific bare access sits inside that
guard's branch. This intentionally matches a real, common, safe idiom
already in this codebase — `TwoColumn.astro`:
```js
const imageUrl = blok.image?.filename
  ? `${blok.image.filename}/m/1200x0/filters:quality(85)`   // bare access, safe: inside the guarded branch
  : null;
```
The bare `blok.image.filename` on the second line is safe only because it's
inside the branch the first line's optional-chained condition already
guards. A same-file check can't distinguish this from a genuinely unguarded
bare access elsewhere in the same file that happens to share a field name
with one guarded access — so a finding could theoretically be missed in
that specific shape. It's a deliberate scope/complexity tradeoff (avoiding a
real AST-based control-flow analyzer), not something to "fix" by making the
heuristic stricter — a stricter version would just reintroduce false
positives on this exact idiom (confirmed while building this: the first
version flagged `CaseStudyLayout.astro`'s `key_takeaways`/`sidebar` fields
for exactly this reason, using a guard shape the scanner hadn't accounted
for yet).

## Verification

- `npm run check:build-safety` runs with no env/token and prints valid JSON.
- Should currently report zero `unsafeOptionalFields` findings and 2
  `typeErrors` (`CaseStudyLayout.astro:21`, `FAQ.astro:68` — pre-existing,
  known, low-severity typing nuances, not this skill's core target).
- If you need to confirm the detector still works: temporarily strip every
  `blok.image?.` guard in `TwoColumn.astro` down to `blok.image.` and
  re-run — should report `two_column` with an `unguarded-dot-access` finding
  on `image`. Revert immediately after (`git checkout -- src/storyblok/TwoColumn.astro`).
