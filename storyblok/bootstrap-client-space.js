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
 * `storyblok sync --type components,stories --source <A> --target <B>`
 * rather than porting fields one at a time through the Management API.
 *
 * Usage: node --env-file=.env storyblok/bootstrap-client-space.js <slug> [--region eu]
 */
import { execFileSync } from 'node:child_process';

const PRIMER_BLOCK_SPACE_ID = '293131252124026';

function getArg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

const slug = process.argv[2];
const region = getArg('--region', 'eu');
const token = process.env.STORYBLOK_MANAGEMENT_TOKEN;

if (!slug || slug.startsWith('--')) {
  console.error('Usage: node --env-file=.env storyblok/bootstrap-client-space.js <slug> [--region eu]');
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

function syncFromPrimerBlockSpace(targetSpaceId, type) {
  // storyblok CLI reads its own auth from `storyblok login` state, not this
  // script's STORYBLOK_MANAGEMENT_TOKEN — run `storyblok login` first if this
  // fails with an auth error.
  execFileSync(
    'npx',
    ['storyblok', 'sync', '--type', type, '--source', PRIMER_BLOCK_SPACE_ID, '--target', targetSpaceId],
    { stdio: 'inherit' }
  );
}

async function main() {
  console.log(`Creating Storyblok space "${slug}" (region: ${region})...`);
  const space = await createSpace(slug);
  console.log(`Created space ${space.id} (${space.name}).`);

  console.log('Syncing component schemas from Primer Block Space...');
  syncFromPrimerBlockSpace(space.id, 'components');

  console.log('Syncing starter stories (config, page) from Primer Block Space...');
  try {
    syncFromPrimerBlockSpace(space.id, 'stories');
  } catch (err) {
    console.error(
      'Story sync failed — component schemas are in place, but you\'ll need to create a `config` story ' +
        'by hand (BaseLayout.astro reads it via cdn/stories/config; without one, header/footer render nothing).'
    );
    throw err;
  }

  console.log('\nDone. Next steps (manual, by design):');
  console.log(`  - Space ID: ${space.id}`);
  console.log('  - Fetch the space\'s preview token (Settings > API Keys in the Storyblok UI) for STORYBLOK_TOKEN.');
  console.log('  - A Management API token is a personal, account-level token — add it to the client repo\'s .env by hand, not minted here.');
  console.log('  - Region defaults to eu; the Storyblok CLI/Management API create endpoint used here does not take a region parameter directly — verify the created space\'s region in the UI and reach out to Storyblok support to move it if it landed in the wrong one.');
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
