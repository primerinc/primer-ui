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

## Adding new blocks

When you add a new component to the library:
1. Add the Astro component in src/storyblok/[ComponentName].astro
2. Register it in astro.config.mjs under the `components` map
3. Document its schema in this file following the table format above
4. Update the component inventory table in CLAUDE.md
