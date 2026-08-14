/**
 * Shared fetch/mapping logic for the resource archive pages
 * (src/pages/resources/index.astro, src/pages/resources/[category].astro).
 *
 * `resource` has no dedicated card image/excerpt field yet (see
 * schema-reference.md's `resource` table — title is "reserved for a future
 * resource-listing/index page" but no image/excerpt field exists alongside
 * it) — so card art/copy reuses the same derive-from-body-content fallback
 * already built for SEO (src/lib/seo-fallback.ts), rather than duplicating
 * that logic. Worth adding real `card_image`/`card_excerpt` fields on
 * `resource` later so editors can override this per entry — noted here so
 * it's not forgotten, not done in this pass since it's a live-space schema
 * change, not just code.
 */
import { deriveFallbackDescription, deriveFallbackImage } from './seo-fallback';

export interface ResourceCategory {
  /** URL segment: /resources/[slug] */
  slug: string;
  /** Storyblok resource_type Option value */
  resourceType: string;
  /** Display label */
  label: string;
}

// Keep in sync with resource.resource_type's Option field values in Storyblok
// (schema-reference.md's `resource` table: blog, case_study, webinar, research).
export const RESOURCE_CATEGORIES: ResourceCategory[] = [
  { slug: 'blog',          resourceType: 'blog',       label: 'Blog' },
  { slug: 'case-studies',  resourceType: 'case_study', label: 'Case Studies' },
  { slug: 'webinars',      resourceType: 'webinar',    label: 'Webinars' },
  { slug: 'research',      resourceType: 'research',   label: 'Research' },
];

export function categoryBySlug(slug: string): ResourceCategory | undefined {
  return RESOURCE_CATEGORIES.find((c) => c.slug === slug);
}

interface RawResourceStory {
  id: number;
  name: string;
  full_slug: string;
  first_published_at?: string | null;
  content: {
    title?: string;
    resource_type?: string;
    featured?: boolean;
    body?: Record<string, unknown>[];
  };
}

export interface ResourceCard {
  id: number;
  href: string;
  title: string;
  resourceType: string;
  categoryLabel: string;
  excerpt?: string;
  image?: string;
  featured: boolean;
  publishedAt?: string;
}

function toCard(story: RawResourceStory): ResourceCard {
  const category = RESOURCE_CATEGORIES.find((c) => c.resourceType === story.content.resource_type);
  return {
    id: story.id,
    href: `/${story.full_slug}`,
    title: story.content.title || story.name,
    resourceType: story.content.resource_type || '',
    categoryLabel: category?.label ?? story.content.resource_type ?? '',
    excerpt: deriveFallbackDescription(story.content.body),
    image: deriveFallbackImage(story.content.body),
    featured: !!story.content.featured,
    publishedAt: story.first_published_at ?? undefined,
  };
}

const PER_PAGE = 12;

/**
 * Fetches one page of published `resource` stories, newest first.
 * @param resourceType Filter to one resource_type, or omit for all categories.
 */
export async function fetchResources(
  api: { get: (path: string, params: Record<string, unknown>) => Promise<{ data: { stories: RawResourceStory[] }; headers: Headers }> },
  { resourceType, page = 1 }: { resourceType?: string; page?: number }
): Promise<{ cards: ResourceCard[]; total: number; page: number; perPage: number }> {
  const params: Record<string, unknown> = {
    version: 'draft',
    content_type: 'resource',
    sort_by: 'first_published_at:desc',
    per_page: PER_PAGE,
    page,
  };
  if (resourceType) {
    params.filter_query = { resource_type: { in: resourceType } };
  }

  const { data, headers } = await api.get('cdn/stories', params);
  const total = Number(headers?.get?.('total') ?? data.stories.length);

  return {
    cards: data.stories.map(toCard),
    total,
    page,
    perPage: PER_PAGE,
  };
}
