---
name: storyblok-render-check
description: Verifies a component/CSS change actually renders correctly by creating disposable Storyblok content, running a real production build, and grepping the compiled output — for when static analysis (drift/build-safety/variant checks) all pass but you still need proof the visual result is right.
---

# Storyblok render check

## Why this exists

Twice on 2026-07-29, static analysis said something was fine when it
wasn't:

1. **Figma**: a new component-set variant's node metadata looked completely
   correct (visible, right fills, right text) — it was actually rendering as
   a 16px sliver because the *component set's own outer frame* hadn't been
   resized to include it and was silently clipping. Only a screenshot caught
   it.
2. **Astro dev server**: after building the `dark` background fix across 8
   components, curling the dev server's HTML and grepping for the expected
   CSS selectors found almost nothing — not because the CSS was missing,
   but because **this project's dev server injects styles via a separate
   Vite HMR path, not inline in the initial SSR HTML response.** Class
   *names* on rendered elements are reliable in dev-server HTML (they ARE
   server-rendered); CSS rule *content* is not — grepping for it there gives
   false negatives.

What actually worked: create a disposable Storyblok story exercising the
change, run a **real production build** (`npm run build`, not `astro dev`),
and grep the **compiled static CSS** in `dist/client/_astro/*.css` directly.
This skill exists so that pattern is a repeatable command sequence instead
of ad hoc `node -e` scripts written fresh each time (which is how it was
done originally, before this skill and `storyblok/render-check.js`
existed).

**When to reach for this vs. the other checks:** `storyblok-drift-check`,
`storyblok-build-safety-check`, and `storyblok-variant-check` are all
static analysis — fast, no build required, but they check *shape*
(schema/doc/code agreement, guarded optional fields, variant-to-CSS
coverage). None of them can tell you whether a change actually *renders*
correctly. Reach for this skill after those pass, when you need to confirm
the visual/structural result itself — a new component, a new variant, a CSS
fix touching multiple components, anything where "the class exists" isn't
the same question as "it looks right."

## Procedure

1. **Write a body JSON file** — a plain array of blok objects, the same
   shape as a `campaign_page`'s `body` field. Only include the
   component(s)/field values you're actually verifying:
   ```json
   [
     { "component": "hero", "headline": "Test", "background": "dark" }
   ]
   ```
   `_uid` is optional — `render-check.js` generates one for the top-level
   blok and for any nested blok one level deep (e.g. a `buttons` or `cards`
   array), so you don't have to hand-write them.

2. **Create the disposable story:**
   ```
   npm run storyblok:render-check -- create <body.json> [--slug <slug>]
   ```
   Prints the story's `id` and `full_slug`. It's unpublished
   (`hide_nav`/`hide_footer: true`, named "Internal — Render Check
   (temporary, delete me)"), so it never appears on the live site or in
   nav — safe to leave briefly, but always clean up (step 5).

3. **Run a real production build** — not the dev server:
   ```
   npm run build
   ```
   This is the step that actually matters, per "Why this exists" above. A
   successful build with no errors is itself a signal (CSS/TS syntax is
   valid), but isn't sufficient on its own — proceed to step 4.

4. **Grep the compiled CSS** for what you expect:
   ```
   grep -o "your-expected-selector[^}]*}" dist/client/_astro/*.css
   ```
   Astro's scoped CSS mangles selectors with a `[data-astro-cid-xxxxx]`
   attribute suffix on every compound part, so an exact literal-string
   search for `.component--modifier .child` won't match — search for a
   distinctive substring instead (the class name itself, or a specific
   `var(--p-...)` token reference) and read the surrounding ~200-400 chars
   for context, the way the 2026-07-29 dark-bg fix was verified. If you need
   to confirm the story's HTML structure too (element nesting, which classes
   landed on which element), curl the dev server directly — element/class
   presence in dev-server HTML IS reliable, only rule *content* isn't (see
   "Why this exists").

5. **Clean up — always, even if the check failed:**
   ```
   npm run storyblok:render-check -- cleanup <storyId>
   ```
   Don't leave render-check stories in the space. They're harmless
   individually (unpublished, hidden nav/footer) but accumulate as clutter
   in the Storyblok UI's story list if left behind session after session.

## Known limitations

- **`dist/` is gitignored** — a `npm run build` output is local/disposable
  by design, not something to commit or worry about cleaning up on disk
  (unlike the Storyblok story, which *does* need explicit cleanup since it
  lives in shared space, not your local checkout).
- **This checks rendering, not visual polish.** Confirming a CSS rule
  compiled with the right selector and token reference is not the same as
  confirming it *looks good* — spacing, alignment, and genuine visual
  judgment calls still need an actual screenshot (there's no headless
  browser tool wired into this workflow yet; `get_screenshot`-equivalent
  for the live Astro site, the way Figma's `get_screenshot` works for
  design files, would close this gap — worth building if visual-polish
  bugs start recurring the way the two "Why this exists" bugs did).
- **The build takes real time** (a few seconds, not instant) — don't reach
  for this on every trivial one-line CSS tweak; it's for changes where the
  static checks alone aren't enough evidence, per "When to reach for this."

## Verification

- `npm run storyblok:render-check -- create <file>` with a
  body containing one `hero` blok should print a valid `id`/`full_slug`,
  and `npm run storyblok:render-check -- cleanup <id>`
  afterward should print `deleted story <id>` with no error.
- Confirmed 2026-07-29: a body with a `card_grid` containing 2 nested
  `card_item`s correctly got a `_uid` generated on the top-level blok and
  on both nested items — fetching the story back afterward showed all three
  populated correctly.
