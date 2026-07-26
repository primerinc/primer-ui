/**
 * JSON-LD builders for SEO and answer engines (AEO/GEO).
 *
 * Everything is emitted as a single `@graph` with stable `@id`s so the nodes
 * reference each other rather than repeating themselves — an Article points at
 * the Organization that published it instead of inlining a second copy. Answer
 * engines resolve those relationships; a page of disconnected islands gives
 * them much less to work with.
 *
 * FAQPage is deliberately not here: it's built inside FAQ.astro, because the
 * questions live in that block and it already gates on include_schema.
 */

export interface SchemaNode {
  '@type': string;
  '@id'?: string;
  [key: string]: unknown;
}

/** Stable identifiers, so nodes can point at each other across the graph. */
export const ids = {
  organization: (origin: string) => `${origin}/#organization`,
  website: (origin: string) => `${origin}/#website`,
  page: (url: string) => `${url}#webpage`,
};

export interface OrganizationInput {
  origin: string;
  name: string;
  logo?: string;
  sameAs?: string[];
}

export function organization({ origin, name, logo, sameAs }: OrganizationInput): SchemaNode {
  return {
    '@type': 'Organization',
    '@id': ids.organization(origin),
    name,
    url: `${origin}/`,
    ...(logo ? { logo: { '@type': 'ImageObject', url: logo } } : {}),
    // Social profiles are how engines confirm this is the same entity they
    // already know about elsewhere.
    ...(sameAs?.length ? { sameAs } : {}),
  };
}

export function website(origin: string, name: string): SchemaNode {
  return {
    '@type': 'WebSite',
    '@id': ids.website(origin),
    url: `${origin}/`,
    name,
    publisher: { '@id': ids.organization(origin) },
  };
}

/** Storyblok's resource_type maps onto the closest schema.org type. */
const ARTICLE_TYPES: Record<string, string> = {
  blog: 'BlogPosting',
  case_study: 'Article',
  webinar: 'Article',
  research: 'Article',
};

export interface ArticleInput {
  origin: string;
  url: string;
  headline: string;
  description?: string;
  image?: string;
  datePublished?: string;
  dateModified?: string;
  resourceType?: string;
}

export function article({
  origin, url, headline, description, image, datePublished, dateModified, resourceType,
}: ArticleInput): SchemaNode {
  return {
    '@type': ARTICLE_TYPES[resourceType ?? ''] ?? 'Article',
    '@id': ids.page(url),
    headline,
    ...(description ? { description } : {}),
    ...(image ? { image } : {}),
    // Engines weight freshness; omit rather than invent a date.
    ...(datePublished ? { datePublished } : {}),
    ...(dateModified ? { dateModified } : {}),
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    isPartOf: { '@id': ids.website(origin) },
    publisher: { '@id': ids.organization(origin) },
    author: { '@id': ids.organization(origin) },
  };
}

/**
 * Wraps nodes in one @graph. Returns null when there's nothing worth emitting,
 * so callers can skip the script tag entirely rather than shipping an empty one.
 */
export function graph(nodes: (SchemaNode | null | undefined)[]): string | null {
  const present = nodes.filter((n): n is SchemaNode => Boolean(n));
  if (!present.length) return null;
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': present });
}

/**
 * Parses an editor-supplied JSON-LD blob. Invalid JSON is dropped rather than
 * thrown — a typo in a CMS field should not take the page down, and a missing
 * schema block is a far smaller problem than a 500.
 */
export function parseCustomSchema(raw?: string): SchemaNode | SchemaNode[] | null {
  if (!raw?.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    console.warn('[schema] custom_schema is not valid JSON — skipping');
    return null;
  }
}
