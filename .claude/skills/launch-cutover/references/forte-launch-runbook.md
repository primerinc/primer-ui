# Forte launch runbook — Monday, November 30, 2026, 6am PT (2pm UK)

A checkpoint call comes first, then the switch. Follow-up check-in Tuesday,
December 1, 12pm US / 5pm UK. The press release goes out December 2.

The code for launch is already deployed (branch `launch-prep`). Launch day is
settings, DNS and one deploy: no code changes, no PR.

## What the switches do

| Setting | Where | Before launch | At launch |
|---|---|---|---|
| `CONTENT_VERSION` | Netlify › Site configuration › Environment variables | unset: the site shows Storyblok **drafts** | `published`: visitors see **published** content only; pages are cached on Netlify's CDN |
| `STORYBLOK_WEBHOOK_SECRET` | Netlify env (mark it secret) | unset | a long random string; the same value goes in the Storyblok webhook |
| Search indexing | none needed | `robots.txt` blocks `*.netlify.app` | the real domain gets `Allow: /` and the sitemap automatically |
| energysys.com → forteplatform.com | `netlify.toml` (already in the code) | inactive | works as soon as energysys.com is a domain alias on the site |

The Visual Editor always shows drafts (its requests carry `?_storyblok`, which
are never cached), so editing works the same after launch. A Netlify env change
only takes effect on the next deploy.

## Before launch day

- [ ] **From Forte:** registrar/DNS login (or someone at Forte who can make changes during the launch window) for **forteplatform.com** and **energysys.com**. Confirm which registrar each one uses, and note any existing email (MX) records: those stay untouched.
- [ ] Lower the TTL on the existing energysys.com records to 300s, a day or more before launch, so the switch takes effect quickly.
- [ ] `npm run check:unpublished`: publish or archive everything it lists. Run it again on launch morning.
- [ ] HubSpot: confirm that each form's submission lands, testing with a `+skipform@hubspot.com` address.
- [ ] Rebrand popup: Storyblok › Config › "Rebrand announcement". Set **Button link** to the blog post once it exists (until then it goes to /about). The config has to be **published** for the popup to appear after launch.

## Launch morning

1. **Content:** `npm run check:unpublished` → 0 listed. Publish the Config story.
2. **Netlify env:** set `CONTENT_VERSION=published` and `STORYBLOK_WEBHOOK_SECRET=<random>`. To generate the secret: `openssl rand -hex 32`.
3. **Domains** (Netlify › Domain management):
   - Add `forteplatform.com` as the primary domain (www redirects to it automatically).
   - Add `energysys.com` and `www.energysys.com` as domain aliases.
   - At the registrars, point the DNS as Netlify instructs: an A record for the apex to Netlify's load balancer, and a CNAME for www to `forte-primer.netlify.app`. Or move the nameservers to Netlify DNS.
   - Wait for the Let's Encrypt certificate to show as issued for all four names.
4. **Deploy:** `gh workflow run deploy-netlify.yml --ref main`, then `gh run watch`.
5. **Storyblok webhook** (Settings › Webhooks › New):
   - URL: `https://forteplatform.com/api/storyblok-webhook`
   - Secret: the same value as in step 2
   - Triggers: Story published, unpublished, deleted, moved; Datasource entry saved
6. **Storyblok preview URL** (Settings › Visual Editor): set the default to `https://forteplatform.com/` and keep "Local dev (James)".

## Checks after the deploy

- [ ] `curl -sI https://forteplatform.com/` returns `200` with `netlify-cdn-cache-control: public, durable, s-maxage=3600…`, and a second request shows `cache-status: "Netlify Edge"; hit`.
- [ ] `https://forteplatform.com/robots.txt` shows `Allow: /` and the sitemap line.
- [ ] `https://energysys.com/` and `https://www.energysys.com/solutions/` both 301 to forteplatform.com, then on to the mapped page.
- [ ] Publish a small change in Storyblok. It should show on the live site within seconds. Netlify › Logs › Functions shows `storyblok-webhook: cache cleared`.
- [ ] The Visual Editor still loads drafts and live preview still updates.
- [ ] The rebrand popup shows once in a private window and stays closed on the next page.
- [ ] Mega menus open; a form submits (with `+skipform@hubspot.com`).
- [ ] Search Console: add the forteplatform.com property, then submit `https://forteplatform.com/sitemap.xml`. Use the Change of Address tool from the energysys.com property.
- [ ] GA4/GTM: confirm the forteplatform.com page views arrive.

## Undo

- Content problems: unset `CONTENT_VERSION` and redeploy. The site goes back to drafts with no caching.
- Stale page after a publish: Netlify › Deploys › "Clear cache and deploy", or wait an hour (the CDN limit).
- Domain problems: remove the alias or primary domain in Netlify. energysys.com DNS can point back at WordPress if its host is still running.
