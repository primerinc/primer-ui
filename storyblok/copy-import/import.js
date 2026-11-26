#!/usr/bin/env node
/**
 * Copy importer: the client's copy master document (.docx) -> Storyblok drafts.
 *
 * Reads the doc (File > Download > Microsoft Word in Google Docs), maps each
 * page and section to its story and block (mapping.js), and compares the doc's
 * copy with what Storyblok holds. A dry run (the default) changes nothing and
 * writes a report; --apply writes the changes to the stories as unpublished
 * drafts.
 *
 * Rules:
 * - A doc field with no copy (blank, "TBC") leaves the Storyblok field as it is.
 * - Where the doc has items (FAQ pairs, benefits, rows), the block gets exactly
 *   those items: extra filler items are dropped and new ones copy the last
 *   item's icon and settings.
 * - "OR" alternatives: the first is used, the rest are listed in the report.
 * - Nothing is published. Pages signed off in the doc should come off the
 *   --pages list once imported, so later edits in Storyblok aren't overwritten.
 *
 * Usage:
 *   node --env-file=.env storyblok/copy-import/import.js [--doc <path>] [--pages "Home,Platform"] [--apply]
 * The doc defaults to the newest .docx in storyblok/copy-import/input/;
 * the report goes to storyblok/copy-import/reports/. Both folders are git-ignored.
 */
import { writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readDocxParagraphs } from './docx.js';
import { parseCopyDoc } from './parse.js';
import { PAGES, FIELDS, SKIP_SECTIONS, SKIP_PAGES, PAGE_LINKS } from './mapping.js';
import { linkPageReferences } from './links.js';
import { backupStory } from '../lib/backup.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SPACE = process.env.STORYBLOK_SPACE_ID;
const TOKEN = process.env.STORYBLOK_MANAGEMENT_TOKEN;
const arg = (flag, fallback) => { const i = process.argv.indexOf(flag); return i !== -1 ? process.argv[i + 1] : fallback; };
const APPLY = process.argv.includes('--apply');
const newestDocx = () => {
  const dir = join(HERE, 'input');
  let files = [];
  try { files = readdirSync(dir).filter((f) => f.endsWith('.docx')); } catch {}
  if (!files.length) { console.error('No .docx in storyblok/copy-import/input/ (download the Google Doc as Word and save it there, or pass --doc <path>)'); process.exit(1); }
  return join(dir, files.sort((a, b) => statSync(join(dir, b)).mtimeMs - statSync(join(dir, a)).mtimeMs)[0]);
};
const DOC = arg('--doc', null) ?? newestDocx();
const ONLY = arg('--pages', null)?.split(',').map((s) => s.trim());

if (!TOKEN || !SPACE) {
  console.error('Set STORYBLOK_MANAGEMENT_TOKEN and STORYBLOK_SPACE_ID in .env (run with node --env-file=.env)');
  process.exit(1);
}

async function api(method, path, body) {
  const res = await fetch(`https://mapi.storyblok.com/v1/spaces/${SPACE}${path}`, {
    method,
    headers: { Authorization: TOKEN, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 429) { await new Promise((r) => setTimeout(r, 1000)); return api(method, path, body); }
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

// ── Matching ──────────────────────────────────────────────────────
const key = (s) => s.toLowerCase().replace(/[–—-]/g, ' ').replace(/[^a-z0-9?&' ]/g, ' ').replace(/\s+/g, ' ').trim();

function findSectionMapping(sections, title) {
  const k = key(title);
  for (const [name, target] of Object.entries(sections)) {
    const n = key(name);
    if (k === n || k.startsWith(`${n} `)) return [name, target];
  }
  return null;
}

const findSection = (page, title) => page?.sections.find((s) => key(s.title) === key(title) || key(s.title).startsWith(`${key(title)} `));

// ── Copy helpers ──────────────────────────────────────────────────
// Filled in at the start of the run: phrase -> { uuid, full_slug }
let pageLinks = {};

const richtext = (paragraphs) => linkPageReferences({
  type: 'doc',
  content: paragraphs.map((p) => ({ type: 'paragraph', content: [{ type: 'text', text: p }] })),
}, pageLinks);

const plain = (v) => {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (v.type === 'doc') return (v.content || []).map((n) => (n.content || []).map((t) => t.text || '').join('')).join('\n\n');
  return JSON.stringify(v);
};

function overLimit(field) {
  if (!field.limit || field.placeholder) return null;
  const v = field.paragraphs[0] || '';
  const size = field.limit.unit === 'words' ? v.split(/\s+/).filter(Boolean).length : v.length;
  return size > field.limit.max ? `${size}/${field.limit.max} ${field.limit.unit}` : null;
}

const fresh = (b) => {
  const c = structuredClone(b);
  const walk = (x) => {
    if (Array.isArray(x)) x.forEach(walk);
    else if (x && typeof x === 'object') { if ('_uid' in x) x._uid = randomUUID(); Object.values(x).forEach(walk); }
  };
  walk(c);
  return c;
};

/** Sets block[path] (a "cta_button.text" path writes into the first nested block) */
function setField(block, path, value, changes, label, docField) {
  const [fieldName, asType] = path.split(':');
  const [top, sub] = fieldName.split('.');
  let current, apply;
  if (sub) {
    const nested = block[top]?.[0];
    if (!nested) { changes.push({ label, field: fieldName, from: '(no button on this block)', to: value, flags: ['not applied: add a button in Storyblok first'] }); return; }
    current = nested[sub]; apply = () => { nested[sub] = value; };
  } else {
    current = block[top];
    const v = asType === 'richtext' ? richtext(docField.paragraphs) : value;
    apply = () => { block[top] = v; };
  }
  if (plain(current).trim() === String(value).trim()) return;
  // Same words, only line breaks differ: keep Storyblok's deliberate breaks (Figma line breaks)
  if (plain(current).replace(/\s+/g, ' ').trim() === String(value).replace(/\s+/g, ' ').trim()) return;
  const flags = [];
  const over = overLimit(docField);
  if (over) flags.push(`over limit: ${over}`);
  if (docField.alternatives.length) flags.push(`${docField.alternatives.length} "OR" alternative${docField.alternatives.length > 1 ? 's' : ''} not used`);
  if (docField.notes.length) flags.push(`note in doc: ${docField.notes.join(' / ')}`);
  changes.push({ label, field: fieldName, from: plain(current), to: value, flags });
  apply();
}

function applyFields(block, holder, map, changes, prefix = '') {
  for (const [label, docField] of Object.entries(holder.fields)) {
    if (docField.placeholder) continue;
    const path = map[label];
    if (!path) {
      if (!/^(Provide link|Insert|Infographic)/.test(label)) changes.push({ label: prefix + label, field: '—', from: '', to: docField.value, flags: ['no matching field on this block'] });
      continue;
    }
    setField(block, path, docField.value, changes, prefix + label, docField);
  }
}

function applySection(block, section, opts, changes) {
  const spec = FIELDS[block.component];
  if (!spec) { changes.push({ label: '—', field: '—', from: '', to: '', flags: [`no field map for ${block.component}`] }); return; }
  applyFields(block, section, spec.fields, changes);

  // Two Column bullets: "Column 1, Bullet 1" ... -> the `list` field, one per line
  if (section.list?.length && block.component === 'two_column') {
    const lines = section.list.filter((f) => !f.placeholder).sort((a, b) => (a.col || 0) - (b.col || 0) || a.num - b.num).map((f) => f.value);
    const value = lines.join('\n');
    if (plain(block.list) !== value) changes.push({ label: 'Bullets', field: 'list', from: plain(block.list), to: value, flags: [] });
    block.list = value;
  }

  const items = section.items.filter((it) => Object.values(it.fields).some((f) => !f.placeholder));
  if (!items.length || !spec.items) {
    if (items.length && !spec.items) changes.push({ label: 'items', field: '—', from: '', to: `${items.length} items`, flags: [`${block.component} has no repeating items`] });
    return;
  }
  const list = block[spec.items] || [];
  if (!list.length) { changes.push({ label: 'items', field: spec.items, from: '0', to: String(items.length), flags: ['block has no item to copy from; add one in Storyblok first'] }); return; }
  const before = list.length;
  const next = items.map((it, i) => (list[i] ? list[i] : fresh(list[list.length - 1])));
  items.forEach((it, i) => {
    const prefix = `${it.marker || `Item ${i + 1}`} › `;
    if (opts.items === 'offices') {
      const f = it.fields;
      const get = (k) => (f[k] && !f[k].placeholder ? f[k].value : '');
      const title = get('Office Name') || it.marker || '';
      const desc = [get('Address'), '', [get('Phone'), get('Email')].filter(Boolean).join('\n')].join('\n').trim();
      if (title && plain(next[i].title) !== title) changes.push({ label: `${prefix}Office Name`, field: 'title', from: plain(next[i].title), to: title, flags: [] });
      if (desc && plain(next[i].description) !== desc) changes.push({ label: `${prefix}Address / Phone / Email`, field: 'description', from: plain(next[i].description), to: desc, flags: [] });
      if (title) next[i].title = title;
      if (desc) next[i].description = desc;
      return;
    }
    applyFields(next[i], it, spec.itemFields, changes, prefix);
  });
  if (before !== items.length) changes.push({ label: 'items', field: spec.items, from: `${before} items`, to: `${items.length} items`, flags: [] });
  block[spec.items] = next;
}

// ── Run ───────────────────────────────────────────────────────────
const promote = Object.fromEntries(Object.entries(PAGES).map(([p, v]) => [p, Object.keys(v.sections)]));
const docPages = parseCopyDoc(readDocxParagraphs(DOC), promote);
const docByTitle = Object.fromEntries(docPages.map((p) => [p.title, p]));
const universal = docByTitle['Universal Elements'];

for (const [phrase, slug] of Object.entries(PAGE_LINKS)) {
  const story = (await api('GET', `/stories?with_slug=${encodeURIComponent(slug)}`)).stories?.[0];
  if (story) pageLinks[phrase] = { uuid: story.uuid, full_slug: story.full_slug };
  else console.warn(`PAGE_LINKS: no story with slug ${slug} ("${phrase}" stays plain text)`);
}

const report = [];
const totals = { pages: 0, changes: 0, flagged: 0, unmapped: 0 };

for (const page of docPages) {
  if (ONLY && !ONLY.includes(page.title)) continue;
  const map = PAGES[page.title];
  if (!map) {
    report.push({ page: page.title, skipped: SKIP_PAGES[page.title] || 'not in mapping.js (add it to import this page)' });
    continue;
  }
  const entry = { page: page.title, story: map.story, note: map.note, sections: [] };
  report.push(entry);
  if (!map.story) { entry.skipped = map.note; continue; }

  const story = (await api('GET', `/stories?with_slug=${encodeURIComponent(map.story)}`)).stories?.[0];
  if (!story) { entry.skipped = `no story with slug ${map.story}`; continue; }
  const full = (await api('GET', `/stories/${story.id}`)).story;
  const body = full.content.body || [];
  totals.pages++;
  let pageChanged = false;

  for (const section of page.sections) {
    const sec = { title: section.title, warnings: [...section.warnings], changes: [] };
    entry.sections.push(sec);
    const skip = SKIP_SECTIONS.find(([re]) => re.test(section.title));
    if (skip) { sec.status = `skipped: ${skip[1]}`; continue; }
    const found = findSectionMapping(map.sections, section.title);
    if (!found) {
      const hasCopy = Object.values(section.fields).some((f) => !f.placeholder) || section.items.length;
      sec.status = hasCopy ? 'UNMAPPED: has copy but no block to put it in' : 'no copy, not mapped';
      if (hasCopy) totals.unmapped++;
      continue;
    }
    const [, [component, nth, opts = {}]] = found;

    let source = section, via = null;
    if (opts.universal && (section.universal || !Object.keys(section.fields).length)) {
      source = findSection(universal, opts.universal); via = `Universal Elements › ${opts.universal}`;
    } else if (opts.from && !Object.values(section.fields).some((f) => !f.placeholder)) {
      source = findSection(docByTitle[opts.from[0]], opts.from[1]); via = `${opts.from[0]} › ${opts.from[1]}`;
    }
    if (!source) { sec.status = `source not found in the doc: ${via}`; totals.unmapped++; continue; }

    const blocks = body.filter((b) => b.component === component);
    const block = blocks[nth];
    if (!block) { sec.status = `no ${component} #${nth + 1} on the page`; totals.unmapped++; continue; }

    sec.status = `→ ${component} #${nth + 1}${via ? ` (copy from ${via})` : ''}`;
    sec.warnings.push(...(source !== section ? source.warnings : []));
    applySection(block, source, opts, sec.changes);
    if (sec.changes.length) pageChanged = true;
    totals.changes += sec.changes.length;
    totals.flagged += sec.changes.filter((c) => c.flags.length).length;
  }

  // The page's "SEO title tag" / "Meta description" lines go into its seo
  // block. These are the plain meta_title / meta_description Text fields
  // (Forte's seo block, 2026-11). primer-ui's original seo block only has the
  // metatags plugin field: add the two fields to the space first (see the
  // copy-doc-sync skill), or the values are written but not shown.
  const seoLines = [
    page.seoTitle && ['meta_title', page.seoTitle, 'Meta title', 60],
    page.metaDescription && ['meta_description', page.metaDescription, 'Meta description', 155],
  ].filter(Boolean);
  if (seoLines.length) {
    const sec = { title: 'SEO', warnings: [], changes: [], status: '→ seo block' };
    entry.sections.push(sec);
    full.content.seo ||= [];
    if (!full.content.seo[0]) full.content.seo.push({ _uid: randomUUID(), component: 'seo' });
    for (const [field, value, label, max] of seoLines) {
      const docField = { paragraphs: [value], alternatives: [], notes: [], limit: { max, unit: 'characters' }, placeholder: false };
      setField(full.content.seo[0], field, value, sec.changes, label, docField);
    }
    if (sec.changes.length) pageChanged = true;
    totals.changes += sec.changes.length;
  }

  if (APPLY && pageChanged) {
    backupStory('copy-import', story.full_slug, (await api('GET', `/stories/${story.id}`)).story);
    await api('PUT', `/stories/${story.id}`, { story: { content: full.content }, publish: 0 });
    entry.applied = true;
  }
}

// ── Report ────────────────────────────────────────────────────────
const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n+/g, ' ⏎ ');
const clip = (s, n = 160) => { const t = esc(s); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
const now = new Date();
const stamp = now.toISOString().slice(0, 16).replace(':', '');
const lines = [
  `# Copy import ${APPLY ? '(APPLIED to drafts)' : 'dry run'}: ${now.toISOString().slice(0, 16).replace('T', ' ')}`,
  '',
  `Doc: \`${DOC.split('/').pop()}\`. ${totals.pages} pages compared, ${totals.changes} field changes, ${totals.flagged} flagged, ${totals.unmapped} sections with copy that has nowhere to go.`,
  APPLY ? 'Changes were written to the Storyblok drafts (nothing published).' : 'Nothing was written. Run with `--apply` to write these changes to the drafts.',
  '',
];
for (const e of report) {
  lines.push(`## ${e.page}${e.story ? ` → \`${e.story}\`` : ''}`);
  if (e.note) lines.push('', `> ${e.note}`);
  if (e.skipped) { lines.push('', `Skipped: ${e.skipped}`, ''); continue; }
  for (const s of e.sections || []) {
    lines.push('', `### ${s.title}`, '', s.status);
    s.warnings.forEach((w) => lines.push(`- ⚠️ ${w}`));
    if (s.changes.length) {
      lines.push('', '| Field | Now in Storyblok | From the doc | Flags |', '|---|---|---|---|');
      s.changes.forEach((c) => lines.push(`| ${esc(c.label)} | ${clip(c.from)} | ${clip(c.to, 220)} | ${esc(c.flags.join('; '))} |`));
    } else if (s.status.startsWith('→')) lines.push('- No changes.');
  }
  lines.push('');
}
mkdirSync(join(HERE, 'reports'), { recursive: true });
const out = join(HERE, 'reports', `copy-import-${APPLY ? 'applied' : 'dry-run'}-${stamp}.md`);
writeFileSync(out, lines.join('\n'));
console.log(`${totals.pages} pages, ${totals.changes} changes (${totals.flagged} flagged), ${totals.unmapped} unmapped sections with copy`);
console.log(`Report: ${out}`);
