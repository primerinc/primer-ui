# Storyblok Block Schema Reference

This document is the shared source of truth for every block in the Primer component library.
When setting up a new Storyblok space, use these schemas to configure each block type.

Copy each schema exactly — field names must match the prop interfaces in the Astro components.

---

## hero

| Field name           | Type     | Required | Options / Notes              |
|----------------------|----------|----------|------------------------------|
| headline             | Text     | Yes      |                              |
| subheadline          | Textarea | No       |                              |
| cta_primary_label    | Text     | No       |                              |
| cta_primary_url      | Text     | No       | URL field preferred          |
| cta_secondary_label  | Text     | No       |                              |
| cta_secondary_url    | Text     | No       | URL field preferred          |
| background_image     | Asset    | No       | Image only                   |
| layout               | Option   | No       | centered (default), left-aligned |
| background           | Option   | No       | secondary (default), primary, accent-subtle |

---

## feature_grid

| Field name   | Type    | Required | Options / Notes              |
|--------------|---------|----------|------------------------------|
| eyebrow      | Text    | No       |                              |
| headline     | Text    | Yes      |                              |
| subheadline  | Textarea| No       |                              |
| features     | Blocks  | Yes      | Restrict to: feature_item    |
| columns      | Option  | No       | 2, 3 (default), 4            |
| text_align   | Option  | No       | center (default), left       |
| background   | Option  | No       | primary (default), secondary, accent-subtle |

### feature_item (nested block inside feature_grid)

| Field name  | Type     | Required | Notes                              |
|-------------|----------|----------|------------------------------------|
| icon        | Asset    | No       | SVG or PNG — rendered as `<img>`   |
| title       | Text     | Yes      |                                    |
| description | Textarea | Yes      |                                    |

---

## testimonial_block

| Field name  | Type   | Required | Notes                          |
|-------------|--------|----------|--------------------------------|
| eyebrow     | Text   | No       |                                |
| headline    | Text   | No       |                                |
| items       | Blocks | Yes      | Restrict to: testimonial_item  |
| layout      | Option | No       | grid (default), carousel       |
| background  | Option | No       | primary (default), secondary, accent-subtle |

### testimonial_item (nested block inside testimonial_block)

| Field name | Type  | Required | Notes               |
|------------|-------|----------|---------------------|
| quote      | Textarea | Yes   |                     |
| author     | Text  | Yes      | Full name           |
| role       | Text  | No       | Job title / company |
| avatar     | Asset | No       | Image only          |

---

## cta_banner

| Field name        | Type   | Required | Options / Notes                                       |
|-------------------|--------|----------|-------------------------------------------------------|
| headline          | Text   | Yes      |                                                       |
| subheadline       | Textarea | No     |                                                       |
| buttons           | Blocks | No       | Restrict to: button                                   |
| background_style  | Option | No       | accent (default), dark, light                         |
| text_align        | Option | No       | left (default), center                                |

### button (nested block inside cta_banner)

| Field name | Type | Required | Options / Notes                        |
|------------|------|----------|----------------------------------------|
| text       | Text | Yes      | Button label                           |
| link       | Link | Yes      | Multilink                              |
| variant    | Option | No     | primary (default), secondary           |

---

## logo_bar

| Field name | Type   | Required | Notes                       |
|------------|--------|----------|-----------------------------|
| eyebrow    | Text   | No       | e.g. "Trusted by"           |
| logos      | Blocks | Yes      | Restrict to: logo_item      |

### logo_item

| Field name | Type  | Required | Notes       |
|------------|-------|----------|-------------|
| image      | Asset | Yes      | SVG or PNG  |
| alt        | Text  | Yes      | Company name |
| url        | Text  | No       | Optional link |

---

## two_column

| Field name  | Type     | Required | Options / Notes              |
|-------------|----------|----------|------------------------------|
| eyebrow     | Text     | No       |                              |
| headline    | Text     | No       |                              |
| body        | Textarea | No       |                              |
| cta_label   | Text     | No       |                              |
| cta_url     | Text     | No       |                              |
| image       | Asset    | No       | Image only                   |
| image_side  | Option   | No       | right (default), left        |
| background  | Option   | No       | primary (default), secondary, accent-subtle |

---

## rich_text

| Field name | Type      | Required | Notes                          |
|------------|-----------|----------|--------------------------------|
| content    | Richtext  | Yes      | Storyblok richtext field       |
| background | Option    | No       | primary (default), secondary, accent-subtle |

---

## stats_bar

| Field name | Type   | Required | Notes                           |
|------------|--------|----------|---------------------------------|
| eyebrow    | Text   | No       | e.g. "By the numbers"           |
| stats      | Blocks | Yes      | Restrict to: stat_item          |
| background | Option | No       | secondary (default), primary, accent-subtle |

### stat_item (nested block inside stats_bar)

| Field name  | Type | Required | Notes                        |
|-------------|------|----------|------------------------------|
| number      | Text | Yes      | e.g. "12+", "$2M", "98%"     |
| label       | Text | Yes      | e.g. "Years in business"     |
| description | Text | No       | Optional supporting line     |

---

## card_grid

| Field name  | Type     | Required | Options / Notes              |
|-------------|----------|----------|------------------------------|
| eyebrow     | Text     | No       |                              |
| headline    | Text     | No       |                              |
| subheadline | Textarea | No       |                              |
| cards       | Blocks   | Yes      | Restrict to: card_item       |
| columns     | Option   | No       | 2, 3 (default)               |
| background  | Option   | No       | primary (default), secondary, accent-subtle |

### card_item (nested block inside card_grid)

| Field name  | Type     | Required | Notes                        |
|-------------|----------|----------|------------------------------|
| image       | Asset    | No       | Image only                   |
| eyebrow     | Text     | No       | Category / tag label         |
| title       | Text     | Yes      |                              |
| description | Textarea | No       |                              |
| cta_label   | Text     | No       |                              |
| cta_url     | Text     | No       |                              |

---

## header

| Field name                | Type    | Required | Options / Notes                        |
|---------------------------|---------|----------|----------------------------------------|
| announcement_enabled      | Boolean | No       | Default false                          |
| announcement_text         | Text    | No       |                                        |
| announcement_link_label   | Text    | No       |                                        |
| announcement_link_url     | Link    | No       | Multilink                              |
| logo                      | Asset   | No       | Image only                             |
| nav_items                 | Blocks  | No       | Restrict to: nav_item                  |
| login_enabled             | Boolean | No       | Default false                          |
| login_label               | Text    | No       | e.g. "Log In"                          |
| login_link                | Link    | No       | Multilink                              |
| cta_button                | Blocks  | No       | Restrict to: button. Maximum: 1        |
| sticky                    | Boolean | No       | Default true                           |

### nav_item (nested block inside header)

| Field name       | Type   | Required | Notes                                  |
|------------------|--------|----------|----------------------------------------|
| label            | Text   | Yes      |                                        |
| link             | Link   | No       | Multilink — omit if item has dropdown  |
| dropdown_groups  | Blocks | No       | Restrict to: nav_group                 |

### nav_group (nested block inside nav_item)

| Field name | Type   | Required | Notes                                  |
|------------|--------|----------|----------------------------------------|
| heading    | Text   | No       | Section label e.g. "By Industry"       |
| links      | Blocks | Yes      | Restrict to: nav_link                  |

### nav_link (nested block inside nav_group)

| Field name | Type | Required | Notes      |
|------------|------|----------|------------|
| label      | Text | Yes      |            |
| link       | Link | Yes      | Multilink  |

---

## footer

| Field name          | Type    | Required | Options / Notes                         |
|---------------------|---------|----------|-----------------------------------------|
| logo                | Asset   | No       | Image only                              |
| tagline             | Text    | No       | Short line under logo                   |
| columns             | Blocks  | No       | Restrict to: footer_column              |
| social_links        | Blocks  | No       | Restrict to: social_link                |
| newsletter_enabled  | Boolean | No       | Default false                           |
| newsletter_heading  | Text    | No       | e.g. "Stay in the loop"                 |
| copyright           | Text    | No       | e.g. "© 2026 Acme Inc."                 |
| legal_links         | Blocks  | No       | Restrict to: nav_link                   |

### footer_column (nested block inside footer)

| Field name | Type   | Required | Notes                    |
|------------|--------|----------|--------------------------|
| heading    | Text   | No       | Column label             |
| links      | Blocks | Yes      | Restrict to: nav_link    |

### social_link (nested block inside footer)

| Field name | Type   | Required | Options / Notes                                     |
|------------|--------|----------|-----------------------------------------------------|
| platform   | Option | Yes      | linkedin, x, facebook, instagram, youtube           |
| url        | Link   | Yes      | Multilink                                           |

---

## team

| Field name  | Type     | Required | Options / Notes                     |
|-------------|----------|----------|-------------------------------------|
| eyebrow     | Text     | No       |                                     |
| headline    | Text     | No       |                                     |
| subheadline | Textarea | No       |                                     |
| members     | Blocks   | Yes      | Restrict to: team_member            |
| columns     | Option   | No       | 2, 3 (default), 4                   |
| layout      | Option   | No       | card (default), minimal             |
| background  | Option   | No       | primary (default), secondary, accent-subtle |

### team_member (nested block inside team)

| Field name   | Type  | Required | Notes                           |
|--------------|-------|----------|---------------------------------|
| photo        | Asset | No       | Image only — square crop recommended |
| name         | Text  | Yes      |                                 |
| title        | Text  | No       | Job title                       |
| bio          | Textarea | No    |                                 |
| linkedin_url | Text  | No       | URL field preferred             |

---

## tabs

| Field name  | Type     | Required | Options / Notes                        |
|-------------|----------|----------|----------------------------------------|
| eyebrow     | Text     | No       |                                        |
| headline    | Text     | No       |                                        |
| subheadline | Textarea | No       |                                        |
| items       | Blocks   | Yes      | Restrict to: tab_item                  |
| layout      | Option   | No       | horizontal (default), vertical         |
| background  | Option   | No       | primary (default), secondary, accent-subtle |

### tab_item (nested block inside tabs)

| Field name | Type     | Required | Notes                                    |
|------------|----------|----------|------------------------------------------|
| label      | Text     | Yes      | Short tab button label                   |
| title      | Text     | No       | Panel heading                            |
| body       | Textarea | No       | Panel body copy                          |
| image      | Asset    | No       | Optional panel image (3:2 crop recommended) |

---

## faq

| Field name      | Type    | Required | Options / Notes                              |
|-----------------|---------|----------|----------------------------------------------|
| eyebrow         | Text    | No       |                                              |
| headline        | Text    | No       |                                              |
| subheadline     | Textarea| No       |                                              |
| items           | Blocks  | Yes      | Restrict to: faq_item                        |
| include_schema  | Boolean | No       | Default false — injects FAQPage JSON-LD when enabled |
| background      | Option  | No       | primary (default), secondary, accent-subtle  |

### faq_item (nested block inside faq)

| Field name | Type     | Required | Notes                                              |
|------------|----------|----------|----------------------------------------------------|
| question   | Text     | Yes      | Plain text — used as schema `name` field           |
| answer     | Richtext | Yes      | Supports bold, links, lists — rendered in panel    |

**Schema note:** When `include_schema` is enabled, a `<script type="application/ld+json">` block is injected with `FAQPage` structured data. Plain text is extracted from the richtext answer automatically — HTML is stripped for the schema output.

---

## pricing_table

| Field name             | Type    | Required | Options / Notes                                      |
|------------------------|---------|----------|------------------------------------------------------|
| eyebrow                | Text    | No       |                                                      |
| headline               | Text    | No       |                                                      |
| subheadline            | Textarea| No       |                                                      |
| plans                  | Blocks  | Yes      | Restrict to: pricing_plan                            |
| toggle_enabled         | Boolean | No       | Default false — shows monthly/annual toggle          |
| toggle_label_monthly   | Text    | No       | Default "Monthly"                                    |
| toggle_label_annual    | Text    | No       | Default "Annual"                                     |
| background             | Option  | No       | primary (default), secondary, accent-subtle          |

### pricing_plan (nested block inside pricing_table)

| Field name   | Type    | Required | Notes                                                     |
|--------------|---------|----------|-----------------------------------------------------------|
| name         | Text    | Yes      | Plan name e.g. "Starter", "Growth", "Enterprise"         |
| description  | Text    | No       | Short tagline for the plan                                |
| price_monthly| Text    | No       | e.g. "$49" — shown when toggle is off                    |
| price_annual | Text    | No       | e.g. "$39" — shown when toggle is on                     |
| price_suffix | Text    | No       | e.g. "/mo" — appended after the price amount             |
| features     | Blocks  | No       | Restrict to: pricing_feature                              |
| cta_label    | Text    | No       | Button label, default "Get started"                       |
| cta_url      | Link    | No       | Multilink                                                 |
| cta_variant  | Option  | No       | primary, secondary (default — primary if highlighted)     |
| highlighted  | Boolean | No       | Default false — accent background + shadow + badge        |
| badge        | Text    | No       | e.g. "Most Popular" — shown as pill above highlighted card|

### pricing_feature (nested block inside pricing_plan)

| Field name | Type    | Required | Notes                                              |
|------------|---------|----------|----------------------------------------------------|
| text       | Text    | Yes      | Feature description                                |
| included   | Boolean | No       | Default true — false renders strikethrough + × icon|

---

## contact_form

| Field name         | Type     | Required | Options / Notes                                           |
|--------------------|----------|----------|-----------------------------------------------------------|
| eyebrow            | Text     | No       |                                                           |
| headline           | Text     | No       |                                                           |
| subheadline        | Textarea | No       |                                                           |
| layout             | Option   | No       | centered (default), split                                 |
| show_phone         | Boolean  | No       | Default false — adds phone field to form                  |
| show_company       | Boolean  | No       | Default false — adds company field to form                |
| contact_email      | Text     | No       | Displayed in split layout info panel                      |
| contact_phone      | Text     | No       | Displayed in split layout info panel                      |
| contact_address    | Textarea | No       | Displayed in split layout info panel                      |
| submit_label       | Text     | No       | Default "Send message"                                    |
| success_message    | Text     | No       | Default "Thanks — we'll be in touch soon."                |
| hubspot_portal_id  | Text     | No       | HubSpot portal ID (e.g. 12345678). Set both HS fields to enable HubSpot API mode |
| hubspot_form_id    | Text     | No       | HubSpot form GUID — found in HubSpot → Marketing → Forms → share → Embed Code |
| background         | Option   | No       | primary (default), secondary, accent-subtle               |

**HubSpot mode:** When both `hubspot_portal_id` and `hubspot_form_id` are set, submissions POST to the HubSpot Forms v3 API (CORS-safe, no embed script). Full name splits into `firstname`/`lastname` at the first space. HubSpot property names used: `firstname`, `lastname`, `email`, `message`, `phone`, `company`. Falls back to Netlify Forms when either field is blank.

**Switching to embed later:** Add a `hubspot_embed_code` Textarea and render a target div + inject HubSpot's script — separate code path, no conflict with the API approach.

**Note (Netlify fallback):** Requires static (SSG) output for Netlify to detect the form at build time.

---

## video

| Field name   | Type    | Required | Options / Notes                                                      |
|--------------|---------|----------|----------------------------------------------------------------------|
| eyebrow      | Text    | No       |                                                                      |
| headline     | Text    | No       |                                                                      |
| subheadline  | Textarea| No       |                                                                      |
| video_type   | Option  | Yes      | youtube (default), hosted                                            |
| youtube_url  | Text    | No       | Any YouTube URL format — video ID extracted automatically. Used when `video_type = youtube` |
| video_file   | Asset   | No       | MP4 file uploaded to Storyblok/CDN. Used when `video_type = hosted` |
| poster       | Asset   | No       | Thumbnail image. YouTube: shown before play (facade). Hosted: video poster attribute |
| caption      | Text    | No       | Short description shown below the video                              |
| autoplay     | Boolean | No       | Default false — hosted only. Forces `muted = true` when enabled     |
| muted        | Boolean | No       | Default false — hosted only                                          |
| loop         | Boolean | No       | Default false — hosted only                                          |
| background   | Option  | No       | primary (default), secondary, accent-subtle                          |

**YouTube privacy:** Uses `youtube-nocookie.com` embed domain. The iframe is not loaded until the user clicks play (facade pattern) — no YouTube cookies are set on page load.

**Autoplay note:** Browsers require `muted` for autoplay to work. Setting `autoplay = true` automatically forces `muted` on the `<video>` element.

---

## process_steps

| Field name   | Type     | Required | Options / Notes                                     |
|--------------|----------|----------|-----------------------------------------------------|
| eyebrow      | Text     | No       |                                                     |
| headline     | Text     | No       |                                                     |
| subheadline  | Textarea | No       |                                                     |
| steps        | Blocks   | Yes      | Restrict to: process_step                           |
| layout       | Option   | No       | horizontal (default), vertical                      |
| background   | Option   | No       | primary (default), secondary, accent-subtle         |

### process_step (nested block inside process_steps)

| Field name | Type     | Required | Notes                                               |
|------------|----------|----------|-----------------------------------------------------|
| title      | Text     | Yes      | Step title                                          |
| body       | Textarea | Yes      | Step description                                    |

**Step numbers** are auto-generated from array index (01, 02, 03…) — no number field needed.

**Horizontal layout:** Steps in a responsive grid row, badge + title + body centered in each column. Best for 3–4 steps.

**Vertical layout:** Two-column — header panel (sticky left) + stacked steps with badge and connector line (right). Best for 4–6 steps with longer descriptions.

---

## case_study_layout

Two-column layout block for long-form content (case studies, in-depth articles) — a key-takeaways callout, a full richtext content column, and a customizable sticky sidebar. Added to `resource` and `campaign_page`'s `body` whitelist (not `page`'s).

| Field name     | Type     | Required | Options / Notes                                                         |
|----------------|----------|----------|--------------------------------------------------------------------------|
| key_takeaways  | Blocks   | No       | Restrict to: key_takeaway_item. Rendered as a highlighted callout box above the content column |
| content        | Richtext | Yes      | The main article body — supports headings, paragraphs, images, blockquotes, lists, links, and tables (native Storyblok richtext table support) |
| sidebar        | Blocks   | No       | Restrict to: table_of_contents, sidebar_cta. Add any combination/order/multiples; renders as a sticky column alongside the content |
| background     | Option   | No       | primary (default), secondary, accent-subtle                             |

**Table of contents is fully automatic** — `table_of_contents` requires no manual link entry. At render time, `src/lib/richtext-toc.ts` walks the `content` richtext JSON, collects every H2/H3, slugifies the heading text into an anchor id (deduping repeats with a numeric suffix), stamps those ids onto the rendered `<h2>`/`<h3>` tags, and feeds the same list to the sidebar widget. Editors just write headings normally in the richtext editor — no plugin or per-heading tagging required.

### key_takeaway_item (nested block inside case_study_layout.key_takeaways)

| Field name | Type     | Required | Notes                          |
|------------|----------|----------|---------------------------------|
| text       | Textarea | Yes      | One takeaway line. Icon is a fixed checkmark glyph, not per-item customizable |

### table_of_contents (nested block inside case_study_layout.sidebar)

| Field name | Type | Required | Notes                                                    |
|------------|------|----------|-----------------------------------------------------------|
| heading    | Text | No       | Widget title, default "On this page". Links are auto-generated — see above, nothing else to configure |

**Not registered in `astro.config.mjs`** — unlike every other block, `CaseStudyLayout.astro` renders this one directly (not via the generic `StoryblokComponent` resolver) so it can pass the computed `headings` array as a prop. It still carries `storyblokEditable` for visual-editor click-to-select.

### sidebar_cta (nested block inside case_study_layout.sidebar)

| Field name | Type     | Required | Notes                          |
|------------|----------|----------|---------------------------------|
| headline   | Text     | No       |                                 |
| body       | Textarea | No       |                                 |
| cta_label  | Text     | No       | Button text                    |
| cta_url    | Text     | No       | Button link                    |

---

## Root content types

Unlike the nestable blocks above, these are top-level Storyblok **content types** (created under Settings → Content Types) — each one is a full story, not a block nested inside `body`. All three share the same `body` field and render through a single Astro file, `src/storyblok/Page.astro`, which only renders `body` — content-type-specific fields (title, resource_type, seo, etc.) are read by the routing layer (`src/pages/[...slug].astro`), not by the block itself. Register each new content type's technical name in `astro.config.mjs` under `components`.

**Live in Primer Block Space as of 2026-07-22**, built via Management API: `seo` block, `resource` content type, `campaign_page` content type, and `seo` attached to `page`. All three content types' `body` field shares an identical 16-block whitelist (includes `rich_text` and `logo_bar`, which were initially missed). The SEO Metatags app must be installed *and explicitly applied to the space* (Settings → Apps inside the space, not just the account-wide app store) before the `seo` block's `metatags` field can be created — its Management API `field_type` is `seo-metatags` (hyphenated), not `seo_metatags` as the plugin name might suggest.

### seo (nestable block — Block Library, same place as every other block above)

Storyblok has no cross-content-type "field group" mechanism — the "Group" field type is a purely visual collapse/expand widget scoped to a single component's own schema and doesn't appear in the API response. To genuinely share a field set across `page`, `resource`, and `campaign_page`, build it as an ordinary nestable block (component technical name `seo`) like any other block in this file, then attach it to each content type via a **Blocks** field restricted to just that component, Minimum 1 / Maximum 1. Because it's a Blocks field, it comes back from the API as a one-item array — `story.content.seo?.[0]`, not `story.content.seo` directly.

| Field name    | Type                   | Required | Options / Notes                                                            |
|---------------|-------------------------|----------|-----------------------------------------------------------------------------|
| metatags      | Plugin — SEO Metatags   | No       | Storyblok's built-in metatags plugin (Plugin field, custom type `seo-metatags`). Produces `{ title, description, og_image, og_title, og_description, twitter_title, twitter_description, twitter_image }`. Only `title`, `description`, and `og_image` are currently read by the site |
| canonical_url | Text                    | No       | Overrides the auto-computed canonical URL. Leave blank in the normal case — `BaseLayout` already computes canonical from the page's own URL |
| noindex       | Boolean                 | No       | Default false. Renders `<meta name="robots" content="noindex, nofollow">` when true |

**Fallback:** if `metatags.title` is blank, the browser `<title>` falls back to the story's own Name field (set in the CMS sidebar, not part of this block).

**Content-type field to add:** on `page`, `resource`, and `campaign_page`, add a field named `seo`, Type = **Blocks**, restricted to component `seo`, Minimum 1, Maximum 1.

### page (existing)

| Field name | Type   | Required | Notes                                            |
|------------|--------|----------|---------------------------------------------------|
| body       | Blocks | Yes      | Nestable, accepts any block above                 |
| seo        | Blocks | No       | Restrict to `seo`, min 1 / max 1                  |

### resource

| Field name     | Type    | Required | Options / Notes                                                        |
|----------------|---------|----------|--------------------------------------------------------------------------|
| title          | Text    | Yes      | Public-facing title. Not rendered on the page itself (the visual headline comes from the first body block, typically hero) — reserved for a future resource-listing/index page, same role as `card_item.title` |
| resource_type  | Option  | Yes      | blog, case_study, webinar, research                                      |
| featured       | Boolean | No       | Default false. Reserved for a future resource-listing page — not used on the detail page itself |
| body           | Blocks  | Yes      | Restrict to the nestable blocks above                                    |
| seo            | Blocks  | No       | Restrict to `seo`, min 1 / max 1                                         |
| gate_enabled              | Boolean  | No | Default false. See "Content gating" below                          |
| gate_hubspot_portal_id    | Text     | No | HubSpot Portal ID for the gate form                                 |
| gate_hubspot_form_id      | Text     | No | HubSpot Form ID for the gate form                                   |
| gate_headline             | Text     | No | Default "Unlock this resource"                                     |
| gate_description          | Textarea | No | Optional supporting copy on the gate card                           |

### campaign_page

| Field name             | Type    | Required | Options / Notes                                                        |
|------------------------|---------|----------|--------------------------------------------------------------------------|
| title                  | Text    | Yes      | Internal/SEO-fallback title only — not rendered on the page. Campaign pages are fully built from body blocks (typically starting with hero) |
| internal_campaign_name | Text    | No       | For internal tracking/reporting only — not rendered anywhere on the site |
| hide_nav               | Boolean | No       | Default false. Hides the global header for this page (wired in `BaseLayout.astro`) |
| hide_footer            | Boolean | No       | Default false. Hides the global footer for this page (wired in `BaseLayout.astro`) |
| body                   | Blocks  | Yes      | Restrict to the nestable blocks above                                    |
| seo                    | Blocks  | No       | Restrict to `seo`, min 1 / max 1                                         |
| gate_enabled              | Boolean  | No | Default false. See "Content gating" below                          |
| gate_hubspot_portal_id    | Text     | No | HubSpot Portal ID for the gate form                                 |
| gate_hubspot_form_id      | Text     | No | HubSpot Form ID for the gate form                                   |
| gate_headline             | Text     | No | Default "Unlock this resource"                                     |
| gate_description          | Textarea | No | Optional supporting copy on the gate card                           |

### Content gating (soft gate)

`resource` and `campaign_page` can require a HubSpot form fill before the rest
of the content is visible — set `gate_enabled` plus the two HubSpot ids. This is
a **soft gate**: the full body ships in the static HTML at build time (needed
for SEO/AEO — see the structured-data section — and for the SSR/live-preview
setup) and is only hidden/shown client-side via `src/storyblok/ContentGate.astro`,
wrapping `Page.astro`'s body render. It is lead-capture, not content security.

- Locked state is the default in the markup (`data-gate-state="locked"`), so
  there's no server-side branching and no flash of gated content — a returning
  visitor's unlock is detected and applied by an `is:inline` script that runs
  before paint, keyed to `localStorage` under `hubspot_gate_{pathname}` (per-page,
  not a single site-wide unlock).
- The gate form submits directly to HubSpot's Forms API via `fetch()` — the
  same pattern `ContactForm.astro` already uses — rather than loading HubSpot's
  embed script (`js.hsforms.net/forms/embed/v2.js`). That was a deliberate
  choice: it avoids introducing a second HubSpot integration style, and with it,
  the need for a shared script-loader singleton to prevent duplicate embeds if
  more than one HubSpot-embedding component ever lands on the same page.
- If `gate_enabled` is on but either HubSpot id is blank, the gate is skipped
  entirely and the content renders normally — a visitor should never be
  trapped behind a gate that has nothing to submit to.
- The whole body sits behind the gate; there's currently no "show this much,
  then gate" partial-teaser option. If a page needs a visible teaser above the
  gate, that's a `ContentGate` prop addition, not yet built.
- Gated content gets `inert` while locked, removing it from both the tab order
  and the accessibility tree in one step — same pattern as the mobile nav in
  `Header.astro`.

---

## Adding new blocks

When you add a new component to the library:
1. Add the Astro component in src/storyblok/[ComponentName].astro
2. Register it in astro.config.mjs under the `components` map
3. Document its schema in this file following the table format above
4. Update the component inventory table in CLAUDE.md
