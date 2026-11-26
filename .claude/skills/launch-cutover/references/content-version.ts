/**
 * The launch switch: which Storyblok content the site shows.
 *
 * Until launch the site shows drafts, so the Forte team sees their edits
 * without publishing. At launch, set CONTENT_VERSION=published in Netlify
 * (Site configuration › Environment variables) and redeploy. From then on
 * visitors see only published content, and pages are cached on Netlify's CDN
 * (see `cacheHeaders` in src/middleware.ts) until the next Storyblok publish
 * clears it (src/pages/api/storyblok-webhook.ts).
 *
 * Storyblok's Visual Editor always gets drafts: it loads the page with a
 * `_storyblok` query parameter, and those requests are never cached.
 *
 * Search indexing needs no switch: robots.txt.ts already blocks *.netlify.app
 * and allows the real domain.
 */

export type ContentVersion = 'draft' | 'published';

function setting(name: string): string | undefined {
  return (typeof process !== 'undefined' ? process.env?.[name] : undefined) || import.meta.env[name];
}

/** True once CONTENT_VERSION=published is set: the site is launched. */
export function isPublishedMode(): boolean {
  return setting('CONTENT_VERSION')?.trim().toLowerCase() === 'published';
}

/** True when the request comes from Storyblok's Visual Editor. */
export function isEditorRequest(url: URL): boolean {
  return url.searchParams.has('_storyblok');
}

/** The Storyblok `version` to fetch for this request. */
export function contentVersion(url: URL): ContentVersion {
  return isPublishedMode() && !isEditorRequest(url) ? 'published' : 'draft';
}
