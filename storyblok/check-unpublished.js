/**
 * npm run check:unpublished — lists what a visitor will NOT see once the site
 * switches to published content (CONTENT_VERSION=published, see
 * src/lib/content-version.ts).
 *
 * Read-only. Two lists, leaving out folders and Templates & archive (archive/):
 * - Never published: these pages 404 after the switch.
 * - Unpublished changes: visitors get the last published version, not the
 *   draft the team sees today.
 *
 * Run it the day before launch and again on launch morning, then publish (or
 * archive) whatever it lists. Needs STORYBLOK_MANAGEMENT_TOKEN and
 * STORYBLOK_SPACE_ID in .env.
 */
const token = process.env.STORYBLOK_MANAGEMENT_TOKEN;
const space = process.env.STORYBLOK_SPACE_ID;
if (!token || !space) {
  console.error('Set STORYBLOK_MANAGEMENT_TOKEN and STORYBLOK_SPACE_ID in .env');
  process.exit(1);
}

const stories = [];
for (let page = 1; ; page++) {
  const res = await fetch(
    `https://mapi.storyblok.com/v1/spaces/${space}/stories?per_page=100&page=${page}`,
    { headers: { Authorization: token } }
  );
  if (!res.ok) throw new Error(`Storyblok ${res.status}: ${await res.text()}`);
  const { stories: batch } = await res.json();
  stories.push(...batch);
  if (batch.length < 100) break;
}

const live = stories.filter((s) => !s.is_folder && !s.full_slug.startsWith('archive/'));
const never = live.filter((s) => !s.published_at);
const changed = live.filter((s) => s.published_at && s.unpublished_changes);

const show = (title, list) => {
  console.log(`\n${title}: ${list.length}`);
  for (const s of list.sort((a, b) => a.full_slug.localeCompare(b.full_slug))) {
    console.log(`  /${s.full_slug}  (${s.name}, updated ${s.updated_at?.slice(0, 10)})`);
  }
};

console.log(`${live.length} stories checked (folders and archive/ left out)`);
show('Never published — 404 after launch', never);
show('Unpublished changes — visitors see the older published version', changed);
process.exitCode = never.length || changed.length ? 1 : 0;
