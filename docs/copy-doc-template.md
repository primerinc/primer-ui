# Copy master document: how to lay it out

Share this with the copywriter before they start. Primer imports the doc straight into the website's content system (`npm run copy:import`), so following these conventions means the copy lands on the right page and in the right field with no retyping. Anything the importer can't place is listed in a report, never silently dropped.

## Structure

- **One Google Doc for the whole site.** Use one **tab per page** (Home, Platform, About, …).
- **Each page starts with a Heading 1** with the page name, exactly as it appears in the tab list.
- **Each section is a Heading 2** named after the Figma section, e.g. `Hero`, `Feature Grid — Client Challenges`, `FAQ`, `CTA Banner — Ready to Get Started?`. Use the real Heading 2 style, not bold text.
- **Copy that repeats on several pages** (a CTA banner, the logo bar) goes once in a **Universal Elements** tab. On each page, write the section heading and the words `Universal Element` under it.
- Put instructions for Primer in a separate **Key** tab, or start the line with `Note:` so it isn't read as copy.

## Fields

Write each field as a label, a colon and the copy (on the same line or the next):

```
Eyebrow (max 40 characters):
Built for operators

Headline (max 60 characters):
One platform for every barrel

Sub-headline / Body (max 200 characters):
Forte connects production, accounting and emissions data in one place.

Button Label:
Book a demo
```

Labels the importer knows: Eyebrow, Headline, Sub-headline, Sub-headline / Body, Body, Title, Description, Button, Button Label, Link Label, Question, Answer, Quote, Quotes, Name, Position, Position/Company, Office Name, Address, Phone, Email, Feature Label, Our Description, Competitor Description, and the contact form labels. Ask Primer before inventing a new one.

- **Character limits:** keep the `(max N characters)` from the brief in the label. The import report flags copy over the limit; it doesn't cut anything.
- **Not ready yet:** write `TBC`. The site keeps its current text until real copy arrives.
- **Two options:** put `OR` on its own line between them. The first one is used; the others are listed for review.

## Repeating items (features, benefits, FAQs, offices)

Give each item a short plain line straight above its first label, then its fields:

```
Benefit 1
Title: Faster close
Description: Month-end in days, not weeks.

Benefit 2
Title: One source of truth
Description: …
```

Numbered labels work too: `Question 1:` / `Answer 1:`, `Feature 2 Title:` / `Feature 2 Body:`. The page ends up with exactly as many items as the doc has, so add or remove items freely.

## SEO

Under a page's Heading 1, add `SEO title tag: <title>` (about 60 characters). Meta descriptions can go the same way: `Meta description: …` (about 155 characters).

## Linking to other pages

In FAQ answers, name the page the way the site does ("see the Platform page"). Primer turns those phrases into links.

## When something's signed off

Tell Primer which pages are final. After the last import of a page, edits happen in the content system, not the doc. If you later send a new version of the doc, say so: the newest doc replaces earlier hand edits.
