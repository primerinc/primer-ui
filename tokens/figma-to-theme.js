#!/usr/bin/env node
/**
 * Figma variables → tokens/themes/<client>.json
 *
 * For clients whose design source is a Figma file's own variables (Primer
 * naming: color/text/primary, font/size/lg, space/8) rather than Tokens
 * Studio. Claude exports the variables and text styles with the Figma plugin
 * API (tokens/figma/export-variables.js, run through use_figma) into a
 * committed snapshot, tokens/figma/variables.json. This script turns the
 * snapshot into a Style Dictionary theme layered over primitives.json +
 * semantic.json. Everything client-specific (viewport range, phone sizes,
 * strays to ignore, fallbacks) lives in tokens/figma/theme.config.js.
 *
 *   npm run build:tokens:figma     (this script, then Style Dictionary)
 *
 * See the figma-variables-to-tokens skill. First built for Forte (2026-10-22).
 *
 * Deviation from the primer-ui theme convention: primer themes only override
 * primitives. A client Figma that remaps semantic meanings (text/secondary →
 * a brand blue) needs semantic overrides too, so this theme writes them.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { calculateClamp } from './lib/utopia-clamp.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = (await import(pathToFileURL(join(__dirname, 'figma/theme.config.js')).href)).default;
const SNAPSHOT = join(__dirname, 'figma', config.snapshot ?? 'variables.json');
const OUT = join(__dirname, 'themes', `${config.theme}.json`);
const { minVw: MIN_VW, maxVw: MAX_VW, fontMin: FONT_MIN = {}, eyebrowMin: EYEBROW_MIN, paddingX: PADDING_X, spaceMin } = config;
const IGNORE = new Set(config.ignore ?? []);
const SKIP_FONT_SIZES = new Set(config.skipFontSizes ?? []);

const WEIGHTS = { Thin: 100, ExtraLight: 200, Light: 300, Regular: 400, Medium: 500, SemiBold: 600, Bold: 700, ExtraBold: 800, Black: 900 };

const rem = (px) => `${Math.round((px / 16) * 10000) / 10000}rem`;
const fluid = (min, max) => calculateClamp({ minSize: min, maxSize: max, minWidth: MIN_VW, maxWidth: MAX_VW });

const snapshot = JSON.parse(readFileSync(SNAPSHOT, 'utf-8'));
const byName = Object.fromEntries(snapshot.variables.map((v) => [v.name, v]));
const theme = {};
const warnings = [];

function set(path, value, comment) {
  const keys = path.split('.');
  let node = theme;
  for (const k of keys.slice(0, -1)) node = node[k] ??= {};
  node[keys.at(-1)] = comment ? { value, comment } : { value };
}

// Figma variable name → code token path. Returns null for names we don't map.
function codePath(name) {
  const p = name.split('/');
  switch (p[0]) {
    case 'color':
    case 'border-width':
    case 'opacity':
    case 'font':
      return p.join('.');
    case 'radius':
      return p.join('.');
    case 'space':
      return `space.${p[1] === '0-5' ? '0.5' : p[1]}`;
    case 'size':
      // primitives size/1240 etc. are only used through size/container/*
      return p[1] === 'container' ? `container.${p[2]}` : null;
    case 'line-height':
      return `line-height.${p[1]}`;
    case 'spacing':
    case 'type':
      return p.join('.');
    default:
      return null;
  }
}

const ref = (name) => {
  const path = codePath(name);
  if (!path) throw new Error(`No code path for alias target ${name}`);
  return `{${path}}`;
};

// ---- Primitives ---------------------------------------------------------------
for (const v of snapshot.variables) {
  if (v.collection !== 'primitives' || IGNORE.has(v.name)) continue;
  const path = codePath(v.name);
  if (!path) continue;
  const [group, sub, key] = v.name.split('/');

  if (v.alias) { set(path, ref(v.alias)); continue; }

  if (v.type === 'COLOR') set(path, v.value);
  else if (group === 'font' && sub === 'family') {
    set(path, sub && key === 'mono' ? `'${v.value}', 'Courier New', monospace` : `${v.value}, system-ui, sans-serif`);
  } else if (group === 'font' && sub === 'weight') set(path, WEIGHTS[v.value] ?? v.value);
  else if (group === 'font' && sub === 'size') {
    if (SKIP_FONT_SIZES.has(key)) continue; // only used as a phone size, not a step of its own
    const min = FONT_MIN[key];
    set(path, min ? fluid(min, v.value) : rem(v.value));
  } else if (group === 'space') {
    const min = spaceMin(v.value);
    set(path, v.value === 0 ? '0' : v.value === 1 ? '1px' : min ? fluid(min, v.value) : rem(v.value));
  } else if (group === 'radius') set(path, v.value >= 9999 ? '9999px' : rem(v.value));
  else if (group === 'border-width') set(path, v.value === 0 ? '0' : `${v.value}px`);
  else if (group === 'opacity') set(path, String(Math.round(v.value * 100) / 100));
  else if (group === 'line-height') set(path, String(v.value / 100));
  else warnings.push(`unhandled primitive ${v.name}`);
}

// container.* comes from size/container/* (semantic in Figma, primitive in primer)
for (const v of snapshot.variables) {
  if (!v.name.startsWith('size/container/')) continue;
  set(codePath(v.name), rem(byName[v.alias].value));
}

// Primer tokens the client's Figma doesn't define (e.g. the numeric brand
// ramp, status subtle steps): point them at the client's own colours.
for (const [path, value, comment] of config.primitiveFallbacks ?? []) set(path, value, comment);

// ---- Semantic -----------------------------------------------------------------
for (const v of snapshot.variables) {
  if (v.collection !== 'semantic' || v.name.startsWith('size/container/')) continue;
  const path = codePath(v.name);
  if (!path) { warnings.push(`no code path for ${v.name}`); continue; }
  if (!v.alias) { warnings.push(`semantic ${v.name} has a raw value, not an alias`); continue; }
  set(path, ref(v.alias));
}

// Fluid overrides that Figma (one static value per variable) can't express.
if (PADDING_X) set('spacing.section.padding-x', fluid(PADDING_X.min, PADDING_X.max), `Side margin: ${PADDING_X.min}px on phones, ${PADDING_X.max}px at ${MAX_VW}`);
if (EYEBROW_MIN && byName['font/size/md']) set('type.eyebrow.size', fluid(EYEBROW_MIN, byName['font/size/md'].value), `Eyebrow: ${EYEBROW_MIN}px on phones`);

// Primer semantic tokens the components use that the client's Figma doesn't name
for (const [path, value, comment] of config.semanticFallbacks ?? []) set(path, value, comment);

// Letter-spacing and line-height from the Figma text styles, in em so they
// scale with fluid font sizes.
for (const s of snapshot.textStyles) {
  const slug = s.name.toLowerCase().replace(/\//g, '-');
  const lh = s.lineHeight.unit === 'PERCENT' ? Math.round(s.lineHeight.value) / 100 : null;
  const ls = s.letterSpacing.unit === 'PIXELS' ? s.letterSpacing.value / s.size : s.letterSpacing.value / 100;
  set(`type.style.${slug}.line-height`, String(lh));
  set(`type.style.${slug}.letter-spacing`, ls ? `${Math.round(ls * 10000) / 10000}em` : '0');
}

writeFileSync(OUT, JSON.stringify(theme, null, 2) + '\n');
console.log(`Wrote ${OUT}`);
for (const name of IGNORE) if (byName[name]) console.log(`Skipped stray Figma variable: ${name}`);
if (warnings.length) { console.warn(warnings.join('\n')); process.exitCode = 1; }
