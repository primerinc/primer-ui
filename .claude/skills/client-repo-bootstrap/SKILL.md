---
name: client-repo-bootstrap
description: Walks through spinning up a new client build from primer-ui — fork the repo, apply the client's brand tokens, provision a Storyblok space from Primer Block Space, connect a duplicated Figma design file's Tokens Studio sync to the new repo, and wire branding. Stops short of hosting/deploy, which stays a deliberate manual step until a hosting platform is chosen.
---

# Client repo bootstrap

## Why this exists

Every client build today repeats the same manual sequence: fork the
component library, hand-author a theme file, rebuild a Storyblok space's
~47 component schemas, wire branding. This skill automates that repeated
setup so billable time goes to actual client customization instead.

**This is an orchestration skill, not a script to run unattended.** Every
phase below has a real external side effect — a new GitHub repo, a new
(billing-relevant) Storyblok space, pushes. Confirm with the user before
each one; do not chain them without a pause.

**Explicitly out of scope: hosting.** `astro.config.mjs` is pinned to
`@astrojs/node` (`mode: 'standalone'`), which only works self-hosted — the
adapter swap is parked until a hosting platform is chosen (CLAUDE.md's SSR
deploy note). Stop after Phase 5 and report the repo is ready for local dev;
do not touch `astro.config.mjs`'s `adapter` line or guess a hosting platform.

**What "no Primer branding" actually means here — confirmed with James:**
the internal repo/package naming (`package.json`'s `@primer-inc/ui`,
`README.md`, `CLAUDE.md`) can stay as-is — the client never sees a
`package.json` name or a README title. What matters is anywhere the client
actually looks or edits, which in practice is **only the Storyblok
editor/CMS** (they never touch the codebase). That's why Phase 4 doesn't
sync stories from Primer Block Space wholesale — confirmed by direct
inspection that its `config` story has real Primer branding baked in
(`site_name: "Primer"`, footer `tagline: "Primer Inc"`) and the space also
holds other clients' demo content (Lock 8's), which a blanket story sync
would have copied straight into every new client's CMS.

## Phase 1 — Client brief

Gather before doing anything:
- **Client slug** — kebab-case, matches `tokens/themes/` naming convention (`tokens/themes/README.md`).
- **Client display name** — the real site name (e.g. "Acme Corp"), seeded into the new Storyblok space's `config` story as `site_name`. This is the client-facing name a content editor will actually see, unlike the slug.
- **Full 8-step brand color ramp** — keys `100/200/300/400/500/600/700/900`, matching `tokens/primitives.json`'s `color.brand.*` shape (confirmed against `tokens/themes/wireframe.json`, which overrides this same primitive-shaped subtree, not semantic.json). **Do not auto-generate this from a single accent color** — there's no color-ramp-generation tooling in this repo, and an algorithmic tint/shade ramp is a real design-quality risk for a real brand. Get the full ramp from the client's brand guidelines or design file. If they only have one brand color, say so explicitly and ask for the ramp rather than inventing one.
- **Brand font** — for the `BaseLayout.astro` Google Fonts `<link>` swap (CLAUDE.md already calls this out as the one hand-edit per client).
- **Destination GitHub org/account** — where the new repo gets created.
- **Storyblok region** — default `eu` (matches Primer Block Space).

## Phase 2 — Repo creation

1. Clone primer-ui into a fresh local directory named for the client slug.
2. Strip `.git` and `git init` fresh — a client repo doesn't need primer-ui's full commit history, and starting clean avoids any future accidental cross-client leakage through old commits.
3. Internal naming (`package.json`'s `@primer-inc/ui`, `README.md`, `CLAUDE.md`) does **not** need to change — confirmed with James this is fine to leave as-is, since the client never sees any of it. Don't spend a step on it unless asked.
4. Confirm the GitHub destination (org/account, repo name, private/public) with the user.
5. `gh repo create <org>/<slug> --private --source=. --push` (or public, per confirmation).

Confirm specifically before the `gh repo create`/push step — everything before it is local and reversible.

## Phase 3 — Tokens

Using the brand ramp from Phase 1:

1. **In this repo (primer-ui):** create `tokens/themes/<slug>.json` with a `color.brand` override matching `wireframe.json`'s shape (see that file for the exact structure). Commit it here — this is the central archive `tokens/themes/README.md` describes ("do not commit partial/in-progress theme files" implies finished ones are committed).
2. **In the new client repo:** apply the same `color.brand.*` values directly into that repo's own `tokens/primitives.json` (not a `tokens/themes/*.json` override file — a client repo only ever runs one theme, so the value becomes the primitive directly, no `PRIMER_THEME` switching needed there). Run `npm run build:tokens` in the client repo and confirm it completes without error before moving on.

## Phase 4 — Storyblok space

This is the one mechanical piece, scripted in `storyblok/bootstrap-client-space.js`:

1. Confirm with the user before running it — it creates a real (billing-relevant) Storyblok space.
2. Run `npm run bootstrap:client-space -- <slug> <site-name> [--region eu]` (needs `STORYBLOK_MANAGEMENT_TOKEN` in `.env`, and `storyblok login` done at least once for the CLI's own auth — the script's component-sync step shells out to the `storyblok` CLI, which does not read `STORYBLOK_MANAGEMENT_TOKEN` itself).
3. It creates an empty space, syncs **component schemas only** from Primer Block Space (`storyblok sync --type components` — the same mechanism already validated for porting a demo space's schema back, ports all ~47 schemas in one step instead of field-by-field), then creates one clean `config` story directly via the Management API — seeded with only `site_name` (the client display name from Phase 1); `header`/`footer` are left genuinely empty, not pre-filled with placeholder nav links or Primer's own branding.
4. **Stories are deliberately not synced from Primer Block Space at all** — its actual `config` story carries real Primer branding, and the space also holds other clients' demo content. Don't "fix" this by syncing stories with a broader filter; the empty-header/footer `config` story this script creates is the safe baseline, and the client's own header/footer content gets added through the Storyblok editor afterward, same as any other content.
5. Take the space ID and preview token (Settings → API Keys in the Storyblok UI) the script prints, and write `STORYBLOK_TOKEN` + the space ID into the **client repo's** `.env` (never commit `.env`). Prompt the user to add a Management API token by hand if the client repo will need one later — that's a personal, account-level token, not something to mint or store automatically.
6. Build the component catalog page — an unpublished `campaign_page` story with every component (and variant worth comparing) stacked on it, labeled, `hide_nav`/`hide_footer` on. See "Component catalog pattern" in `storyblok/schema-reference.md` for the exact recipe. This is what gets pulled up whenever the client asks "what does X look like" instead of improvising something under time pressure.

## Phase 5 — Figma design file (ongoing token editing, not just the initial apply)

Phase 3 applies the client's brand ramp once, directly, so the repo is usable immediately without waiting on this step. This phase sets up the *ongoing* pipeline — so a designer can keep adjusting the client's tokens in Figma afterward, the same way Primer's own tokens are maintained.

1. Duplicate the "Primer Design System" Figma file → rename to "`<client display name>` Design System."
2. Open Tokens Studio in the duplicate and explicitly set the GitHub sync provider's **Repository** field to `<org>/<slug>` (the client repo from Phase 2) — **not** `primerinc/primer-ui`. The sync config form is `Name / Personal access token / Repository (owner/repo) / Branch / token storage path`. It isn't documented anywhere findable whether a duplicated Figma file inherits the source file's old sync target or starts blank — treat it as unknown and **explicitly set/verify** the Repository field before anyone hits Push, rather than assuming either way. Branch stays `main`; storage path stays `tokens/tokens.studio.json`, matching this repo's convention.
3. One GitHub PAT (`repo` scope) can be reused across every client file's sync config — it's a credential scoped to what the person entering it can access, not something to mint fresh per client.
4. Confirm `.github/workflows/build-tokens.yml` exists in the client repo (it will automatically — every client repo is a fork taken after this Action already existed in `primer-ui`). This is what makes Figma edits actually take effect without anyone running a local build — see CLAUDE.md's Figma sync section.
5. Share the duplicated Figma file with whoever will be doing the client's design work — **edit access to that one file, nothing else** (no GitHub, no Storyblok Management API access implied by this step).

## Phase 6 — Branding + stop

1. Update the client repo's `BaseLayout.astro` Google Fonts `<link>` for the brief's brand font.
2. Report completion clearly: repo created, tokens applied and building clean, Storyblok space provisioned and verified, Figma file connected. Then **stop** — state explicitly that hosting target selection and the `@astrojs/node` → real-platform adapter swap are the deliberate next manual step, not something this skill attempts.

## Verification

- Before ever running this for a real client, dry-run Phases 1-3 against a throwaway slug (e.g. `test-client`) without actually calling `gh repo create` or hitting the Storyblok API — confirm the sequence and confirmation gates make sense.
- `storyblok/bootstrap-client-space.js` should fail loudly (non-zero exit, clear message) if `STORYBLOK_MANAGEMENT_TOKEN` is missing, or if the `storyblok` CLI isn't authenticated (`storyblok login`) — same posture as `check-drift.js`.
- After a real run, open the new space's `config` story in Storyblok and confirm `site_name` is the client's name (not "Primer") and `header`/`footer` are empty, not carrying over any Primer Block Space content.
- Treat the first real run as a trial: scrutinize each confirmation gate rather than assuming the sequence is correct just because it read fine on paper. In particular, verify the space actually landed in the requested region (the create-space API call used here doesn't confirm one was passed/honored — check in the Storyblok UI after creation).
- After Phase 5, push a real (throwaway is fine) color change through the duplicated Figma file end-to-end — Import Variables, Push — and confirm it lands in the *client* repo, not `primer-ui`, and that `.github/workflows/build-tokens.yml` actually runs and regenerates the client repo's tokens automatically. Don't consider Phase 5 done on configuration alone; a misconfigured Repository field fails silently (it just pushes to the wrong place) and won't surface any other way.
