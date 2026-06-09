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

| Component         | Storyblok block name  | File path                                  | Status      |
|-------------------|-----------------------|--------------------------------------------|-------------|
| Hero              | hero                  | components/Hero/Hero.astro                 | complete    |
| FeatureGrid       | feature_grid          | components/FeatureGrid/FeatureGrid.astro   | complete    |
| TestimonialBlock  | testimonials          | components/TestimonialBlock/ (stub)        | stub        |
| CTABanner         | cta_banner            | components/CTABanner/ (stub)               | stub        |
| LogoBar           | logo_bar              | components/LogoBar/ (stub)                 | stub        |

Update this table every time a component is added or its status changes.

---

## Coding conventions

### Component structure
Every component follows this pattern:

```astro
---
/**
 * ComponentName
 * Storyblok block name: block_name_here
 *
 * Fields: (list all Storyblok fields with types)
 */

interface Props {
  // TypeScript interface matching Storyblok block fields exactly
  field_name: string;
  optional_field?: string;
  class?: string; // always include this for override flexibility
}

const { field_name, optional_field, class: className = '' } = Astro.props;
---

<section class:list={['component-name', className]}>
  <!-- markup -->
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
- Never use hardcoded color, font, spacing, or radius values — always CSS custom properties
- Always include `class?: string` prop for external override flexibility
- Use `class:list` for conditional class merging
- Storyblok image fields are typed as `{ filename: string; alt?: string }`
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
`layouts/BaseLayout.astro` is the root layout. It imports `tokens/dist/tokens.css`.
All client Astro projects use this layout as their base.

Update the Google Fonts link in BaseLayout for each client's brand fonts.

---

## Style Dictionary version note
This repo uses Style Dictionary v5. Token references in JSON files use the v5 syntax:
`{color.neutral.900}` — **not** `{color.neutral.900.value}` (that is v3/v4 syntax and will break the build).

---

## Adding a new component — checklist
- [ ] Create `components/[Name]/[Name].astro` following the standard structure
- [ ] Interface matches Storyblok field schema exactly
- [ ] All styles use CSS custom properties
- [ ] Add block schema to `storyblok/schema-reference.md`
- [ ] Add row to component table above in this file
- [ ] Commit with message: "Add [Name] component"
