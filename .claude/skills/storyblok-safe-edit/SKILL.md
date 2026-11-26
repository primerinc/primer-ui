---
name: storyblok-safe-edit
description: The rules for any change made to a live Storyblok space through the Management API (stories, component schemas, datasources, assets, config) — back up the "before" JSON to ~/Documents/<Client>-Storyblok-backups/<date>-<task>/ with storyblok/lib/backup.js, write drafts not publishes, dry-run and report counts first, respect rate limits, and know how to restore. Use before every script or one-off that writes to Storyblok, and when someone asks to undo a Storyblok change.
---

# Safe Storyblok edits

## Why this exists

On Forte, Claude changed the live space through the Management API about 30
times: copy imports, bulk link fixes, schema options, moving folders,
deleting placeholder posts, publishing. Every change had a JSON backup, and
more than once that backup was the undo:

- Video blocks removed for launch and kept to put back later
- the Pricing "How it works" section
- a temporary CSS block in Config

Storyblok's own history is per story and easy to miss. Schema changes have
no history at all.

## The rules

1. **Back up first, always.**
   - Use `storyblok/lib/backup.js` (`backupStory`, `backupJson`) or the
     same layout by hand:
     `~/Documents/<Client>-Storyblok-backups/<YYYY-MM-DD>-<task>/<name>.json`
   - Set `STORYBLOK_BACKUP_CLIENT=<Client>` in `.env`.
   - Back up the full GET response (story, component or datasource
     entries) from just before the write.
   - Removing a block from a page? Save that block on its own as
     `<slug>-<block>-at-<index>.json`, so it can be re-inserted later.
2. **Drafts, not publishes.**
   - Write with `publish: 0`. Publishing is James's or the team's call.
   - When James asks for a publish, check the story doesn't already have
     *other people's* unpublished changes. Publishing would push those
     live too, so say so first.
3. **Dry-run and count first.** For anything over a handful of stories,
   print what will change (story, field, before → after) and the totals.
   Get James's go-ahead, then apply.
4. **Never delete to tidy.**
   - Move unwanted stories to the `archive/` folder ("Templates & archive";
     noindex, out of lists and the sitemap) and add a redirect.
   - Delete only when James asks, with a backup.
   - Unpublishing hides nothing before launch, because the site reads drafts.
5. **Schema changes are live immediately** for every editor. Back up the
   component (`GET /components/<id>`) first.
   - Prefer adding an option or field over renaming one: a renamed key
     silently empties existing content.
   - Afterwards run `npm run check:storyblok-drift` and
     `npm run check:storyblok-variants`, and update `schema-reference.md`.
6. **Rate limits:** about 3 requests a second on the free plan, more on
   paid plans. Retry on 429 after 1 second, and sleep about 250ms between
   writes.
7. **Report** what changed: the counts, where the backups are, and what
   wasn't touched and why. Note anything lasting in the project memory or
   status notes.

## Restoring

- **A story:**

  ```bash
  PUT https://mapi.storyblok.com/v1/spaces/<space>/stories/<id>
  { "story": { "content": <backup.story.content> }, "publish": 0 }
  ```

  If the story was published, publish again after James checks it.
- **A block:** read the saved block, give it (and its nested blocks) fresh
  `_uid`s, and insert it at the saved index.
- **A component:** `PUT /components/<id>` with the saved
  `{ component: { schema, … } }`.
- **Datasource entries:** re-POST the missing names and values. Never bulk
  delete and recreate them, because the entry IDs change.
- **A deleted story** can't be restored via the API from the trash on every
  plan. Recreate it from the backup with `POST /stories` (same slug and
  parent), and repoint any links to the new UUID.

## Plan and account traps (from Forte)

- **An expired trial locks the whole space** for API writes (`422 "trial has
  expired"`). Downgrading to Starter unlocks it. Watch the trial end date.
- **Starter allows 1 seat** and refuses some asset types (PDFs) until a card
  is on file.
- **Custom workflow stages** block publishing until the story is in the
  publishable stage. The Growth plan can't edit stages via the API.
