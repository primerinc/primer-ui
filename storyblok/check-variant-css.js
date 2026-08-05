#!/usr/bin/env node
/**
 * Finds Storyblok Option fields whose declared values have no matching CSS
 * modifier class in the corresponding Astro component — the class of bug
 * where an editor can select a style variant in the CMS and it silently
 * does nothing, because the schema offers a value the component's <style>
 * block was never built to handle.
 *
 * Found by hand on 2026-07-29 (see the storyblok-variant-check skill for
 * the full story): `background: dark` was selectable in 8 components with
 * zero matching CSS. This script systematizes that manual audit — fetches
 * every live Option field via the Management API, cross-references each
 * declared value against the compiled CSS selectors in the matching
 * `.astro` file, and skips values that correctly need no modifier because
 * they match the component's own default (the base rule already covers the
 * default state — that's not a bug, see the skill's "Known non-findings").
 *
 * Pure reporting script, like check-drift.js and check-build-safety.js:
 * prints one JSON object, always exits 0 unless the Storyblok API call
 * itself fails. Interpreting findings and proposing fixes is the
 * storyblok-variant-check skill's job, not this script's.
 *
 * Usage: node --env-file=.env storyblok/check-variant-css.js [--space <id>]
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseAstroConfigComponents } from './lib/schema-reference.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const DEFAULT_SPACE_ID = '293131252124026'; // Primer Block Space

// Option fields that categorize/configure behavior rather than select a
// visual style — no CSS modifier is ever expected for these, so they'd be
// permanent false positives if left in the scan.
const NON_VISUAL_FIELDS = ['video_type', 'resource_type', 'platform', 'linktype'];

function getArg(flag) {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const spaceId = getArg('--space') || process.env.STORYBLOK_SPACE_ID || DEFAULT_SPACE_ID;
const token = process.env.STORYBLOK_MANAGEMENT_TOKEN;

if (!token) {
  console.error('STORYBLOK_MANAGEMENT_TOKEN not set — run via `node --env-file=.env storyblok/check-variant-css.js`');
  process.exit(1);
}

async function fetchLiveComponents(spaceId) {
  const components = [];
  let page = 1;
  for (;;) {
    const res = await fetch(
      `https://mapi.storyblok.com/v1/spaces/${spaceId}/components?per_page=100&page=${page}`,
      { headers: { Authorization: token } }
    );
    if (!res.ok) {
      throw new Error(`Storyblok API ${res.status} fetching components: ${await res.text()}`);
    }
    const data = await res.json();
    components.push(...data.components);
    if (data.components.length < 100) break;
    page++;
  }
  return components;
}

/** Every Option-type field on a component, with its declared values + default. */
function extractOptionFields(schema) {
  return Object.entries(schema)
    .filter(([, field]) => field.type === 'option')
    .map(([name, field]) => ({
      field: name,
      values: (field.options || []).map((o) => o.value),
      schemaDefault: field.default_value,
    }));
}

/**
 * JS-level fallback defaults, e.g. `const bg = blok.background || 'primary';`
 * or `const layout = blok.layout ?? 'centered';`. Storyblok's own
 * `default_value` is often unset — the component's own fallback is the
 * real effective default, and a value matching it correctly needs no CSS
 * modifier (the base/unmodified rule already renders it).
 */
function extractJsDefaults(source) {
  const frontmatterMatch = source.match(/^---\n([\s\S]*?)\n---/);
  const frontmatter = frontmatterMatch ? frontmatterMatch[1] : '';
  const defaults = {};
  const re = /blok\.(\w+)\s*(?:\|\||\?\?)\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(frontmatter))) defaults[m[1]] = m[2];
  return defaults;
}

/** All class selectors defined in the file's <style> block(s). */
function extractCssClasses(source) {
  const styleBlocks = [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
  const css = styleBlocks.join('\n');
  const classes = new Set();
  const re = /\.([a-zA-Z0-9_-]+)/g;
  let m;
  while ((m = re.exec(css))) classes.add(m[1]);
  return classes;
}

/** Does any defined class look like a modifier for this (field, value)? */
function findMatchingClasses(classes, value) {
  const suffix = value.replace(/_/g, '-');
  return [...classes].filter((c) => c.endsWith(`--${suffix}`) || c.endsWith(`-${suffix}`));
}

async function main() {
  const liveComponents = await fetchLiveComponents(spaceId);
  const astroConfigMap = parseAstroConfigComponents(join(ROOT, 'astro.config.mjs'));

  const report = { space: spaceId, generatedAt: new Date().toISOString(), components: {} };

  for (const component of liveComponents) {
    const optionFields = extractOptionFields(component.schema).filter(
      ({ field }) => !NON_VISUAL_FIELDS.includes(field)
    );
    if (!optionFields.length) continue;

    const filePath = astroConfigMap[component.name];
    if (!filePath) {
      // Nested blocks (e.g. card_item, pricing_plan) aren't resolver-registered
      // and render inline inside their parent — out of scope for this script,
      // same as the manual audit. Flagged separately so it's not silently skipped.
      report.components[component.name] = { skipped: 'not in astro.config.mjs (nested block, checked manually)' };
      continue;
    }

    const fullPath = join(ROOT, 'src', `${filePath}.astro`);
    if (!existsSync(fullPath)) {
      report.components[component.name] = { skipped: `file not found: ${fullPath}` };
      continue;
    }

    const source = readFileSync(fullPath, 'utf8');
    const jsDefaults = extractJsDefaults(source);
    const classes = extractCssClasses(source);

    const findings = [];
    for (const { field, values, schemaDefault } of optionFields) {
      const effectiveDefault = schemaDefault ?? jsDefaults[field];
      for (const value of values) {
        if (value === effectiveDefault) continue; // default needs no modifier — not a bug
        const matches = findMatchingClasses(classes, value);
        findings.push({ field, value, matchingClasses: matches });
      }
    }

    const missing = findings.filter((f) => f.matchingClasses.length === 0);
    if (missing.length) {
      report.components[component.name] = { file: `src/${filePath}.astro`, missing };
    }
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
