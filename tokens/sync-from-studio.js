import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Merges the Tokens Studio export (tokens.studio.json, synced from Figma by the
 * plugin) into the token files Style Dictionary builds from.
 *
 * Figma is authoritative only for the categories in OWNED_BY_FIGMA below.
 * Everything else stays hand-authored here, for two reasons:
 *
 *   1. Figma Variables can't express it at all — shadows are Effect Styles,
 *      motion/easing has no variable type, line-height and letter-spacing live
 *      inside Text Styles.
 *   2. Tokens Studio's "convert to rem" applies to every numeric variable, and
 *      Figma types opacity / border-width / 1px values as plain FLOATs, so they
 *      come back as nonsense lengths (opacity 0.05 -> "0.003rem", 1px ->
 *      "0.063rem", radius full 9999px -> "624.938rem").
 *
 * Widen OWNED_BY_FIGMA only for categories whose exported values have been
 * checked to round-trip losslessly.
 */

const OWNED_BY_FIGMA = [
  ['color'],           // lossless — the layer designers actually iterate on
  ['font', 'family'],  // fallback stack re-attached below
  ['radius'],          // component-scoped: radius.button/card/input etc. exist in
                       // both layers, so a designer can round one component without
                       // touching the rest. Exported in rem rather than px — same
                       // rendered size, and radius.full arrives as 624.938rem.
];

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (p) => JSON.parse(readFileSync(join(__dirname, p), 'utf-8'));

const studio = read('tokens.studio.json');
const setNames = Object.keys(studio).filter((k) => !k.startsWith('$'));

const findSet = (label, pred) => {
  const hit = setNames.find(pred);
  if (!hit) {
    throw new Error(
      `Could not find the ${label} set in tokens.studio.json.\n` +
      `  Sets present: ${setNames.join(', ') || '(none)'}\n` +
      `  Re-run Import Variables in Tokens Studio and push again.`
    );
  }
  return hit;
};

// Set names arrive as "Collection/Mode" and are recreated on every import, so
// match them loosely rather than pinning exact casing.
const isWireframe = (k) => k.toLowerCase().includes('wireframe');
const primitivesSet = findSet('primitives', (k) => k.toLowerCase().startsWith('primitives'));
const semanticSet   = findSet('semantic',   (k) => k.toLowerCase().startsWith('semantic') && !isWireframe(k));

const isToken = (n) => n && typeof n === 'object' && 'value' in n && typeof n.value !== 'object';
const at = (obj, path) => path.reduce((n, k) => (n && typeof n === 'object' ? n[k] : undefined), obj);

/**
 * Figma stores only the family name ("IBM Plex Sans"); the shipped token carries
 * a full stack ("'IBM Plex Sans', system-ui, sans-serif"). Keep the base's
 * fallbacks and swap in the family Figma now specifies.
 */
const withFallbacks = (figmaValue, baseValue) => {
  const family = String(figmaValue).replace(/^['"]|['"]$/g, '');
  const quoted = /\s/.test(family) ? `'${family}'` : family;
  const fallbacks = String(baseValue ?? '').split(',').slice(1).join(',').trim();
  return fallbacks ? `${quoted}, ${fallbacks}` : quoted;
};

/** Copy Figma's values for one category onto the base tree, in place. */
const applyCategory = (base, figma, path) => {
  const source = at(figma, path);
  if (!source) return 0;

  let applied = 0;
  const walk = (src, dst, trail) => {
    for (const [key, node] of Object.entries(src)) {
      if (key.startsWith('$') || !node || typeof node !== 'object') continue;

      if (isToken(node)) {
        const isFontFamily = trail[0] === 'font' && trail[1] === 'family';
        const value = isFontFamily ? withFallbacks(node.value, dst[key]?.value) : node.value;
        if (dst[key]?.value !== value) applied++;
        dst[key] = { value };
      } else {
        dst[key] ??= {};
        walk(node, dst[key], [...trail, key]);
      }
    }
  };

  let target = base;
  for (const key of path) target = target[key] ??= {};
  walk(source, target, path);
  return applied;
};

for (const [file, setName] of [['primitives.json', primitivesSet], ['semantic.json', semanticSet]]) {
  const base = read(file);
  const changed = OWNED_BY_FIGMA.reduce(
    (sum, path) => sum + applyCategory(base, studio[setName], path), 0
  );
  writeFileSync(join(__dirname, file), `${JSON.stringify(base, null, 2)}\n`);
  console.log(`  ${file} <- "${setName}" (${changed} value${changed === 1 ? '' : 's'} updated from Figma)`);
}

console.log('Synced from tokens.studio.json');
