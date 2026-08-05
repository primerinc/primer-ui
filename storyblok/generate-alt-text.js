#!/usr/bin/env node
/**
 * Fills in missing alt text on assets in the Storyblok Asset Library using
 * Claude's vision capability — accessibility + SEO/AEO-friendly descriptions
 * for images editors upload without typing alt text themselves.
 *
 * Scope: the Asset Library only (GET/PUT /spaces/{id}/assets), which is
 * every file ever uploaded regardless of whether it's currently referenced
 * in a story. It does NOT touch alt text already saved inside a story's
 * content (an `asset`-type field's own `alt`, e.g. `blok.image.alt`) — those
 * are per-usage overrides that already diverged from the library default the
 * moment an editor typed something custom, and blanket-rewriting live story
 * content is a bigger, scarier operation than this first pass is scoped for.
 * A future follow-up could walk story content the same way
 * check-build-safety.js walks component fields, matching by filename.
 *
 * Endpoint/payload confirmed by reading Storyblok's own CLI source
 * (storyblok/monoblok, packages/cli/src/commands/assets/actions.ts) rather
 * than guessing — `PUT /v1/spaces/{id}/assets/{asset_id}` with body
 * `{ asset: { alt: "..." } }`. The public docs page for "Update Asset" only
 * covers replacing the file itself, not a metadata-only edit like this.
 *
 * Safety rails (this is this repo's first *write* script, not a read-only
 * check — see check-drift.js / check-build-safety.js for the read-only
 * pattern this deliberately departs from):
 *   - Dry-run by default. Nothing is written until --write is passed.
 *   - Skips assets that already have non-blank alt text, unless --overwrite
 *     is also passed — this is a "fill gaps" tool, not a "regenerate
 *     everything" tool, so it never clobbers text an editor already wrote.
 *   - --limit caps how many assets get processed per run (default 10) so a
 *     first run costs a small, predictable number of Anthropic API calls
 *     before you've seen the output quality. Raise it (or pass --all) once
 *     you trust the results.
 *
 * Requires STORYBLOK_MANAGEMENT_TOKEN (already used by the other storyblok/
 * scripts) and ANTHROPIC_API_KEY (new — add your own key to .env; this repo
 * doesn't ship one).
 *
 * Usage:
 *   node --env-file=.env storyblok/generate-alt-text.js                  # dry run, up to 10 assets
 *   node --env-file=.env storyblok/generate-alt-text.js --limit 25       # dry run, up to 25
 *   node --env-file=.env storyblok/generate-alt-text.js --all --write    # write alt text for every asset missing it
 *   node --env-file=.env storyblok/generate-alt-text.js --overwrite --write --limit 5   # regenerate existing alt text too
 *   node --env-file=.env storyblok/generate-alt-text.js --space <id> ... # target a different space
 */

const DEFAULT_SPACE_ID = '293131252124026'; // Primer Block Space

// Claude's vision input only accepts these raster formats — SVGs (mostly
// icons in this library) and non-image files (PDFs, etc.) are skipped
// rather than sent to the API and failing.
const SUPPORTED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const ALT_TEXT_PROMPT = `You are writing alt text for an image on a B2B marketing website, optimized for accessibility, SEO, and answer-engine optimization (AEO — how AI systems summarize and cite web content).

Write ONE concise alt text (under 125 characters) that factually describes what is visible in the image. Rules:
- Do not start with "image of", "picture of", or "photo of".
- Do not invent details, brand names, or context you can't actually see.
- Be specific and descriptive (concrete nouns, not vague terms like "a scene").
- Plain, natural language a screen reader user would find genuinely useful — not keyword stuffing.

Reply with ONLY the alt text itself. No quotes, no explanation, no trailing period unless it reads as a full sentence.`;

function getArg(flag) {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
}
function hasFlag(flag) {
  return process.argv.includes(flag);
}

const spaceId = getArg('--space') || process.env.STORYBLOK_SPACE_ID || DEFAULT_SPACE_ID;
const managementToken = process.env.STORYBLOK_MANAGEMENT_TOKEN;
const anthropicKey = process.env.ANTHROPIC_API_KEY;
const write = hasFlag('--write');
const overwrite = hasFlag('--overwrite');
const all = hasFlag('--all');
const limit = all ? Infinity : Number(getArg('--limit') ?? 10);

if (!managementToken) {
  console.error('STORYBLOK_MANAGEMENT_TOKEN not set — run via `node --env-file=.env storyblok/generate-alt-text.js`');
  process.exit(1);
}
if (!anthropicKey) {
  console.error('ANTHROPIC_API_KEY not set — add your own key to .env (this repo does not ship one).');
  process.exit(1);
}

async function fetchAllAssets(spaceId) {
  const assets = [];
  let page = 1;
  for (;;) {
    const res = await fetch(
      `https://mapi.storyblok.com/v1/spaces/${spaceId}/assets?per_page=100&page=${page}`,
      { headers: { Authorization: managementToken } },
    );
    if (!res.ok) throw new Error(`Storyblok API ${res.status} fetching assets: ${await res.text()}`);
    const data = await res.json();
    assets.push(...data.assets);
    if (data.assets.length < 100) break;
    page++;
  }
  return assets;
}

async function generateAltText(asset) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 150,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'url', url: asset.filename } },
            { type: 'text', text: ALT_TEXT_PROMPT },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.content?.find((block) => block.type === 'text')?.text?.trim();
  if (!text) throw new Error('No text returned from Anthropic API');
  return text;
}

async function updateAssetAlt(spaceId, assetId, alt) {
  const res = await fetch(`https://mapi.storyblok.com/v1/spaces/${spaceId}/assets/${assetId}`, {
    method: 'PUT',
    headers: { Authorization: managementToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ asset: { alt } }),
  });
  if (!res.ok) throw new Error(`Storyblok API ${res.status} updating asset ${assetId}: ${await res.text()}`);
}

async function main() {
  const assets = await fetchAllAssets(spaceId);

  const candidates = assets
    .filter((a) => SUPPORTED_CONTENT_TYPES.includes(a.content_type))
    .filter((a) => overwrite || !a.alt?.trim())
    .slice(0, limit);

  const skippedUnsupported = assets.filter((a) => !SUPPORTED_CONTENT_TYPES.includes(a.content_type)).length;
  const skippedHasAlt = assets.filter(
    (a) => SUPPORTED_CONTENT_TYPES.includes(a.content_type) && a.alt?.trim() && !overwrite,
  ).length;

  console.log(`Space ${spaceId}: ${assets.length} total assets.`);
  console.log(`  ${skippedUnsupported} skipped (unsupported type — SVG/PDF/etc, not sent to vision API)`);
  console.log(`  ${skippedHasAlt} skipped (already has alt text — pass --overwrite to regenerate)`);
  console.log(`  ${candidates.length} candidate(s) this run${all ? '' : ` (--limit ${limit}, pass --all for everything)`}`);
  console.log(write ? '  MODE: --write — changes WILL be saved to Storyblok\n' : '  MODE: dry run — nothing will be saved (pass --write to apply)\n');

  let succeeded = 0;
  let failed = 0;

  for (const asset of candidates) {
    process.stdout.write(`${asset.short_filename} ... `);
    try {
      const altText = await generateAltText(asset);
      console.log(`"${altText}"`);
      if (write) {
        await updateAssetAlt(spaceId, asset.id, altText);
      }
      succeeded++;
    } catch (err) {
      console.log(`FAILED — ${err.message}`);
      failed++;
    }
  }

  console.log(`\n${succeeded} generated${write ? ' and saved' : ' (dry run, not saved)'}, ${failed} failed.`);
  if (!write && succeeded > 0) {
    console.log('Re-run with --write once you\'re happy with the quality above.');
  }
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
