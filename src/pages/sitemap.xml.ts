import type { APIRoute } from 'astro';
import { useStoryblokApi } from '@storyblok/astro';

/**
 * Dynamic sitemap, not the static @astrojs/sitemap integration — this repo is
 * pure SSR with content that only exists in Storyblok (no build-time route
 * list to crawl), and it's cloned per client with a different domain each
 * time, so a request-derived origin (matching the pattern already used in
 * BaseLayout/[...slug].astro) is more correct than a hardcoded `site` config.
 *
 * Only the three routable content types are included — `testimonial` stories
 * are reference data (see TestimonialBlock.astro), and `config` is a
 * singleton, not a page. A page can opt out via its own `seo.noindex` field.
 */
const ROUTABLE_TYPES = new Set(['page', 'resource', 'campaign_page']);

interface SeoBlock {
  noindex?: boolean;
}

interface StorySummary {
  full_slug: string;
  content?: { component?: string; seo?: SeoBlock[] };
  published_at?: string | null;
}

export const GET: APIRoute = async ({ site, url }) => {
  const origin = site?.origin ?? url.origin;
  const api = useStoryblokApi();

  const stories: StorySummary[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const { data } = await api.get('cdn/stories', {
      version: 'draft',
      per_page: perPage,
      page,
    });
    stories.push(...(data.stories ?? []));
    if (!data.stories || data.stories.length < perPage) break;
    page += 1;
  }

  const urls = stories
    .filter((s) => ROUTABLE_TYPES.has(s.content?.component ?? ''))
    .filter((s) => !s.content?.seo?.[0]?.noindex)
    .map((s) => ({
      loc: s.full_slug === 'home' ? '/' : `/${s.full_slug}`,
      lastmod: s.published_at ?? undefined,
    }));

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${origin}${u.loc}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod.slice(0, 10)}</lastmod>` : ''}
  </url>`
  )
  .join('\n')}
</urlset>
`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
