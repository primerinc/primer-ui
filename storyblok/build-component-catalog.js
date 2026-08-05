#!/usr/bin/env node
/**
 * Builds the per-client "component catalog" page documented in
 * storyblok/schema-reference.md ("Component catalog pattern (per-client)"):
 * an unpublished campaign_page story with every body-eligible block (plus a
 * few variant comparisons worth a client decision) stacked on one page, each
 * labeled with a rich_text heading so it reads as a scroll of "here's what
 * X looks like" rather than raw content.
 *
 * Deliberately leaves every image/logo Asset field empty rather than faking
 * external placeholder URLs — LogoBar/CardGrid/etc. append a Storyblok CDN
 * transform path (`/m/WxHfilters:...`) onto whatever's in the field, which
 * only resolves against real Storyblok-hosted assets. An external URL there
 * 404s; an empty field just renders no image, which every component already
 * handles gracefully. Upload real assets and fill these in by hand afterward
 * if the catalog needs to look fully dressed for a specific walkthrough.
 *
 * Usage: node --env-file=.env storyblok/build-component-catalog.js [--space <id>]
 */

const DEFAULT_SPACE_ID = '293131252124026'; // Primer Block Space
const token = process.env.STORYBLOK_MANAGEMENT_TOKEN;

function getArg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

const spaceId = getArg('--space', DEFAULT_SPACE_ID);

if (!token) {
  console.error('STORYBLOK_MANAGEMENT_TOKEN not set — run via `node --env-file=.env storyblok/build-component-catalog.js`');
  process.exit(1);
}

let uidCounter = 0;
const uid = () => `catalog-${Date.now()}-${uidCounter++}`;

const doc = (text) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

const heading = (text) => ({
  type: 'doc',
  content: [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] }],
});

/** A rich_text block used purely as a section label between catalog entries. */
function label(text) {
  return { _uid: uid(), component: 'rich_text', content: heading(text), background: 'dark' };
}

function button(text, variant = 'primary') {
  return { _uid: uid(), component: 'button', text, link: { url: '#', linktype: 'url' }, variant };
}

const entries = [];
const add = (labelText, block) => entries.push(label(labelText), block);

add('Hero — Centered', {
  _uid: uid(),
  component: 'hero',
  headline: 'Modernizing operations for the physical security industry',
  subheadline: 'Lock 8 Partners pairs enterprise-grade access control with a service model built for how facilities teams actually work.',
  buttons: [button('Get started'), button('Talk to sales', 'secondary')],
  layout: 'centered',
  background: 'secondary',
});

add('Hero — Left-Aligned', {
  _uid: uid(),
  component: 'hero',
  headline: 'Access control that scales with your portfolio',
  subheadline: 'From a single site to a national footprint, one platform handles it all.',
  buttons: [button('Request a demo')],
  layout: 'left-aligned',
  background: 'primary',
});

add('Hero — Two-Column', {
  _uid: uid(),
  component: 'hero',
  headline: 'One platform for every door you manage',
  subheadline: 'Pair centralized access control with a service model built for how facilities teams actually work.',
  buttons: [button('Get started'), button('Talk to sales', 'secondary')],
  layout: 'two-column',
  background: 'secondary',
});

add('Feature Grid — 3 Columns, Centered', {
  _uid: uid(),
  component: 'feature_grid',
  eyebrow: 'Platform',
  headline: 'Everything a facilities team needs in one place',
  subheadline: 'Purpose-built for multi-site operators.',
  columns: '3',
  text_align: 'center',
  background: 'primary',
  features: [
    { _uid: uid(), component: 'feature_item', title: 'Centralized access', description: 'Manage every door, every site, from one dashboard.' },
    { _uid: uid(), component: 'feature_item', title: 'Real-time alerts', description: 'Know the moment something needs attention.' },
    { _uid: uid(), component: 'feature_item', title: 'Audit-ready logs', description: 'Every event, timestamped and exportable.' },
  ],
});

add('Testimonials — Grid', {
  _uid: uid(),
  component: 'testimonials',
  eyebrow: 'Customers',
  headline: 'Trusted by facilities teams nationwide',
  layout: 'grid',
  background: 'primary',
  items: [
    { _uid: uid(), component: 'testimonial_item', quote: 'Rollout across 40 sites took weeks, not months.', author: 'Dana Ruiz', role: 'VP Facilities, Meridian Group' },
    { _uid: uid(), component: 'testimonial_item', quote: 'Support actually picks up the phone.', author: 'Tom Okafor', role: 'Director of Security, Harborview' },
  ],
});

add('Testimonials — Carousel', {
  _uid: uid(),
  component: 'testimonials',
  eyebrow: 'Customers',
  headline: 'What our partners say',
  layout: 'carousel',
  background: 'secondary',
  items: [
    { _uid: uid(), component: 'testimonial_item', quote: 'The audit trail alone paid for the switch.', author: 'Priya Shah', role: 'COO, Lockstep Facilities' },
    { _uid: uid(), component: 'testimonial_item', quote: 'One dashboard for every regional site — finally.', author: 'Marcus Webb', role: 'Ops Lead, Bellcrest' },
  ],
});

add('CTA Banner — Accent, Left-Aligned', {
  _uid: uid(),
  component: 'cta_banner',
  headline: 'Ready to see it on your own sites?',
  subheadline: 'Book a walkthrough with our team.',
  buttons: [button('Book a demo')],
  background_style: 'accent',
  text_align: 'left',
});

add('Logo Bar — Grid', {
  _uid: uid(),
  component: 'logo_bar',
  eyebrow: 'Trusted by',
  display: 'grid',
  logos: [
    { _uid: uid(), component: 'logo_item', alt: 'Meridian Group' },
    { _uid: uid(), component: 'logo_item', alt: 'Harborview' },
    { _uid: uid(), component: 'logo_item', alt: 'Bellcrest' },
  ],
});

add('Two Column — Image Right', {
  _uid: uid(),
  component: 'two_column',
  eyebrow: 'How it works',
  headline: 'Provision a new site in under an hour',
  body: 'Ship hardware, scan the QR code, and the site is live on the same access policy as the rest of your portfolio.',
  cta_label: 'See the setup flow',
  cta_url: '#',
  image_side: 'right',
  background: 'primary',
});

add('Two Column — Image Left', {
  _uid: uid(),
  component: 'two_column',
  eyebrow: 'Reporting',
  headline: 'Every event, exportable on demand',
  body: 'Generate an audit-ready report for any site, any date range, in a couple of clicks.',
  cta_label: 'View sample report',
  cta_url: '#',
  image_side: 'left',
  background: 'secondary',
});

add('Rich Text', {
  _uid: uid(),
  component: 'rich_text',
  content: doc('This is a rich_text block — used for long-form copy that needs real formatting: bold, links, lists. It also doubles as the label block used throughout this catalog page.'),
  background: 'primary',
});

add('Stats Bar', {
  _uid: uid(),
  component: 'stats_bar',
  eyebrow: 'By the numbers',
  background: 'secondary',
  stats: [
    { _uid: uid(), component: 'stat_item', number: '400+', label: 'Sites managed' },
    { _uid: uid(), component: 'stat_item', number: '99.9%', label: 'Platform uptime' },
    { _uid: uid(), component: 'stat_item', number: '<1hr', label: 'Average provisioning time' },
  ],
});

add('Card Grid — 2 Columns', {
  _uid: uid(),
  component: 'card_grid',
  eyebrow: 'Resources',
  headline: 'Case studies',
  columns: '2',
  background: 'primary',
  cards: [
    { _uid: uid(), component: 'card_item', eyebrow: 'Case study', title: 'Meridian Group scales to 40 sites', description: 'How a national operator rolled out access control in six weeks.', cta_label: 'Read more', cta_url: '#' },
    { _uid: uid(), component: 'card_item', eyebrow: 'Case study', title: 'Harborview cuts response time in half', description: 'Real-time alerts changed how their security team operates.', cta_label: 'Read more', cta_url: '#' },
  ],
});

add('Card Grid — 3 Columns', {
  _uid: uid(),
  component: 'card_grid',
  eyebrow: 'Resources',
  headline: 'Latest updates',
  columns: '3',
  background: 'secondary',
  cards: [
    { _uid: uid(), component: 'card_item', title: 'Platform update: Q3', description: 'New audit export formats and faster alerting.', cta_label: 'Read more', cta_url: '#' },
    { _uid: uid(), component: 'card_item', title: 'Webinar: Multi-site rollouts', description: 'Join our team for a live walkthrough.', cta_label: 'Register', cta_url: '#' },
    { _uid: uid(), component: 'card_item', title: 'Guide: Choosing hardware', description: 'What to check before you order.', cta_label: 'Read more', cta_url: '#' },
  ],
});

add('Team — Card Layout', {
  _uid: uid(),
  component: 'team',
  eyebrow: 'Leadership',
  headline: 'Who you\'ll work with',
  columns: '3',
  layout: 'card',
  background: 'primary',
  members: [
    { _uid: uid(), component: 'team_member', name: 'Alex Chen', title: 'VP Customer Success', bio: 'Leads onboarding and rollout for every new site.' },
    { _uid: uid(), component: 'team_member', name: 'Jordan Reyes', title: 'Director of Support', bio: '24/7 support, staffed in-house, not outsourced.' },
  ],
});

add('Team — Minimal Layout', {
  _uid: uid(),
  component: 'team',
  eyebrow: 'Leadership',
  headline: 'Meet the team',
  columns: '4',
  layout: 'minimal',
  background: 'secondary',
  members: [
    { _uid: uid(), component: 'team_member', name: 'Sam Patel', title: 'Head of Engineering' },
    { _uid: uid(), component: 'team_member', name: 'Riley Nguyen', title: 'Head of Partnerships' },
  ],
});

add('Tabs — Horizontal', {
  _uid: uid(),
  component: 'tabs',
  eyebrow: 'Platform',
  headline: 'Built for every role',
  layout: 'horizontal',
  background: 'primary',
  items: [
    { _uid: uid(), component: 'tab_item', label: 'Facilities', title: 'For facilities teams', body: 'Manage every door from one dashboard.' },
    { _uid: uid(), component: 'tab_item', label: 'Security', title: 'For security teams', body: 'Real-time alerts and full audit trails.' },
  ],
});

add('Tabs — Vertical', {
  _uid: uid(),
  component: 'tabs',
  eyebrow: 'Platform',
  headline: 'By use case',
  layout: 'vertical',
  background: 'secondary',
  items: [
    { _uid: uid(), component: 'tab_item', label: 'New construction', title: 'New construction', body: 'Provision access before the doors are even hung.' },
    { _uid: uid(), component: 'tab_item', label: 'Retrofit', title: 'Retrofit', body: 'Swap existing hardware without a service gap.' },
  ],
});

add('FAQ', {
  _uid: uid(),
  component: 'faq',
  eyebrow: 'Questions',
  headline: 'Frequently asked questions',
  background: 'primary',
  items: [
    { _uid: uid(), component: 'faq_item', question: 'How long does rollout take?', answer: doc('Most single sites go live within a day; multi-site portfolios typically roll out over a few weeks.') },
    { _uid: uid(), component: 'faq_item', question: 'Do you support existing hardware?', answer: doc('In most cases, yes — reach out and we\'ll confirm compatibility for your specific hardware.') },
  ],
});

add('Pricing Table', {
  _uid: uid(),
  component: 'pricing_table',
  eyebrow: 'Pricing',
  headline: 'Simple, per-site pricing',
  background: 'secondary',
  plans: [
    { _uid: uid(), component: 'pricing_plan', name: 'Starter', description: 'For single-site operators', price_monthly: '$49', price_suffix: '/mo', cta_label: 'Get started' },
    { _uid: uid(), component: 'pricing_plan', name: 'Enterprise', description: 'For multi-site portfolios', price_monthly: '$39', price_suffix: '/mo', highlighted: true, badge: 'Most popular', cta_label: 'Talk to sales' },
  ],
});

add('Contact Form — Centered', {
  _uid: uid(),
  component: 'contact_form',
  eyebrow: 'Get in touch',
  headline: 'Talk to our team',
  layout: 'centered',
  background: 'primary',
});

add('Video — YouTube', {
  _uid: uid(),
  component: 'video',
  eyebrow: 'See it in action',
  headline: 'A 2-minute platform overview',
  video_type: 'youtube',
  youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  caption: 'Placeholder video — swap for a real product walkthrough.',
  background: 'secondary',
});

add('Process Steps — Horizontal', {
  _uid: uid(),
  component: 'process_steps',
  eyebrow: 'Onboarding',
  headline: 'How rollout works',
  layout: 'horizontal',
  background: 'primary',
  steps: [
    { _uid: uid(), component: 'process_step', title: 'Kickoff call', body: 'We map your sites and hardware.' },
    { _uid: uid(), component: 'process_step', title: 'Ship & install', body: 'Hardware arrives pre-configured.' },
    { _uid: uid(), component: 'process_step', title: 'Go live', body: 'Your team is live on day one.' },
  ],
});

add('Case Study Layout', {
  _uid: uid(),
  component: 'case_study_layout',
  background: 'primary',
  key_takeaways: [
    { _uid: uid(), component: 'key_takeaway_item', text: 'Rolled out across 40 sites in six weeks.' },
    { _uid: uid(), component: 'key_takeaway_item', text: 'Cut incident response time in half.' },
  ],
  content: {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'The challenge' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Meridian Group needed one platform across a fast-growing, multi-region portfolio.' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'The result' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'A single dashboard, consistent policy enforcement, and an audit trail that satisfies every regional compliance requirement.' }] },
    ],
  },
  sidebar: [
    { _uid: uid(), component: 'table_of_contents' },
    { _uid: uid(), component: 'sidebar_cta', headline: 'Want results like this?', cta_label: 'Talk to sales', cta_url: '#' },
  ],
});

async function createCatalogStory() {
  // Deliberately no `path` field: Storyblok's `path` ("Real path") overrides
  // the URL the Visual Editor loads for preview, it does not create folder
  // nesting. Setting it to a route this Astro site doesn't actually have
  // (e.g. a fake `_internal/...` prefix) makes the preview 404 even though
  // the real route (full_slug, `component-catalog`) works fine. Leave it
  // unset so the Visual Editor previews at the story's actual full_slug.
  const body = {
    story: {
      name: 'Internal — Component Catalog',
      slug: 'component-catalog',
      parent_id: 0,
      is_startpage: false,
      content: {
        component: 'campaign_page',
        title: 'Internal — Component Catalog (do not publish)',
        internal_campaign_name: 'Component catalog reference — every block, labeled',
        hide_nav: true,
        hide_footer: true,
        seo: [],
        body: entries,
      },
    },
    publish: 0,
  };

  const res = await fetch(`https://mapi.storyblok.com/v1/spaces/${spaceId}/stories`, {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Storyblok API ${res.status} creating catalog story: ${await res.text()}`);
  }
  return res.json();
}

async function main() {
  console.log(`Creating component catalog story in space ${spaceId} (draft, unpublished)...`);
  const { story } = await createCatalogStory();
  console.log(`Created story ${story.id} at full_slug "${story.full_slug}".`);
  console.log('It is a draft — open it in the Storyblok Visual Editor to view/preview, it will not appear on the live site.');
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
