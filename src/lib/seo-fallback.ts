/**
 * Derives a meta description and OG image from a page's own body content
 * when the editor never fills in the `seo` block's fields — so a client
 * doesn't have to write SEO copy by hand for every page they create. Title
 * already has this fallback ([...slug].astro / index.astro pass
 * `metatags?.title || story.name`); this covers description and image,
 * which had no fallback before and shipped with an empty <meta
 * name="description"> whenever an editor skipped the seo block.
 *
 * Walks `body` in render order and uses the first block with usable copy —
 * intentionally not "smartest" extraction (no scoring/ranking), since the
 * first section of a page is usually the one that best represents it (a
 * hero, an intro rich_text block, etc.) and predictable beats clever here.
 */

interface Blok {
  component?: string;
  [key: string]: unknown;
}

const TEXT_FIELDS_BY_PRIORITY = ['subheadline', 'body', 'description', 'quote', 'text', 'tagline'];

/** Flattens a Storyblok richtext doc's text nodes into plain text. */
function richtextToPlainText(doc: unknown): string {
  if (!doc || typeof doc !== 'object') return '';
  const node = doc as { type?: string; text?: string; content?: unknown[] };
  if (node.type === 'text' && typeof node.text === 'string') return node.text;
  if (Array.isArray(node.content)) {
    return node.content.map(richtextToPlainText).join(' ');
  }
  return '';
}

function truncate(text: string, max = 155): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

export function deriveFallbackDescription(body: Blok[] | undefined): string | undefined {
  for (const blok of body ?? []) {
    for (const field of TEXT_FIELDS_BY_PRIORITY) {
      const value = blok[field];
      if (typeof value === 'string' && value.trim()) return truncate(value);
      if (value && typeof value === 'object') {
        const plain = richtextToPlainText(value);
        if (plain.trim()) return truncate(plain);
      }
    }
  }
  return undefined;
}

const IMAGE_FIELDS_BY_PRIORITY = ['background_image', 'image', 'photo', 'poster'];

export function deriveFallbackImage(body: Blok[] | undefined): string | undefined {
  for (const blok of body ?? []) {
    for (const field of IMAGE_FIELDS_BY_PRIORITY) {
      const asset = blok[field] as { filename?: string } | undefined;
      if (asset?.filename) return `${asset.filename}/m/1200x630/filters:quality(80)`;
    }
  }
  return undefined;
}
