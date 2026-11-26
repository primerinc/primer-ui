/**
 * Client settings for tokens/figma-to-theme.js. Copy and edit per client;
 * the values below are Forte's (Concept C, 2026-10-22) as a worked example.
 *
 * Figma holds the desktop value of each variable. The phone value comes from
 * rules agreed with the designer, kept here so they're easy to retune.
 * Keep every fluid font size's max at most 2.5× its min (good-css / WCAG zoom).
 */
export default {
  theme: 'client', // writes tokens/themes/<theme>.json; set PRIMER_THEME to the same name
  snapshot: 'variables.json', // tokens/figma/<snapshot>, written by export-variables.js

  // Fluid range: phone width → desktop design width (Figma frames)
  minVw: 375,
  maxVw: 1440,

  // Phone size for each fluid font step, keyed by its Figma name (font/size/<key>).
  // Steps not listed stay static.
  fontMin: { '5xl': 40, '4xl': 36, '3xl': 28, '2xl': 22, xl: 19, lg: 17 },
  // font/size/<key> variables only used as a phone size, not a step of their own
  skipFontSizes: ['17'],
  // Eyebrow: Figma's font/size/md on desktop, this on phones (omit to keep it static)
  eyebrowMin: 14,

  // Phone value for a spacing step (px in, px out), or null to keep it static.
  // Forte: below 32 static; 32→80 shrinks ×0.875→×0.6; 96 and up follows
  // "section spacing 96–128 → 48–64".
  spaceMin(px) {
    if (px < 32) return null;
    if (px >= 96) return 48 + (px - 96) / 2;
    const t = (px - 32) / (80 - 32);
    return Math.round(px * (0.875 - t * (0.875 - 0.6)) * 100) / 100;
  },

  // Section side margin (desktop margin in Figma → phone gutter)
  paddingX: { min: 16, max: 100 },

  // Figma variables that aren't part of the system (left in by accident)
  ignore: ['Background', 'Color/neutral/200'],

  // [token path, value, comment?]: primer primitives the client's Figma
  // doesn't define, pointed at the client's colours so nothing renders in
  // primer's default gold. Check `npm run check:contrast` after changing these.
  primitiveFallbacks: [
    ['color.brand.100', '{color.neutral.50}', 'no light brand tint in Figma; neutral instead'],
    ['color.brand.200', '{color.neutral.100}'],
    ['color.brand.300', '{color.neutral.200}'],
    ['color.brand.400', '{color.brand.orange}'],
    ['color.brand.500', '{color.brand.orange}'],
    ['color.brand.600', '{color.brand.orange-dark}'],
    ['color.brand.700', '{color.brand.orange-dark}'],
    ['color.brand.900', '{color.neutral.900}'],
    ['color.success.subtle', '{color.success.bg}'],
    ['color.warning.subtle', '{color.warning.bg}'],
    ['color.danger.subtle', '{color.danger.bg}'],
  ],

  // [token path, value, comment?]: primer semantic tokens the components use
  // that the client's Figma doesn't name
  semanticFallbacks: [
    ['font.weight.heading', '{type.heading.weight}'],
    ['font.weight.body', '{type.body.weight-regular}'],
    ['color.bg.selected', '{color.neutral.100}'],
    ['color.accent.muted', '{color.neutral.200}'],
  ],
};
