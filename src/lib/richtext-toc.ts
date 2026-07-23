/**
 * Derives a table of contents from a Storyblok richtext doc by walking its
 * JSON node tree for H2/H3 headings — no editor curation required.
 */

interface RichTextNode {
  type?: string;
  attrs?: { level?: number };
  text?: string;
  content?: RichTextNode[];
}

export interface TocHeading {
  level: number;
  text: string;
  slug: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function extractText(node: RichTextNode): string {
  if (node.type === 'text') return node.text || '';
  if (!node.content) return '';
  return node.content.map(extractText).join('');
}

export function extractHeadings(doc?: RichTextNode): TocHeading[] {
  const headings: TocHeading[] = [];
  const slugCounts = new Map<string, number>();

  const walk = (node: RichTextNode) => {
    if (node.type === 'heading' && (node.attrs?.level === 2 || node.attrs?.level === 3)) {
      const text = extractText(node).trim();
      if (text) {
        const base = slugify(text);
        const count = slugCounts.get(base) || 0;
        slugCounts.set(base, count + 1);
        const slug = count === 0 ? base : `${base}-${count + 1}`;
        headings.push({ level: node.attrs!.level!, text, slug });
      }
    }
    node.content?.forEach(walk);
  };

  doc?.content?.forEach(walk);
  return headings;
}

/**
 * Storyblok's renderRichText emits plain `<h2>`/`<h3>` tags with no id.
 * Rather than reach into tiptap's extension internals to inject attrs during
 * render, walk the already-rendered HTML string and stamp ids on in document
 * order — headings must have been extracted from the same doc beforehand so
 * the two lists line up.
 */
export function injectHeadingIds(html: string, headings: TocHeading[]): string {
  let i = 0;
  return html.replace(/<h([23])>/g, (match) => {
    const heading = headings[i];
    i++;
    return heading ? `<h${heading.level} id="${heading.slug}">` : match;
  });
}
