/**
 * /guide — the Forte team's Storyblok guide (docs/guides/forte-storyblok-guide.html),
 * served from the site so it ships with the code it describes.
 *
 * It's behind a password: the browser asks for one (HTTP Basic auth; any
 * username, the password is the GUIDE_PASSWORD environment variable in
 * Netlify). With no GUIDE_PASSWORD set, the guide stays locked, except on the
 * local dev server. It's never cached and never indexed.
 */
import type { APIRoute } from 'astro';
import guideHtml from '../../docs/guides/forte-storyblok-guide.html?raw';

export const prerender = false;

const PRIVATE = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow',
};

/** Compares two strings in constant time, so the check doesn't leak the password. */
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

function passwordFrom(header: string | null): string | null {
  if (!header?.startsWith('Basic ')) return null;
  try {
    const decoded = atob(header.slice('Basic '.length).trim());
    const colon = decoded.indexOf(':');
    return colon === -1 ? null : decoded.slice(colon + 1);
  } catch {
    return null;
  }
}

export const GET: APIRoute = ({ request }) => {
  const password = process.env.GUIDE_PASSWORD || import.meta.env.GUIDE_PASSWORD;
  const open = !password && import.meta.env.DEV;

  if (!open) {
    const given = passwordFrom(request.headers.get('authorization'));
    if (!password || given === null || !safeEqual(given, password)) {
      return new Response('This guide needs a password.', {
        status: 401,
        headers: {
          ...PRIVATE,
          'Content-Type': 'text/plain; charset=utf-8',
          'WWW-Authenticate': 'Basic realm="Forte website guide", charset="UTF-8"',
        },
      });
    }
  }

  return new Response(guideHtml, {
    headers: { ...PRIVATE, 'Content-Type': 'text/html; charset=utf-8' },
  });
};
