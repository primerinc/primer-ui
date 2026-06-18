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

Update this table every time a component is added or its status changes.

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

---

## Storyblok block schemas
Full field reference for every block: `storyblok/schema-reference.md`

When creating a new Storyblok space for a client:
1. Refer to schema-reference.md for each block's field definitions
2. Field names must match the Astro component prop interface exactly
3. Configure the visual editor nesting to match the component hierarchy

---

## BaseLayout
`src/layouts/BaseLayout.astro` is the root layout. It imports `tokens/dist/tokens.css`.
All client Astro projects use this layout as their base.

Update the Google Fonts link in BaseLayout for each client's brand fonts.

---

## Style Dictionary version note
This repo uses Style Dictionary v5. Token references in JSON files use the v5 syntax:
`{color.neutral.900}` — **not** `{color.neutral.900.value}` (that is v3/v4 syntax and will break the build).

---

## Adding a new component — checklist
- [ ] Create `src/storyblok/[Name].astro` following the standard structure
- [ ] Use `blok` prop with `storyblokEditable` on the root element
- [ ] All styles use CSS custom properties
- [ ] Register the component in `astro.config.mjs` under `components: { block_name: 'storyblok/Name' }`
- [ ] Add block schema to `storyblok/schema-reference.md`
- [ ] Add row to component table above in this file
- [ ] Commit with message: "Add [Name] component"
