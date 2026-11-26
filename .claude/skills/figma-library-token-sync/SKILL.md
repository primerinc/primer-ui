---
name: figma-library-token-sync
description: Exports fully-resolved design tokens from a Figma file that subscribes to the Primer Design System library (rather than a local duplicate) — via the figma-console-mcp MCP server, working around Tokens Studio's inability to read library-subscribed variable collections.
---

# Figma library token sync

## Why this exists

`primitives` and `semantic` variables normally live as a file's own local
Variable collections — that's what Tokens Studio's "Import Variables"
reads. It works, but it means every file (the master, every client
duplicate) carries its own independent copy of the full variable set,
including `primitives`, which Figma's own UI can't fully hide from a
designer's color/spacing pickers no matter how `scopes` is configured (the
"Libraries → All libraries" search modal ignores `scopes` entirely —
confirmed 2026-08-20).

The real fix is a client file that **subscribes** to the Primer Design
System as a published Team Library and enables only its `semantic`
collection, leaving `primitives` disabled — genuinely invisible in every
picker, not just scope-hidden. The catch: **Tokens Studio's "Import
Variables" can only read a file's own local collections, not ones merely
subscribed from a library** — confirmed via a real spike (2026-08-20,
throwaway files, published a spike library, subscribed a consumer file
with only `semantic` enabled — Tokens Studio's import dialog showed zero
importable collections).

[figma-console-mcp](https://docs.figma-console-mcp.southleft.com/)
(southleft, MIT licensed, free/open source) closes that gap. Confirmed
2026-08-21: its `figma_get_library_variables` tool enumerates *every*
collection in a subscribed library — including `primitives`, even when
disabled in the consuming file's pickers — and `getVariableByIdAsync`
(via `figma_execute`) resolves any variable found that way to its real
value, alias chains and all, without needing it imported first.

## What this is NOT

This is an **on-demand procedure**, not an automatic sync. It requires
Figma Desktop open with the Desktop Bridge plugin actively running and
connected — it cannot run headlessly in a GitHub Action the way Tokens
Studio's GitHub-sync-on-push could for a local-variables file. Someone
(a human, or Claude Code with `figma-console-mcp` connected) has to
deliberately run this when a token update needs to reach code.

## Prerequisites

- `figma-console-mcp` connected as an MCP server (see
  `docs.figma-console-mcp.southleft.com/setup` — needs a Figma Personal
  Access Token in the server's env and the Desktop Bridge plugin imported
  + running in the target Figma file. New MCP server connections only
  take effect on session restart.)
- The target Figma file subscribes to the published Primer Design System
  library, with (at minimum) `semantic` enabled. `primitives` should stay
  disabled — that's the point.
- `figma_get_status` with `probe: true` confirms the bridge is connected
  and targeting the right file before doing anything else.

## Procedure

1. **Enumerate the library's variables**: call `figma_get_library_variables`
   (optionally filtered by `collectionName`) against the target file. This
   returns every collection the library publishes — `semantic` and
   `primitives` both — each variable's `key`, `name`, and `resolvedType`.
   No values yet, just the inventory.

2. **Resolve each variable to its real value**: for each variable of
   interest (normally just `semantic`'s — that's what components actually
   bind to), use `figma_execute` to run
   `figma.variables.getVariableByIdAsync(id)`. If the returned value is a
   `VARIABLE_ALIAS` (`{type: 'VARIABLE_ALIAS', id: ...}`), recursively
   resolve the target id the same way until you hit a literal value.
   Variables don't need to be imported into the file first — reading by
   id works directly, confirmed against a real primitive
   (`color/brand/500` resolved to `{r:0.749,g:0.545,b:0.235}` /
   `#BF8B3C`, matching the source exactly, with primitives disabled in
   the consuming file).

3. **Assemble the output JSON.** Match Tokens Studio's existing token-set
   shape (`Collection/Mode` naming, `$extensions["com.figma.scopes"]`,
   etc.) so `tokens/sync-from-studio.js` and everything downstream (Style
   Dictionary, `npm run build:tokens`) needs **zero changes** — only the
   *source* of `tokens/tokens.studio.json` changes, not what consumes it.

4. **Commit the result** to the target repo's `tokens/tokens.studio.json`
   and run `npm run build:tokens` (or push and let
   `.github/workflows/build-tokens.yml` do it) exactly as today.

## Verification

- Before running this against any real client file, validate end-to-end
  against a throwaway consumer file subscribed to the real (not spike)
  published library — confirm `primitives` is absent from that file's
  own pickers (both scoped surfaces and the "All libraries" modal) while
  still resolving correctly through this procedure.
- After a real run: confirm `build:tokens` completes without error and
  the regenerated `tokens/dist/tokens.css` contains the expected resolved
  values, not broken/unresolved alias references.

## Not yet decided / open follow-ups

- Whether to eventually rewrite this as a real standalone script (Node,
  using the same underlying capability) that a designer could run
  without Claude Code in the loop — today this is a Claude-Code-mediated
  procedure, not a packaged tool.
- Whether new client files should convert to this subscribe-only model
  immediately, or continue today's duplicate-file model for anything
  already in flight (e.g. Forte's current wireframe stays on local
  variables through its current build phase — this is additive for new
  onboarding, not a forced retrofit of in-progress work).
