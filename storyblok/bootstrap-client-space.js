#!/usr/bin/env node
/**
 * The one fully-mechanical piece of the client-repo-bootstrap skill: create a
 * new, empty Storyblok space and populate it from Primer Block Space rather
 * than rebuilding ~47 component schemas by hand.
 *
 * Deliberately does NOT decide when to run — the client-repo-bootstrap skill
 * confirms with the user before invoking this, since creating a space is a
 * billing-relevant, external side effect. This script just executes once
 * called; it does not prompt.
 *
 * Uses the already-validated mechanism from the space-duplication workflow
 * (see storyblok/schema-reference.md / CLAUDE.md's Storyblok space strategy):
 * `storyblok sync --type components --source <A> --target <B>` rather than
 * porting ~47 schemas one field at a time through the Management API.
 *
 * Deliberately does NOT sync stories from Primer Block Space. Confirmed by
 * inspecting it directly: its `config` story has real Primer branding baked
 * in (site_name "Primer", footer tagline "Primer Inc"), and the space also
 * holds other clients' demo content (Lock 8's case study/campaign stories) —
 * syncing stories wholesale would copy both straight into every new client's
 * CMS. Only component *schemas* (empty structure, no content) are safe to
 * carry over unfiltered. Instead this creates one clean `config` story
 * directly via the Management API, seeded with the new client's own name and
 * nothing else — no placeholder nav links, no borrowed branding.
 *
 * Usage: node --env-file=.env storyblok/bootstrap-client-space.js <slug> <site-name> [--region eu]
 */
import { execFileSync } from 'node:child_process';

const PRIMER_BLOCK_SPACE_ID = '293131252124026';

function getArg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

const slug = process.argv[2];
const siteName = process.argv[3];
const region = getArg('--region', 'eu');
const token = process.env.STORYBLOK_MANAGEMENT_TOKEN;

if (!slug || slug.startsWith('--') || !siteName || siteName.startsWith('--')) {
  console.error('Usage: node --env-file=.env storyblok/bootstrap-client-space.js <slug> <site-name> [--region eu]');
  process.exit(1);
}
if (!token) {
  console.error('STORYBLOK_MANAGEMENT_TOKEN not set — run via `node --env-file=.env storyblok/bootstrap-client-space.js <slug>`');
  process.exit(1);
}

async function createSpace(name) {
  const res = await fetch('https://mapi.storyblok.com/v1/spaces/', {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ space: { name } }),
  });
  if (!res.ok) {
    throw new Error(`Storyblok API ${res.status} creating space: ${await res.text()}`);
  }
  const { space } = await res.json();
  return space;
}

function syncComponentsFromPrimerBlockSpace(targetSpaceId) {
  // storyblok CLI reads its own auth from `storyblok login` state, not this
  // script's STORYBLOK_MANAGEMENT_TOKEN — run `storyblok login` first if this
  // fails with an auth error.
  execFileSync(
    'npx',
    ['storyblok', 'sync', '--type', 'components', '--source', PRIMER_BLOCK_SPACE_ID, '--target', targetSpaceId],
    { stdio: 'inherit' }
  );
}

/** BaseLayout.astro fetches cdn/stories/config on every page for header/
 *  footer + site_name — without one it degrades safely (no nav, no footer,
 *  per BaseLayout's own try/catch), but a client shouldn't start from
 *  literally nothing either. Seeds only site_name; header/footer are left
 *  empty for the client to fill in themselves rather than pre-filled with
 *  placeholder nav links or borrowed branding. */
async function createConfigStory(targetSpaceId, siteName) {
  const res = await fetch(`https://mapi.storyblok.com/v1/spaces/${targetSpaceId}/stories`, {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      story: {
        name: 'Config',
        slug: 'config',
        content: { component: 'config', site_name: siteName, header: [], footer: [] },
        is_startpage: false,
        publish: 1,
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`Storyblok API ${res.status} creating config story: ${await res.text()}`);
  }
}

async function main() {
  console.log(`Creating Storyblok space "${slug}" (region: ${region})...`);
  const space = await createSpace(slug);
  console.log(`Created space ${space.id} (${space.name}).`);

  console.log('Syncing component schemas from Primer Block Space...');
  syncComponentsFromPrimerBlockSpace(space.id);

  console.log(`Creating a clean config story (site_name: "${siteName}", empty header/footer)...`);
  try {
    await createConfigStory(space.id, siteName);
  } catch (err) {
    console.error(
      'config story creation failed — component schemas are in place, but you\'ll need to create it ' +
        'by hand (BaseLayout.astro reads it via cdn/stories/config; without one, header/footer just render nothing, it won\'t crash).'
    );
    throw err;
  }

  console.log('\nDone. Next steps (manual, by design):');
  console.log(`  - Space ID: ${space.id}`);
  console.log('  - Fetch the space\'s preview token (Settings > API Keys in the Storyblok UI) for STORYBLOK_TOKEN.');
  console.log('  - A Management API token is a personal, account-level token — add it to the client repo\'s .env by hand, not minted here.');
  console.log('  - Region defaults to eu; the Storyblok CLI/Management API create endpoint used here does not take a region parameter directly — verify the created space\'s region in the UI and reach out to Storyblok support to move it if it landed in the wrong one.');
  console.log('  - The config story\'s header/footer are intentionally empty — add the client\'s real logo/nav/footer content in the Storyblok editor before launch, there is no placeholder content to replace.');
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
