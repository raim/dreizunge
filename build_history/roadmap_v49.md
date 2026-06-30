# Roadmap v49

**v48 shipped.** This file supersedes `roadmap_v48.md` (now historical). It carries the session
protocol (unchanged) and every still-open item forward. Start a fresh session by reading this file,
then `LIVE-TEST-CHECKLIST.md`, then the latest `v*_session*_notes.md`.

---

## ⚠️ Session protocol — READ FIRST, applies to every change

This block is the standing "definition of done." A fresh session is expected to follow it without
being re-told; several of these were missed in past sessions (LIVE-TEST updates, i18n listing,
version bump) and only caught because the user noticed. Treat it as a checklist.

**How to start a session:** read THIS file (the highest-numbered `build_history/roadmap_v*.md` is
the current one), then `build_history/LIVE-TEST-CHECKLIST.md`, then the most recent
`build_history/v*_session*_notes.md`. Establish the green baseline (`node test/run.js` +
`node test/check-inline.js`) before touching anything.

**Working rules (per change):**
- One change at a time. Pure refactors stay byte-identical. After each change: full suite green
  (`node test/run.js`) and `check-inline` at 0. Re-run before moving on.
- Add or update a **unit test** for any new behavior. When adding a lesson type, exercise type,
  generator, or registry entry, update the matching registry test (`unit-*-registry`).

**Definition of Done — before calling any change finished, check ALL that apply:**
1. **Tests** — suite green + `check-inline` 0; new/changed behavior has a guarding test.
2. **LIVE-TEST-CHECKLIST.md** — if the change is browser-only or Ollama-only (UI, RTL, TTS,
   rendering, anything not exercisable headlessly), ADD a numbered section describing exactly what
   to click and what to expect. *This is the one most often forgotten.* Anything you label
   "browser-verify owed" in notes MUST have a matching checklist entry.
3. **i18n** — new user-facing strings go in `ui.json` **`en` only** (never add English text to other
   languages — the user's `translate-ui.js` fills *missing* keys and can't detect English
   fallbacks). List every new key in the session notes + roadmap so the offline translate pass is
   run. Changed English values won't be re-translated automatically (script keys off *missing*, not
   *changed*) — call those out explicitly or hand-edit if language-neutral.
4. **Static build** — if client (`index.html`) or baked data (`lessons.json`, `languages.json`,
   `scripts.json`, `ui.json`) changed, re-run `node build-static.js` so `docs/index.html` is current.
5. **Data parity** — if a generator exists on both server and client (math, intro_script, furigana
   tokenizer), keep them identical and assert parity in a test.

**Definition of Done — at a release / packaging point:**
6. **Version** — bump `APP_VERSION` in `server.js` if it's a new release. NOTE: the static build
   *also* hardcodes the version in two spots in `build-static.js` (`APP.info.version` and the
   `app-version` textContent) — bump those too (they drifted to stale before). Consider deriving
   them from `server.js`'s `APP_VERSION` to remove the drift (see Tech debt).
7. **Roadmap** — mark shipped items ✅, carry every open TODO/idea forward, and at a version bump
   write the next `build_history/roadmap_v{N+1}.md` (carrying this protocol block forward).
8. **Session notes** — write/update `build_history/v{ver}_session{n}_notes.md`.
9. **Package** — sync the release dir, regenerate `docs/`, zip, and call out which deliverables are
   still owed (browser pass, i18n, native-speaker content checks).

(If you add a new standing rule, append it here so the next session inherits it.)

---

## What shipped in v48 (summary)
The v47.x batch, now released as v48. Highlights: content-aware bidi/RTL, mute & no-voice
fallbacks, the seven script tables + **Hindi/Devanagari** (basic) and **reverse-direction script
lessons** (ar→en / ja→en / hi→en), arc-integrated per-chapter script primers, **no-keyboard glyph
ordering** (with furigana stripping), synonyms/word_forms **QC**, **hidden lessons** (static,
non-blocking) + hidden-vocab-leak fix, **mixed-as-progression** (mixed lesson present → learner
plays only it; once-through unlocks the story), difficulty-scaled **script length caps** (letters +
play-time questions), the **result-card** fixes (script letters, mixed-lesson words, story-unlock),
the **read-story SyntaxError** escaping fix (`escJsAttr`), a **ui.json sanity clean** (wrong-script
removal), and a **consolidation** of the learner-visibility rule into shared
`lessonCountsFor` / `countedLessons` / `setComplete`. APP_VERSION = v48; docs rebuilt with the
user's 249-topic lessons.json (schema 29).

---

## OPEN — near-term (do these next)

### 0. Browser / Ollama verification pass — IN PROGRESS (user)
The interactive checklist (`dreizunge_v47x_verification_checklist.html`, mirrored in
`LIVE-TEST-CHECKLIST.md`) is the gate. Browser-only sections (A,B,C,NK,HL,SL,UI) need only the
static build; the Ollama sections (D,E) need a local model. **Expect to tune the QC prompts** —
qwen2.5:7b (and similar small models) are unreliable on "is this distractor also valid?" and
synonym/antonym judgments. Anything that fails → fix before relying on it.

### 1. UI translation re-pass with TranslateGemma — OWED (user)
The shipped `ui.json` is script-clean but has English-fallback gaps where corrupted values were
removed (coverage ~275–339 / 372 per language). Re-run the translate pipeline on the flagged keys —
see **`build_history/ui_translation_flags.txt`** — and on the untranslated-gap keys. The previous
model (qwen2.5:7b) bled scripts (Chinese into Korean/Hebrew, Cyrillic into Arabic); a stronger model
(TranslateGemma) should fix it. The script sanity check that caught this is in this session's notes
if it needs re-running on the next ui.json.

### 2. Library tag/language filter persistence — NEEDS REPRO
Reported: navigating back to main loses the tag/language selection. The in-memory filters
(`APP.libTagFilter`, `APP.libFilter`, `APP.libSrcFilter`) already persist across navigation and
`_renderTagFilterBar` re-selects, so the reset isn't obvious. Likely culprit: `_restoreFormLang()`
(🌍 Home button / back paths) resets `APP.lang`/`srcLang` to *form* defaults — intended for the
generation form but it may reset the selectors the library reads. HELD pending exact repro (which
control resets, via which button) — the language-selection flow is intricate and tied to
generation, so no speculative change. Candidate fix once confirmed: persist the three lib filters
and/or decouple them from `_restoreFormLang`.

---

## OPEN — waiting on user material

### Dialect lessons M1 — WAITING ON EAST-TYROLEAN MATERIAL
Full spec + parsing rules + data model in **`build_history/spec_dialect_lessons_m1.md`**. Decisions
locked: glossary-table-first; East-Tyrolean pilot; dialect = target / High German = source; 3-col
table `dialect | de | note`; one row = one verbatim vocab item; approximate `de` voice toggle.
Safety spine: **user is the source of truth, the model is a packager/aligner, never an author.** Do
NOT start coding until real rows arrive — the importer's column/orthography handling must be built
and tested against actual data. Then M1.5 (opt-in AI example sentences, QC-gated), M2 (generated
dialect stories, per-dialect `curated:true`, native-reviewed).

---

## OPEN — discussed, not started

### Dynamic mixed lessons as the DEFAULT progression model
Shift from "complete each lesson in a locked path" to "play variable-length mixed rounds from the
whole set until a target fraction of ALL questions is solved," with per-lesson coverage indicators.
**Interim shipped in v48:** (a) a `mixed` lesson present → non-teacher plays only it, once-through
unlocks the story; (b) script lessons cap play-time questions to a difficulty-scaled random subset.
The full model still needs the keystone: **stable per-question IDs** (exercises re-derive/reshuffle
today, so "solved" has nothing durable to attach to) + a per-question solved store + coverage UI +
weighted round assembly + a set-level completion fraction. Open design Qs (decide before building):
what counts as "solved" (one correct = coverage model, recommended first; vs SRS mastery later);
default vs opt-in vs teacher path; round weighting (≈70/30 unsolved/review); **coverage-aware
sampling** (the v48 script play-cap is plain random — a short round can miss letters); flagged
questions excluded from the denominator. Builds on existing `buildMixedExercises` + `_srcLessonIdx`.

---

## OPEN — scripts

- **Hindi matras/conjuncts.** Basic Devanagari table shipped (44 letters, recognition only). Matras
  (positional vowel signs) and conjuncts (क्ष) need a different lesson type — larger effort, only if
  demand warrants.
- **Thai** — still the only empty stub in `scripts.json`. Fill the table (like the others) when
  wanted; same posture (native review of romanizations).
- **Native review of romanizations** — Hangul, Hebrew, Arabic, Devanagari translits are
  high-confidence but worth a native pass (IAST/standard, but pedagogy choices like inherent-vowel
  matter).
- **Plan A — multi-language transliteration/sound matrix (the proper "speak the sound" fix).**
  Today a script letter's feedback speaks the glyph in the target voice (v48 fixed the "dh→d-h"
  bug by NOT speaking the romanization). The richer feature — speak an accurate *pronunciation* per
  (script, letter, UI-language) — wants a per-(script, letter, UI-lang) matrix in scripts.json,
  sourced from CLDR/ICU + LLM + native review. Big data effort; deferred.

---

## OPEN — larger tracks (carried, not scheduled)

- **`examples.json` stock via batch-gen + QC** ("greetings and introductions" seed) — Priority 1 in
  v48 roadmap. Generate a stock set offline, QC-gate it, measure `_genMeta` quality on a weak model.
- **Map-tree UI on the main page** — Priority 2 (visual topic tree).
- **Platform track** — Priority 3, large; see `platform_plan.md`. Keep client↔server coupling from
  deepening so a future clean API boundary stays feasible.
- **QC coverage expansion** — extend QC to all lesson types except `math` and the two error-hunt
  types; tune prompts on a weak local model (ties to verification §0).
- **Static-build flag handling — content-merge review UI.** Beyond flags-only merge, support
  merging a re-import with a review UI (TODO later).

---

## Tech debt
- **Version drift in `build-static.js`.** The static version is hardcoded (drifted to stale `v46`
  before v48). Derive it from `server.js`'s `APP_VERSION` (read/parse at build time) so a single
  bump suffices. (Bumped manually to v48 this release.)
- **Three "set done"/visibility checks were duplicated** → consolidated into `lessonCountsFor` /
  `countedLessons` / `setComplete` in v48. If a new visibility rule is added, change it there only.

---

## Reference docs (build_history/)
- `spec_dialect_lessons_m1.md` — dialect M1 spec (decisions locked, awaiting material).
- `LIVE-TEST-CHECKLIST.md` — browser/Ollama checklist (§1–39).
- `ui_translation_flags.txt` — ui.json keys to re-translate (TranslateGemma).
- `roadmap_v48.md` — historical; the larger original plan text (examples.json, map-tree, platform,
  intro phase-2, etc.) lives there in full if more detail is needed.
- `v47x_session_integration_review.md`, `v47x_furigana_seam_audit.md` — cross-feature audits.
- `START-HERE.md` — pointer (should point at this file as the current roadmap).
