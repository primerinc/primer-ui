/**
 * Turns the copy master document's paragraphs into
 *   pages[] -> { seoTitle?, sections[] -> { fields, items[], notes[] } }
 *
 * The doc's conventions (Primer's copy master document; see docs/copy-doc-template.md):
 * - Heading 1 is a page (a Google Docs tab), Heading 2 is a section.
 * - A field is a label line, "Headline (max 40 characters):", with the copy on
 *   the next line(s) or after the colon. Only known labels count (LABELS), so
 *   copy that happens to end in a colon is never mistaken for a field.
 * - A repeating item starts with a plain line straight above its first label
 *   ("Benefit 1", "FAQ Item 3", "Row 2", "US Office"), or comes from a
 *   numbered label ("Question 4:", "Feature 2 Title:").
 * - "OR" between two drafts of a field: the first is used, the rest are kept
 *   as alternatives for the report.
 * - Lines that run on with no blank line between them are one value (a Body
 *   wrapped over two paragraphs); a later paragraph after a blank line is a
 *   note, not copy, except where a field holds several paragraphs (answers,
 *   quotes).
 */

const LABELS = [
  'Eyebrow', 'Headline', 'Sub-headline / Body', 'Sub-headline / Dek', 'Sub-headline', 'Body', 'Title',
  'Button Label', 'Button', 'Link Label', 'Description',
  'Question', 'Answer', 'Quotes', 'Quote', 'Name', 'Position/Company', 'Position',
  'Attributed Name', 'Attributed Title/Company',
  'Feature Label', 'Our Description', 'Forte Description', 'Competitor Description',
  'Office Name', 'Address', 'Phone', 'Email',
  'Partner name', 'Intro Copy', 'Job Title', 'Support Body', 'Infographic',
  'Insert link to video', 'Insert video link', 'Insert link to graphic image',
  'Provide link to platform image', 'Provide link to infographic',
  'Full Name Field Label', 'Email Field Label', 'Message Field Label', 'Message Field Placeholder',
  'Submit Button', 'Full Name Label', 'Email Label', 'Message Label', 'Submit Button Label',
];

// Fields whose blank-line-separated paragraphs all belong to the copy
const MULTI_PARAGRAPH = new Set(['Answer', 'Quotes', 'Quote', 'Body', 'Address', 'Intro Copy', 'Support Body']);

const PLACEHOLDER = /^(tbc\b.*|tbd\b.*|n\/a|-+|…|\.\.\.)$/i;

// Instructions to Primer, never copy: kept as section notes for the report
const INSTRUCTION = /data[- ]driven|^insert link|^provide link|^pull content from|universal element|^compile in|^forte to provide|^logos to provide/i;

const norm = (s) => s.replace(/\s+/g, ' ').trim();

/** "Headline (max 40 characters):" -> { label, limit, inline } or null */
function matchLabel(line) {
  // Some labels have a colon before the limit too: "Eyebrow: (max 40 characters):"
  line = line.replace(/^([^:]{1,60}?)\s*:\s*(\((?:max|Max)[^)]*\))\s*:/, '$1 $2:');
  const m = line.match(/^([^:]{1,60}?)\s*:\s*([\s\S]*)$/) || line.match(/^(.{1,60}?)\s*$/);
  if (!m) return null;
  let raw = m[1].trim();
  const inline = (m[2] ?? '').trim();
  const hadColon = /:/.test(line);

  let limit = null;
  raw = raw.replace(/\s*\((?:max|Max)\s*(\d+)\s*(characters?|words?)\)\s*/g, (_, n, unit) => {
    limit = { max: Number(n), unit: unit.startsWith('word') ? 'words' : 'characters' };
    return ' ';
  }).replace(/\s*\(no character limit\)\s*/i, ' ').replace(/\s+/g, ' ').trim();

  // Numbered labels: "Question 2", "FAQ Answer 3", "Feature 1 Title", "Topic 4 Body",
  // "Column 2, Bullet 3", "Item 7"
  let num = null, col = null, label = raw;
  let n;
  if ((n = raw.match(/^(?:FAQ )?(Question|Answer) (\d+)$/i))) { label = cap(n[1]); num = +n[2]; }
  else if ((n = raw.match(/^(?:Feature|Topic|Value|Benefit) (\d+) (Title|Body|Description)$/i))) { label = cap(n[2]); num = +n[1]; }
  else if ((n = raw.match(/^Column (\d+), Bullet (\d+)$/i))) { label = 'Bullet'; col = +n[1]; num = +n[2]; }
  else if ((n = raw.match(/^Item (\d+)$/i))) { label = 'ListItem'; num = +n[1]; }
  else {
    const known = LABELS.find((l) => l.toLowerCase() === raw.toLowerCase());
    if (!known) return null;
    label = known;
  }
  // A bare known word with no colon ("Eyebrow") only counts when it is a label
  // on its own line; "Body" mid-copy never appears alone, so this is safe.
  if (!hadColon && inline) return null;
  return { label, limit, inline, num, col };
}

const cap = (s) => s[0].toUpperCase() + s.slice(1).toLowerCase();

function newField(label, limit) {
  return { label, limit, paragraphs: [], alternatives: [], notes: [], _gap: false, _alt: false };
}

/**
 * @param paragraphs [{style, text}] from readDocxParagraphs
 * @param promote    map of page title -> section titles that may appear as plain
 *                   text instead of Heading 2 (they are promoted, with a warning)
 */
export function parseCopyDoc(paragraphs, promote = {}) {
  // Flatten soft line breaks into their own lines; blank paragraphs become gaps
  const lines = [];
  for (const p of paragraphs) {
    if (/^Heading1$|^Title$/.test(p.style) || /^Heading2$/.test(p.style)) {
      lines.push({ kind: p.style === 'Heading2' ? 'h2' : p.style === 'Title' ? 'title' : 'h1', text: norm(p.text) });
      continue;
    }
    const parts = p.text.split('\n');
    if (!p.text.trim()) { lines.push({ kind: 'gap' }); continue; }
    parts.forEach((t, i) => {
      if (i > 0 && !t.trim()) return;
      lines.push({ kind: 'text', text: norm(t), soft: i > 0 });
    });
  }

  const pages = [];
  let page = null, section = null, target = null, field = null;

  const startSection = (title, promoted = false) => {
    section = { title, fields: {}, items: [], notes: [], warnings: [] };
    if (promoted) section.warnings.push(`"${title}" is plain text in the doc, not a Heading 2; treated as its own section`);
    page.sections.push(section);
    target = section; field = null;
  };

  const itemFor = (num, marker) => {
    let item = section.items.find((it) => it.num === num && num != null);
    if (!item) {
      item = { num, marker: marker ?? null, fields: {} };
      section.items.push(item);
    }
    return item;
  };

  const isLabelAt = (i) => {
    for (let j = i; j < lines.length; j++) {
      if (lines[j].kind === 'gap') return false;
      if (lines[j].kind !== 'text') return false;
      return !!matchLabel(lines[j].text);
    }
    return false;
  };

  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (ln.kind === 'h1') {
      page = { title: ln.text, sections: [] };
      pages.push(page);
      section = null; target = null; field = null;
      continue;
    }
    if (!page) continue;
    if (ln.kind === 'title') { section = null; target = null; field = null; continue; }
    if (ln.kind === 'h2') {
      if (ln.text) startSection(ln.text);
      continue;
    }
    if (ln.kind === 'gap') { if (field) field._gap = true; continue; }
    // "SEO title tag (for the developer): ..." under a page's heading goes
    // into the page's seo block, not into a section
    const seoTitle = ln.text.match(/^SEO title tag[^:]*:\s*(.+)$/i);
    if (seoTitle) { page.seoTitle = seoTitle[1].trim(); continue; }
    const metaDesc = ln.text.match(/^Meta description[^:]*:\s*(.+)$/i);
    if (metaDesc) { page.metaDescription = metaDesc[1].trim(); continue; }
    if (!section) startSection('(page intro)');

    const text = ln.text;
    const lab = matchLabel(text);

    if (lab) {
      let holder = target;
      if (lab.label === 'Bullet') {
        section.list ??= [];
        field = newField(`Column ${lab.col}, Bullet ${lab.num}`, lab.limit);
        field.col = lab.col; field.num = lab.num;
        section.list.push(field);
      } else if (lab.label === 'ListItem') {
        section.list ??= [];
        field = newField(`Item ${lab.num}`, lab.limit);
        field.num = lab.num;
        section.list.push(field);
      } else {
        if (lab.num != null) holder = target = itemFor(lab.num);
        const key = lab.label;
        // A repeated label on the same holder starts a new item (testimonials:
        // Quote, Name, Position, Quote, Name, ...)
        if (holder.fields[key] && holder.fields[key].paragraphs.length && lab.num == null) {
          holder = target = itemFor(null);
          if (holder === section) holder = target = itemFor(null);
        }
        field = holder.fields[key] = newField(key, lab.limit);
      }
      if (lab.inline) field.paragraphs.push(lab.inline);
      continue;
    }

    if (/^or$/i.test(text) && field) { field._alt = true; field._gap = false; continue; }

    // A mapped section title written as plain text (not Heading 2) opens that
    // section, when copy or a "Universal Element" note follows it
    const promoteList = promote[page.title] || [];
    const asSection = !ln.soft && promoteList.find((t) => norm(t).toLowerCase() === text.toLowerCase());
    if (asSection && section.title.toLowerCase() !== asSection.toLowerCase()) {
      startSection(asSection, true);
      continue;
    }

    // A plain line straight above a label opens an item
    if (!ln.soft && isLabelAt(i + 1)) {
      if (!/^(faq items?|bulleted list)$/i.test(text) && !/^list\b/i.test(text)) {
        const item = { num: null, marker: text, fields: {} };
        section.items.push(item);
        target = item; field = null;
        continue;
      }
      continue;
    }

    // Copy
    if (!field || INSTRUCTION.test(text)) { section.notes.push(text); continue; }
    if (field._alt) { field.alternatives.push(text); field._alt = false; field._gap = false; continue; }
    if (!field.paragraphs.length) { field.paragraphs.push(text); field._gap = false; continue; }
    if (!field._gap) {
      // Runs on from the line above: the same paragraph wrapped, or another
      // quote under "Quotes:" (each quote starts with a quotation mark)
      if (/^["“”]/.test(text) && /^Quote/.test(field.label)) field.paragraphs.push(text);
      else if (field.label === 'Address') field.paragraphs[field.paragraphs.length - 1] += `\n${text}`; // one address line per paragraph
      else field.paragraphs[field.paragraphs.length - 1] += ` ${text}`;
      continue;
    }
    if (MULTI_PARAGRAPH.has(field.label)) field.paragraphs.push(text);
    else field.notes.push(text);
    field._gap = false;
  }

  // Tidy: values, placeholders, and items left with nothing in them
  for (const pg of pages) {
    for (const s of pg.sections) {
      const fix = (f) => {
        delete f._gap; delete f._alt;
        f.value = f.paragraphs.join('\n\n');
        f.placeholder = !f.value || f.paragraphs.every((p) => PLACEHOLDER.test(p));
      };
      Object.values(s.fields).forEach(fix);
      s.items = s.items.filter((it) => Object.keys(it.fields).length);
      s.items.forEach((it) => Object.values(it.fields).forEach(fix));
      (s.list || []).forEach(fix);
      s.universal = s.notes.some((n) => /universal element/i.test(n));
      s.pullFrom = s.notes.find((n) => /^pull content from/i.test(n)) || null;
    }
  }
  return pages;
}
