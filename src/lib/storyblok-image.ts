/**
 * Derives intrinsic width/height for Storyblok images so the browser can reserve
 * space before the file loads. Without these the page reflows as images arrive,
 * which is the single most obvious "cheap site" signal — and the heaviest
 * penalty in a Lighthouse score.
 *
 * Storyblok encodes the asset's natural size in the URL:
 *   https://a.storyblok.com/f/{space}/{width}x{height}/{hash}/{name}
 */

const NATURAL = /\/f\/\d+\/(\d+)x(\d+)\//;

export interface ImageSize {
  width?: number;
  height?: number;
}

/** Natural pixel dimensions of the uploaded asset, if the URL carries them. */
export function naturalSize(filename?: string): Required<ImageSize> | null {
  const match = filename?.match(NATURAL);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  return width > 0 && height > 0 ? { width, height } : null;
}

/**
 * Dimensions an image will actually render at after an `/m/{w}x{h}/` transform.
 * Storyblok treats a 0 in either axis as "scale proportionally", so that case is
 * resolved from the natural aspect ratio.
 *
 * Returns an empty object rather than throwing when the URL has no dimensions —
 * SVGs and external assets still render, they just don't get the CLS benefit.
 *
 * Spread onto an <img>:  <img src={url} {...imageSize(file, 1200, 0)} />
 */
export function imageSize(filename: string | undefined, w = 0, h = 0): ImageSize {
  // A transform that pins both axes needs no lookup — it is the rendered size.
  if (w > 0 && h > 0) return { width: w, height: h };

  const natural = naturalSize(filename);
  if (!natural) return {};

  if (w > 0) return { width: w, height: Math.round((natural.height * w) / natural.width) };
  if (h > 0) return { width: Math.round((natural.width * h) / natural.height), height: h };
  return natural;
}
