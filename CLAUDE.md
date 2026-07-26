# primer-ui — Shared Component Library

## What this repo is
Primer's shared Astro component library. Every client build starts from here.
Components consume CSS custom properties from `tokens/dist/tokens.css`.
Per-client theming is done by swapping the semantic token layer and rebuilding.

Repository: https://github.com/primerinc/primer-ui
Agency: Primer — primerinc.com — Lambertville, NJ

---

## Token system

### Layer model
1. **Primitives** (`tokens/primitives.json`) — raw values, never client-specific
2. **Semantic** (`tokens/semantic.json`) — purpose-based aliases, swapped per client
3. **Output** (`tokens/dist/tokens.css`) — compiled CSS custom properties, never edited directly

### Figma → GitHub → site sync (as of 2026-07-25)

Design changes flow: **edit a Figma Variable → Tokens Studio "Import Variables" → Push → `npm run build:tokens`.**

- The Tokens Studio plugin syncs Figma's variables to `tokens/tokens.studio.json` (GitHub sync provider, configured in the plugin's Settings).
- `tokens/sync-from-studio.js` (runs automatically as part of `build:tokens`) merges that export into `primitives.json` / `semantic.json`.
- Astro's dev server picks up the regenerated CSS via the `primer:watch-tokens` Vite plugin in `astro.config.mjs` — no restart needed.

**Figma is authoritative only for `color` and `font.family`** (the `OWNED_BY_FIGMA` list in the sync script). Everything else stays hand-authored, for two reasons:

1. **Figma Variables can't express it** — shadows are Effect Styles, motion/easing has no variable type, and `font.leading` / `font.tracking` live inside Text Styles.
2. **Tokens Studio's rem conversion corrupts it** — Figma types opacity, border-width and 1px values as plain FLOATs, so they come back as nonsense lengths (`opacity 0.05` → `0.003rem`, `1px` → `0.063rem`, `radius.full 9999px` → `624.938rem`).

Only widen `OWNED_BY_FIGMA` after checking that the exported values for that category round-trip losslessly.

**Tokens Studio workflow rules:**
- **Never rename imported token sets.** Import Variables always writes to sets named `Collection/Mode` (e.g. `primitives/primitives`, `semantic/semantic`, `semantic/Wireframe`) and does not update renamed copies — renaming silently forks the data. Delete strays instead; the sync script matches set names case-insensitively.
- Themes are a **Pro-only** feature. On the free tier the Themes tab won't persist set assignments. Nothing here reads `$themes`, so leave it alone — code-side theming uses `PRIMER_THEME` + `tokens/themes/*.json` instead.
- `tokens/themes/wireframe.json` is still hand-maintained; the Figma `semantic/Wireframe` set is not yet wired in.

### CSS variable naming
Pattern: `--p-[category]-[subcategory]-[variant]`

Examples:
- `--p-color-bg-primary`
- `--p-color-text-secondary`
- `--p-color-accent-default`
- `--p-color-border-default`
- `--p-font-display`
- `--p-font-body`
- `--p-font-size-xl`
- `--p-font-weight-medium`
- `--p-space-8`
- `--p-radius-card`
- `--p-shadow-md`

### Build command
```bash
npm run build:tokens
```

### Per-client theme workflow
1. Copy `tokens/semantic.json` → `tokens/themes/[client-slug].json`
2. Update color values to match client brand (primitives stay the same)
3. Run `npm run build:tokens`
4. The new `tokens/dist/tokens.css` replaces the default in the client's Astro project

---

## Component library

| Component        | Storyblok block name | File path                             | Status   |
|------------------|----------------------|---------------------------------------|----------|
| Hero             | hero                 | src/storyblok/Hero.astro              | complete |
| FeatureGrid      | feature_grid         | src/storyblok/FeatureGrid.astro       | complete |
| CTABanner        | cta_banner           | src/storyblok/CTABanner.astro         | complete |
| LogoBar          | logo_bar             | src/storyblok/LogoBar.astro           | complete |
| TestimonialBlock | testimonials         | src/storyblok/TestimonialBlock.astro  | complete |
| TwoColumn        | two_column           | src/storyblok/TwoColumn.astro         | complete |
| RichText         | rich_text            | src/storyblok/RichText.astro          | complete |
| StatsBar         | stats_bar            | src/storyblok/StatsBar.astro          | complete |
| CardGrid         | card_grid            | src/storyblok/CardGrid.astro          | complete |
| Header           | header               | src/storyblok/Header.astro            | complete |
| Footer           | footer               | src/storyblok/Footer.astro            | complete |
| Team             | team                 | src/storyblok/Team.astro              | complete |
| Tabs             | tabs                 | src/storyblok/Tabs.astro              | complete |
| FAQ              | faq                  | src/storyblok/FAQ.astro               | complete |
| PricingTable     | pricing_table        | src/storyblok/PricingTable.astro      | complete |
| ContactForm      | contact_form         | src/storyblok/ContactForm.astro       | complete |
| ProcessSteps     | process_steps        | src/storyblok/ProcessSteps.astro      | complete |
| Video            | video                | src/storyblok/Video.astro             | complete |
| CaseStudyLayout  | case_study_layout    | src/storyblok/CaseStudyLayout.astro   | complete |

Update this table every time a component is added or its status changes.

`src/storyblok/ContentGate.astro` and `BodyBlocks.astro` aren't in the table above —
they're internal helpers `Page.astro` reaches for, not registered Storyblok bloks.
`ContentGate` implements the soft-gate pattern (`gate_enabled` etc. on `resource`/
`campaign_page` — see "Content gating" in `storyblok/schema-reference.md`); `BodyBlocks`
is just the shared body-rendering loop, factored out so it can be used both directly
and nested inside `ContentGate` without duplicating the scroll-reveal wrapper logic.

---

## Coding conventions

### Component structure
Every component lives in `src/storyblok/` and follows this pattern:

```astro
---
/**
 * ComponentName
 * Storyblok block name: block_name_here
 *
 * Fields: (list all Storyblok fields with types)
 */
import { storyblokEditable } from '@storyblok/astro';

const { blok } = Astro.props;
---

<section {...storyblokEditable(blok)} class="component-name">
  <!-- markup using blok.field_name -->
</section>

<style>
  /* Use CSS custom properties exclusively — no hardcoded values */
  .component-name {
    background: var(--p-color-bg-primary);
    font-family: var(--p-font-body);
  }
</style>
```

### Rules
- All components receive a `blok` prop from Storyblok — never individual props
- Always spread `{...storyblokEditable(blok)}` on the root element (enables visual editor)
- Never use hardcoded color, font, spacing, or radius values — always CSS custom properties
- Use `class:list` for conditional class merging
- Storyblok image fields are accessed as `blok.image?.filename` and `blok.image?.alt`
- Keep component styles scoped (default Astro behavior)
- Name CSS classes using kebab-case BEM-lite: `.component-name`, `.component-name__element`

### Background field pattern
All section components support a `background` Option field in Storyblok. The pattern is identical across every component:

```astro
const bg = blok.background || 'primary'; // or 'secondary' for Hero/StatsBar
```
```html
<section class:list={['component', `component--bg-${bg}`]}>
```
```css
/* Base rule FIRST — modifier overrides must come AFTER (equal specificity, cascade order wins) */
.component {
  background: var(--p-color-bg-primary);
}
.component--bg-secondary     { background: var(--p-color-bg-secondary); }
.component--bg-accent-subtle { background: var(--p-color-bg-accent); }
```

**Defaults:** Hero and StatsBar default to `secondary` (their original hardcoded background). All other section components default to `primary`. Existing content with no `background` field set renders identically to before.

**Storyblok field:** Type = Option, options: `primary`, `secondary`, `accent-subtle`. Add to: hero, feature_grid, stats_bar, two_column, card_grid, testimonial_block, rich_text, team, tabs, faq.

### Icon field pattern (feature_item)
`feature_item.icon` is an **Asset** field (not Textarea). Clients upload SVG/PNG files to the media library. Rendered as `<img>` — CSS color control via `currentColor` is not available. If a client needs brand-colored icons, have them export SVGs with the color baked in.

### Text align pattern
`cta_banner` and `feature_grid` support a `text_align` Option field (`left`/`center` for CTA Banner, `center`/`left` for Feature Grid). Modifier class: `component--align-${textAlign}`.

---

## Storyblok block schemas
Full field reference for every block: `storyblok/schema-reference.md`

When creating a new Storyblok space for a client:
1. Refer to schema-reference.md for each block's field definitions
2. Field names must match the Astro component prop interface exactly
3. Configure the visual editor nesting to match the component hierarchy

### Root content types
In addition to nestable blocks, the space needs three root content types: `page`, `resource`, `campaign_page`. All three share a `body` Blocks field and a reusable `seo` block (an ordinary nestable block, attached via a restricted min-1/max-1 Blocks field — Storyblok has no cross-content-type field-group feature) — see the "Root content types" section of `storyblok/schema-reference.md` for exact fields. All three render through `src/storyblok/Page.astro` (registered per content type in `astro.config.mjs`); SEO metadata and `campaign_page`'s `hide_nav`/`hide_footer` are read and applied in `src/pages/[...slug].astro` and `src/layouts/BaseLayout.astro`.

---

## BaseLayout
`src/layouts/BaseLayout.astro` is the root layout. It imports `tokens/dist/tokens.css`.
All client Astro projects use this layout as their base.

Update the Google Fonts link in BaseLayout for each client's brand fonts.

Third-party scripts (GTM, consent management platforms, etc.) are configured
per-client via the singleton `config` story, not hardcoded here — see the
`config` section and "Third-party scripts & consent" in
`storyblok/schema-reference.md`.

---

## Rendering mode: SSR + Storyblok Live Preview (as of 2026-07-22)

This repo runs `output: 'server'` (not static/SSG) with `livePreview: true` on the Storyblok integration, `src/middleware.ts` wiring up the live-preview handler, and `src/pages/[...slug].astro` + `src/pages/index.astro` fetching content per-request via `getPayload()` instead of baking it in via `getStaticPaths`. This is required for Storyblok's Visual Editor to reflect **style/Option-field changes** (background, layout, variant, etc.) live — without it, only plain text fields appeared to update, and style changes required a full dev-server restart to show up (discovered while testing the Lock 8 demo space). This SSR + live-preview setup is the intended permanent architecture for all future client builds, not a demo-only hack — every client will want the same instant-preview editing experience.

**⚠️ MUST DO BEFORE DEPLOYING ANY BUILD OFF LOCALHOST (this project or any future client project cloned from this repo):**
The adapter currently configured in `astro.config.mjs` is `@astrojs/node` (`mode: 'standalone'`) — this only works for a **self-hosted Node process** (VPS, Docker, a box you run yourself). It will **not** work as-is on Netlify, Vercel, Cloudflare Pages, or similar serverless/edge hosts. Before the first non-localhost deploy:
1. Confirm the actual hosting target (Netlify, Vercel, Cloudflare, self-hosted, etc.) — not yet decided as of 2026-07-22.
2. Swap `@astrojs/node` for that platform's official Astro adapter (e.g. `@astrojs/netlify`, `@astrojs/vercel`) in `astro.config.mjs`. The live-preview logic itself (`src/middleware.ts`, `getPayload()` calls) is adapter-agnostic and does not need to change — only the `adapter` line and the corresponding npm package.
3. Update the Storyblok space's Visual Editor **Location** setting (Settings → Visual Editor) from `https://localhost:4321/` to the deployed URL once live.

As of 2026-07-22, staying on `localhost` intentionally (Primer component work + Lock 8 Partners demo prep) — do not swap the adapter or otherwise treat this as urgent until an actual deploy is imminent.

---

## Style Dictionary version note
This repo uses Style Dictionary v5. Token references in JSON files use the v5 syntax:
`{color.neutral.900}` — **not** `{color.neutral.900.value}` (that is v3/v4 syntax and will break the build).

---

## Figma design system — component build status

Figma file: https://www.figma.com/design/ePSkKvHKM4v0RdoUYcz2N0/Primer-Design-System

Variables: `primitives` collection (60 vars) + `semantic` collection (31 vars, 2 modes: `semantic` / `Wireframe`).
Wireframe mode strips brand colour so reviews read as structure, not visual design — Brian applies it per-frame from the Variables panel.

⚠️ **Figma and code currently disagree on wireframe colour.** `tokens/themes/wireframe.json` was made fully greyscale on 2026-07-25 (true neutrals, near-black CTAs), but the Figma `semantic/Wireframe` mode still uses the old blue (`accent.default = #3b82f6`). The two are not synced — the sync script deliberately covers only `primitives/primitives` and `semantic/semantic`, never the Wireframe mode. To bring them back in line, update the Wireframe-mode variables in Figma to match `tokens/themes/wireframe.json`.

### Component build: complete. Lock 8 Partners demo: complete (confirmed via Storyblok Management API, 2026-07-23).

> All 18 components + Video (174:16) built. Root content-type schemas (`resource`, `campaign_page`, shared `seo` field group) and their code wiring (SEO tags, `hide_nav`/`hide_footer` in BaseLayout) are done — see "Root content types" above.
>
> **Lock 8 Partners — Demo** Storyblok space (id `294034023399259`, region `eu-central-1`) was duplicated from Primer Block Space on 2026-07-22 and is fully set up: all 41 component schemas present (background/text_align Option fields, `feature_item.icon` as Asset, `cta_banner.buttons` as Blocks, etc.), and both demo entries are built and **published**:
> - `resource`: "Case Study: Lock 8 Partners Modernization" (`lock-8-partners-case-study-demo`)
> - `campaign_page`: "Campaign Page Template (Demo)" (`campaign-template-demo`)
>
> Ready for the live walkthrough. Known non-blocking inconsistency: `two_column` and `card_grid` still use plain `cta_label`/`cta_url` text fields instead of a nested `button` blok, unlike `hero`/`cta_banner`.

**Next up:** no outstanding Storyblok setup work. Remaining open item is the [SSR deploy adapter swap](#rendering-mode-ssr--storyblok-live-preview-as-of-2026-07-22) once a hosting target is chosen — currently staying on localhost intentionally.

| Component        | Figma page      | Variants                          | Status      | Node ID  |
|------------------|-----------------|-----------------------------------|-------------|----------|
| Button           | Button          | Style × State (6 variants)        | ✅ done     | 11:8     |
| Hero             | Hero            | Layout=Centered/Left-Aligned      | ✅ done     | 14:20    |
| CTA Banner       | CTA Banner      | Style=Accent/Dark/Light × Align=Left/Center | ✅ done | 96:33 |
| Two Column       | Two Column      | Image Side=Right/Left             | ✅ done     | 18:22    |
| Logo Bar         | Logo Bar        | Display=Grid/Marquee              | ✅ done     | 24:27    |
| Feature Grid     | Feature Grid    | Columns=2/3/4 × Align=Center/Left | ✅ done     | 98:84    |
| Card Grid        | Card Grid       | Columns=2/3                       | ✅ done     | 28:90    |
| Header           | Header          | Announcement=False/True           | ✅ done     | 29:38    |
| Footer           | Footer          | Newsletter=False/True             | ✅ done     | 77:48    |
| Stats Bar        | Stats Bar       | —                                 | ✅ done     | 103:25   |
| Testimonial      | Testimonial     | Layout=Grid/Carousel              | ✅ done     | 88:23    |
| Team             | Team            | Layout=Card/Minimal               | ✅ done     | 106:51   |
| Tabs             | Tabs            | Layout=Horizontal/Vertical        | ✅ done     | 117:54   |
| FAQ              | FAQ             | Expanded=False/True               | ✅ done     | 79:91    |
| PricingTable     | Pricing Table   | Plans=2/3                         | ✅ done     | 121:157  |
| ContactForm      | Contact Form    | Layout=Centered/Split             | ✅ done     | 132:56   |
| ProcessSteps     | Process Steps   | Layout=Horizontal/Vertical        | ✅ done     | 168:2    |
| Video            | Video           | Source=YouTube/Hosted             | ✅ done     | 174:16   |

### Figma sizing conventions (learned the hard way)
- **VERTICAL auto-layout sections**: append children FIRST, set `primaryAxisSizingMode = 'AUTO'`, then call `resize(1440, node.height)` to fix width without clobbering computed height. Never call `resize()` with a hard-coded height before appending children — it locks the height to that value even in AUTO mode.
- **HORIZONTAL auto-layout sections** (Hero, CTA, TwoColumn outer): same pattern — children first, then `resize(1440, node.height)`
- `combineAsVariants` stacks all at (0,0) — always manually reposition and resize the set after combining
- Button component set node ID is always `11:8` — use `figma.getNodeByIdAsync('11:8')` for instances

---

## Adding a new component — checklist
- [ ] Create `src/storyblok/[Name].astro` following the standard structure
- [ ] Use `blok` prop with `storyblokEditable` on the root element
- [ ] All styles use CSS custom properties
- [ ] Register the component in `astro.config.mjs` under `components: { block_name: 'storyblok/Name' }`
- [ ] Add block schema to `storyblok/schema-reference.md`
- [ ] Add row to component table above in this file
- [ ] Commit with message: "Add [Name] component"
