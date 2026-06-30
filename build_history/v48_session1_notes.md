# v48 — release session notes

This session closed out the v47.x batch and cut **v48**. Baseline stayed green throughout
(`node test/run.js` + `node test/check-inline.js` = 0).

## Shipped this session (on top of the v47.x work)
- **Reverse-direction script lessons** — `ar→en` / `ja→en` / `hi→en` now offer a 🔡 script lesson
  for the non-Latin script even when it's on the SOURCE side. No new scripts.json entries (tables
  are direction-agnostic); added `scriptLessonAvailable(target, src)` (either side) for the manual
  add menu, and `scriptsUsedInLessonSet` now unions target+source scripts + scans source text.
  Auto-gen (arc) stays target-only.
- **Result-card fixes** — script lessons show their letters (not an empty/“Vocabulary” box) and the
  Next button names a script lesson by its title; **mixed lessons** now show the words actually
  played; **story-unlock** on the result card respects the learner-visibility rule (was
  `allLessons.every`, which counted hidden siblings → never unlocked in mixed-only mode).
- **Mixed-as-progression** — a set with a `mixed` lesson hides the others for a learner and
  once-through unlocks the story (per user: "once through is enough").
- **ui.json sanity clean** — the uploaded ui.json was stale (missing 214 current `en` keys) AND had
  ~100 wrong-script values (Chinese in Korean/Hebrew, Cyrillic in Arabic). Shipped a merge: complete
  `en` kept, only script-clean translations retained, corrupt ones dropped to English fallback.
  Flagged keys → `build_history/ui_translation_flags.txt` (re-translate with TranslateGemma).
- **Read-story SyntaxError fix** — storyline "read story"/"continue" built inline `onclick` with the
  chapter title and apostrophe-only escaping; a title with `" \` or a newline produced
  `missing ) after argument list` and a dead click. `toggleSavedStory` now reads the title from
  `data-topic`; `continueFromLesson` uses a new value-preserving `escJsAttr`.
- **Consolidation** — three duplicated "is the set done / does this lesson count" checks merged into
  shared `lessonCountsFor(d,L)` / `countedLessons(d)` / `setComplete(d)`. All sites (path render,
  progress, locking, next-up, continue-jump, result card) route through them; old inline `_mixedOnly`
  definitions removed (test asserts they stay gone). `continueLesson` now also respects mixed-only.

## Release actions (this session)
- **APP_VERSION → v48** in `server.js`; also bumped the two hardcoded version spots in
  `build-static.js` (they had drifted to stale `v46`).
- **lessons.json** replaced with the user's upload (249 topics, schema 29); `build-static.js`
  re-run — `docs/index.html` now shows v48 with 249 topics baked.
- **roadmap_v49.md** written (carries the session protocol + all open items); `roadmap_v48.md` is
  now historical; `START-HERE.md` example pointer updated.
- Packaged as `dreizunge_v48.zip`.

## New tests this session
`unit-inline-escaping` (read-story escaping), plus extended `unit-intro-script` (reverse-direction
availability, source-side detection, result-card mixed/story-unlock), `unit-hidden-lessons`
(consolidated helpers + hidden-vocab-leak), `unit-no-keyboard` (furigana stripping).

## i18n keys added across the batch (en-only — for the translate pass)
`form.arc_script_lbl`; `ex.no_keyboard.title`, `ex.badge.glyph_order`, `ex.glyph_order.q`,
`ex.glyph_order.q_plain`, `ex.glyph_order.placeholder`; `intro.glyph_readonly`, `intro.editor_note`,
`intro.no_letters`, `intro.field.glyph/name/translit/ipa`; `tts.voice_test` (reused). Devanagari/
reverse-direction script lessons reuse the generic script-lesson strings (no new keys).

## Owed (carried to roadmap_v49)
Browser/Ollama verification pass (checklist) + QC-prompt tuning; TranslateGemma re-pass on the
flagged + gap keys; tag/language-filter repro; dialect M1 (awaiting material). See `roadmap_v49.md`.
