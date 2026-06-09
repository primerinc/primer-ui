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

## Adding new blocks

When you add a new component to the library:
1. Add the Astro component in components/[ComponentName]/[ComponentName].astro
2. Document its schema in this file following the table format above
3. Update the component inventory table in CLAUDE.md
