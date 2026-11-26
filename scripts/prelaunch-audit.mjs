#!/usr/bin/env node
/**
 * Pre-launch audit: crawls a site's sitemap and writes one report of what to
 * fix before launch (see the prelaunch-audit skill, which adds axe,
 * Lighthouse and the Storyblok unpublished check on top).
 *
 * Per page: status, <title> length, meta description, share image, h1 count,
 * noindex, `#` links, links to the old domain(s), old /wp-content/ files
 * (they die when the domain moves), non-breaking spaces in the text (phone
 * overflow), Latin placeholder copy, and the canonical's host.
 * Site-wide: every unique link is checked once (internal and external);
 * external 401/403/429 are reported as "blocked", not broken (bot protection).
 * Security headers on the home page.
 *
 * Read-only. Usage:
 *   node scripts/prelaunch-audit.mjs --base https://client.netlify.app \
 *     [--old energysys.com,www.energysys.com] [--max 500] [--skip-external] [--out .audit]
 * Writes .audit/prelaunch-<date>.md (git-ignored) and prints a summary.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const opt = (f, d) => (args.includes(f) ? args[args.indexOf(f) + 1] : d);
const BASE = opt('--base')?.replace(/\/$/, '');
if (!BASE) { console.error('Usage: --base https://site.example [--old old-domain.com] [--max N] [--skip-external]'); process.exit(1); }
const OLD = (opt('--old', '') || '').split(',').map((s) => s.trim().replace(/^www\./, '')).filter(Boolean);
const MAX = Number(opt('--max', 1000));
const SKIP_EXTERNAL = args.includes('--skip-external');
const OUT = opt('--out', '.audit');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36 primer-prelaunch-audit';
const origin = new URL(BASE).origin;

const get = (url, opts = {}) => fetch(url, { headers: { 'User-Agent': UA, ...opts.headers }, redirect: opts.redirect ?? 'follow', method: opts.method ?? 'GET', signal: AbortSignal.timeout(20000) });

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }));
  return out;
}

// ── Sitemap ──────────────────────────────────────────────────────
async function sitemapUrls(url, seen = new Set()) {
  if (seen.has(url)) return [];
  seen.add(url);
  let res = null;
  for (let attempt = 0; attempt < 3 && !res?.ok; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 2000)); // cold SSR functions can fail once
    res = await get(url).catch(() => null);
  }
  if (!res?.ok) { console.warn(`sitemap ${url}: ${res?.status ?? 'unreachable'}`); return []; }
  const xml = await res.text();
  const locs = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&'));
  if (/<sitemapindex/i.test(xml)) return (await Promise.all(locs.map((l) => sitemapUrls(l, seen)))).flat();
  return locs;
}

const robotsSitemaps = await get(`${BASE}/robots.txt`).then((r) => (r.ok ? r.text() : '')).catch(() => '')
  .then((t) => [...t.matchAll(/^Sitemap:\s*(\S+)/gim)].map((m) => { const u = new URL(m[1]); return `${origin}${u.pathname}`; }));
let pages = [];
for (const sm of [...robotsSitemaps, `${BASE}/sitemap.xml`, `${BASE}/sitemap-index.xml`]) {
  pages = [...new Set(await sitemapUrls(sm))];
  if (pages.length) break;
}
if (!pages.length) pages = [`${BASE}/`];
// The sitemap may list the production domain; audit the --base host instead
pages = pages.map((u) => { const x = new URL(u); return `${origin}${x.pathname}${x.search}`; }).slice(0, MAX);
console.log(`${pages.length} pages from the sitemap`);

// ── Pages ────────────────────────────────────────────────────────
const attr = (tag, name) => tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1];
const metaContent = (html, key) => {
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const t = m[0];
    if ((attr(t, 'name') || attr(t, 'property'))?.toLowerCase() === key) return attr(t, 'content') ?? '';
  }
  return null;
};
const LATIN = /\b(lorem ipsum|dolor sit amet|consectetur adipiscing|sed do eiusmod)\b/i;
const links = new Map(); // url -> Set(page paths)

const results = await pool(pages, 6, async (url) => {
  const path = new URL(url).pathname;
  const r = { path, issues: [] };
  let res;
  try { res = await get(url); } catch (e) { r.status = 'error'; r.issues.push(`fetch failed: ${e.message}`); return r; }
  r.status = res.status;
  if (!res.ok) { r.issues.push(`status ${res.status}`); return r; }
  const html = await res.text();
  const body = html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '');

  const title = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1].trim() ?? '';
  r.title = title;
  if (!title) r.issues.push('no <title>');
  else if (title.length > 65) r.issues.push(`title ${title.length} chars (over 65)`);
  const desc = metaContent(html, 'description');
  if (!desc) r.issues.push('no meta description');
  else if (desc.length < 70) r.issues.push(`thin meta description (${desc.length} chars)`);
  else if (desc.length > 170) r.issues.push(`meta description ${desc.length} chars (over 170)`);
  if (desc && LATIN.test(desc)) r.issues.push('meta description is placeholder Latin');
  if (!metaContent(html, 'og:image')) r.issues.push('no share image (og:image)');
  const h1s = (body.match(/<h1\b/gi) || []).length;
  if (h1s !== 1) r.issues.push(`${h1s} h1 headings`);
  if (/noindex/i.test(metaContent(html, 'robots') ?? '')) r.issues.push('noindex');
  const canonical = [...html.matchAll(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi)].map((m) => attr(m[0], 'href'))[0];
  if (canonical) r.canonical = new URL(canonical, url).host;

  const text = body.replace(/<[^>]+>/g, ' ');
  if (LATIN.test(text)) r.issues.push('placeholder Latin in the page text');
  // One or two non-breaking spaces (orphan prevention) are deliberate; a run of
  // 5+ words glued together (pasted from WordPress) overflows on phones
  const runs = (text.match(/(?:[^\s<>]+(?:&nbsp;|&#160;|\u00a0)){4,}[^\s<>]+/g) || []).length;
  if (runs) r.issues.push(`${runs} runs of 5+ words joined by non-breaking spaces (overflow on phones)`);

  for (const m of body.matchAll(/<a\b[^>]*>/gi)) {
    const href = attr(m[0], 'href');
    if (href == null) continue;
    if (href === '#' || href === '') { r.issues.push('a `#` or empty link'); continue; }
    if (/^(mailto|tel|javascript|data):/i.test(href) || href.startsWith('#')) continue;
    let abs;
    try { abs = new URL(href, url); } catch { r.issues.push(`unparseable link ${href}`); continue; }
    abs.hash = '';
    const host = abs.hostname.replace(/^www\./, '');
    if (OLD.includes(host)) r.issues.push(`links to the old domain: ${abs.href}`);
    if (/\/wp-content\/uploads\//.test(abs.pathname) && abs.origin !== origin) r.issues.push(`old WordPress file (dies at launch): ${abs.href}`);
    if (!links.has(abs.href)) links.set(abs.href, new Set());
    links.get(abs.href).add(path);
  }
  r.issues = [...new Set(r.issues)];
  return r;
});

// ── Links ────────────────────────────────────────────────────────
const toCheck = [...links.keys()].filter((u) => !SKIP_EXTERNAL || new URL(u).origin === origin);
console.log(`checking ${toCheck.length} unique links`);
const linkStatus = new Map();
await pool(toCheck, 8, async (u) => {
  let status;
  try {
    let res = await get(u, { method: 'HEAD' });
    if (res.status === 405 || res.status === 404 || res.status >= 500) res = await get(u);
    status = res.status;
  } catch (e) { status = e.name === 'TimeoutError' ? 'timeout' : 'unreachable'; }
  linkStatus.set(u, status);
});
const broken = [], blocked = [];
for (const [u, s] of linkStatus) {
  const internal = new URL(u).origin === origin;
  if (s === 200 || (typeof s === 'number' && s < 400)) continue;
  if (!internal && [401, 403, 429, 999].includes(s)) blocked.push([u, s]);
  else broken.push([u, s, internal]);
}

// ── Headers ──────────────────────────────────────────────────────
const home = await get(`${BASE}/`).catch(() => null);
const WANT = ['strict-transport-security', 'x-content-type-options', 'referrer-policy', 'permissions-policy', 'content-security-policy'];
const headerRows = WANT.map((h) => [h, home?.headers.get(h) ?? '(missing)']);
const robots = await get(`${BASE}/robots.txt`).then((r) => r.text()).catch(() => '(unreachable)');

// ── Report ───────────────────────────────────────────────────────
const date = new Date().toISOString().slice(0, 10);
const withIssues = results.filter((r) => r.issues.length);
const count = (re) => results.filter((r) => r.issues.some((i) => re.test(i))).length;
const L = [];
L.push(`# Pre-launch audit: ${BASE} (${date})`, '');
L.push(`${results.length} pages, ${withIssues.length} with issues. ${toCheck.length} unique links: ${broken.length} broken, ${blocked.length} blocked by the other site.`, '');
L.push('## Summary', '', '| Check | Pages |', '|---|---|');
for (const [label, re] of [
  ['Not 200', /^status|fetch failed/], ['`#` or empty links', /`#`/], ['Links to the old domain', /old domain/],
  ['Old WordPress files', /WordPress file/], ['Title over 65', /title \d+ chars/], ['No meta description', /no meta description/],
  ['Thin meta description', /thin meta/], ['No share image', /og:image/], ['Not exactly one h1', /h1 headings/],
  ['Placeholder Latin', /Latin/], ['Non-breaking-space runs', /non-breaking/], ['noindex', /^noindex$/],
]) L.push(`| ${label} | ${count(re)} |`);
const canonHosts = [...new Set(results.map((r) => r.canonical).filter(Boolean))];
L.push('', `Canonical hosts: ${canonHosts.join(', ') || '(none)'}. On a preview host this is expected to be the preview host until launch; after launch it must be the real domain only.`);
if (broken.length) {
  L.push('', '## Broken links', '', '| Link | Status | Found on |', '|---|---|---|');
  for (const [u, s, internal] of broken.sort()) L.push(`| ${internal ? new URL(u).pathname : u} | ${s} | ${[...links.get(u)].slice(0, 5).join(', ')}${links.get(u).size > 5 ? ` +${links.get(u).size - 5}` : ''} |`);
}
if (blocked.length) {
  L.push('', '## Blocked (check by hand in a browser; usually fine)', '');
  for (const [u, s] of blocked.sort()) L.push(`- ${u} (${s})`);
}
L.push('', '## Pages', '');
for (const r of withIssues.sort((a, b) => a.path.localeCompare(b.path))) {
  L.push(`### ${r.path}`, '');
  for (const i of r.issues) L.push(`- ${i}`);
  L.push('');
}
L.push('## Security headers (home page)', '', '| Header | Value |', '|---|---|');
for (const [h, v] of headerRows) L.push(`| ${h} | ${String(v).slice(0, 120)} |`);
L.push('', '## robots.txt', '', '```', robots.trim().slice(0, 1500), '```', '');

mkdirSync(OUT, { recursive: true });
const file = join(OUT, `prelaunch-${date}.md`);
writeFileSync(file, L.join('\n'));
console.log(`${withIssues.length}/${results.length} pages with issues, ${broken.length} broken links. Report: ${file}`);
