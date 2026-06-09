# Client Themes

Each file in this directory is a per-client override of `tokens/semantic.json`.

## Creating a new client theme

1. Copy `tokens/semantic.json` to `tokens/themes/[client-slug].json`
2. Update the color values to match the client's brand
3. Run `npm run build:tokens` — this regenerates `tokens/dist/tokens.css`
4. Copy the new `tokens.css` into the client's Astro project

## Naming convention

Use the client's project slug, all lowercase with hyphens:
- `acme-corp.json`
- `dental-lab.json`
- `tech-startup.json`

Do not commit partial or in-progress theme files to main.
Always test by running the build script before committing.
