---
name: client-repo-bootstrap
description: Walks through spinning up a new client build from primer-ui — fork the repo, apply the client's brand tokens, provision a Storyblok space from Primer Block Space, and wire branding. Stops short of hosting/deploy, which stays a deliberate manual step until a hosting platform is chosen.
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

## Phase 1 — Client brief

Gather before doing anything:
- **Client slug** — kebab-case, matches `tokens/themes/` naming convention (`tokens/themes/README.md`).
- **Full 8-step brand color ramp** — keys `100/200/300/400/500/600/700/900`, matching `tokens/primitives.json`'s `color.brand.*` shape (confirmed against `tokens/themes/wireframe.json`, which overrides this same primitive-shaped subtree, not semantic.json). **Do not auto-generate this from a single accent color** — there's no color-ramp-generation tooling in this repo, and an algorithmic tint/shade ramp is a real design-quality risk for a real brand. Get the full ramp from the client's brand guidelines or design file. If they only have one brand color, say so explicitly and ask for the ramp rather than inventing one.
- **Brand font** — for the `BaseLayout.astro` Google Fonts `<link>` swap (CLAUDE.md already calls this out as the one hand-edit per client).
- **Destination GitHub org/account** — where the new repo gets created.
- **Storyblok region** — default `eu` (matches Primer Block Space).

## Phase 2 — Repo creation

1. Clone primer-ui into a fresh local directory named for the client slug.
2. Strip `.git` and `git init` fresh — a client repo doesn't need primer-ui's full commit history, and starting clean avoids any future accidental cross-client leakage through old commits.
3. **De-primer the identity, not the engineering conventions.** The client repo should be named/described as the client's project, not carry `primer-ui` branding forward — but most of what currently says "Primer" is genuine, still-valid engineering guidance (the token layer rules, component structure conventions), not identity, and should stay:
   - `package.json`: rename `"name"` from `@primer-inc/ui` to `@primer-inc/<slug>` (keep the `@primer-inc` scope — Primer the agency maintains/builds these, the scope denotes that, not the client's own org) and update `"description"` to describe this specific client's site.
   - `README.md`: retitle from `# primer-ui` to `# <client name>` and rewrite its description line; the structural sections below (`tokens/`, `storyblok/`, setup commands) stay as-is, they're still accurate.
   - `CLAUDE.md`: rewrite the title and the "What this repo is" / `Repository:` lines to describe this client's repo — leave the rest (token system, component conventions, coding rules) untouched, it's still the operative guidance for anyone (human or Claude) working in this fork.
   - `package-lock.json`: don't hand-edit — just rerun `npm install` after the `package.json` rename and it regenerates consistently.
   - `astro.config.mjs`'s `primer:watch-tokens` Vite plugin label is cosmetic (an internal dev-server log tag, no external visibility) — rename it if convenient, not worth a separate pass if not.
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
2. Run `npm run bootstrap:client-space -- <slug> [--region eu]` (needs `STORYBLOK_MANAGEMENT_TOKEN` in `.env`, and `storyblok login` done at least once for the CLI's own auth — the script's sync step shells out to the `storyblok` CLI, which does not read `STORYBLOK_MANAGEMENT_TOKEN` itself).
3. It creates an empty space, then runs `storyblok sync --type components --source <primer-block-space-id> --target <new-space-id>` (ports all ~47 schemas in one step — the same mechanism already validated for porting a demo space's schema back, not field-by-field Management API calls) and `storyblok sync --type stories` for a starter set.
4. **Verify a `config` story exists in the new space afterward** — `BaseLayout.astro` hard-depends on one at that slug; without it, header/footer silently render nothing (no error, just missing chrome). If the story sync didn't produce one, create it by hand before moving on.
5. Take the space ID and preview token (Settings → API Keys in the Storyblok UI) the script prints, and write `STORYBLOK_TOKEN` + the space ID into the **client repo's** `.env` (never commit `.env`). Prompt the user to add a Management API token by hand if the client repo will need one later — that's a personal, account-level token, not something to mint or store automatically.

## Phase 5 — Branding + stop

1. Update the client repo's `BaseLayout.astro` Google Fonts `<link>` for the brief's brand font.
2. Report completion clearly: repo created, tokens applied and building clean, Storyblok space provisioned and verified. Then **stop** — state explicitly that hosting target selection and the `@astrojs/node` → real-platform adapter swap are the deliberate next manual step, not something this skill attempts.

## Verification

- Before ever running this for a real client, dry-run Phases 1-3 against a throwaway slug (e.g. `test-client`) without actually calling `gh repo create` or hitting the Storyblok API — confirm the sequence and confirmation gates make sense.
- `storyblok/bootstrap-client-space.js` should fail loudly (non-zero exit, clear message) if `STORYBLOK_MANAGEMENT_TOKEN` is missing, or if the `storyblok` CLI isn't authenticated (`storyblok login`) — same posture as `check-drift.js`.
- Treat the first real run as a trial: scrutinize each confirmation gate rather than assuming the sequence is correct just because it read fine on paper. In particular, verify the space actually landed in the requested region (the create-space API call used here doesn't confirm one was passed/honored — check in the Storyblok UI after creation).
