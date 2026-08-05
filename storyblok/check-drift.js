#!/usr/bin/env node
/**
 * Reconciles four sources that each independently claim to know a Storyblok
 * component's field list — the live space (canonical, but not in git), this
 * repo's schema-reference.md, each component's `Fields:` docblock + `blok.`
 * usage in src/storyblok/*.astro, and CLAUDE.md's component inventory table —
 * and reports where they disagree.
 *
 * Deliberately a plain reporting script, not a gate: prints one JSON object
 * to stdout and exits 0 unless the API call itself fails. Interpreting the
 * output (which findings matter, what to do about them) is the job of the
 * storyblok-drift-check skill layered on top, not this script.
 *
 * Usage: node --env-file=.env storyblok/check-drift.js [--space <id>]
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseSchemaReferenceMd, parseAstroConfigComponents } from './lib/schema-reference.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Primer Block Space — the canonical, reusable base every client build starts
// from. Override with --space to check a duplicated client/demo space
// against this repo's docs/code instead.
const DEFAULT_SPACE_ID = '293131252124026';

// Content types fetched directly by slug (BaseLayout's cdn/stories/config
// call) rather than resolved through Storyblok's block resolver — they will
// never appear in astro.config.mjs's `components` map, and that's correct,
// not drift.
const NOT_RESOLVER_COMPONENTS = ['config'];

// Storyblok's "section" field type is a pure editor-UI grouping divider —
// it holds no data of its own (its `keys` array just lists which other
// real fields render under its label in the Visual Editor sidebar), so it
// has no code- or doc-side equivalent and isn't real drift. ('tab' was an
// earlier guess at the type name that turned out to be wrong — the actual,
// documented type is 'section'; see storyblok-docs' component-field-object
// reference. Left in this list too in case it resurfaces from a stale
// schema, but 'section' is the one that matters going forward.)
const IGNORED_LIVE_FIELD_TYPES = ['tab', 'section'];

const typeMap = JSON.parse(
  readFileSync(join(ROOT, '.claude/skills/storyblok-drift-check/references/type-map.json'), 'utf8')
);

function getArg(flag) {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const spaceId = getArg('--space') || process.env.STORYBLOK_SPACE_ID || DEFAULT_SPACE_ID;
const token = process.env.STORYBLOK_MANAGEMENT_TOKEN;

if (!token) {
  console.error('STORYBLOK_MANAGEMENT_TOKEN not set — run via `node --env-file=.env storyblok/check-drift.js`');
  process.exit(1);
}

async function fetchLiveComponents(spaceId) {
  const components = {};
  let page = 1;
  for (;;) {
    const res = await fetch(
      `https://mapi.storyblok.com/v1/spaces/${spaceId}/components?per_page=100&page=${page}`,
      { headers: { Authorization: token } }
    );
    if (!res.ok) {
      throw new Error(`Storyblok API ${res.status} fetching components: ${await res.text()}`);
    }
    const data = await res.json();
    for (const c of data.components) {
      const fields = {};
      for (const [fieldName, def] of Object.entries(c.schema)) {
        if (IGNORED_LIVE_FIELD_TYPES.includes(def.type)) continue;
        fields[fieldName] = def.type;
      }
      components[c.name] = { fields, isRoot: !!c.is_root };
    }
    if (data.components.length < 100) break;
    page++;
  }
  return components;
}

/** Splits a comma-separated field list on top-level commas only — commas
 *  inside parens (e.g. "stats (blocks -> stat_item: number, label)") don't
 *  count as field separators. */
function splitTopLevel(str) {
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of str) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts.map((s) => s.trim()).filter(Boolean);
}

function tokenToFieldName(tok) {
  const m = tok.match(/^([A-Za-z_][A-Za-z0-9_]*)/);
  return m ? m[1] : null;
}

function parseClaudeComponentTable(path) {
  const lines = readFileSync(path, 'utf8').split('\n');
  const headerIdx = lines.findIndex((l) => l.includes('Storyblok block name'));
  if (headerIdx === -1) return new Set();
  const names = new Set();
  for (let i = headerIdx + 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim().startsWith('|')) break;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 2 || !cells[1]) break;
    names.add(cells[1]);
  }
  return names;
}

/** Pulls the top-level `Fields:` list out of a component's leading docblock,
 *  stopping at a blank comment line, the closing comment marker, or a nested
 *  `xxx fields:` label (e.g. PricingTable's `pricing_plan fields:` continuation). */
function parseComponentFieldsDoc(astroPath) {
  let text;
  try {
    text = readFileSync(astroPath, 'utf8');
  } catch {
    return null;
  }
  const comment = text.match(/\/\*\*([\s\S]*?)\*\//);
  if (!comment) return null;
  const commentLines = comment[1].split('\n').map((l) => l.replace(/^\s*\*\s?/, ''));
  const startIdx = commentLines.findIndex((l) => /^Fields:/i.test(l.trim()));
  if (startIdx === -1) return null;

  let buffer = commentLines[startIdx].replace(/^Fields:\s*/i, '');
  for (let i = startIdx + 1; i < commentLines.length; i++) {
    const trimmed = commentLines[i].trim();
    if (trimmed === '') break;
    if (/^\S+ fields:/i.test(trimmed)) break;
    buffer += ' ' + trimmed;
  }
  return splitTopLevel(buffer).map(tokenToFieldName).filter(Boolean);
}

// Storyblok injects these onto every blok object at runtime — they're never
// part of a component's schema, so `blok._uid` etc. isn't a real code/live
// mismatch even though it's a genuine `blok.` access in the code.
const STORYBLOK_META_FIELDS = ['_uid', '_editable', 'component'];

function blokAccessFields(astroPath) {
  let text;
  try {
    text = readFileSync(astroPath, 'utf8');
  } catch {
    return [];
  }
  const set = new Set();
  const re = /\bblok\.([A-Za-z_][A-Za-z0-9_]*)/g;
  let m;
  while ((m = re.exec(text))) {
    if (!STORYBLOK_META_FIELDS.includes(m[1])) set.add(m[1]);
  }
  return [...set];
}

function typeMatches(liveType, docType) {
  const acceptable = typeMap[liveType];
  if (!acceptable) return true; // unknown live type — don't invent a false mismatch
  return acceptable.some((label) => docType.toLowerCase().startsWith(label.toLowerCase()));
}

async function main() {
  const live = await fetchLiveComponents(spaceId);
  const docSections = parseSchemaReferenceMd(join(ROOT, 'storyblok/schema-reference.md'));
  const astroMap = parseAstroConfigComponents(join(ROOT, 'astro.config.mjs'));
  const claudeTableNames = parseClaudeComponentTable(join(ROOT, 'CLAUDE.md'));

  const docsByName = Object.fromEntries(docSections.map((s) => [s.name, s]));
  const allNames = new Set([...Object.keys(live), ...Object.keys(docsByName), ...Object.keys(astroMap)]);

  const report = { space: spaceId, generatedAt: new Date().toISOString(), components: {} };

  for (const name of [...allNames].sort()) {
    const liveComp = live[name];
    const docSection = docsByName[name];
    const astroFile = astroMap[name];
    const isTopLevel = docSection ? docSection.level === 2 : true;

    const entry = {
      inLive: !!liveComp,
      inDocs: !!docSection,
      inAstroConfig: !!astroFile,
      liveOnlyFields: [],
      docsOnlyFields: [],
      codeOnlyFields: [],
      typeMismatches: [],
      notInAstroConfig: false,
      notInClaudeTable: false,
    };

    const liveFields = liveComp?.fields ?? null;
    // Doc rows for pure UI-grouping fields (Section/Tab) describe the same
    // divider that fetchLiveComponents already strips out of `live` via
    // IGNORED_LIVE_FIELD_TYPES — drop them here too so they don't show up
    // as false docsOnlyFields drift.
    const docFields = docSection
      ? Object.fromEntries(
          docSection.fields
            .filter((f) => !['Section', 'Tab'].includes(f.type))
            .map((f) => [f.field, f.type])
        )
      : null;

    if (liveFields && docFields) {
      entry.liveOnlyFields = Object.keys(liveFields).filter((f) => !(f in docFields));
      entry.docsOnlyFields = Object.keys(docFields).filter((f) => !(f in liveFields));
      entry.typeMismatches = Object.keys(liveFields)
        .filter((f) => f in docFields)
        .filter((f) => !typeMatches(liveFields[f], docFields[f]))
        .map((f) => ({ field: f, live: liveFields[f], doc: docFields[f] }));
    }

    if (astroFile) {
      const astroPath = join(ROOT, 'src', `${astroFile}.astro`);
      const docblockFields = parseComponentFieldsDoc(astroPath) ?? [];
      const usedFields = blokAccessFields(astroPath);
      const codeFields = new Set([...docblockFields, ...usedFields]);
      if (liveFields) {
        entry.codeOnlyFields = [...codeFields].filter((f) => !(f in liveFields));
      }
    }

    if (isTopLevel && !NOT_RESOLVER_COMPONENTS.includes(name)) {
      entry.notInAstroConfig = !astroFile;
      entry.notInClaudeTable = !!astroFile && !claudeTableNames.has(name);
    }

    report.components[name] = entry;
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
