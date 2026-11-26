#!/usr/bin/env node
/**
 * Imports a client's old WordPress blog into Storyblok `resource` stories
 * (first built for Forte, 2026-11-13; see the wp-to-storyblok-migration skill).
 *
 * Reads the public WordPress REST API (no login needed), then for each post:
 *   - cleans out page-builder shortcodes (Salient / WPBakery handled; add
 *     others in cleanHtml), keeping the text, and turns the useful ones into
 *     plain HTML (images, quote boxes, buttons, videos)
 *   - copies its images and linked uploads (PDFs) into Storyblok assets, so
 *     nothing depends on the old server after launch
 *   - creates or updates <folder>/<wordpress slug> as resource_header +
 *     case_study_layout + cta_banner
 *   - adds a Datasources › Redirects row from the old address to the new one
 *
 * Category → resource_type comes from --types; anything unlisted becomes
 * learning_hub. WordPress categories are kept as Storyblok tags.
 *
 * Safe to re-run: posts are matched by slug and updated in place (the old
 * story is backed up first); uploaded files are remembered in
 * scripts/.wp-import-cache.json (gitignored).
 *
 * Usage:
 *   node --env-file=.env scripts/import-wordpress-posts.mjs --wp https://www.oldsite.com \
 *     [--folder posts] [--types "Customer Story=success_story,Whitepaper=white_paper"] \
 *     [--cta-text "See how we can help."] [--limit N] [--slug a,b] [--dry-run]
 * Needs STORYBLOK_MANAGEMENT_TOKEN and STORYBLOK_SPACE_ID in .env, a folder
 * with that slug, and a datasource with the slug "redirects".
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { htmlToStoryblokRichtext } from '@storyblok/richtext/html-parser';
import { randomUUID } from 'node:crypto';
import { backupStory } from '../storyblok/lib/backup.js';

const args = process.argv.slice(2);
const opt = (flag, fallback) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback);
const WP = opt('--wp', process.env.WP_URL)?.replace(/\/$/, '');
const SPACE = process.env.STORYBLOK_SPACE_ID;
if (!WP || !SPACE || !process.env.STORYBLOK_MANAGEMENT_TOKEN) {
  console.error('Usage: --wp https://www.oldsite.com, with STORYBLOK_MANAGEMENT_TOKEN and STORYBLOK_SPACE_ID in .env');
  process.exit(1);
}
const WP_HOST = new URL(WP).hostname.replace(/^www\./, '').replace(/\./g, '\\.');
const FOLDER_SLUG = opt('--folder', 'posts');
const TYPES = Object.fromEntries((opt('--types', 'Customer Story=success_story,Case Study=success_story,Whitepaper=white_paper,White Paper=white_paper'))
  .split(',').map((pair) => pair.split('=').map((s) => s.trim())));
const CTA_TEXT = opt('--cta-text', 'Take the next step and see how we can help.');
const DRY = args.includes('--dry-run');
const API = `https://mapi.storyblok.com/v1/spaces/${SPACE}`;
const H = { Authorization: process.env.STORYBLOK_MANAGEMENT_TOKEN, 'Content-Type': 'application/json' };
const CACHE = new URL('./.wp-import-cache.json', import.meta.url);

const limit = args.includes('--limit') ? Number(opt('--limit')) : Infinity;
const onlySlugs = args.includes('--slug') ? opt('--slug').split(',') : null;

// sharp is optional: it only reads image sizes for Storyblok's asset metadata
let sharp = null;
try { sharp = (await import('sharp')).default; } catch { /* sizes left blank */ }

const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : { assets: {}, folder: null };
const saveCache = () => writeFileSync(CACHE, JSON.stringify(cache, null, 1));
const skipped = new Set();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sb(path, opts = {}, tries = 5) {
  if (DRY && opts.method && opts.method !== 'GET') return { story: { id: 0 }, asset_folder: { id: 0 } };
  const r = await fetch(API + path, { headers: H, ...opts });
  if (r.status === 429 && tries) { await sleep(1500); return sb(path, opts, tries - 1); }
  const text = await r.text();
  if (!r.ok) throw new Error(`${opts.method || 'GET'} ${path} → ${r.status} ${text.slice(0, 300)}`);
  await sleep(250);
  return text ? JSON.parse(text) : {};
}

const decode = (s = '') => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&hellip;/g, '…').replace(/&rsquo;/g, '’').replace(/&lsquo;/g, '‘').replace(/&ndash;/g, '–').replace(/&mdash;/g, '—');
const stripTags = (s) => decode(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const escAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// Shortcode attributes come through wptexturize with curly or prime quotes
const attrs = (tag) => {
  const out = {};
  for (const m of decode(tag).matchAll(/(\w+)=["”″“]([^"”″“]*)["”″“]/g)) out[m[1]] = m[2];
  return out;
};

async function wpAll(path) {
  const out = [];
  for (let page = 1; ; page++) {
    const r = await fetch(`${WP}/wp-json/wp/v2/${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    if (!r.ok) break;
    const batch = await r.json();
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

async function assetFolder() {
  if (cache.folder) return cache.folder;
  const { asset_folders } = await sb('/asset_folders');
  const found = asset_folders.find((f) => f.name === 'Blog (migrated from WordPress)');
  cache.folder = found?.id ?? (await sb('/asset_folders', { method: 'POST', body: JSON.stringify({ asset_folder: { name: 'Blog (migrated from WordPress)' } }) })).asset_folder.id;
  saveCache();
  return cache.folder;
}

// Copies a file from the old site into Storyblok once; returns its Storyblok URL
async function upload(url, alt = '') {
  const abs = new URL(url, WP).href;
  if (cache.assets[abs]) return cache.assets[abs];
  if (DRY) return { url: abs, id: 0 };
  const r = await fetch(abs);
  if (!r.ok) { console.warn(`  ! could not download ${abs} (${r.status})`); return null; }
  const buf = Buffer.from(await r.arrayBuffer());
  const filename = decodeURIComponent(abs.split('/').pop().split('?')[0]);
  let size = '';
  if (sharp) { try { const m = await sharp(buf).metadata(); if (m.width) size = `${m.width}x${m.height}`; } catch { /* not an image */ } }
  let signed;
  try {
    signed = await sb('/assets', { method: 'POST', body: JSON.stringify({ filename, size, asset_folder_id: await assetFolder() }) });
  } catch (e) {
    // The free Starter plan refuses some file types (PDFs) until a card is on
    // the space: keep the old link and list it, so it can be moved later
    if (!String(e.message).includes('credit_card_required')) throw e;
    skipped.add(abs);
    return null;
  }
  const form = new FormData();
  for (const [k, v] of Object.entries(signed.fields)) form.append(k, v);
  form.append('file', new Blob([buf], { type: r.headers.get('content-type') || 'application/octet-stream' }), filename);
  const up = await fetch(signed.post_url, { method: 'POST', body: form });
  if (!up.ok && up.status !== 204) throw new Error(`upload ${filename} → ${up.status}`);
  await sb(`/assets/${signed.id}/finish_upload`);
  if (alt) await sb(`/assets/${signed.id}`, { method: 'PUT', body: JSON.stringify({ asset: { alt } }) }).catch(() => {});
  const sbUrl = `https:${signed.pretty_url}`.replace('https:https:', 'https:');
  cache.assets[abs] = { url: sbUrl, id: signed.id };
  saveCache();
  return cache.assets[abs];
}

const assetField = (a, alt) => a && { id: a.id, alt: alt || '', name: '', focus: '', title: '', source: '', filename: a.url, copyright: '', fieldtype: 'asset', meta_data: {} };

async function cleanHtml(html, media, postPaths) {
  let h = html;
  // Page-builder pieces worth keeping, as plain HTML
  h = h.replace(/\[image_with_animation\b[^\]]*\]/g, (tag) => {
    const a = attrs(tag); const m = media[a.image_url];
    return m ? `\n<img src="${m.source_url}" alt="${escAttr(a.alt || m.alt_text || '')}">\n` : '';
  });
  h = h.replace(/\[nectar_single_testimonial\b[^\]]*\]/g, (tag) => {
    const a = attrs(tag);
    if (!a.quote) return '';
    const who = [a.name, a.subtitle].filter(Boolean).join(', ');
    return `<blockquote><p>${escAttr(a.quote)}</p>${who ? `<p>${escAttr(who)}</p>` : ''}</blockquote>`;
  });
  h = h.replace(/\[nectar_btn\b[^\]]*\]/g, (tag) => {
    const a = attrs(tag);
    return a.url && a.text ? `<p><a href="${escAttr(a.url)}">${escAttr(a.text)}</a></p>` : '';
  });
  h = h.replace(/\[vc_video\b[^\]]*\]/g, (tag) => {
    const a = attrs(tag);
    return a.link ? `<p><a href="${escAttr(a.link)}">Watch the video</a></p>` : '';
  });
  // Every other shortcode is layout only: drop the tags, keep what's inside.
  // The old site's rows, columns and text blocks stood in for paragraphs, so
  // their edges become paragraph breaks (the empty ones are removed below)
  h = h.replace(/\[\/?(vc_row|vc_row_inner|vc_column|vc_column_inner|vc_column_text|nectar_responsive_text|divider)\b[^\]]*\]/g, '</p><p>');
  h = h.replace(/\[\/?[a-z_]+\b[^\]]*\]/g, '');
  h = h.replace(/<(\/?)h1\b/gi, '<$1h2');
  h = h.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '');
  h = h.replace(/\s(class|style|id|role|aria-[\w-]+|data-[\w-]+)="[^"]*"/g, '');
  h = h.replace(/<p>\s*(<\/?(p|span)>\s*)*<\/p>/g, '');
  h = h.replace(/<p>(\s|&nbsp;|<br\s*\/?>)*<\/p>/g, '');
  h = h.replace(/<(h[2-6])>(\s|&nbsp;|<br\s*\/?>|<(strong|b|em|span)>\s*<\/\3>)*<\/\1>/gi, '');

  // Links to other old posts go to their new addresses
  h = h.replace(new RegExp(`href="(https?://(?:www\\.)?${WP_HOST})?(/[^"#?]*)`, 'g'), (all, host, path) => {
    const p = path.replace(/\/$/, '').toLowerCase();
    return postPaths[p] ? `href="${postPaths[p]}` : all;
  });

  // Uploaded files (images, PDFs) move into Storyblok
  const files = [...new Set([...h.matchAll(new RegExp(`(?:src|href)="((?:https?://(?:www\\.)?${WP_HOST})?/wp-content/uploads/[^"]+)"`, 'g'))].map((m) => m[1]))];
  for (const f of files) {
    const a = await upload(f.replace(/-\d+x\d+(\.\w+)$/, '$1')) || await upload(f);
    // Not copied: point at the old site in full, since a relative link would
    // break on the new domain
    h = h.split(`"${f}"`).join(`"${a ? a.url : new URL(f, WP).href}"`);
  }
  return h;
}

// ── Run ──────────────────────────────────────────────────────────────────
const posts = (await wpAll('posts?_embed=author,wp:featuredmedia,wp:term')).sort((a, b) => a.date.localeCompare(b.date));
const mediaIds = new Set();
for (const p of posts) for (const m of p.content.rendered.matchAll(/image_url=["”″“](\d+)/g)) mediaIds.add(m[1]);
const media = {};
for (const id of mediaIds) {
  const r = await fetch(`${WP}/wp-json/wp/v2/media/${id}?_fields=id,source_url,alt_text`);
  if (r.ok) media[id] = await r.json();
}
const postPaths = Object.fromEntries(posts.map((p) => [new URL(p.link).pathname.replace(/\/$/, '').toLowerCase(), `/${FOLDER_SLUG}/${p.slug}`]));

const folder = (await sb(`/stories?with_slug=${FOLDER_SLUG}&folder_only=1`)).stories?.[0]
  || (await sb('/stories?folder_only=1&per_page=100')).stories.find((s) => s.full_slug.replace(/\/$/, '') === FOLDER_SLUG);
if (!folder) { console.error(`No Storyblok folder with slug ${FOLDER_SLUG}`); process.exit(1); }
const POSTS_FOLDER = folder.id;
const redirectsDs = (await sb('/datasources')).datasources.find((d) => d.slug === 'redirects');
if (!redirectsDs) { console.error('No datasource with slug "redirects" (Datasources › New, slug redirects)'); process.exit(1); }
const REDIRECTS_DS = redirectsDs.id;

const existing = {};
for (let page = 1; ; page++) {
  const { stories } = await sb(`/stories?with_parent=${POSTS_FOLDER}&per_page=100&page=${page}`);
  for (const s of stories) existing[s.slug] = s.id;
  if (stories.length < 100) break;
}
const { datasource_entries: redirectRows } = await sb(`/datasource_entries?datasource_id=${REDIRECTS_DS}&per_page=1000`);
const redirectNames = new Set(redirectRows.map((e) => e.name.toLowerCase().replace(/\/$/, '')));

let done = 0;
const report = [];
for (const p of posts) {
  if (onlySlugs && !onlySlugs.includes(p.slug)) continue;
  if (done >= limit) break;
  const terms = (p._embedded?.['wp:term']?.[0] || []).map((t) => ({ slug: t.slug, name: decode(t.name) }));
  const names = terms.map((t) => t.name);
  const type = names.map((n) => TYPES[n]).find(Boolean) || 'learning_hub';
  const oldPath = new URL(p.link).pathname;
  const primary = terms.find((t) => t.slug === oldPath.split('/')[1]) || terms[0];
  const title = decode(p.title.rendered).trim();

  const fm = p._embedded?.['wp:featuredmedia']?.[0];
  const featured = fm?.source_url ? await upload(fm.source_url, decode(fm.alt_text || '')) : null;
  const featuredAlt = decode(fm?.alt_text || '') || title;
  const html = await cleanHtml(p.content.rendered, media, postPaths);
  // WordPress's own excerpts carry page-builder code, so the card text is the
  // first real paragraph, cut at a word near 220 characters
  const firstPara = [...html.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => stripTags(m[1])).find((t) => t.length > 60) || '';
  const excerpt = firstPara.length > 220 ? firstPara.slice(0, 220).replace(/\s+\S*$/, '') + '…' : firstPara;
  const richtext = htmlToStoryblokRichtext(html);
  const date = p.date.replace('T', ' ').slice(0, 16);

  const content = {
    component: 'resource',
    title,
    resource_type: type,
    featured: false,
    card_image: assetField(featured, featuredAlt),
    card_excerpt: excerpt,
    body: [
      {
        _uid: randomUUID(), component: 'resource_header', background: 'primary',
        category: primary?.name || '', headline: title, dek: excerpt,
        author_name: p._embedded?.author?.[0]?.name || '', published_date: date, social_links: [],
      },
      {
        _uid: randomUUID(), component: 'case_study_layout', background: 'primary',
        content: richtext, key_takeaways: [], featured_image: assetField(featured, featuredAlt),
        sidebar: [
          { _uid: randomUUID(), component: 'table_of_contents', heading: 'On this page' },
          { _uid: randomUUID(), component: 'sidebar_cta', headline: 'Get Started', body: CTA_TEXT, cta_label: 'Get Started', cta_url: '/get-started' },
        ],
      },
      {
        _uid: randomUUID(), component: 'cta_banner', headline: 'Ready to Get Started?', text_align: 'center', background_style: 'dark',
        subheadline: CTA_TEXT,
        buttons: [{ _uid: randomUUID(), component: 'button', text: 'Get Started', variant: 'primary', show_caret: false, link: { id: '', url: '/get-started', linktype: 'url', fieldtype: 'multilink', cached_url: '/get-started' } }],
      },
    ],
  };
  const story = { name: title, slug: p.slug, parent_id: POSTS_FOLDER, content, tag_list: names, first_published_at: p.date_gmt + '.000Z' };

  const id = existing[p.slug];
  if (id && !DRY) backupStory('wp-import', `${FOLDER_SLUG}/${p.slug}`, (await sb(`/stories/${id}`)).story);
  const res = id
    ? await sb(`/stories/${id}`, { method: 'PUT', body: JSON.stringify({ story, force_update: 1 }) })
    : await sb('/stories', { method: 'POST', body: JSON.stringify({ story }) });
  existing[p.slug] = res.story.id;

  const from = oldPath.replace(/\/$/, '');
  if (!redirectNames.has(from.toLowerCase())) {
    await sb('/datasource_entries', { method: 'POST', body: JSON.stringify({ datasource_entry: { name: from, value: `/${FOLDER_SLUG}/${p.slug}`, datasource_id: REDIRECTS_DS } }) });
    redirectNames.add(from.toLowerCase());
  }
  done++;
  report.push(`${type.padEnd(13)} /${FOLDER_SLUG}/${p.slug}  ←  ${oldPath}`);
  console.log(`${done}. ${type} ${p.slug}`);
}
if (skipped.size) report.push('', 'Not copied (Storyblok needs a card on the space for this file type), still linked to the old site:', ...skipped);
writeFileSync(new URL('./.wp-import-report.txt', import.meta.url), report.join('\n') + '\n');
if (skipped.size) console.log(`${skipped.size} files left on the old site (see scripts/.wp-import-report.txt)`);
console.log(`${DRY ? 'Dry run (nothing written)' : 'Done'}: ${done} posts, ${Object.keys(cache.assets).length} files in Storyblok.`);
