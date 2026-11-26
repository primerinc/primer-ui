---
name: forms-and-tracking
description: Sets up and tests a primer site's HubSpot forms, Google Tag Manager / GA4 and cookie consent the same way every time — HubSpot portal and form IDs on each Contact Form block, the portal's tracking-domain list, safe test submissions with +skipform@hubspot.com, the GTM container in Config, Consent Mode v2 defaults before GTM, the built-in cookie banner, and the form_submit dataLayer event for conversions. Use when wiring forms or analytics for a client, when a form "doesn't arrive in HubSpot", or before launch.
---

# Forms and tracking

## Why this exists

Every Lock 8 client uses HubSpot for forms and GTM for tags, and the same
traps came up on Forte:

- A made-up test address created a real HubSpot submission.
- Submissions from a domain HubSpot doesn't know land in spam.
- GTM's own form trigger can't see forms that post in the background.
- Consent defaults have to run before GTM, or Consent Mode does nothing.

Do it in this order.

## HubSpot forms

The Contact Form block posts to the HubSpot Forms API
(`api.hsforms.com/submissions/v3/integration/submit/<portal>/<form>`) when
`hubspot_portal_id` and `hubspot_form_id` are filled in. HubSpot is the
supported default. The Netlify Forms fallback doesn't work reliably under
SSR: it gets a 403 but still shows the thank-you message.

1. **Get from the client** (or from their HubSpot, with access):
   - the portal ID
   - the form GUID for each form on the site (contact, get-started,
     gated downloads, job apply)
   - the internal property names of any extra fields: company, area of
     interest, the consent/subscription type ID
2. **Fill each Contact Form block** in Storyblok, backing it up first.
   - The field names in the site form must match the HubSpot form's
     properties, or HubSpot rejects the submission.
   - Check `company_required`/`hubspot_company_field`: is the company stored
     on the contact (`contact`) or on the company record (`company`, which
     HubSpot calls 0-2/name)?
3. **Tracking domains:**
   - In HubSpot › Settings › Tracking & Analytics › Tracking Code ›
     Advanced Tracking, add the preview host (`<site>.netlify.app`) **and**
     the launch domain.
   - Without them, submissions go to spam as "Unregistered Site Domain".
4. **Test every form:**
   - Only use an email ending in `+skipform@hubspot.com`, e.g.
     `test+skipform@hubspot.com`. HubSpot returns 200 and stores nothing.
   - Never use example.com or a made-up address: those create real contacts
     in the client's CRM.
   - Check the network response (200 with an `inlineMessage`), the
     thank-you state, and the `form_submit` event in the dataLayer.
5. **Don't change forms the client has signed off** without James saying so.

## Google Tag Manager / GA4

1. Put the client's container ID (`GTM-XXXXXXX`) in **Config ›
   gtm_container_id**, not pasted into head_scripts. BaseLayout places the
   head snippet and the noscript iframe in the right order.
2. **Conversions:** forms push `{ event: 'form_submit', form_name, form_id,
   form_type, page_path }` after a successful submission
   (`references/track.ts`; call it only on success). There's no personal
   data in it.
   - In GTM: a Custom Event trigger on `form_submit`, then a GA4 event tag
     (`generate_lead` or the client's name for it).
   - GTM's built-in Form Submission trigger won't fire, because there's no
     page load.
3. GTM isn't rendered inside the Storyblok Visual Editor, so editors don't
   pollute analytics.
4. **Test:**
   - GTM Preview (Tag Assistant) on the preview host.
   - Then GA4 › Realtime once the domain is live.
   - A local ad blocker blocks GTM and drops Lighthouse Best Practices to
     96. That's expected.

## Cookie consent

Choose one:

- **The built-in banner** (`references/CookieConsent.astro`, with the
  Config fields `cookie_banner_enabled`, `cookie_message` and
  `cookie_policy_link`).
  - BaseLayout writes the Google Consent Mode v2 defaults (all denied
    except functionality and security, `wait_for_update: 500`) **before**
    GTM. It re-applies a stored choice from localStorage (180 days).
  - The banner sends `gtag('consent','update', …)`.
  - With the banner on, the GTM noscript iframe is dropped, since a visitor
    without scripts can't consent.
  - See `references/BaseLayout-tracking-excerpt.astro` for the order.
- **The client's CMP** (Cookiebot, OneTrust, CookieYes): their snippet goes
  in **Config › head_scripts**, which renders before GTM. Leave the
  built-in banner off.

Either way:
- The privacy policy link must point at a real page.
- Forte's Terms referenced a Cookie Policy page that didn't exist yet. Check
  for that before launch.
- Embeds should use privacy-friendly modes: the Video block already uses
  `youtube-nocookie.com` behind a click-to-load facade.

## Before launch

- Every form: HubSpot IDs set, tested with `+skipform`, and landing in the
  right HubSpot form.
- The launch domain is on HubSpot's tracking list.
- GTM is in Config. The `form_submit` trigger and tag are published in GTM.
- Consent behaves: no GA cookies before Accept, in a private window.
- After launch: GA4 Realtime shows the new domain.
