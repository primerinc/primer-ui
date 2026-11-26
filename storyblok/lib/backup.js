/**
 * Backups before any Storyblok Management API write.
 *
 * Every script (and every one-off Claude writes) that changes a story,
 * component schema, datasource or asset saves the "before" JSON first:
 *
 *   ~/Documents/<Client>-Storyblok-backups/<YYYY-MM-DD>-<task>/<name>.json
 *
 * <Client> is STORYBLOK_BACKUP_CLIENT in .env (e.g. "Forte"), else the
 * package.json name. Override the whole folder with STORYBLOK_BACKUP_DIR.
 * Files are never overwritten: a second backup of the same thing on the same
 * day gets a -2, -3 … suffix, so the first "before" is always kept.
 *
 * Restoring: PUT the saved story's `content` back with
 *   PUT /v1/spaces/<space>/stories/<id>  { story: { content }, publish: 0 }
 * (see the storyblok-safe-edit skill).
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

function clientName() {
  if (process.env.STORYBLOK_BACKUP_CLIENT) return process.env.STORYBLOK_BACKUP_CLIENT;
  try {
    const { name } = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
    if (name) return name.replace(/^@[^/]+\//, '');
  } catch {}
  return 'client';
}

const today = () => new Date().toISOString().slice(0, 10);
const safe = (s) => String(s).replace(/^\/+|\/+$/g, '').replace(/[^a-z0-9._-]+/gi, '_').slice(0, 120) || 'item';

/** The folder for today's backups of one task, created if needed. */
export function backupDir(task) {
  const root = process.env.STORYBLOK_BACKUP_DIR || join(homedir(), 'Documents', `${clientName()}-Storyblok-backups`);
  const dir = join(root, `${today()}-${safe(task)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Saves `data` as JSON under the task folder. Returns the file path. */
export function backupJson(task, name, data) {
  const dir = backupDir(task);
  let file = join(dir, `${safe(name)}.json`);
  for (let n = 2; existsSync(file); n++) file = join(dir, `${safe(name)}-${n}.json`);
  writeFileSync(file, JSON.stringify(data, null, 2));
  return file;
}

/** Saves a full story object (from GET /stories/:id) before it is changed. */
export const backupStory = (task, slug, story) => backupJson(task, `story-${slug}`, story);
