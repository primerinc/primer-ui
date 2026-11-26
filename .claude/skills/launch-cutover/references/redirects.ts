/**
 * 301 redirects that editors manage in Storyblok, under Datasources › Redirects.
 *
 * Each entry's Name is the old path and its Value is where it goes now:
 *   /blog/our-new-platform  →  /posts/our-new-platform
 *   /about-us               →  /about
 *   /old-news/*             →  /resources       (every page under /old-news)
 *   /blog/*                 →  /posts/*         (keeps the rest of the path)
 * The value can also be a full URL on another site.
 *
 * Paths match without case or a trailing slash. The query string is kept.
 * An exact entry always wins. A wildcard entry only applies when the site has
 * no page of its own at that address (see middleware.ts), so /partners/* →
 * /partners catches the old site's leftover partner URLs without hiding the
 * real partner pages at /partners/<name>.
 * The list is cached for a minute, so a new entry works within a minute of
 * saving it, with no deploy.
 */
import { useStoryblokApi } from '@storyblok/astro';

interface Rule {
  from: string;
  to: string;
}

interface Rules {
  at: number;
  exact: Map<string, string>;
  prefixes: Rule[];
}

const TTL_MS = 60_000;
let cache: Rules | null = null;
let pending: Promise<Rules> | null = null;

const normalise = (path: string) => {
  let p = path.trim().toLowerCase();
  try {
    if (/^https?:\/\//.test(p)) p = new URL(p).pathname; // a full old URL pasted in
    p = decodeURI(p);
  } catch {
    // keep it as typed
  }
  if (!p.startsWith('/')) p = `/${p}`;
  return p.length > 1 ? p.replace(/\/+$/, '') : p;
};

async function load(): Promise<Rules> {
  const exact = new Map<string, string>();
  const prefixes: Rule[] = [];
  const api = useStoryblokApi();
  for (let page = 1; page < 50; page++) {
    const { data } = await api.get('cdn/datasource_entries', {
      datasource: 'redirects',
      per_page: 1000,
      page,
    });
    const entries: { name?: string; value?: string }[] = data?.datasource_entries ?? [];
    for (const { name, value } of entries) {
      if (!name?.trim() || !value?.trim()) continue;
      const to = value.trim();
      if (name.trim().endsWith('*')) {
        prefixes.push({ from: normalise(name.trim().slice(0, -1)), to });
      } else {
        exact.set(normalise(name), to);
      }
    }
    if (entries.length < 1000) break;
  }
  // Longest prefix first, so /blog/2019/* wins over /blog/*
  prefixes.sort((a, b) => b.from.length - a.from.length);
  return { at: Date.now(), exact, prefixes };
}

async function rules(): Promise<Rules> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache;
  pending ??= load()
    .catch((e) => {
      // A Storyblok hiccup must never take the site down: keep the last list.
      console.warn('[redirects] could not load the Redirects datasource:', e?.message ?? e);
      return cache ?? { at: Date.now(), exact: new Map<string, string>(), prefixes: [] };
    })
    .finally(() => { pending = null; });
  cache = await pending;
  return cache;
}

export interface Redirect {
  to: string;
  /** From a wildcard entry: only use it when there's no page here */
  wildcard: boolean;
}

/** Where this URL should redirect to, or null. */
export async function findRedirect(url: URL): Promise<Redirect | null> {
  const { exact, prefixes } = await rules();
  if (!exact.size && !prefixes.length) return null;

  const path = normalise(url.pathname);
  let target = exact.get(path) ?? null;
  const wildcard = !target;

  if (!target) {
    for (const { from, to } of prefixes) {
      const base = from.replace(/\/+$/, '');
      if (path !== base && !path.startsWith(`${base}/`)) continue;
      const rest = path.slice(base.length).replace(/^\//, '');
      target = to.endsWith('*') ? to.slice(0, -1).replace(/\/?$/, '/') + rest : to;
      break;
    }
  }
  if (!target) return null;

  const dest = new URL(target, url.origin);
  if (!dest.search) dest.search = url.search;
  // Never redirect a page to itself
  if (dest.origin === url.origin && normalise(dest.pathname) === path) return null;
  const to = dest.origin === url.origin ? `${dest.pathname}${dest.search}${dest.hash}` : dest.href;
  return { to, wildcard };
}
