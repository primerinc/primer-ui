#!/usr/bin/env node
/**
 * Extracts a page/section/field skeleton from a Figma wireframe file built
 * from Primer's own component library, for the figma-content-brief skill.
 * Deliberately outputs structured JSON only — composing the actual
 * copywriter-facing document (tightening placeholder text into real
 * guidance, grouping repeated items, deciding what needs a human's
 * attention) is the agent's job in Phase 2, not this script's. See the
 * figma-content-brief skill for the full workflow this feeds into.
 *
 * How it identifies fields: a wireframe frame's top-level children are
 * Figma INSTANCEs of Primer components (e.g. "Hero", "Feature Grid") —
 * confirmed by inspecting the Forte wireframe directly. Each instance name
 * is resolved to `<component-source>/src/storyblok/<PascalCase>.astro`,
 * whose leading `Fields: ...` docblock comment is the field-name authority
 * (NOT storyblok/schema-reference.md, confirmed stale — see the skill's
 * SKILL.md for why). Plain TEXT layers are then matched positionally, in
 * document order, against that field list — every component checked so far
 * (Hero, Feature Grid) has its docblock field order matching its actual
 * layer order, so this holds as the primary strategy, but every result
 * still carries the raw layer trace so a mismatch is visible rather than
 * silently wrong.
 *
 * A field is treated as an Asset (not copy text) if the component's
 * template accesses it as `blok.<field>?.filename` — a reliable signal
 * since only Storyblok Asset fields render that way in this codebase.
 * Repeating content (e.g. Feature Grid's 3 "Feature Item" instances) is
 * detected via the docblock's `(blocks → x_item)` annotation, matched
 * against child instance names converted to Title Case.
 *
 * Usage:
 *   node --env-file=.env figma/generate-content-brief.js <figma-url-or-file-key> \
 *     [--component-source ../../primer-2026] [--pages "HOME,About,Pricing"]
 *
 * Run once with no --pages to discover and confirm the page list first —
 * a wireframe file can have non-page canvases (cover, component sandbox)
 * that shouldn't become "pages" in the brief.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { parseComponentFieldsDetailed, parseAstroConfigComponents } from '../storyblok/lib/schema-reference.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ASSET_PLACEHOLDER_RE = /^(image|icon|photo|logo|video|avatar)$/i;

function getArg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

function toTitleCase(snakeOrWord) {
  return snakeOrWord
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function toPascalCase(titleCaseName) {
  return titleCaseName.replace(/[^A-Za-z0-9]/g, '');
}

/** Figma layer names can contain a LINE SEPARATOR (U+2028) or other Unicode
 *  whitespace instead of a plain space — invisible in a terminal or JSON
 *  viewer, but byte-different from what a human would type into --pages
 *  (confirmed on the Forte file's "Configurator Community" frame). \s in a
 *  JS regex already covers U+2028/U+2029 per spec, so this collapses any
 *  such run to one plain space before comparing. */
function normalizeWhitespace(str) {
  return str.replace(/\s+/g, ' ').trim();
}

function extractFileKey(input) {
  const m = input.match(/figma\.com\/design\/([0-9a-zA-Z]{22,128})/);
  return m ? m[1] : input;
}

const rawInput = process.argv[2];
const componentSourceArg = getArg('--component-source', '../../primer-2026');
const pagesArg = getArg('--pages');
const token = process.env.FIGMA_TOKEN;

if (!rawInput) {
  console.error('Usage: node --env-file=.env figma/generate-content-brief.js <figma-url-or-file-key> [--component-source ../../primer-2026] [--pages "HOME,About"]');
  process.exit(1);
}
if (!token) {
  console.error('FIGMA_TOKEN not set — generate one at figma.com/settings (Personal access tokens) and add it to .env');
  process.exit(1);
}

const fileKey = extractFileKey(rawInput);
const componentSourceDir = resolve(__dirname, componentSourceArg);
if (!existsSync(join(componentSourceDir, 'src/storyblok'))) {
  console.error(`--component-source (${componentSourceDir}) has no src/storyblok directory — check the path.`);
  process.exit(1);
}

// A wireframe instance's name can collide with an unrelated file that
// happens to share its PascalCase prefix but isn't actually a nestable
// section block — confirmed on Forte: the "Testimonial" instance (the
// TestimonialBlock section wrapper) would otherwise resolve to
// Testimonial.astro, a completely different, non-nestable standalone-story
// renderer that just happens to exist at that filename. astro.config.mjs's
// `components` map is the ground truth for which files are actually
// resolver-registered section blocks, so prefer a registered file over an
// incidental filename match — see resolveComponentFields below.
let registeredComponentBasenames = new Set();
try {
  const map = parseAstroConfigComponents(join(componentSourceDir, 'astro.config.mjs'));
  registeredComponentBasenames = new Set(Object.values(map).map((p) => p.replace(/^storyblok\//, '')));
} catch {
  // No astro.config.mjs found (e.g. a bare component library without a
  // consuming app) — fall back to direct filename resolution only.
}

async function fetchFile(key) {
  const res = await fetch(`https://api.figma.com/v1/files/${key}`, {
    headers: { 'X-Figma-Token': token },
  });
  if (!res.ok) {
    throw new Error(`Figma API ${res.status} fetching file ${key}: ${await res.text()}`);
  }
  return res.json();
}

/** Resolves an INSTANCE's name to its component's parsed field list, or
 *  null if there's no matching file — callers must report null matches to
 *  the human rather than silently skip them. */
const componentCache = new Map();
function resolveComponentFields(instanceName) {
  if (componentCache.has(instanceName)) return componentCache.get(instanceName);
  const pascal = toPascalCase(instanceName);
  // Prefer a same-prefix registered file that's an actual nestable section
  // block over one that isn't — confirmed on Forte: "Testimonial" matches
  // both Testimonial.astro (registered too, but a standalone root content
  // type — "not nestable" in its own header, can never be a page section)
  // and TestimonialBlock.astro (the real section wrapper). Being
  // resolver-registered alone doesn't disambiguate since both are; a page
  // section instance can never resolve to a non-nestable root type.
  const candidates = [pascal, ...[...registeredComponentBasenames].filter((n) => n.startsWith(pascal) && n !== pascal)];
  let resolvedName = null;
  for (const candidate of candidates) {
    const p = join(componentSourceDir, 'src/storyblok', `${candidate}.astro`);
    if (!existsSync(p)) continue;
    const header = readFileSync(p, 'utf8').match(/\/\*\*([\s\S]*?)\*\//)?.[1] ?? '';
    if (/not nestable/i.test(header)) continue;
    resolvedName = candidate;
    break;
  }
  resolvedName ??= pascal; // fall back to the exact name even if only a non-nestable match exists
  const astroPath = join(componentSourceDir, 'src/storyblok', `${resolvedName}.astro`);
  if (!existsSync(astroPath)) {
    componentCache.set(instanceName, null);
    return null;
  }
  const fields = parseComponentFieldsDetailed(astroPath);
  const text = readFileSync(astroPath, 'utf8');
  const assetFieldNames = new Set(
    [...text.matchAll(/\bblok\.(\w+)\?\.filename/g)].map((m) => m[1])
  );
  // Storyblok Link/Multilink fields are only ever consumed via .url/.cached_url
  // (as an href), never rendered as their own visible text — no text layer to
  // pair against, but still worth flagging as "needs a URL" for whoever's
  // producing the actual link targets, not the copywriter's job either way.
  const linkFieldNames = new Set(
    [...text.matchAll(/\bblok\.(\w+)\?\.(?:url|cached_url)/g)].map((m) => m[1])
  );
  // A field only has an actual placeholder layer in the wireframe if it's
  // rendered as visible JSX text content — `{blok.x}` (optionally with a
  // `?.prop`/`|| 'default'`/`&&` chain) appearing right after a `>`, i.e.
  // as a tag's children. That excludes attribute usage (`href={...}`,
  // `class:list={...}`) and JS-only `const x = blok.y` computations, which
  // is exactly the Boolean/Option-field case (sticky, show_border,
  // announcement_enabled, etc.) that has no layer to pair against at all.
  const textFieldNames = new Set(
    [...text.matchAll(/>\s*\{\s*blok\.(\w+)(?:\?\.\w+)?(?:\s*(?:\|\|| &&)[^}]*)?\}/g)]
      .map((m) => m[1])
      .filter((name) => !assetFieldNames.has(name) && !linkFieldNames.has(name))
  );
  const result = { astroPath, fields: fields ?? [], assetFieldNames, linkFieldNames, textFieldNames };
  componentCache.set(instanceName, result);
  return result;
}

/** Depth-first walk collecting TEXT layers in document order, stopping
 *  descent at any INSTANCE whose name matches a known nested-item type for
 *  the current component (those get pulled out as repeating items
 *  separately, not flattened into the parent's flat field list) or any
 *  OTHER instance (flagged, not silently absorbed into the parent's
 *  positional field list). */
function collectFlatTextAndNestedInstances(node, nestedTypeNamesLower, out) {
  for (const child of node.children ?? []) {
    if (child.type === 'TEXT') {
      out.textLayers.push({ id: child.id, characters: (child.characters ?? child.name ?? '').trim() });
    } else if (child.type === 'INSTANCE') {
      const nameLower = child.name.toLowerCase();
      if (nestedTypeNamesLower.has(nameLower)) {
        out.nestedInstances.push(child);
      } else {
        out.unexpectedInstances.push({ id: child.id, name: child.name });
      }
    } else {
      collectFlatTextAndNestedInstances(child, nestedTypeNamesLower, out);
    }
  }
}

function extractSection(instanceNode) {
  const resolved = resolveComponentFields(instanceNode.name);
  if (!resolved) {
    return {
      component: instanceNode.name,
      figmaNodeId: instanceNode.id,
      unresolved: true,
      note: `No matching component found at src/storyblok/${toPascalCase(instanceNode.name)}.astro under --component-source`,
    };
  }

  const nestedFieldDefs = resolved.fields.filter((f) => f.nestedType);
  const nestedTypeNamesLower = new Set(
    nestedFieldDefs.map((f) => toTitleCase(f.nestedType).toLowerCase())
  );

  const collected = { textLayers: [], nestedInstances: [], unexpectedInstances: [] };
  collectFlatTextAndNestedInstances(instanceNode, nestedTypeNamesLower, collected);

  // Positionally pair the component's flat (non-nested) fields against the
  // text layers actually found, in order — but only for fields that
  // actually HAVE a layer to pair against. Boolean/Option fields (sticky,
  // show_border, announcement_enabled, ...) render nothing visible and are
  // skipped entirely, not given a phantom slot — including them was what
  // scrambled every field after them in earlier testing (see Header/Footer).
  // Link fields (login_link, announcement_link_url, ...) also have no text
  // layer of their own (only ever consumed via .url/.cached_url as an
  // href) but still need a URL from someone, so they're reported separately
  // rather than silently dropped.
  const flatFields = resolved.fields.filter((f) => !f.nestedType);
  const fields = [];
  const assets = [];
  const links = [];
  let cursor = 0;
  for (const f of flatFields) {
    if (resolved.linkFieldNames.has(f.name)) {
      links.push({ field: f.name });
      continue;
    }
    if (!resolved.assetFieldNames.has(f.name) && !resolved.textFieldNames.has(f.name)) {
      continue; // Boolean/Option field — no layer, not copywriter-relevant.
    }
    const layer = collected.textLayers[cursor];
    cursor++;
    if (resolved.assetFieldNames.has(f.name)) {
      assets.push({ field: f.name, note: layer ? `placeholder: "${layer.characters}"` : 'no placeholder layer found — verify manually' });
    } else {
      fields.push({ field: f.name, placeholder: layer?.characters ?? null });
    }
  }

  // If every expected slot consumed exactly one layer and none are left
  // over, positional matching almost certainly lined up correctly. Any
  // mismatch — leftover layers (a wireframe simplifying repeating content
  // into plain un-instanced text, e.g. Header's nav links with no matching
  // "Nav Item" instances) or too few (an optional field just isn't shown in
  // this instance) — means the pairing above is NOT trustworthy as-is.
  // Surface both explicitly rather than presenting a wrong result with
  // false confidence; Phase 2 (and a human) needs to resolve these by eye.
  const extraTextLayers = collected.textLayers.slice(cursor).map((l) => l.characters);
  const needsManualReview = extraTextLayers.length > 0 || cursor > collected.textLayers.length;

  // Group repeating nested instances by name (e.g. 3x "Feature Item").
  const nestedByName = new Map();
  for (const inst of collected.nestedInstances) {
    if (!nestedByName.has(inst.name)) nestedByName.set(inst.name, []);
    nestedByName.get(inst.name).push(inst);
  }
  const nestedItems = [];
  for (const [name, instances] of nestedByName) {
    const fieldDef = nestedFieldDefs.find((f) => toTitleCase(f.nestedType).toLowerCase() === name.toLowerCase());
    const itemResolved = resolveComponentFields(name);
    nestedItems.push({
      itemType: fieldDef?.nestedType ?? name,
      figmaInstanceName: name,
      count: instances.length,
      items: instances.map((inst) => {
        if (itemResolved) {
          // Nested item has its own component file (e.g. "button" -> Button.astro) — same treatment as a top-level section.
          const section = extractSection(inst);
          return section;
        }
        // No standalone file (e.g. feature_item is inline in FeatureGrid.astro) — best-effort: dump every text
        // layer found under this instance in order, unnamed, flagged for human review to label correctly.
        const innerTexts = [];
        (function walk(n) {
          for (const c of n.children ?? []) {
            if (c.type === 'TEXT') innerTexts.push((c.characters ?? c.name ?? '').trim());
            else walk(c);
          }
        })(inst);
        return { figmaNodeId: inst.id, needsReview: true, rawTextLayers: innerTexts };
      }),
    });
  }

  return {
    component: instanceNode.name,
    figmaNodeId: instanceNode.id,
    fields,
    assets,
    links,
    nestedItems,
    unexpectedInstances: collected.unexpectedInstances,
    needsManualReview,
    extraTextLayers,
  };
}

async function main() {
  // stderr, not stdout — when --pages is given, stdout must be pure JSON
  // so callers can pipe/parse it directly.
  console.error(`Fetching Figma file ${fileKey}...`);
  const file = await fetchFile(fileKey);

  const canvases = file.document.children ?? [];
  const allTopFrames = canvases.flatMap((canvas) =>
    (canvas.children ?? [])
      .filter((n) => n.type === 'FRAME')
      .map((frame) => ({ canvas: canvas.name, frame }))
  );

  if (!pagesArg) {
    console.log('\nDiscovered top-level frames (candidate pages) — re-run with --pages to confirm which are real site pages:\n');
    for (const { canvas, frame } of allTopFrames) {
      console.log(`  [${canvas}] ${normalizeWhitespace(frame.name)}  (node-id: ${frame.id})`);
    }
    console.log('\nExample: --pages "HOME,About,Pricing"');
    return;
  }

  const wantedNames = pagesArg.split(',').map((s) => s.trim());
  const pages = [];
  for (const name of wantedNames) {
    const match = allTopFrames.find((f) => normalizeWhitespace(f.frame.name) === normalizeWhitespace(name));
    if (!match) {
      console.error(`Warning: no top-level frame named "${name}" found — skipping.`);
      continue;
    }
    const sections = (match.frame.children ?? [])
      .filter((n) => n.type === 'INSTANCE')
      .map((instance) => extractSection(instance));
    pages.push({ page: name, figmaNodeId: match.frame.id, sections });
  }

  const output = { fileKey, fileName: file.name, componentSource: componentSourceDir, pages };
  console.log(JSON.stringify(output, null, 2));
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
