#!/usr/bin/env node
/**
 * Organizes the ~44 component schemas into Storyblok's native Component
 * Groups feature, so both Settings > Components and the "add a block"
 * picker an editor sees show organized sections instead of one flat list.
 *
 * Grouping mirrors the implicit structure already in
 * storyblok/schema-reference.md (top-level blocks vs. their nested items):
 *   - Sections     — blocks an editor drops directly into a page body
 *   - Nested items — sub-blocks that only ever live inside a parent
 *   - Navigation   — header/footer nav building blocks
 *   - Global/Site  — header, footer, config, seo
 * Root content types (page, resource, campaign_page) are deliberately left
 * ungrouped — they're not part of the nestable-block picker this feature
 * organizes, they're created as their own stories via a separate UI flow.
 *
 * Idempotent: re-running reuses existing groups by name (doesn't duplicate)
 * and just re-applies the same component_group_uuid assignments.
 *
 * Usage: node --env-file=.env storyblok/organize-component-groups.js [--space <id>]
 */

const DEFAULT_SPACE_ID = '293131252124026'; // Primer Block Space
const token = process.env.STORYBLOK_MANAGEMENT_TOKEN;

function getArg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

const spaceId = getArg('--space', DEFAULT_SPACE_ID);

if (!token) {
  console.error('STORYBLOK_MANAGEMENT_TOKEN not set — run via `node --env-file=.env storyblok/organize-component-groups.js`');
  process.exit(1);
}

const GROUPS = {
  Sections: [
    'card_grid', 'case_study_layout', 'contact_form', 'cta_banner', 'faq',
    'feature_grid', 'hero', 'logo_bar', 'pricing_table', 'process_steps',
    'rich_text', 'stats_bar', 'tabs', 'team', 'testimonials', 'two_column', 'video',
  ],
  'Nested items': [
    'button', 'card_item', 'faq_item', 'feature_item', 'key_takeaway_item',
    'logo_item', 'pricing_feature', 'pricing_plan', 'process_step',
    'sidebar_cta', 'stat_item', 'tab_item', 'table_of_contents',
    'team_member', 'testimonial_item',
  ],
  Navigation: ['footer_column', 'nav_group', 'nav_item', 'nav_link', 'social_link'],
  'Global / Site': ['config', 'footer', 'header', 'seo'],
};

async function api(path, options = {}) {
  const res = await fetch(`https://mapi.storyblok.com/v1/spaces/${spaceId}${path}`, {
    ...options,
    headers: { Authorization: token, 'Content-Type': 'application/json', ...options.headers },
  });
  if (!res.ok) throw new Error(`Storyblok API ${res.status} on ${path}: ${await res.text()}`);
  return res.json();
}

async function ensureGroup(name, existingGroups) {
  const existing = existingGroups.find((g) => g.name === name);
  if (existing) return existing.uuid;
  const { component_group: created } = await api('/component_groups', {
    method: 'POST',
    body: JSON.stringify({ component_group: { name } }),
  });
  console.log(`  created group "${name}"`);
  return created.uuid;
}

async function main() {
  const { component_groups: existingGroups } = await api('/component_groups');
  const { components } = await api('/components');
  const byName = Object.fromEntries(components.map((c) => [c.name, c]));

  console.log('Ensuring groups exist...');
  const groupUuidByLabel = {};
  for (const label of Object.keys(GROUPS)) {
    groupUuidByLabel[label] = await ensureGroup(label, existingGroups);
  }

  console.log('Assigning components to groups...');
  let updated = 0;
  let missing = [];
  for (const [label, names] of Object.entries(GROUPS)) {
    const groupUuid = groupUuidByLabel[label];
    for (const name of names) {
      const component = byName[name];
      if (!component) {
        missing.push(name);
        continue;
      }
      if (component.component_group_uuid === groupUuid) continue; // already correct
      await api(`/components/${component.id}`, {
        method: 'PUT',
        body: JSON.stringify({ component: { component_group_uuid: groupUuid } }),
      });
      updated++;
    }
    console.log(`  ✓ ${label} (${names.length} component${names.length === 1 ? '' : 's'})`);
  }

  if (missing.length) {
    console.warn(`\nNot found in this space, skipped: ${missing.join(', ')}`);
  }
  console.log(`\nDone. ${updated} component(s) newly assigned.`);
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
