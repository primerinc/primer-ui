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

---

## feature_grid

| Field name   | Type    | Required | Options / Notes              |
|--------------|---------|----------|------------------------------|
| eyebrow      | Text    | No       |                              |
| headline     | Text    | Yes      |                              |
| subheadline  | Textarea| No       |                              |
| features     | Blocks  | Yes      | Restrict to: feature_item    |
| columns      | Option  | No       | 2, 3 (default), 4            |

### feature_item (nested block inside feature_grid)

| Field name  | Type     | Required | Notes                         |
|-------------|----------|----------|-------------------------------|
| icon        | Textarea | No       | Paste inline SVG here         |
| title       | Text     | Yes      |                               |
| description | Textarea | Yes      |                               |

---

## testimonial_block

| Field name  | Type   | Required | Notes                          |
|-------------|--------|----------|--------------------------------|
| eyebrow     | Text   | No       |                                |
| headline    | Text   | No       |                                |
| items       | Blocks | Yes      | Restrict to: testimonial_item  |
| layout      | Option | No       | grid (default), carousel       |

### testimonial_item (nested block inside testimonial_block)

| Field name | Type  | Required | Notes               |
|------------|-------|----------|---------------------|
| quote      | Textarea | Yes   |                     |
| author     | Text  | Yes      | Full name           |
| role       | Text  | No       | Job title / company |
| avatar     | Asset | No       | Image only          |

---

## cta_banner

| Field name        | Type   | Required | Options / Notes                   |
|-------------------|--------|----------|-----------------------------------|
| headline          | Text   | Yes      |                                   |
| subheadline       | Textarea | No     |                                   |
| cta_label         | Text   | Yes      |                                   |
| cta_url           | Text   | Yes      |                                   |
| background_style  | Option | No       | accent (default), dark, light     |

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

---

## rich_text

| Field name | Type      | Required | Notes                          |
|------------|-----------|----------|--------------------------------|
| content    | Richtext  | Yes      | Storyblok richtext field       |

---

## stats_bar

| Field name | Type   | Required | Notes                           |
|------------|--------|----------|---------------------------------|
| eyebrow    | Text   | No       | e.g. "By the numbers"           |
| stats      | Blocks | Yes      | Restrict to: stat_item          |

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

### faq_item (nested block inside faq)

| Field name | Type     | Required | Notes                                              |
|------------|----------|----------|----------------------------------------------------|
| question   | Text     | Yes      | Plain text — used as schema `name` field           |
| answer     | Richtext | Yes      | Supports bold, links, lists — rendered in panel    |

**Schema note:** When `include_schema` is enabled, a `<script type="application/ld+json">` block is injected with `FAQPage` structured data. Plain text is extracted from the richtext answer automatically — HTML is stripped for the schema output.

---

## Adding new blocks

When you add a new component to the library:
1. Add the Astro component in src/storyblok/[ComponentName].astro
2. Register it in astro.config.mjs under the `components` map
3. Document its schema in this file following the table format above
4. Update the component inventory table in CLAUDE.md
