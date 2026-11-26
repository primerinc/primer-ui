import { sequence, defineMiddleware } from 'astro:middleware';
import { onRequest as storyblokLivePreview } from '@storyblok/astro/middleware.ts';
import { preventOrphans } from './lib/no-orphans';
import { findRedirect } from './lib/redirects';
import { isEditorRequest, isPublishedMode } from './lib/content-version';

// See src/lib/redirects.ts: 301s editors add under Datasources › Redirects.
const redirects = defineMiddleware(async (context, next) => {
  const { request, url } = context;
  if (request.method !== 'GET' && request.method !== 'HEAD') return next();
  if (/^\/_(astro|image|server-islands)\//.test(url.pathname)) return next();
  if (url.searchParams.has('_storyblok')) return next(); // the Visual Editor
  const found = await findRedirect(url);
  if (!found) return next();
  if (!found.wildcard) return context.redirect(found.to, 301);
  // A wildcard never hides a real page: render first, redirect only on a 404
  const response = await next();
  return response.status === 404 ? context.redirect(found.to, 301) : response;
});

// See src/lib/no-orphans.ts: no paragraph ends with one word on its own line.
const noOrphans = defineMiddleware(async (_context, next) => {
  const response = await next();
  if (!response.headers.get('content-type')?.includes('text/html')) return response;

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(preventOrphans(await response.text()), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
});

/**
 * Security headers Netlify doesn't add itself (it already sends HSTS and
 * nosniff). They're set here rather than in netlify.toml because pages are
 * rendered by a Netlify Function, which header rules there don't reach.
 *
 * frame-ancestors lets only this site and Storyblok's Visual Editor show the
 * pages in a frame: the editor previews the site inside an iframe, so a
 * blanket X-Frame-Options: DENY would break it.
 */
const SECURITY_HEADERS: Record<string, string> = {
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Content-Security-Policy': "frame-ancestors 'self' https://app.storyblok.com",
};

/** Sets headers on a response, copying it first if its headers are read-only (redirects). */
function withHeaders(response: Response, entries: [string, string][]): Response {
  if (!entries.length) return response;
  try {
    for (const [k, v] of entries) response.headers.set(k, v);
    return response;
  } catch {
    const headers = new Headers(response.headers);
    for (const [k, v] of entries) headers.set(k, v);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
}

const securityHeaders = defineMiddleware(async (_context, next) => {
  const response = await next();
  return withHeaders(response, Object.entries(SECURITY_HEADERS).filter(([k]) => !response.headers.has(k)));
});

/**
 * CDN caching, on only after launch (CONTENT_VERSION=published, see
 * src/lib/content-version.ts). Before launch pages show drafts, so caching
 * them would hide the team's edits.
 *
 * Netlify's CDN keeps a page for up to an hour and serves a stale copy for a
 * day while it fetches a fresh one in the background. Every Storyblok publish
 * clears the whole cache straight away (src/pages/api/storyblok-webhook.ts),
 * so the hour only matters if that webhook ever fails. A deploy clears it too.
 * Browsers always check back (max-age=0), so they never hold an old page.
 *
 * The cache key keeps only `page` (archive paging) and `_storyblok` from the
 * query string: tracking parameters (utm_*, gclid) share one cached copy, and
 * a Visual Editor request never matches a cached page. Editor requests,
 * /guide, /api and anything that isn't a 200 are never cached.
 */
const CDN_CACHE: [string, string][] = [
  ['Cache-Control', 'public, max-age=0, must-revalidate'],
  ['Netlify-CDN-Cache-Control', 'public, durable, s-maxage=3600, stale-while-revalidate=86400'],
  ['Netlify-Vary', 'query=page|_storyblok'],
];

const cacheHeaders = defineMiddleware(async (context, next) => {
  const response = await next();
  const { request, url } = context;
  if (!isPublishedMode() || isEditorRequest(url)) return response;
  if (request.method !== 'GET' && request.method !== 'HEAD') return response;
  if (response.status !== 200 || response.headers.has('Cache-Control')) return response;
  if (/^\/(api|guide)(\/|$)/.test(url.pathname)) return response;
  return withHeaders(response, CDN_CACHE);
});

export const onRequest = sequence(securityHeaders, cacheHeaders, redirects, storyblokLivePreview, noOrphans);
