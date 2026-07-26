/**
 * Shared parsing for the two things that describe a Storyblok component
 * outside the live space: storyblok/schema-reference.md's field tables, and
 * astro.config.mjs's block-name -> Astro file map. Used by both
 * check-drift.js (live vs. docs vs. code vs. CLAUDE.md) and
 * check-build-safety.js (which fields are optional, and what type).
 */
import { readFileSync } from 'node:fs';

/**
 * Splits a markdown file into component sections by ## / ### headers and
 * parses each one's `| Field name | Type | ... |` table into
 * {field, type, required} rows. Header text like
 * "feature_item (nested block inside feature_grid)" has its parenthetical
 * stripped to recover the technical name; "###" (nested block) vs "##"
 * (top-level, resolver-registered) is preserved as `level`.
 *
 * Sections with no parsed table (prose subsections like "### Content
 * gating (soft gate)") are dropped — they aren't components.
 */
export function parseSchemaReferenceMd(path) {
  const lines = readFileSync(path, 'utf8').split('\n');
  const sections = [];
  let current = null;
  let headerCells = null;

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)$/);
    const h3 = !h2 && line.match(/^###\s+(.+)$/);
    if (h2 || h3) {
      if (current) sections.push(current);
      const headerText = (h2 ? h2[1] : h3[1]).trim();
      current = { name: headerText.split(/\s/)[0], level: h2 ? 2 : 3, fields: [] };
      headerCells = null;
      continue;
    }
    if (current && line.trim().startsWith('|')) {
      const cells = line.split('|').slice(1, -1).map((c) => c.trim());
      if (cells.length < 2) continue;
      if (cells[0] === 'Field name') {
        headerCells = cells;
        continue;
      }
      if (/^-+$/.test(cells[0].replace(/[: ]/g, ''))) continue; // separator row
      if (!cells[0]) continue;
      const requiredIdx = headerCells ? headerCells.indexOf('Required') : 2;
      current.fields.push({
        field: cells[0],
        type: cells[1],
        required: requiredIdx !== -1 ? cells[requiredIdx] : undefined,
      });
    }
  }
  if (current) sections.push(current);

  return sections.filter((s) => s.fields.length > 0);
}

/** Parses astro.config.mjs's `components: { block_name: 'storyblok/File', ... }`
 *  map. It's a static object literal of quoted strings, so a bracket-depth
 *  scan + regex is enough — no need for a real JS parser. */
export function parseAstroConfigComponents(path) {
  const text = readFileSync(path, 'utf8');
  const startIdx = text.indexOf('components: {');
  if (startIdx === -1) throw new Error('Could not find `components: {` in astro.config.mjs');
  let depth = 0;
  let end = -1;
  for (let i = startIdx + 'components:'.length; i < text.length; i++) {
    if (text[i] === '{') depth++;
    if (text[i] === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const block = text.slice(startIdx, end + 1);
  const map = {};
  const re = /([A-Za-z_][A-Za-z0-9_]*)\s*:\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(block))) map[m[1]] = m[2];
  return map;
}
