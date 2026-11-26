---
name: launch-cutover
description: Takes a primer site from "preview on netlify.app showing Storyblok drafts" to "live on the client's domain" — the launch switch (CONTENT_VERSION=published), CDN caching with a signed Storyblok webhook that clears it, domains and old-domain 301s, the runbook for the day, the post-launch checks (scripts/launch-check.mjs), Search Console change of address, and the handover to the client's own accounts. Use when planning a launch date, writing the launch runbook, on launch day, or when James asks "what has to happen on launch day".
---

# Launch cutover

## Why this exists

The Forte launch (2026-11-30) worked as settings, DNS and one deploy, with no
code changes on the day. The code went in weeks earlier and was dormant until
switched on. This skill gets the next client to the same place.

## The pieces (port from `references/` if the repo lacks them)

| Piece | File | What it does |
|---|---|---|
| Launch switch | `references/content-version.ts` → `src/lib/` | Until `CONTENT_VERSION=published`, the site reads Storyblok drafts so the team sees edits without publishing. After it, visitors get published content only. Visual Editor requests (`?_storyblok`) always get drafts |
| CDN caching | `cacheHeaders` in `references/middleware.ts` | Published mode only. `Netlify-CDN-Cache-Control: public, durable, s-maxage=3600, stale-while-revalidate=86400`; browsers `max-age=0`; `Netlify-Vary: query=page\|_storyblok` so tracking parameters share one cached copy. `/api`, `/guide`, editor requests and non-200s are never cached |
| Cache purge | `references/storyblok-webhook.ts` → `src/pages/api/` | Storyblok publish/unpublish/delete/move/datasource → HMAC-SHA1-signed POST → `purgeCache()`. With no secret set it refuses everything (503) |
| Security headers | `securityHeaders` in `middleware.ts` | Referrer-Policy, Permissions-Policy, `frame-ancestors 'self' https://app.storyblok.com`. Never use X-Frame-Options DENY: it breaks the Visual Editor |
| Redirects | `references/redirects.ts` | See the `redirect-map` skill |
| Old domain 301 | `references/netlify-old-domain-redirects.toml` → `netlify.toml` | Host-level `force = true` 301s. Inert until the old domain is an alias on the site |
| robots.txt | `src/pages/robots.txt.ts` (primer-ui) | Already flips by host: `*.netlify.app` Disallow, the real domain Allow plus Sitemap. No switch needed |
| Unpublished check | `npm run check:unpublished` | Lists stories that would 404 or show stale content after the switch |

The pieces depend on `@netlify/functions` (for `purgeCache`) and the
`@astrojs/netlify` adapter.

## Weeks before

1. **Port the pieces, deploy them while dormant, and test on preview:**
   - The webhook should return 503 until the secret is set.
   - There should be no cache headers yet.
   - robots should Disallow.
2. **Write the runbook** from `references/forte-launch-runbook.md`: date,
   time (with both time zones if the client is abroad), domains, and the
   person at the client who holds the DNS. Commit it as
   `docs/launch-runbook.md`.
3. **Ask the client for DNS early.** On Forte this was still outstanding a
   week before launch.
   - Get the registrar login for both domains, or a named person who can
     make changes during the launch window.
   - Note the existing MX/TXT (email) records. They stay untouched.
4. **Accounts:** the client should own Netlify (a Pro team), Storyblok (a
   paid space plan with enough seats), the domain, GTM/GA4, HubSpot and
   Search Console. See `docs/handover.md`.
5. **Content:**
   - Run `prelaunch-audit` and `redirect-map`.
   - Get `check:unpublished` to 0. Publish, or move unwanted stories to
     `archive/`. Don't unpublish: before launch the site reads drafts, so
     unpublishing hides nothing.
6. **Tracking and forms** (the `forms-and-tracking` skill): HubSpot form IDs
   and the tracking-domain list including the new domain, the GTM container
   ID in config, and the cookie banner.

## Day before

- Lower the TTL on the existing DNS records to 300s.
- Run `check:unpublished` again.
- Publish the Config story, so the popup, banner and menus are live.

## Launch (the order matters)

1. **Content:** `npm run check:unpublished` → 0. Publish Config.
2. **Netlify env:**
   - `CONTENT_VERSION=published`
   - `STORYBLOK_WEBHOOK_SECRET` from `openssl rand -hex 32`, marked secret

   Env changes only apply on the next deploy.
3. **Domains** (Netlify › Domain management):
   - Add the primary domain, plus the old domain and its www as aliases.
   - At the registrar: an A record for the apex to Netlify's load balancer,
     and a CNAME for www to `<site>.netlify.app`. Or move the nameservers to
     Netlify DNS.
   - Wait for the Let's Encrypt certificate to show as issued for every name.
4. **Deploy:** the repo's manual workflow (e.g.
   `gh workflow run deploy-netlify.yml --ref main`, then `gh run watch`).
   Mention the credit cost.
5. **Storyblok webhook** (Settings › Webhooks):
   - URL: `https://<domain>/api/storyblok-webhook`, with the same secret.
   - Triggers: story published, unpublished, deleted and moved; datasource
     entry saved.
6. **Storyblok preview URL:** make `https://<domain>/` the default and keep
   the local dev entry.

## Checks after

```bash
node scripts/launch-check.mjs --domain <domain> --old <olddomain.com> --paths /,/solutions/,/about-us/ --preview <site>.netlify.app
```

The script checks:
- 200 with a valid certificate, and www → apex
- a cache header on the first request and a cache hit on the second
- robots Allow plus a Sitemap line on the domain
- canonical and og:url on the domain
- old-domain paths giving a 301 that lands on a 200
- the preview host still Disallowing

Then by hand:
- Publish a small change in Storyblok. It should be live in seconds, and
  Netlify › Logs › Functions should show `storyblok-webhook: cache cleared`.
- The Visual Editor still loads drafts.
- The popup or banner behaves, and the mega menus open.
- A form submits with `+skipform@hubspot.com`.
- GA4 Realtime shows page views from the new domain.
- **Search Console:** add the new domain's property, submit the sitemap, and
  run Change of Address from the old domain's property.

## Undo

- **Content wrong:** unset `CONTENT_VERSION` and redeploy. The site goes back
  to drafts, uncached.
- **Stale page:** Netlify › Deploys › "Clear cache and deploy", or wait an hour.
- **DNS wrong:** remove the domain or alias in Netlify. The old domain can
  point back at the old host if it's still running. Ask the client to keep
  the old hosting for a couple of weeks after launch.
