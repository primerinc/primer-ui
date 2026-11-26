---
name: figma-variables-to-tokens
description: Builds a client's design tokens straight from their Figma file's variables (Primer naming like color/text/primary, font/size/lg, space/8) — exports variables and text styles with the Figma plugin API into a committed snapshot, turns it into tokens/themes/<client>.json with fluid phone→desktop sizes from tokens/figma/theme.config.js, builds tokens.css, and runs the contrast check. Use when a client's Figma design system is the token source (not Tokens Studio), or when the designer changed a variable and the site should pick it up.
---

# Figma variables → tokens

## Why this exists

Forte's tokens came from the variables in its Figma design-system file, not
from Tokens Studio. The file was a restyled copy of the Primer master, so it
used Primer's variable names, and those map one-to-one to `--p-*`. Exporting
through the plugin API into a committed snapshot gave a reviewable diff on
every design change. A config file holds the parts Figma can't express
(phone sizes, side margins). Every re-export after that took a few minutes.

Use `figma-library-token-sync` instead when the client file *subscribes* to
the Primer library rather than owning the variables.

## Files

| File | What it is |
|---|---|
| `tokens/figma/export-variables.js` | Plugin API script run through `use_figma`. Read-only. Returns `{ source, variables, textStyles }` |
| `tokens/figma/variables.json` | The committed snapshot (rename per client if you like; set `snapshot` in the config) |
| `tokens/figma/theme.config.js` | Per client: theme name, `minVw`/`maxVw`, phone font sizes, spacing rule, side margin, strays to ignore, primer fallbacks |
| `tokens/figma-to-theme.js` | Snapshot + config → `tokens/themes/<theme>.json` |

## Procedure

1. **Agree the phone rules with the designer first.** Figma usually only has
   desktop frames (Forte: 1440, no mobile). Agree these and write them in the
   client CLAUDE.md:
   - the phone size for h1–h4, body-lg and the eyebrow (Forte: h1 56→36,
     h2 36→28, h3 28→22, h4 22→19, body-lg 18→17)
   - section spacing (Forte: 96–128 → 48–64)
   - the side margin (Forte: 100 → 16)

   Keep every fluid font's max ≤ 2.5× its min (good-css, WCAG zoom).
2. **Export.**
   - Load the `figma:figma-use` skill.
   - `create_session` with the file key, then `use_figma` running the contents
     of `tokens/figma/export-variables.js`.
   - Save the returned JSON as the snapshot. Never edit the Figma file: it's
     the designer's, and this script only reads it.
3. **Configure.** Copy the Forte example values in `theme.config.js` and edit
   them for the client. Set `theme` to the client name and set
   `PRIMER_THEME=<theme>` in the `build:tokens` script.
4. **Build.**

   ```bash
   PRIMER_THEME=<theme> npm run build:tokens:figma
   ```

   In a client repo, make that the default `build:tokens` script, with the
   theme name filled in.
   - A warning about an unmapped name means a new Figma group: extend
     `codePath()` in `figma-to-theme.js`.
   - A semantic token with a raw value (not an alias) is a designer slip. Ask
     the designer rather than mapping it.
5. **Contrast.**
   - Run `npm run check:contrast`. List the failing pairs for the designer as
     decisions (Forte had 6). Don't change the colours yourself.
   - The client's Figma can remap semantic meanings (Forte:
     `text/secondary` → a brand blue). That's why this theme overrides
     semantic tokens, a deliberate exception to primer's "themes override
     primitives only" rule. Note it in the client CLAUDE.md.
6. **Commit both files**: the snapshot and `tokens/dist/tokens.css`. The site
   imports tokens.css at build time; `.gitignore` re-includes `tokens/dist/`.
   Commit them together, so the diff shows the design change and its effect.

## When the designer changes something

- Re-export the snapshot, run `build:tokens`, then check `git diff` on the
  snapshot. The changed variables are exactly what the designer touched.
- Mention anything surprising to James, such as a renamed variable or a
  deleted step.
- A one-value tweak while the designer is mid-exploration can be patched
  straight into the snapshot (Forte: Body/md tracking 2px → 1px). Say so in
  the commit, and re-export properly later.

## Gotchas

- **Stray variables** left in the file (Forte: `Background`,
  `Color/neutral/200`) go in `ignore`, not into the theme.
- **Phone-only steps** that exist only to be a phone size (Forte: font size
  17) go in `skipFontSizes`.
- **Primer tokens the client Figma lacks** (the numeric brand ramp, status
  `subtle`) must point at client colours via `primitiveFallbacks`, or they
  render in primer's default gold.
- **The Figma REST token in `.env` may be expired.** Use the Figma connector
  (`use_figma`, `download_assets`) instead of REST calls.
