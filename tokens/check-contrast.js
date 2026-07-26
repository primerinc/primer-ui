import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * WCAG contrast audit over the compiled tokens.
 *
 * Run this for every client palette. Semantic colours are Figma-owned (see
 * OWNED_BY_FIGMA in sync-from-studio.js), so failures are fixed by repointing
 * the semantic variable in Figma at a darker or lighter step — not by editing
 * tokens here, which the next sync would revert.
 *
 *   npm run check:contrast
 *
 * Exits non-zero on failure so it can gate a deploy.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(__dirname, 'dist/tokens.css'), 'utf-8');

const tokens = Object.fromEntries(
  [...css.matchAll(/--p-(color-[\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]),
);

const luminance = (hex) => {
  const channels = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// AA: 4.5 for body text, 3.0 for large text (>=24px, or >=19px bold) and for
// non-text UI such as focus rings and borders that carry meaning.
const BODY = 4.5;
const LARGE = 3.0;

/** Pairs that actually occur in the components, not every possible combination. */
const PAIRS = [
  ['color-text-primary',        'color-bg-primary',      'body text on page',        BODY],
  ['color-text-secondary',      'color-bg-primary',      'secondary text',           BODY],
  ['color-text-tertiary',       'color-bg-primary',      'captions / eyebrows',      BODY],
  ['color-text-accent',         'color-bg-primary',      'accent eyebrows',          BODY],
  ['color-text-accent-strong',  'color-bg-primary',      'prose links',              BODY],

  ['color-text-primary',        'color-bg-secondary',    'body on tinted section',   BODY],
  ['color-text-secondary',      'color-bg-secondary',    'secondary on tint',        BODY],
  ['color-text-accent',         'color-bg-accent',       'accent on accent wash',    BODY],

  ['color-text-on-accent',      'color-accent-default',  'primary button label',     BODY],
  ['color-text-on-accent',      'color-accent-hover',    'primary button, hovered',  BODY],
  ['color-text-inverse',        'color-bg-inverse',      'footer / inverse surfaces',BODY],

  ['color-border-focus',        'color-bg-primary',      'focus ring',               LARGE],
  ['color-border-default',      'color-bg-primary',      'input borders',            LARGE],

  ['color-status-danger-text',  'color-status-danger-bg','error message',            BODY],
  ['color-status-success-text', 'color-status-success-bg','success message',         BODY],
];

let failures = 0;
const rows = [];

for (const [fg, bg, label, required] of PAIRS) {
  if (!tokens[fg] || !tokens[bg]) {
    rows.push(['SKIP', label, '—', `missing token: ${!tokens[fg] ? fg : bg}`]);
    continue;
  }
  const value = ratio(tokens[fg], tokens[bg]);
  const ok = value >= required;
  if (!ok) failures++;
  rows.push([
    ok ? 'pass' : 'FAIL',
    label,
    `${value.toFixed(2)}:1`,
    `needs ${required}  ${tokens[fg]} on ${tokens[bg]}`,
  ]);
}

const width = Math.max(...rows.map((r) => r[1].length));
console.log('\nWCAG AA contrast\n');
for (const [status, label, value, note] of rows) {
  const mark = status === 'FAIL' ? '✗' : status === 'SKIP' ? '–' : '✓';
  console.log(`  ${mark} ${label.padEnd(width)}  ${value.padStart(7)}   ${note}`);
}

if (failures) {
  console.log(
    `\n${failures} pair${failures === 1 ? '' : 's'} below AA.\n` +
    `Fix in Figma by repointing the semantic variable at a darker/lighter step —\n` +
    `editing tokens/semantic.json directly is reverted by the next token sync.\n`,
  );
  process.exit(1);
}

console.log('\nAll pairs meet AA.\n');
