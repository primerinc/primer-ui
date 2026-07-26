#!/usr/bin/env node
/**
 * Finds Storyblok fields that are optional (Required: No in
 * schema-reference.md) but whose type is "dangerous" to leave unguarded —
 * Asset/Blocks/Link/Multilink/Richtext/Plugin all throw at request time if a
 * component accesses a property, calls .map()/.forEach()/.length, or passes
 * an undefined value into renderRichText() when an editor leaves the field
 * blank. Text/Textarea/Boolean/Option are safe to interpolate directly even
 * when undefined, so they're not checked.
 *
 * This matters more than it would under a static build: this project runs
 * output: 'server' (SSR, for Storyblok live-preview — see CLAUDE.md's
 * "Rendering mode" section), so there's no build step left to catch a bad
 * field before deploy. An unguarded optional field now fails at request
 * time, in production, for whoever hits that page.
 *
 * Pure static analysis — no Storyblok API calls, no token required. Trusts
 * schema-reference.md as ground truth for which fields are optional; run
 * check-drift.js first if that file might be stale relative to the live
 * space.
 *
 * Also shells out to `npx astro check` as a secondary, lower-priority
 * signal — real type errors, but a much narrower net than the scan above
 * since most components leave `blok` untyped (effectively `any`).
 *
 * Usage: node storyblok/check-build-safety.js
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseSchemaReferenceMd, parseAstroConfigComponents } from './lib/schema-reference.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Doc `Type` labels whose live value is an object/array — undefined access
// throws. Everything else (Text, Textarea, Boolean, Option) renders fine as
// undefined, so isn't worth scanning.
const DANGEROUS_TYPE_PREFIXES = ['asset', 'blocks', 'link', 'multilink', 'richtext', 'plugin'];

function isDangerousType(docType) {
  const t = docType.toLowerCase();
  return DANGEROUS_TYPE_PREFIXES.some((p) => t.startsWith(p));
}

function isOptional(required) {
  // Treat missing/unclear Required column as optional — the safer assumption
  // when deciding whether to scan for a guard.
  return !required || /no/i.test(required);
}

function runAstroCheck() {
  try {
    execFileSync('npx', ['astro', 'check'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return [];
  } catch (err) {
    // astro check colorizes its output with ANSI escapes even when piped —
    // strip them before matching, or "error ts(...)" never lines up as plain text.
    const output = `${err.stdout || ''}${err.stderr || ''}`.replace(/\x1b\[[0-9;]*m/g, '');
    const errors = [];
    const re = /([\w./-]+\.astro):(\d+):(\d+)\s*-\s*error\s+ts\(\d+\):\s*([\s\S]*?)(?=\n\S|\n\[|$)/g;
    let m;
    while ((m = re.exec(output))) {
      errors.push({ file: m[1], line: Number(m[2]), message: m[4].trim().split('\n')[0] });
    }
    return errors;
  }
}

/** field is safe if the guarded form (blok.field?. for object types, a
 *  `?? []`/`|| []` default for arrays, or a ternary/&& guard for richtext)
 *  appears ANYWHERE in the file — deliberately lenient rather than doing
 *  real control-flow analysis. This matches the codebase's own idiom of
 *  guarding once (often via a derived const) and reusing the safe value,
 *  e.g. TwoColumn.astro's `blok.image?.filename ? blok.image.filename : ...`
 *  — the second, bare access is safe only because of the first, and a
 *  same-file check treats that pattern as intentional rather than flagging
 *  the bare access. Known limitation, not a bug: a genuinely unguarded bare
 *  access elsewhere in a file that also happens to guard the field once
 *  won't be caught. */
function findUnsafeFields(astroPath, fields) {
  let text;
  try {
    text = readFileSync(astroPath, 'utf8');
  } catch {
    return [];
  }

  const findings = [];
  for (const { field, type } of fields) {
    const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const t = type.toLowerCase();

    if (t.startsWith('blocks')) {
      const usesArrayMethod = new RegExp(`\\bblok\\.${escaped}\\.(map|forEach|length)\\b`).test(text);
      // Either idiom counts as guarded: a `?? []`/`|| []` default assignment
      // (most components), or an optional-chained check anywhere in the file
      // that gates the bare access, e.g.
      // `blok.field?.length > 0 && (... blok.field.map(...) ...)` (CaseStudyLayout).
      const hasDefault = new RegExp(`\\bblok\\.${escaped}\\s*(\\?\\?|\\|\\|)\\s*\\[\\s*\\]`).test(text);
      const hasOptionalChainGuard = new RegExp(`\\bblok\\.${escaped}\\?\\.`).test(text);
      if (usesArrayMethod && !hasDefault && !hasOptionalChainGuard) {
        findings.push({ field, type, pattern: 'unguarded-array-method' });
      }
      continue;
    }

    if (t.startsWith('richtext') || t.startsWith('plugin')) {
      const usesField = new RegExp(`\\brenderRichText\\(\\s*blok\\.${escaped}\\s*\\)|\\bblok\\.${escaped}\\.\\w+`).test(text);
      const hasGuard = new RegExp(`\\bblok\\.${escaped}\\s*(\\?|&&)`).test(text);
      if (usesField && !hasGuard) {
        findings.push({ field, type, pattern: 'unguarded-richtext-or-object' });
      }
      continue;
    }

    // asset / link / multilink — single nested object, commonly .filename/.url/.cached_url
    const bareAccess = new RegExp(`\\bblok\\.${escaped}\\.\\w`).test(text);
    const optionalAccess = new RegExp(`\\bblok\\.${escaped}\\?\\.`).test(text);
    if (bareAccess && !optionalAccess) {
      findings.push({ field, type, pattern: 'unguarded-dot-access' });
    }
  }
  return findings;
}

function main() {
  const docSections = parseSchemaReferenceMd(join(ROOT, 'storyblok/schema-reference.md'));
  const astroMap = parseAstroConfigComponents(join(ROOT, 'astro.config.mjs'));

  const report = { generatedAt: new Date().toISOString(), typeErrors: runAstroCheck(), components: {} };

  for (const section of docSections) {
    const astroFile = astroMap[section.name];
    if (!astroFile) continue; // nested-only blocks and non-resolver stories aren't independently renderable

    const optionalDangerousFields = section.fields.filter((f) => isOptional(f.required) && isDangerousType(f.type));
    if (optionalDangerousFields.length === 0) continue;

    const astroPath = join(ROOT, 'src', `${astroFile}.astro`);
    const unsafeOptionalFields = findUnsafeFields(astroPath, optionalDangerousFields);
    if (unsafeOptionalFields.length > 0) {
      report.components[section.name] = { file: `src/${astroFile}.astro`, unsafeOptionalFields };
    }
  }

  console.log(JSON.stringify(report, null, 2));
}

main();
