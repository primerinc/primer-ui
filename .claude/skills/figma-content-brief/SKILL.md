---
name: figma-content-brief
description: Turns a client's Figma wireframe (built from Primer's own Figma component library) into a Google Doc content brief listing every page, section, and copy field a copywriter needs to fill in — plus a separate asset/image requirements list per page.
---

# Figma content brief

## Why this exists

Before a client repo or Storyblok space exists, the copywriter needs to know
exactly what to write — page by page, section by section, field by field.
Hand-building that list by eyeballing a Figma file doesn't scale past one
client and drifts the moment the design changes. This skill automates the
extraction so the brief always matches the actual wireframe, and is reusable
for every future client with zero rework.

**This is an orchestration skill, not a script to run unattended.** The
extraction script (Phase 1) is mechanical and safe to run freely — it only
reads. Composing the actual brief (Phase 2) is agent judgment, and
publishing it (Phase 3) is a real, visible Drive artifact — confirm with the
user before that step, same posture as `client-repo-bootstrap`.

## Why the field source is primer-2026, not primer-ui's schema-reference.md

Confirmed by direct inspection (Forte wireframe, 2026-08-24): primer-ui's
`storyblok/schema-reference.md` — and even primer-ui's own `Hero.astro` — is
missing fields (`eyebrow` on Hero, `item_style`/`anchor_id` on Feature Grid)
added in primer-2026's "Primer 3.0" work, which never got ported back to the
shared library. Wireframes get built against whichever component set is
actually current, which today is primer-2026, not primer-ui. Each
component's own `Fields:` docblock comment + its template's real `blok.x`
usage is self-updating ground truth in a way a separate doc isn't — that's
what the extraction script reads, via `--component-source` (default
`../../primer-2026`, a sibling of primer-ui — override per-project if a
newer state exists elsewhere by the time you're reading this).

## One-time setup

Generate a Figma personal access token (figma.com/settings → Personal access
tokens, read-only scope is enough) and add it to primer-ui's `.env` as
`FIGMA_TOKEN` (see `.env.example`). One token covers every future client's
wireframe file — this is not a per-client credential.

## Phase 1 — Discover and extract

1. Run with no `--pages` first to see what top-level frames the file has:
   ```
   npm run figma:content-brief -- <figma-file-url-or-key>
   ```
2. **Confirm with the user which discovered frames are real site pages** —
   a wireframe file can have non-page canvases (a cover, a component
   sandbox) that shouldn't become "pages" in the brief. Don't assume every
   top-level frame is a page.
3. Re-run with the confirmed list:
   ```
   npm run figma:content-brief -- <figma-file-url-or-key> --pages "HOME,About,Pricing"
   ```
   This prints one structured JSON document: `pages[].sections[]`, each
   section carrying its matched component, flat copy fields (with the
   wireframe's own placeholder text as guidance), asset/image requirements,
   and repeating nested items (e.g. 3x Feature Item, each with its own
   fields). Any wireframe instance the script couldn't match to a known
   component is called out explicitly (`unresolved: true`) — a design
   section with no matching component is exactly the kind of gap that needs
   a human to notice, not something to silently skip.

## Phase 2 — Compose the brief (agent judgment, not scripted)

Turn the JSON into the actual copywriter-facing document:
- One heading per page, one table per section: Field | Guidance (from the
  wireframe's placeholder text, tightened into something a copywriter can
  actually act on — not just pasted raw) | Copy (blank).
- Repeating items (nested blocks) get their own sub-table per instance found
  — ask for exactly as many as the design shows, not a generic "add more as
  needed."
- Asset/image requirements listed separately per page, clearly distinct from
  copy work — a copywriter shouldn't mistake "supply a photo" for something
  they write.
- Anything the script flagged (`unresolved`, `unexpectedInstances`,
  `needsReview` on a nested item with no standalone component file) gets
  resolved by you before it reaches the brief, or explicitly called out in
  the doc as a known gap — never silently dropped.
- A short instructions block at the top for tone/voice notes, if the user
  has any for this client.

## Phase 3 — Publish to Google Drive (confirm first)

1. Confirm with the user before creating anything — this is a real, visible
   Drive artifact.
2. Create a client-named folder in My Drive (`mimeType:
   application/vnd.google-apps.folder`) if one doesn't already exist.
3. Upload the composed brief as HTML (`content_mime_type: text/html`) via
   `create_file` — Drive auto-converts to a native Google Doc
   (`application/vnd.google-apps.document`), preserving headings/tables far
   better than a plain-text upload.
4. Report the Doc link. Confirm sharing/edit permissions cover whoever the
   copywriter actually is before calling this done — don't assume link
   sharing is already correct.

## Reusability for future clients

Everything is parameterized on the Figma file and which repo to treat as the
component-field authority (`--component-source`, defaults to primer-2026
today). Running this for the next client is just: point Phase 1 at their
wireframe file key, confirm the discovered page list, review/compose the
brief in Phase 2, confirm the Drive publish in Phase 3. Revisit the
`--component-source` default if primer-ui ever absorbs the Primer 3.0
changes back and becomes current again.

## Verification

- Treat every new wireframe file's first run as a real trial, not a rerun of
  a known-good path — Figma layer-naming conventions could vary if a
  different designer built the file.
- Spot-check Phase 1's output against the actual Figma file by eye for at
  least one page before composing the brief — confirm field/placeholder
  pairing lined up correctly (positional matching assumes docblock field
  order matches layer order, true for every component checked so far, but
  verify per new component type rather than trusting it blindly).
- Deliberately test the "unresolved component" path at least once (e.g. an
  instance name with no matching `.astro` file, or point
  `--component-source` at a repo missing a field the wireframe uses) and
  confirm it's reported, not silently dropped.
- A `--pages` name that looks identical to the discovery listing can still
  fail to match — confirmed on Forte's "Configurator Community" frame, whose
  name uses a U+2028 LINE SEPARATOR instead of a plain space, invisible in
  any terminal or JSON viewer. The script normalizes whitespace before
  comparing now, so this shouldn't recur, but if a `--pages` name ever gets
  "skipped" despite matching the discovery output by eye, this is why.
- **`needsManualReview`/`extraTextLayers` catch count mismatches, not
  misalignment with a matching count.** Confirmed on the Forte file: pointing
  `--component-source` at primer-ui (missing Hero's `eyebrow`) shifted every
  field's pairing by one position, but Hero happens to have exactly one
  extra Asset field to absorb the surplus text layer — so the total count
  still matched and `needsManualReview` stayed `false` even though every
  single field was paired with the wrong placeholder. The flag is a useful
  first pass, not a correctness guarantee — Phase 2 actually reading each
  placeholder against its field name is the real backstop, every time, not
  just when something's flagged.
- After Phase 3, open the actual created Google Doc and confirm formatting
  rendered cleanly from the HTML upload — don't assume the Drive conversion
  preserved structure without checking.
