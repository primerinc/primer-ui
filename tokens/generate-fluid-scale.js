#!/usr/bin/env node
/**
 * Generates fluid clamp() values for the font-size and spacing steps that
 * should scale smoothly between viewports, Utopia.fyi-style — and leaves
 * everything else (small/atomic sizes, where a clamp() adds complexity for
 * no visible benefit) as a static value, same as font.size.2xs–lg and every
 * space.* step below the fluid cutoff already are.
 *
 * Viewport bounds: 360px min, 1240px max (chosen 2026-08-05). NOTE:
 * font.size.xl–5xl previously held clamp() values built on Utopia.fyi's own
 * default bounds (375/1440, reverse-engineered from the existing numbers,
 * not documented anywhere) — this script replaces those with the same
 * 360/1240 bounds as everything else here, so the whole system transitions
 * at one consistent pair of viewport widths rather than two silently
 * different ones.
 *
 * Compression policy (the actual design decision here, kept deliberately
 * visible and easy to retune rather than buried in a formula): each fluid
 * step's max (desktop, 1240px) value is UNCHANGED from what's already in
 * primitives.json — this script only computes new min (360px, mobile)
 * values and regenerates the clamp() string. The min value is the max value
 * times a compression factor that decreases linearly across the fluid
 * range — smaller/closer-to-body-text sizes compress the least (they stay
 * closer to their desktop size on mobile), larger/hero-headline or
 * big-section-padding sizes compress the most. This is the same shape
 * Utopia's own type/space scales produce, just parameterized directly by
 * compression % instead of a min/max type-scale ratio, since the existing
 * scale isn't a clean single-ratio geometric progression to begin with.
 *
 * Usage: node tokens/generate-fluid-scale.js [--write]
 * Without --write, prints the computed table without touching primitives.json.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { calculateClamp } from './lib/utopia-clamp.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRIMITIVES_PATH = join(__dirname, 'primitives.json');

const MIN_VIEWPORT = 360;
const MAX_VIEWPORT = 1240;

// Which font.size steps get fluid-clamped (their current rem value becomes
// the max/1240px endpoint), and the compression factor applied to derive
// the min/360px endpoint. font.size.2xs–lg are intentionally left out —
// they're body/UI text, already static, and that's a deliberate existing
// design choice this script preserves, not an oversight.
const FONT_SIZE_FLUID = [
  { key: 'xl', compression: 0.85 },
  { key: '2xl', compression: 0.775 },
  { key: '3xl', compression: 0.70 },
  { key: '4xl', compression: 0.625 },
  { key: '5xl', compression: 0.55 },
];

// Which space.* steps get fluid-clamped. Only the larger, structural steps
// (32px/space.8 and up — section padding, big layout gaps) — space.1
// through space.7 plus space.px/space["0.5"] are component-level micro
// spacing (gaps, borders, icon padding) that don't meaningfully benefit
// from fluid scaling and are left as static values.
const SPACE_FLUID_KEYS = ['8', '10', '12', '14', '16', '20', '24', '28', '32', '40', '48', '64'];

function remToPx(remString) {
  return parseFloat(remString) * 16;
}

const primitives = JSON.parse(readFileSync(PRIMITIVES_PATH, 'utf-8'));

const fontResults = FONT_SIZE_FLUID.map(({ key, compression }) => {
  const current = primitives.font.size[key].value;
  const maxPxMatch = current.match(/,\s*([\d.]+)rem\)$/); // pull the max endpoint out of an existing clamp, or...
  const maxPx = maxPxMatch ? parseFloat(maxPxMatch[1]) * 16 : remToPx(current);
  const minPx = Math.round(maxPx * compression * 100) / 100;
  const clamp = calculateClamp({ minSize: minPx, maxSize: maxPx, minWidth: MIN_VIEWPORT, maxWidth: MAX_VIEWPORT });
  return { key, minPx, maxPx, compression, clamp, previous: current };
});

const spaceResults = SPACE_FLUID_KEYS.map((key, i) => {
  const current = primitives.space[key].value;
  const maxPx = remToPx(current);
  // linear compression from 0.9 (smallest fluid step) to 0.55 (largest)
  const compression = 0.9 - (0.9 - 0.55) * (i / (SPACE_FLUID_KEYS.length - 1));
  const minPx = Math.round(maxPx * compression * 100) / 100;
  const clamp = calculateClamp({ minSize: minPx, maxSize: maxPx, minWidth: MIN_VIEWPORT, maxWidth: MAX_VIEWPORT });
  return { key, minPx, maxPx, compression: Math.round(compression * 1000) / 1000, clamp, previous: current };
});

console.log(`\nfont.size (${MIN_VIEWPORT}px → ${MAX_VIEWPORT}px):`);
console.table(fontResults.map(({ key, minPx, maxPx, compression, clamp }) => ({ key, minPx, maxPx, compression, clamp })));

console.log(`\nspace (${MIN_VIEWPORT}px → ${MAX_VIEWPORT}px):`);
console.table(spaceResults.map(({ key, minPx, maxPx, compression, clamp }) => ({ key, minPx, maxPx, compression, clamp })));

if (process.argv.includes('--write')) {
  for (const { key, clamp } of fontResults) primitives.font.size[key].value = clamp;
  for (const { key, clamp } of spaceResults) primitives.space[key].value = clamp;
  writeFileSync(PRIMITIVES_PATH, JSON.stringify(primitives, null, 2) + '\n');
  console.log(`\nWrote ${fontResults.length} font.size and ${spaceResults.length} space values to ${PRIMITIVES_PATH}`);
} else {
  console.log('\nDry run — nothing written. Re-run with --write to apply.');
}
