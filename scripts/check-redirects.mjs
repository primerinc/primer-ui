#!/usr/bin/env node
/**
 * Redirect map: checks that every old URL lands on a live page, and can sync
 * a reviewed list into Storyblok › Datasources › Redirects (which the site's
 * redirect middleware reads; see the redirect-map skill).
 *
 * Input: a CSV with the old path (or full old URL) in the first column and
 * the new path in the second (a header row is skipped). Export the Google
 * Sheet with File › Download › CSV. Or --from-storyblok to check the
 * datasource's own entries.
 *
 * Check (read-only, the default):
 *   node --env-file=.env scripts/check-redirects.mjs --base https://client.netlify.app --csv redirects.csv
 *   node --env-file=.env scripts/check-redirects.mjs --base https://client.netlify.app --from-storyblok
 * Each old path is requested on --base and followed hop by hop. Reported:
 * lands on a non-200, a loop, more than 2 hops, lands somewhere other than
 * the sheet's target, or no redirect at all (the old path is a 404).
 *
 * Sync (writes; backs up the datasource first):
 *   ... --csv redirects.csv --sync            dry run: lists adds and changes
 *   ... --csv redirects.csv --sync --apply    writes them
 * Never deletes entries. Wildcards (`/blog/*` → `/posts/*`) are passed through.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { backupJson } from '../storyblok/lib/backup.js';

const args = process.argv.slice(2);
const opt = (f, d) => (args.includes(f) ? args[args.indexOf(f) + 1] : d);
const BASE = opt('--base')?.replace(/\/$/, '');
const CSV = opt('--csv');
const FROM_SB = args.includes('--from-storyblok');
const SYNC = args.includes('--sync');
const APPLY = args.includes('--apply');
const TOKEN = process.env.STORYBLOK_MANAGEMENT_TOKEN;
const SPACE = process.env.STORYBLOK_SPACE_ID;

if ((!CSV && !FROM_SB) || (!BASE && !SYNC)) {
  console.error('Usage: --base <site> (--csv <file> | --from-storyblok) [--sync [--apply]]');
  process.exit(1);
}

// Minimal CSV: quoted fields, commas, newlines in quotes
function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; continue; }
    if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

const toPath = (s) => {
  s = s.trim();
  try { if (/^https?:\/\//i.test(s)) { const u = new URL(s); return u.pathname + u.search; } } catch {}
  return s.startsWith('/') ? s : `/${s}`;
};
const norm = (p) => (p.length > 1 ? p.replace(/\/+$/, '') : p).toLowerCase();

async function api(method, path, body) {
  const res = await fetch(`https://mapi.storyblok.com/v1/spaces/${SPACE}${path}`, {
    method, headers: { Authorization: TOKEN, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 429) { await new Promise((r) => setTimeout(r, 1000)); return api(method, path, body); }
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? {} : res.json();
}
async function datasource() {
  if (!TOKEN || !SPACE) { console.error('Set STORYBLOK_MANAGEMENT_TOKEN and STORYBLOK_SPACE_ID in .env'); process.exit(1); }
  const ds = (await api('GET', '/datasources')).datasources.find((d) => d.slug === 'redirects');
  if (!ds) { console.error('No datasource with slug "redirects"'); process.exit(1); }
  const entries = [];
  for (let page = 1; ; page++) {
    const { datasource_entries: batch } = await api('GET', `/datasource_entries?datasource_id=${ds.id}&per_page=1000&page=${page}`);
    entries.push(...batch);
    if (batch.length < 1000) break;
  }
  return { ds, entries };
}

let rows;
if (CSV) {
  rows = parseCsv(readFileSync(CSV, 'utf8'));
  if (rows.length && !/^(\/|https?:)/i.test(rows[0][0].trim())) rows.shift(); // header
  rows = rows.filter((r) => r[0]?.trim() && r[1]?.trim()).map(([from, to]) => ({ from: from.trim(), to: to.trim() }));
} else {
  rows = (await datasource()).entries.map((e) => ({ from: e.name, to: e.value }));
}
console.log(`${rows.length} redirects`);

// ── Sync ─────────────────────────────────────────────────────────
if (SYNC) {
  const { ds, entries } = await datasource();
  const byName = new Map(entries.map((e) => [norm(toPath(e.name)), e]));
  const adds = [], changes = [];
  for (const { from, to } of rows) {
    const name = toPath(from).replace(/\/+$/, '') || '/';
    const e = byName.get(norm(name));
    if (!e) adds.push({ name, value: to });
    else if (e.value.trim() !== to) changes.push({ e, value: to });
  }
  console.log(`${adds.length} to add, ${changes.length} to change, ${entries.length - changes.length} unchanged or not in the sheet (never deleted)`);
  for (const a of adds) console.log(`  + ${a.name} → ${a.value}`);
  for (const c of changes) console.log(`  ~ ${c.e.name}: ${c.e.value} → ${c.value}`);
  if (!APPLY) { console.log('Dry run. Add --apply to write.'); process.exit(0); }
  console.log(`Backup: ${backupJson('redirects', 'redirects-datasource-before', entries)}`);
  for (const a of adds) await api('POST', '/datasource_entries', { datasource_entry: { ...a, datasource_id: ds.id } });
  for (const c of changes) await api('PUT', `/datasource_entries/${c.e.id}`, { datasource_entry: { name: c.e.name, value: c.value } });
  console.log('Written. The site picks the list up within a minute (no deploy).');
  if (!BASE) process.exit(0);
}

// ── Check ────────────────────────────────────────────────────────
async function follow(path) {
  const hops = [];
  let url = new URL(path, BASE).href;
  for (let i = 0; i < 6; i++) {
    let res;
    try { res = await fetch(url, { redirect: 'manual', headers: { 'User-Agent': 'primer-redirect-check' }, signal: AbortSignal.timeout(20000) }); }
    catch (e) { return { hops, status: 'unreachable', final: url }; }
    const loc = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && loc) {
      const next = new URL(loc, url).href;
      if (hops.some((h) => h.url === next) || next === url) return { hops, status: 'loop', final: next };
      hops.push({ url, status: res.status });
      url = next;
      continue;
    }
    return { hops, status: res.status, final: url };
  }
  return { hops, status: 'too many hops', final: url };
}

const problems = [];
const wildcard = (s) => s.includes('*');
let i = 0;
const results = await Promise.all(Array.from({ length: 8 }, async () => {
  while (i < rows.length) {
    const row = rows[i++];
    if (wildcard(row.from)) continue; // check a sample by hand: /blog/* → /posts/*
    const r = await follow(toPath(row.from));
    const final = new URL(r.final);
    const issues = [];
    if (r.status !== 200) issues.push(`ends on ${r.status}`);
    if (!r.hops.length) issues.push('no redirect');
    if (r.hops.length > 2) issues.push(`${r.hops.length} hops`);
    if (r.hops.some((h) => h.status === 302 || h.status === 307)) issues.push('temporary redirect (302/307), should be 301');
    const want = wildcard(row.to) ? null : toPath(row.to);
    if (want && !/^https?:/i.test(row.to) && norm(final.pathname) !== norm(want.split('?')[0])) issues.push(`lands on ${final.pathname}, sheet says ${want}`);
    if (issues.length) problems.push({ ...row, issues, final: final.href });
  }
}));
void results;

const date = new Date().toISOString().slice(0, 10);
mkdirSync('.audit', { recursive: true });
const file = join('.audit', `redirects-${date}.md`);
const L = [`# Redirect check: ${BASE} (${date})`, '', `${rows.length} rows (wildcards skipped: ${rows.filter((r) => wildcard(r.from)).length}), ${problems.length} with problems.`, ''];
if (problems.length) {
  L.push('| Old | Sheet target | Problem | Ends at |', '|---|---|---|---|');
  for (const p of problems.sort((a, b) => a.from.localeCompare(b.from))) L.push(`| ${p.from} | ${p.to} | ${p.issues.join('; ')} | ${p.final.replace(BASE, '')} |`);
}
writeFileSync(file, L.join('\n') + '\n');
console.log(`${problems.length} problems. Report: ${file}`);
process.exitCode = problems.length ? 1 : 0;
