#!/usr/bin/env node
/**
 * Creates (and later deletes) a disposable, unpublished campaign_page story
 * for render verification — spin up real content, run a real production
 * build, grep the compiled output, then clean up. This is the tooling half
 * of the storyblok-render-check skill; that skill explains why this exists
 * and how to use it. Short version: this project's dev server injects CSS
 * via a separate Vite HMR path, so curling the dev server's raw HTML is NOT
 * reliable proof that a CSS change actually works (confirmed 2026-07-29,
 * see the skill) — only a real `npm run build` + grepping the compiled
 * `dist/client/_astro/*.css` output is.
 *
 * Usage:
 *   node --env-file=.env storyblok/render-check.js create <body.json> [--slug <slug>] [--space <id>]
 *   node --env-file=.env storyblok/render-check.js cleanup <storyId> [--space <id>]
 *
 * <body.json> is a JSON array of blok objects — same shape as a
 * campaign_page's `body` field, e.g.:
 *   [{ "component": "hero", "headline": "Test", "background": "dark" }]
 * `_uid` is auto-generated for every blok (and every nested blok, one level
 * deep — Blocks-type fields like `buttons`/`cards`/`items`) if not already
 * present, so you don't have to hand-write them.
 */
const DEFAULT_SPACE_ID = '293131252124026'; // Primer Block Space
const token = process.env.STORYBLOK_MANAGEMENT_TOKEN;

function getArg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

const spaceId = getArg('--space', process.env.STORYBLOK_SPACE_ID || DEFAULT_SPACE_ID);

if (!token) {
  console.error('STORYBLOK_MANAGEMENT_TOKEN not set — run via `node --env-file=.env storyblok/render-check.js ...`');
  process.exit(1);
}

let uidCounter = 0;
const uid = () => `render-check-${Date.now()}-${uidCounter++}`;

/** Auto-generates _uid on the blok itself and on any nested blok array (one level deep). */
function ensureUids(blok) {
  if (!blok._uid) blok._uid = uid();
  for (const value of Object.values(blok)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === 'object' && item.component) ensureUids(item);
      }
    }
  }
  return blok;
}

async function create(bodyFile, slugArg) {
  const { readFileSync } = await import('node:fs');
  const body = JSON.parse(readFileSync(bodyFile, 'utf8')).map(ensureUids);
  const slug = slugArg || `render-check-${Date.now()}`;

  const res = await fetch(`https://mapi.storyblok.com/v1/spaces/${spaceId}/stories`, {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      story: {
        name: `Internal — Render Check (temporary, delete me)`,
        slug,
        parent_id: 0,
        content: {
          component: 'campaign_page',
          title: 'Render Check',
          internal_campaign_name: 'temporary render-check story — safe to delete',
          hide_nav: true,
          hide_footer: true,
          seo: [],
          body,
        },
      },
      publish: 0,
    }),
  });
  if (!res.ok) throw new Error(`Storyblok API ${res.status} creating story: ${await res.text()}`);
  const { story } = await res.json();
  console.log(JSON.stringify({ id: story.id, full_slug: story.full_slug, previewUrl: `https://localhost:4321/${story.full_slug}` }, null, 2));
  console.log('\nNext: npm run build, then grep dist/client/_astro/*.css for what you expect.');
  console.log(`When done: npm run storyblok:render-check -- cleanup ${story.id}`);
}

async function cleanup(storyId) {
  const res = await fetch(`https://mapi.storyblok.com/v1/spaces/${spaceId}/stories/${storyId}`, {
    method: 'DELETE',
    headers: { Authorization: token },
  });
  if (!res.ok) throw new Error(`Storyblok API ${res.status} deleting story: ${await res.text()}`);
  console.log(`deleted story ${storyId}`);
}

const [, , cmd, ...rest] = process.argv;

if (cmd === 'create') {
  const bodyFile = rest.find((a) => !a.startsWith('--'));
  if (!bodyFile) {
    console.error('Usage: node storyblok/render-check.js create <body.json> [--slug <slug>] [--space <id>]');
    process.exit(1);
  }
  await create(bodyFile, getArg('--slug'));
} else if (cmd === 'cleanup') {
  const storyId = rest.find((a) => !a.startsWith('--'));
  if (!storyId) {
    console.error('Usage: node storyblok/render-check.js cleanup <storyId> [--space <id>]');
    process.exit(1);
  }
  await cleanup(storyId);
} else {
  console.error('Usage:\n  node storyblok/render-check.js create <body.json> [--slug <slug>] [--space <id>]\n  node storyblok/render-check.js cleanup <storyId> [--space <id>]');
  process.exit(1);
}
