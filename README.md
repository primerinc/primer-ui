# primer-ui

Primer's shared Astro component library for client builds.

## What's in here

- `tokens/` — Design token system (Style Dictionary)
- `components/` — Astro components keyed to Storyblok blocks
- `layouts/` — Base Astro layouts
- `storyblok/` — Block schema reference for Storyblok setup
- `CLAUDE.md` — Context file for Claude Code sessions

## Setup

```bash
npm install
npm run build:tokens
```

## Token build

Compiles `tokens/primitives.json` + `tokens/semantic.json` → `tokens/dist/tokens.css`

```bash
npm run build:tokens   # one-time build
npm run watch:tokens   # rebuild on file change
```

## Per-client theme

1. Copy `tokens/semantic.json` → `tokens/themes/[client].json`
2. Update brand values
3. Run `npm run build:tokens`
4. Replace `tokens.css` in the client project

## Component reference

See `storyblok/schema-reference.md` for Storyblok field definitions.
See `CLAUDE.md` for full coding conventions and component inventory.
