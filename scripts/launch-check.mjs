#!/usr/bin/env node
/**
 * Launch-day checks, run right after the cutover deploy (see the
 * launch-cutover skill). Read-only.
 *
 *   node scripts/launch-check.mjs --domain forteplatform.com \
 *     [--old energysys.com] [--paths /solutions/,/about-us/] [--preview client.netlify.app]
 *
 * Checks:
 * - https://<domain>/ is 200 with a valid certificate; www → apex (or the reverse)
 * - CDN caching: a cache header on the first request, a hit on the second
 * - robots.txt allows crawling and lists the sitemap; the sitemap uses the domain
 * - the home page's canonical and og:url use the domain, not the preview host
 * - each old domain (and www) 301s to the domain, and each --paths sample
 *   lands on a 200 on the new domain
 * - the preview host still blocks indexing (robots Disallow)
 * Exits 1 if anything fails.
 */
const args = process.argv.slice(2);
const opt = (f, d) => (args.includes(f) ? args[args.indexOf(f) + 1] : d);
const DOMAIN = opt('--domain')?.replace(/^https?:\/\//, '').replace(/\/$/, '');
if (!DOMAIN) { console.error('Usage: --domain example.com [--old old.com] [--paths /a/,/b/] [--preview x.netlify.app]'); process.exit(1); }
const OLD = (opt('--old', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
const PATHS = (opt('--paths', '/') || '/').split(',').map((s) => s.trim()).filter(Boolean);
const PREVIEW = opt('--preview');
const SITE = `https://${DOMAIN}`;

let failed = 0;
const ok = (cond, label, detail = '') => {
  console.log(`${cond ? '✅' : '❌'} ${label}${detail ? `  (${detail})` : ''}`);
  if (!cond) failed++;
};
const req = (url, redirect = 'follow') => fetch(url, { redirect, headers: { 'User-Agent': 'primer-launch-check' }, signal: AbortSignal.timeout(20000) });

async function hops(url) {
  const list = [];
  for (let i = 0; i < 6; i++) {
    const res = await req(url, 'manual');
    const loc = res.headers.get('location');
    list.push({ url, status: res.status });
    if (res.status >= 300 && res.status < 400 && loc) { url = new URL(loc, url).href; continue; }
    return { list, final: url, status: res.status };
  }
  return { list, final: url, status: 'too many hops' };
}

// Home, certificate, caching
try {
  const a = await req(`${SITE}/`);
  ok(a.status === 200, `${SITE}/ is 200 over https`, String(a.status));
  const cdn = a.headers.get('netlify-cdn-cache-control') || a.headers.get('cdn-cache-control') || a.headers.get('cache-control');
  ok(/s-maxage|durable|public/.test(cdn ?? ''), 'CDN cache header set', cdn ?? 'none');
  const b = await req(`${SITE}/`);
  const status = b.headers.get('cache-status') || b.headers.get('x-nf-cache') || b.headers.get('age');
  ok(/hit/i.test(status ?? '') || Number(b.headers.get('age')) > 0, 'second request served from the CDN cache', status ?? 'no cache-status header');
  const html = await b.text();
  const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)/i)?.[1] ?? html.match(/<link[^>]+href=["']([^"']+)["'][^>]*rel=["']canonical/i)?.[1];
  ok(canonical && new URL(canonical).host === DOMAIN, 'canonical uses the domain', canonical ?? 'none');
  const ogUrl = html.match(/<meta[^>]+property=["']og:url["'][^>]*content=["']([^"']+)/i)?.[1];
  if (ogUrl) ok(new URL(ogUrl).host === DOMAIN, 'og:url uses the domain', ogUrl);
  ok(!/netlify\.app/.test(html.replace(/<script[\s\S]*?<\/script>/gi, '')), 'no preview-host (netlify.app) URLs in the page');
} catch (e) { ok(false, `${SITE}/ reachable with a valid certificate`, e.cause?.code || e.message); }

// www / apex
const other = DOMAIN.startsWith('www.') ? DOMAIN.slice(4) : `www.${DOMAIN}`;
try {
  const h = await hops(`https://${other}/`);
  ok(new URL(h.final).host === DOMAIN && h.status === 200, `https://${other}/ redirects to ${DOMAIN}`, h.list.map((x) => x.status).join(' → '));
} catch (e) { ok(false, `https://${other}/ reachable`, e.cause?.code || e.message); }

// robots + sitemap
try {
  const robots = await (await req(`${SITE}/robots.txt`)).text();
  ok(!/^Disallow:\s*\/\s*$/m.test(robots), 'robots.txt allows crawling');
  const sm = robots.match(/^Sitemap:\s*(\S+)/mi)?.[1];
  ok(sm && new URL(sm).host === DOMAIN, 'robots.txt lists the sitemap on the domain', sm ?? 'no Sitemap line');
  if (sm) {
    const xml = await (await req(sm)).text();
    const locs = [...xml.matchAll(/<loc>\s*([^<]+)/g)].map((m) => m[1]);
    ok(locs.length && locs.every((l) => new URL(l).host === DOMAIN), `sitemap URLs use the domain (${locs.length})`);
  }
} catch (e) { ok(false, 'robots.txt / sitemap reachable', e.message); }

// Old domains
for (const old of OLD) {
  for (const host of [old, old.startsWith('www.') ? old.slice(4) : `www.${old}`]) {
    for (const path of PATHS) {
      try {
        const h = await hops(`https://${host}${path}`);
        const first = h.list[0]?.status;
        ok(first === 301 || first === 308, `https://${host}${path} → permanent redirect`, String(first));
        ok(new URL(h.final).host === DOMAIN && h.status === 200, `  …lands on a 200 on ${DOMAIN}`, `${h.final} (${h.status})`);
      } catch (e) { ok(false, `https://${host}${path} reachable (DNS + certificate)`, e.cause?.code || e.message); }
    }
  }
}

// Preview host stays out of search
if (PREVIEW) {
  try {
    const robots = await (await req(`https://${PREVIEW}/robots.txt`)).text();
    ok(/^Disallow:\s*\/\s*$/m.test(robots), `${PREVIEW} robots.txt still blocks indexing`);
  } catch (e) { ok(false, `${PREVIEW} reachable`, e.message); }
}

console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
process.exitCode = failed ? 1 : 0;
