#!/usr/bin/env node
/**
 * Sets a `default_value` on the copy fields (text/textarea/richtext) of
 * every component schema, so a new block instance in the Storyblok editor
 * arrives with placeholder copy already filled in instead of blank fields —
 * useful for demos and for content editors who'd otherwise stare at an
 * empty form. Deliberately skips URL/ID/price/email/phone fields (cta_url,
 * hubspot_portal_id, price_monthly, contact_email, etc.) — a fake default
 * there would silently ship a broken link or fake credential if an editor
 * doesn't notice and overwrite it, unlike a headline/body default which is
 * obviously placeholder text no one would mistake for real content.
 *
 * Idempotent: re-running just overwrites the same default_value again, safe
 * to run repeatedly or after schema changes.
 *
 * Usage: node --env-file=.env storyblok/seed-placeholder-copy.js [--space <id>]
 */

const DEFAULT_SPACE_ID = '293131252124026'; // Primer Block Space
const token = process.env.STORYBLOK_MANAGEMENT_TOKEN;

function getArg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

const spaceId = getArg('--space', DEFAULT_SPACE_ID);

if (!token) {
  console.error('STORYBLOK_MANAGEMENT_TOKEN not set — run via `node --env-file=.env storyblok/seed-placeholder-copy.js`');
  process.exit(1);
}

const LOREM_SHORT = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.';
const LOREM_LONG = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
const richtext = (text) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });

// component name -> { field name -> default_value }. Only copy fields;
// URLs/ids/prices/emails/phones are deliberately omitted (see file header).
const DEFAULTS = {
  button: { text: 'Learn more' },
  card_grid: { eyebrow: 'Category', headline: 'Section headline', subheadline: LOREM_SHORT },
  card_item: { eyebrow: 'Category', title: 'Card title', description: LOREM_LONG, cta_label: 'Learn more' },
  case_study_layout: { content: richtext(LOREM_LONG) },
  contact_form: { eyebrow: 'Get in touch', headline: 'Contact us', subheadline: LOREM_SHORT, submit_label: 'Send message', success_message: "Thanks — we'll be in touch soon.", contact_address: '123 Lorem Street, Ipsum City' },
  cta_banner: { headline: 'Lorem ipsum headline', subheadline: LOREM_SHORT },
  faq: { eyebrow: 'Questions', headline: 'Frequently asked questions', subheadline: LOREM_SHORT },
  faq_item: { question: 'Lorem ipsum dolor sit amet?', answer: richtext(LOREM_SHORT) },
  feature_grid: { eyebrow: 'Features', headline: 'Lorem ipsum headline', subheadline: LOREM_SHORT },
  feature_item: { title: 'Feature title', description: LOREM_SHORT },
  footer: { tagline: LOREM_SHORT, newsletter_heading: 'Stay in the loop', copyright: '© 2026 Company Name' },
  footer_column: { heading: 'Column heading' },
  header: { announcement_text: 'Lorem ipsum announcement text', announcement_link_label: 'Learn more', login_label: 'Log In' },
  hero: { headline: 'Lorem ipsum dolor sit amet consectetur', subheadline: LOREM_LONG },
  key_takeaway_item: { text: 'Lorem ipsum dolor sit amet.' },
  logo_bar: { eyebrow: 'Trusted by' },
  logo_item: { alt: 'Company logo' },
  nav_group: { heading: 'Section' },
  nav_item: { label: 'Link' },
  nav_link: { label: 'Link' },
  pricing_feature: { text: 'Feature included' },
  pricing_plan: { name: 'Plan name', description: LOREM_SHORT, price_suffix: '/mo', cta_label: 'Get started' },
  pricing_table: { eyebrow: 'Pricing', headline: 'Simple, transparent pricing', subheadline: LOREM_SHORT, toggle_label_monthly: 'Monthly', toggle_label_annual: 'Annual' },
  process_step: { title: 'Step title', body: LOREM_SHORT },
  process_steps: { eyebrow: 'Process', headline: 'Lorem ipsum headline', subheadline: LOREM_SHORT },
  rich_text: { content: richtext(LOREM_LONG) },
  sidebar_cta: { headline: 'Lorem ipsum headline', body: LOREM_SHORT, cta_label: 'Learn more' },
  stat_item: { number: '100+', label: 'Lorem ipsum label', description: 'Optional supporting line' },
  stats_bar: { eyebrow: 'By the numbers' },
  tab_item: { label: 'Tab label', title: 'Panel title', body: LOREM_SHORT },
  table_of_contents: { heading: 'On this page' },
  tabs: { eyebrow: 'Tabs', headline: 'Lorem ipsum headline', subheadline: LOREM_SHORT },
  team: { eyebrow: 'Team', headline: 'Meet the team', subheadline: LOREM_SHORT },
  team_member: { name: 'Jane Doe', title: 'Job Title', bio: LOREM_SHORT },
  testimonial_item: { quote: LOREM_SHORT, author: 'Jane Doe', role: 'Job Title, Company' },
  testimonials: { eyebrow: 'Customers', headline: 'What our customers say' },
  two_column: { eyebrow: 'Lorem ipsum', headline: 'Lorem ipsum headline', body: LOREM_LONG, cta_label: 'Learn more' },
  video: { eyebrow: 'Video', headline: 'Lorem ipsum headline', subheadline: LOREM_SHORT, caption: 'Lorem ipsum caption text.' },
};

async function main() {
  const listRes = await fetch(`https://mapi.storyblok.com/v1/spaces/${spaceId}/components`, {
    headers: { Authorization: token },
  });
  if (!listRes.ok) throw new Error(`Storyblok API ${listRes.status} listing components: ${await listRes.text()}`);
  const { components } = await listRes.json();

  let updated = 0;
  let skipped = 0;

  for (const component of components) {
    const fieldDefaults = DEFAULTS[component.name];
    if (!fieldDefaults) continue;

    let changed = false;
    for (const [fieldName, value] of Object.entries(fieldDefaults)) {
      const field = component.schema[fieldName];
      if (!field || !['text', 'textarea', 'richtext'].includes(field.type)) continue;
      field.default_value = value;
      changed = true;
    }

    if (!changed) {
      skipped++;
      continue;
    }

    const res = await fetch(`https://mapi.storyblok.com/v1/spaces/${spaceId}/components/${component.id}`, {
      method: 'PUT',
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ component: { schema: component.schema } }),
    });
    if (!res.ok) {
      console.error(`  ✗ ${component.name}: ${res.status} ${await res.text()}`);
      continue;
    }
    console.log(`  ✓ ${component.name} (${Object.keys(fieldDefaults).length} field${Object.keys(fieldDefaults).length === 1 ? '' : 's'})`);
    updated++;
  }

  console.log(`\nDone. ${updated} component(s) updated, ${skipped} had no matching fields.`);
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
