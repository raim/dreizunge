# v58 — provenance fields: structured source + generating user (roadmap item 2, merged spec)

One feature session on v57. Plan file: `roadmap_v58.md`.

## What shipped

**Data.** `topic.source = { author, licence, url, note }` — structured and optional, exactly as the
original analysis argued (a free-text convention in the description can't be validated/exported/
filtered and would be mangled by retitle passes). `topic.createdBy`, default `'admin'` until login
exists. Schema write-stamp bumped to **30** via a `SCHEMA_VERSION` constant; every reader comparison
stays `>= 29` — a v29 file loads untouched and is re-tagged on its next save. The whole corpus (267
topics) was backfilled with `createdBy:'admin'` by the new `backfill-createdby.js` (dry-run default,
`--write` to save, idempotent, never overwrites an existing value) — explicit data per the roadmap's
preference, not a read-time default.

**Server.** `createdBy` is stamped in `upsert()` — the single choke point every topic write flows
through (generate, book, dialect, save-story, import), so there is no per-route stamping to forget;
updates preserve the original creator. `POST /api/topic-source` sets/clears a topic's source: stable
id resolution ONLY (same-name topics are legal), stores exactly what `sanitizeTopicSource` admits.
The sanitizer is a pure function: trims, caps (author 120 / licence 80 / url 300 / note 500), strips
control chars, and drops any url that neither parses as http(s) nor reads as a DOI (`10.x/…` or
`doi:…`) — fail closed, it's a link target. All-empty → null → the field is DELETED (storage never
holds `{}`). The `/api/lessons` list projection now ships `createdBy` + `source` + `sourceFile`
(from `storyMeta`) — the same live-vs-static asymmetry v55_s hit with generationStats: static bakes
whole topics and would have had the one-liner "for free" while live silently lacked the data.

**Client.** ONE formatter, `provLineHtml` (shared part2 code, present in the static bundle), renders
`by <user> · from: <source>` everywhere: both landing-row renderers CALL it — build-static.js does
not reimplement the formatting, killing the v55_p duplication at that level (only the one-line call
site is duplicated, and the parity test pins it). The storyline screen aggregates over its chapters
via `provLineForChapters` (distinct users, distinct sources, 3 shown + "+n"); storylines carry NO
`createdBy` of their own — deriving stays truthful once login exists and chapters diverge. The
chapter page fills `#prov-stats` ABOVE `#gen-stats` in the same style, adds the note, and offers a
✎ editor (author/licence/url/note) that is live-only (`typeof STATIC_LESSONS === 'undefined'`) and
teacher-gated via `_canEdit()` like every other editor. The client mirrors the server-sanitized
response verbatim (server is authoritative) and toasts `prov.url_dropped` if a URL/DOI was rejected
rather than silently swallowing it; the landing-row cache (`APP.savedList`) is synced in place so
the one-liner updates without a reload. The `<user>` part ships INERT (a styled span, not a dead
link) per the roadmap. Source links are `target="_blank" rel="noopener"`, labels/hrefs escaped;
DOIs resolve through `https://doi.org/`.

**Not done on purpose:** rendered attribution in `export-lessons.js` output (whole topic objects
flow through it, so the DATA survives; rendering it in the printable/export formats is a follow-up
for the export item). No storyline-level source field (derive instead, see above).

## Tests

New `unit-provenance-fields.test.js` (registered): behavioral sanitizer table (caps, control chars,
DOI forms, javascript:/ftp:/garbage dropped, clear-on-empty, non-string fields), upsert-stamp +
schema-stamp contracts, route contract (id-only, sanitized store, clear, updatedAt), projection
fields, one-formatter/four-sites render contracts (incl. inert user + noopener + escaping), and a
real run of `backfill-createdby.js` against a tmp fixture (dry-run, stamp, preserve, idempotent).
`unit-static-landing-parity` hook list gained `provLineHtml(s)`. Suite: **106 green**, check-inline
0 on both builds, static rebuilt. A live smoke against a corpus COPY (`LESSONS_FILE` env) verified
the full loop: set (DOI kept) → projection → hostile-url clear → 404 on unknown id → schema 30
persisted.

## i18n (protocol rule 3)

Nine **en-only** keys: `prov.by` ("by {user}"), `prov.from`, `prov.edit_title`, `prov.author`,
`prov.licence`, `prov.url`, `prov.note`, `prov.save`, `prov.url_dropped`. With v57's
`storyboard.locked_resume`, the pending translate pass covers **10 keys × 29 languages**.

## How to see it work (browser; per the amended protocol rule 2)

Landing page: every saved row shows a muted `by admin` line under its meta (plus `· from: …` once a
source exists). Storyline screen: the same line, aggregated, directly above the storyboard. Open any
chapter: the provenance line sits above the generation stats; with teacher mode ON (live build), a ✎
appears — fill Author/Licence/URL-or-DOI/Note, Save, and the line updates everywhere including the
landing row (no reload). Enter a DOI like `10.1000/xyz` → it links via doi.org; enter garbage or a
`javascript:` url → toast says it was not saved. Clear all four fields + Save → the `from:` part
disappears (field deleted server-side). Static build: same display everywhere, no ✎.
