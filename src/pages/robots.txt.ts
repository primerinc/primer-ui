import type { APIRoute } from 'astro';

// Same request-derived-origin pattern as sitemap.xml.ts / BaseLayout — this
// repo is cloned per client onto a different domain each time, so the
// Sitemap directive can't be a hardcoded value.
export const GET: APIRoute = async ({ site, url }) => {
  const origin = site?.origin ?? url.origin;

  const body = `User-agent: *
Allow: /

Sitemap: ${origin}/sitemap.xml
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
