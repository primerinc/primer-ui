/**
 * Where each section of the client's copy master document goes in Storyblok.
 * Edit PAGES, PAGE_LINKS, SKIP_SECTIONS and SKIP_PAGES for each client. FIELDS
 * describes primer-ui's own blocks, so it rarely changes (add a block here
 * when a new component gets copy from the doc).
 *
 * PAGES: doc page title (its Heading 1, usually a Google Docs tab) -> { story, sections }
 *   story     the Storyblok full slug
 *   note      optional; shown in the report
 *   sections  doc section title (Heading 2) -> [component, nth, options?]: the
 *             nth block of that component in the story's body (0-based).
 *             Options:
 *             universal: '<Universal Elements section>' when the doc says
 *               "Universal Element"; its copy comes from that tab
 *             from: ['<doc page>', '<doc section>'] to use another page's copy
 *               (templates that "pull content from" another page)
 *             items: 'offices' for a Contact page's office list
 *               (Office Name + Address + Phone + Email → title + description)
 *   Section titles match loosely: case, dashes and spacing are ignored, and a
 *   doc title that starts with the mapped one matches ("Partner Success
 *   Stories - need to check" matches "Partner Success Stories").
 *
 * Doc sections with copy and no entry here are listed in the report as
 * UNMAPPED, so a new section in the doc is never dropped silently.
 *
 * The example below is the shape Forte used (2026-10/11). Replace it.
 */

const READY = { universal: 'CTA Banner — Ready to Get Started?' };

// Pages built from the same template can share one section map
const USE_CASE_SECTIONS = {
  'Hero': ['hero', 0],
  'Feature Grid — Key Benefits': ['feature_grid', 0],
  'Use Case': ['two_column', 0],
  'FAQ': ['faq', 0],
  'CTA Banner — Ready to Get Started?': ['cta_banner', 0, READY],
};

export const PAGES = {
  'Home': {
    story: 'home',
    sections: {
      'Hero': ['hero', 0],
      'Social Proof – Logo Bar': ['logo_bar', 0, { universal: 'Social Proof Logo Bar' }],
      'Feature Grid – Client Challenges': ['feature_grid', 0],
      'Value Proposition 1': ['two_column', 0],
      'Value Proposition 2': ['two_column', 1],
      'FAQ': ['faq', 0],
      'CTA Banner — Ready to Get Started?': ['cta_banner', 0, READY],
    },
  },
  'Use Case 1 - Example': { story: 'use-cases/example', sections: USE_CASE_SECTIONS },
  'Contact': {
    story: 'contact',
    sections: {
      'Hero': ['hero', 0],
      'Contact Form': ['contact_form', 0],
      'Locations': ['feature_grid', 0, { items: 'offices' }],
    },
  },
};

/**
 * Phrases in rich text (FAQ answers) that name another page, -> that story's
 * full slug. They become story links. Longest phrase wins.
 */
export const PAGE_LINKS = {
  'Platform page': 'platform',
};

/** Doc sections never imported: [pattern, reason shown in the report] */
export const SKIP_SECTIONS = [
  [/^(header|footer)$/i, 'site-wide header and footer come from the config story'],
  [/testimonial/i, 'testimonials are their own stories (testimonials/ folder), not page copy'],
  [/featured (posts?|success stories)|job listings/i, 'the post list is data-driven'],
];

/** Doc pages (tabs) never imported: title -> reason shown in the report */
export const SKIP_PAGES = {
  'Key': 'instructions for the copywriter',
  'Universal Elements': 'shared copy, imported through the pages that reference it',
};

// ── Field maps for primer-ui's blocks ──────────────────────────────
// doc label -> block field. 'cta_button.text' writes into the first nested
// block; ':richtext' converts paragraphs to Storyblok rich text.
const HEAD = { Eyebrow: 'eyebrow', Headline: 'headline' };
const SUB = { 'Body': 'subheadline', 'Sub-headline': 'subheadline', 'Sub-headline / Body': 'subheadline' };

export const FIELDS = {
  hero: { fields: { ...HEAD, ...SUB } },
  two_column: { fields: { ...HEAD, Body: 'body', 'Link Label': 'cta_button.text', Button: 'cta_button.text' } },
  feature_grid: {
    fields: { ...HEAD, ...SUB },
    items: 'features',
    itemFields: { Title: 'title', Headline: 'title', Body: 'description', Description: 'description' },
  },
  cta_banner: { fields: { Headline: 'headline', Body: 'subheadline', Button: 'buttons.text', 'Button Label': 'buttons.text' } },
  faq: { fields: { ...HEAD, ...SUB }, items: 'items', itemFields: { Question: 'question', Answer: 'answer:richtext' } },
  video: { fields: { ...HEAD, ...SUB } },
  card_grid: { fields: { ...HEAD, ...SUB } },
  logo_bar: { fields: { Eyebrow: 'eyebrow' } },
  contact_form: { fields: { ...HEAD, ...SUB } },
  team: { fields: { ...HEAD, ...SUB } },
  resource_list: { fields: { ...HEAD, ...SUB } },
  versus: {
    fields: { ...HEAD, ...SUB },
    items: 'rows',
    itemFields: {
      'Feature Label': 'feature',
      'Our Description': 'ours_text',
      'Forte Description': 'ours_text',
      'Competitor Description': 'theirs_text',
    },
  },
};
