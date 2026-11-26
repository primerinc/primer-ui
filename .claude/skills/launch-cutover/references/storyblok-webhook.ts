/**
 * POST /api/storyblok-webhook — clears Netlify's CDN cache when content changes.
 *
 * After launch, pages are cached on the CDN (see `cacheHeaders` in
 * src/middleware.ts). Storyblok calls this endpoint on publish, unpublish,
 * delete and move, and when a datasource changes, so visitors see the change
 * within seconds instead of after the cache runs out. It clears the whole
 * site: Forte's pages share the header, footer and post lists, so one publish
 * can change many pages.
 *
 * Setup (launch day, see docs/launch-runbook.md):
 * - Netlify env STORYBLOK_WEBHOOK_SECRET: any long random string.
 * - Storyblok › Settings › Webhooks: URL https://<domain>/api/storyblok-webhook,
 *   the same secret, the triggers above.
 *
 * Storyblok signs each call: the `webhook-signature` header is the HMAC-SHA1
 * of the raw body with the secret, in hex. Unsigned or wrongly signed calls
 * get a 401, and with no secret set the endpoint refuses everything, so no one
 * else can empty the cache.
 */
import type { APIRoute } from 'astro';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { purgeCache } from '@netlify/functions';

export const prerender = false;

const NO_STORE = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };

function signatureMatches(body: string, secret: string, given: string | null): boolean {
  if (!given) return false;
  const expected = createHmac('sha1', secret).update(body).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(given.trim().toLowerCase());
  return a.length === b.length && timingSafeEqual(a, b);
}

export const POST: APIRoute = async ({ request }) => {
  const secret = process.env.STORYBLOK_WEBHOOK_SECRET || import.meta.env.STORYBLOK_WEBHOOK_SECRET;
  if (!secret) return new Response('Webhook secret not set', { status: 503, headers: NO_STORE });

  const body = await request.text();
  if (!signatureMatches(body, secret, request.headers.get('webhook-signature'))) {
    return new Response('Bad signature', { status: 401, headers: NO_STORE });
  }

  let action = 'unknown';
  try {
    action = JSON.parse(body)?.action ?? action;
  } catch {
    // Storyblok always sends JSON; a body that isn't still clears the cache
  }

  try {
    await purgeCache();
  } catch (error) {
    // Off Netlify (local dev) there is no CDN cache to clear
    console.error('storyblok-webhook: purge failed', error);
    return new Response('Purge failed', { status: 500, headers: NO_STORE });
  }

  console.log(`storyblok-webhook: cache cleared (${action})`);
  return new Response('Cache cleared', { status: 200, headers: NO_STORE });
};
