/**
 * Faithful port of Utopia.fyi's own clamp formula (github.com/trys/utopia-core,
 * src/index.ts `calculateClamp`) — not reimplemented from memory. Given a
 * min/max viewport width and a min/max size (in px), produces the same
 * `clamp(min, preferred + slope*vw, max)` string Utopia's own calculator
 * would output for those inputs.
 */
export function calculateClamp({ minSize, maxSize, minWidth, maxWidth, usePx = false }) {
  const isNegative = minSize > maxSize;
  const min = isNegative ? maxSize : minSize;
  const max = isNegative ? minSize : maxSize;

  const divider = usePx ? 1 : 16;
  const unit = usePx ? 'px' : 'rem';

  const slope = (maxSize / divider - minSize / divider) / (maxWidth / divider - minWidth / divider);
  const intersection = (-1 * (minWidth / divider)) * slope + minSize / divider;

  const round = (n) => Math.round((n + Number.EPSILON) * 10000) / 10000;

  return `clamp(${round(min / divider)}${unit}, ${round(intersection)}${unit} + ${round(slope * 100)}vw, ${round(max / divider)}${unit})`;
}
