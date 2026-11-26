---
name: client-direction-canvas
description: Settles a client's visual direction — brand ramp, type, and overall look — on a shareable Claude Design canvas before any repo, Figma file, or Storyblok space exists, then emits the approved ramp in tokens/themes/ shape so client-repo-bootstrap Phase 1 starts from a real, contrast-checked, client-approved palette instead of an invented one.
---

# Client direction canvas

## Why this exists

`client-repo-bootstrap` Phase 1 will not start without a **full 8-step brand
ramp** and a brand font, and it is right to refuse to invent them:

> Do not auto-generate this from a single accent color — there's no
> color-ramp-generation tooling in this repo, and an algorithmic tint/shade
> ramp is a real design-quality risk for a real brand.

For identity and naming work Primer is often the party *creating* the brand, so
there is no client brand guideline or design file to take a ramp from. That
leaves the pipeline blocked on a decision nobody has made yet.

This skill is where that decision gets made — and it is not the thing Phase 1
forbids. Phase 1 bars an **algorithmically generated** ramp; what this produces
is a **designed ramp the client has signed off on**, arrived at by showing them
real candidates and letting them choose. Same eight values, opposite provenance.

The second reason it exists is timing. `tokens/check-contrast.js` says:

> Semantic colours are Figma-owned … failures are fixed by repointing the
> semantic variable in Figma at a darker or lighter step — not by editing
> tokens here, which the next sync would revert.

So a ramp with AA failures becomes a Figma-side repair job once Phase 5 has
wired Tokens Studio. Before Phase 1, it is a number you change in a file. Catch
contrast here, or pay for it later.

## What this produces (the handoff contract)

1. A published, client-shareable canvas with 2–4 named directions.
2. A recorded decision — which direction, and any adjustments the client asked for.
3. `tokens/themes/<client-slug>.json`, primitive-shaped, **passing `npm run check:contrast`**.
4. A brand font name for `BaseLayout.astro`'s Google Fonts `<link>`.

Items 3 and 4 are exactly Phase 1's blocking inputs. When this skill finishes,
`client-repo-bootstrap` can run without asking the client anything.

## Phase 1 — Gather what governs

Before drawing, establish which case you are in:

- **Client has a brand.** Guidelines, a logo, an existing site, a design file.
  Lift exact values — do not reinterpret. The canvas then explores *layout and
  structure*, not palette; the ramp is transcription, not design.
- **Client has fragments.** One logo colour, a printed piece, a competitor they
  admire. The canvas explores ramps built *around* the fixed fragments.
- **Greenfield brand.** Nothing exists. The canvas is the whole decision.

Also gather: client slug (kebab-case, per `tokens/themes/README.md`), client
display name, the sector and audience, and any references the client has named.
**Ask for references.** A named reference site is worth more than any brief —
it is the single highest-leverage input, because it supplies taste the model
cannot invent.

Read `tokens/primitives.json` for the shape and `tokens/themes/wireframe.json`
for the reference format. Never start a theme file from `semantic.json` — theme
files override **primitives**.

## Phase 2 — Author the directions

Follow the `design` skill for canvas mechanics. What matters here:

- **2–4 directions, genuinely different.** Name the axis each one explores
  ("warm editorial" vs "dense technical"), and give each an honest tradeoff. A
  set where only your favourite has a case made for it is a rigged vote.
- **Seed every artboard from token values, not from taste.** Put the candidate
  ramp in the artboard as literal hex and derive nothing at render time — the
  colours the client approves must be the colours that land in the theme file.
- **One artboard per direction is enough to choose.** Decision fidelity is not
  deliverable fidelity. Build the full page set only after they pick.
- **Include a mobile artboard for the chosen direction.** Clients approve
  desktop and then discover mobile; get it in front of them first.
- **Show the ramp itself as an artboard** — all eight brand steps plus the
  neutrals, labelled with their token keys (`brand.500`, `neutral.700`). This is
  what makes the canvas a *token* decision rather than a picture, and it is what
  you transcribe in Phase 5.
- **Real copy or bracketed placeholders. Never lorem ipsum, never invented
  facts.** Prices, dates, counts, addresses stay as `[LIKE THIS]`.

Working files live in `design-lab/explorations/<client-slug>/` while there is no
client repo. Once `client-repo-bootstrap` Phase 2 creates one, move them to
`design/` inside it so the canvas source is versioned with the build — every
later change re-seeds from these files, so losing them means starting over.

## Phase 3 — Publish for the client

**Publish client-facing canvases WITHOUT the export capability.** This is the
one mechanical detail that decides whether the engagement works:

| declared | who can open the link |
|---|---|
| with PNG/PDF export | **your organization only** — the client cannot open it at all |
| without export | shareable by public link |

An outside client hitting a wall on the link you just sent is not a good look.
Declare export only on internal canvases. If the client also needs a PDF for
their own stakeholders, export it yourself from an internal copy and send the
file — but see the font warning below before you do.

Share from the page's share menu. Nothing to install; the client just opens it.

## Phase 4 — Client picks; capture the decision

Get the decision in writing, not just in a meeting. Then:

- Build the chosen direction out into the full page set, in `Main.dc.html`.
- Move the unchosen directions to a second canvas page, or delete them. Keep
  option names stable — an option that was "Direction B" stays "Direction B"
  for the life of the engagement.
- Re-seed and republish to the same artifact so the link the client already has
  keeps working.

**One editor at a time.** Two people saving concurrently conflict with no
merge — the second saver's edits survive only as unsaved local work. Do not put
a client and a designer in the canvas simultaneously.

## Phase 5 — Emit the theme and hand off

1. Write `tokens/themes/<client-slug>.json`, shaped like `wireframe.json`.
   The exact keys, verified against `tokens/primitives.json`:

   | group | keys |
   |---|---|
   | `color.brand` | `100 200 300 400 500 600 700 900` — **there is no 800** |
   | `color.neutral` | `0 50 100 200 300 400 500 600 700 800 900` |
   | `color.success` | `bg subtle base dark` |
   | `color.warning` | `bg subtle base` — **no `dark`, unlike the other two** |
   | `color.danger` | `bg subtle base dark` |
   | `font.family` | `display` and `body` (two entries, not one) |

   Every leaf is `{ "value": "#RRGGBB" }`. Override only what must differ from
   `primitives.json` — `wireframe.json` overrides colour and `font.family` and
   leaves `color.overlay` alone, which is the right instinct to copy.
2. Transcribe the approved hexes **exactly** from the ramp artboard. If a step
   was never decided, go back to the client — do not interpolate it. An
   interpolated step is precisely the algorithmic ramp Phase 1 refuses.
3. Build and audit:

   ```bash
   PRIMER_THEME=<client-slug> npm run build:tokens
   npm run check:contrast
   ```

   Note `build:tokens` runs `sync:tokens` first, which merges
   `tokens/tokens.studio.json` — so do this on a branch or a scratch checkout
   if you do not want that merge in your working tree.
4. **Contrast failures are fixed here, in the ramp, by adjusting a step and
   re-checking with the client** — never by editing semantic tokens, which the
   first Figma sync would revert. This is the whole timing argument for this
   skill; do not skip it to save a round trip.
5. Hand `client-repo-bootstrap` its Phase 1 inputs: slug, display name, the
   audited ramp, brand font, GitHub destination.

Do not commit a partial theme file to main (`tokens/themes/README.md`).

## Gotchas that only show up with real clients

- **Google Fonts do not embed in PNG/PDF export** — exported text renders in
  the fallback face. For a branding agency this is the worst possible place to
  lose fidelity: never settle a typeface from an exported PDF. Type decisions
  happen on the live link.
- **The canvas editor is baked in at publish time** and will not pick up later
  improvements. A long engagement's early canvas runs an older editor; re-seed
  into a fresh canvas if that starts to matter.
- **Design-system colour tokens** are not available in this canvas editor — the
  ramp artboard is how you represent tokens, which is why Phase 2 requires one.
- **A canvas is not a contract.** It is a direction artefact. Approval of a
  canvas is approval of a direction, not of a built page; say so to the client
  in as many words, or you will litigate it later.

## Out of scope

- Repo, Storyblok, and Figma setup — that is `client-repo-bootstrap`.
- The ongoing Figma → Tokens Studio → repo pipeline — that is its Phase 5, and
  it takes over token editing permanently once wired. After that point the
  canvas is for exploring *new* directions, not for maintaining live tokens.
- Content and copy briefs — that is `figma-content-brief`.
- Hosting and deploy, which stay deliberately manual.
