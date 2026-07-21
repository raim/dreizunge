# v60 — learner UI: skip the lesson-set page; redesign the completion card

One learner-UX session on v59. Plan file: `roadmap_v60.md`. Design confirmed with the user before
build (four questions): learners land on the first unfinished lesson (resume, auto-start); Back
targets the storyline deck (landing for solo chapters); teachers keep the lesson-set page.

## Two features, one theme: the lesson-set page becomes teacher-only

**Learner routing.** The one predicate is `_isLearner()` = `!_canEdit()` (so canGenerate OR teacher
mode = not a learner). `loadSaved` still calls `goLessonSet` (it does the per-lesson language/dir
setup and the hash update — a learner needs those), then, for a learner, resumes at
`_firstUnfinishedLessonIdx` and `startLesson`s it. A fully-complete chapter has no unfinished
lesson (idx -1) → the page shows (a re-opened done chapter isn't a dead click; its complete card's
Next/Back take over). Teachers fall through to the page unchanged. The static build's own
`loadSaved` override got the identical branch (guarded `typeof _isLearner==='function'`), so the two
renderers can't drift — `unit-learner-nav` pins both.

Helpers added next to `_canEdit` (so they land in the static engine slice): `_isLearner`,
`_firstUnfinishedLessonIdx(d)` (respects `lessonCountsFor` → hidden/mixed-only aware; -1 when
complete), `_storylineForTopic(topicKey)` (resolves the deck preferring `APP._slScreen`, returns
`{sl, byId, topics, enc}`; the `_slScreen` preference is guarded by `belongs(s)` so a stale deck
from a previous screen can't mislead a landing-page click).

**Completion card redesign.** Markup trimmed to exactly `#comp-next` + `#comp-back`, with a new
`#comp-progress` container above them. `showComplete`:
- **Next** = open the next questions directly. Priority: next unfinished counted lesson in THIS
  chapter (`startLesson`) → else the next chapter in the deck that still has work, opened via
  `loadSaved` (which resumes it at its first unfinished lesson) → else Next hides (`display:none`)
  and Back becomes the only forward action. `_nextChapter()` walks the deck from the current topic
  using the list projection's `lessonCount` vs. progress-key count (the projection doesn't ship the
  lessons themselves).
- **Back** (`compBackToStory`) → `openStorylineScreen` for the deck, or `goLandingClean` for a solo
  chapter. The target is stashed in `APP._compBack` during `showComplete` so button and Next agree;
  for a drill it's resolved from the real stashed topic (`APP._drillPrev.topic`), not the synthetic
  drill topic, so Back returns to the chapter's story.
- **Teacher-only extras:** the mistake drill (`#comp-drill`) and the full nav pills
  (`#comp-nav-btns`) now render only when `_canEdit()` (and not on a drill card). Learners get the
  clean two-button card.
- **Body:** `_compProgressHtml` renders two mini progress bars — along the storyline (chapters with
  all counted work done / total) and within the chapter (counted lessons done / total). Skipped for
  a drill (synthetic topic). On chapter completion (`setComplete`) the story-unlocked card shows the
  **full** story; the 200-char preview now only appears in the teacher/not-yet-done peek, with the
  label switching `complete.story_unlocked` ↔ `complete.story_preview`.

`afterComplete` (now reached only by a drill's Next) restores the real topic via `endDrill` then
calls `compBackToStory`.

## Tests

New `unit-learner-nav.test.js` (registered; suite **108 green**): pure-helper table (learner gate,
resume index incl. hidden-lesson skip and complete→-1, storyline resolution + `_slScreen`
preference), loadSaved routing (live + static parity), card structure (Next chains
lesson→chapter→hidden, Back to story/home, teacher-only drill+pills), full-story-on-unlock, and the
within/along progress summary. Three existing tests were reworked to the redesign (not deleted):
`unit-drill` (nav pills now `_teacher && !lesson._drill`; drill button teacher-gated; Back hidden on
a drill; `afterComplete` → `compBackToStory`), `unit-intro-script` (Next is a plain "Next" now, not
a per-type label; the letters recap guard stays). Headless smoke confirmed the resume index and
storyline resolution against a hand-built APP; a live `/api/lessons/load` smoke confirmed the
endpoint learner routing depends on.

## i18n (protocol rule 3)

Six en-only keys: `complete.next`, `complete.back_story`, `complete.back_home`,
`complete.chapter_progress`, `complete.story_progress`, `complete.story_preview`. Added to `ui.json`
en with placeholders mirrored across all languages (uniform structure for the translate pass). Two
pre-existing keys reused: `complete.story_unlocked`, `drill.cta`. Pending translate pass now totals
**18 keys × 29 languages**.

## How to see it work (browser; per protocol rule 2)

With teacher mode OFF (or the static build): click any saved chapter on the landing page or a
storyline deck — you go straight into the first unfinished question, never the lesson-set page.
Finish a lesson: the card shows your progress (this chapter + the story), a green **Next** that
drops you straight into the next lesson, and **← Back to story** returning to the deck. Finish the
last lesson of a chapter: the FULL chapter story appears ("Story unlocked!"), Next carries you into
the next chapter's first lesson (or hides on the last chapter), Back returns to the deck. For a solo
chapter Back says "← Back" and returns to the landing page. Turn teacher mode ON: clicking a chapter
lands on the lesson-set editing page again, and the completion card regains the drill button and the
📚/📖 nav pills.

## Addendum v60.1 (same session) — learner definition fix + review card

**Bug (user):** clicking a chapter from the storyline screen still landed a learner on the
lesson-set page. Root cause: `_isLearner()` was `!_canEdit()`, and `_canEdit()` is true whenever
`canGenerate` OR teacher mode is on — so a user with a live backend (or, in the reported static
case, teacher mode left ON in localStorage) never qualified as a learner. The storyline-screen
chapter click goes through the SAME `loadSaved` as the landing page (it renders `savedItemHtml`
whose onclick is `loadSaved(...)`), so this was global, not screen-specific.

**Fix (user's chosen definition):** a learner is defined by teacher mode being OFF, INDEPENDENT of
`canGenerate`. `_isLearner()` is now `!APP._teacherMode`. The completion card's teacher-extras gate
was aligned to the same axis (`const _teacher = !!APP._teacherMode`) so routing and card agree — a
backend user who turns teacher mode off gets the full clean learner experience. Editing capability
(`_canEdit`, which still folds in canGenerate) remains a separate axis for the actual edit controls.

**Follow-on:** a learner re-opening an ALREADY-complete chapter previously fell through to the
lesson-set page (the `idx===-1` case). Added a **review mode**: `showComplete(true)` renders the
completion card for a finished chapter without recording progress or a per-round stat (synthetic
`APP.cur` with `_review:true`; the record guard gained `!C._review`). `loadSaved` (live + static)
now routes a learner with no unfinished lesson into `showComplete(true)` — they see the full story +
progress + Back, never the editor.

Tests: `unit-learner-nav` definition assertions flipped to the teacher-mode axis + a regression
guard that `_isLearner` never calls `_canEdit`; new review-mode section (synthetic C, no recording,
live+static routing). `unit-drill` recording guard updated for the `!C._review` prefix. Suite 108
green; static rebuilt.

## Addendum v60.2 (same session) — mixed-driven replay loop + frozen progress bar

**Bug (user):** "stuck in a lesson, Next repeats the same lesson, progress bar doesn't move."
Root cause: the v60 learner routing and completion-card Next both used a naive
`!done[lesson.id]` scan to pick the next lesson. But a **mixed-driven** learner set (the common
case — a set with a visible `mixed` lesson) completes by COVERAGE, not per-lesson booleans: its
mixed lesson never receives a `done[id]`. So the scan returned the mixed lesson's index forever →
Next replayed it, `_firstUnfinishedLessonIdx` never reached -1, and every per-lesson progress
readout stayed at 0/N.

**Fixes:**
- `_firstUnfinishedLessonIdx` is now coverage-aware: for the active topic it returns -1 when
  `setComplete(d)` is true (the real completion rule, covering the coverage model), otherwise the
  first unfinished counted lesson (which for a mixed-driven-but-incomplete set is the mixed/driver
  lesson — the correct place to keep practicing). Proven headless: incomplete→mixed idx,
  complete→-1, classic→next lesson.
- Completion-card **Next** delegates to that helper (`nextLessonIdx = _setDone ? -1 :
  _firstUnfinishedLessonIdx(...)`, with `_setDone` = review flag or `setComplete`), so once
  coverage completes Next advances to the next chapter instead of replaying.
- `startLesson` now `delete C._review` — a v60.1 review render left `_review:true` on the shared
  `APP.cur`; a subsequent real round would then skip progress recording. (Latent; fixed proactively.)
- `_compProgressHtml`'s within-chapter row shows the COVERAGE fraction for a mixed-driven set
  (mirrors buildPath's bar) instead of the always-0 counted-lesson fraction — the bar now moves.

Tests: `unit-learner-nav` gained a coverage-aware regression block (helper returns -1 on
setComplete; Next delegates; startLesson clears _review; progress row uses topicCoverage).
`unit-intro-script`'s next-lesson assertion updated to the delegated helper (hidden-skip now lives
in `_firstUnfinishedLessonIdx` via lessonCountsFor). Suite 108 green; static rebuilt.

## Addendum v60.3 (same session) — quitting a question (✕) leaked to the lesson-set page

**Bug (user):** pressing ✕ on a question still returned to the lesson-set page for a learner.
`confirmQuit` ended with an unconditional `goLessonSet()`. Fixed to respect the learner split: a
learner returns to the storyline deck (`openStorylineScreen`), or the landing page for a solo
chapter — the same target as the completion card's Back; teachers still return to the editing page.
Progress-on-quit recording is unchanged. Shared by the static build (no override). Guarded in
`unit-learner-nav`. Suite 108 green; static rebuilt.

## Addendum v60.4 (same session) — story-progress row read 0 for mixed chapters

**Bug (user):** the completion card's "Story" progress row didn't show progress. Root cause: the
row computes OTHER chapters' completion from the list projection, which ships `lessonCount` +
`lessonTypes` but NOT the lessons themselves — so it used `done-keys >= lessonCount`. A mixed-driven
chapter completes by coverage and its mixed lesson never earns a `done[id]`, so a fully-finished
mixed chapter had `done-keys = lessonCount-1 < lessonCount` → counted as incomplete → the row
showed 0/N (an empty bar that reads as "no progress"). The current chapter was already correct
(`setComplete`).

**Fix:** the story row now detects mixed chapters via `lessonTypes.includes('mixed')` and counts
them done when `done-keys >= cnt-1` (the non-mixed lessons, mixed excluded); classic chapters keep
the exact `>= cnt`. Proven headless: a 3-chapter mixed deck with 2 finished + 1 in progress now
reads 2/3 (was 0/3). Guarded in `unit-learner-nav`. Suite 108 green; static rebuilt.

## Addendum v60.5 (same session) — story generation empty-response on reasoning models

**Bug (user log):** `chapter 1 failed: Story generation failed: Ollama returned empty response`,
with story model `qwen3.6:35b-a3b` (a reasoning/"thinking" model). Root cause: the story-role
`callLLM(system, msg, maxTokens)` wrapper never accepted/forwarded an `opts` object, so the story
call could not request `think:false`. A reasoning model then spent its entire `num_predict` (capped
2048) inside the `<think>` block; `stripThink` removed it → empty text → the llm.js guard rejected
with "Ollama returned empty response". This is the exact failure the v55_c `think:false` fix already
prevents for story-QC / summary-QC / storyboard — the story path had simply never been given the
option.

**Fix:**
- `callLLM(system, userMsg, maxTokens, opts)` now forwards `opts` (through the v59 meter's
  `...args`, so metering is preserved) to `llm.callLLM` → `_callOllama`.
- Story generation passes `{ think: false }` (a story is prose, not reasoning) and its budget is
  raised from 2048 → 4096 for headroom.
- The two tiny-budget JSON meta calls (topic-info 256, meta-translation 128) also pass
  `think:false` — on a reasoning model those budgets vanish entirely into a think block, and the
  topic-info fallback would otherwise silently strip every generation's emoji/name.
- llm.js's existing graceful-degradation retry means a NON-reasoning model that rejects
  `think:false` still works (retried once without it).

NOT changed: `callLLMLesson` (6 lesson-generation sites, same reasoning model). Lessons are JSON and
would benefit from the same treatment, but the user may rely on the lesson model's reasoning for
quality — flagged for a decision rather than changed unprompted.

Guarded by the new `unit-reasoning-model-safety` (opts propagation end-to-end; story + meta calls
pass think:false; empty-response/reasoning-only guards intact). Server-only change; suite 109 green.

## Addendum v60.6 (same session) — story-translation toggle in the read-story panels

**Feature (user):** when a story has a stored source-language translation (`storyTranslation` from
the auto-translate pass — previously write-only, fed to lesson generation), show a button in the
"read story" panels to switch the displayed story between target and source language.

**Implementation:** two panels, each with a shared render helper so they behave identically.
- Completion card: `#comp-story-xlate` button + `_renderCompStory(allDone)` / `toggleCompStoryLang`.
  Defaults to the target story; toggling swaps text, relabels the button to the OTHER language
  (`story.show_translation` ↔ `story.show_original`), and repoints the 🔊 to read whichever language
  is shown. The truncation rule (full when complete, 200-char teacher peek) applies to both langs.
  The old inline render was extracted into `_renderCompStory` (the v60 full-story test was updated
  to point at it).
- Landing saved-item story: `#sis-xlate-<sid>` button + `_renderSavedStory(id)` /
  `toggleSavedStoryLang`. `toggleSavedStory` now caches the loaded topic in `_savedStoryCache` so
  the toggle re-renders with no re-fetch. Vocab highlighting stays on the target story only (a
  translation isn't the target language).
- Both: the button is HIDDEN unless `storyTranslation` exists.

**Data path:** `/api/lessons/load` returns the whole topic (has `storyTranslation`), and the static
build bakes whole topics (spreads `...topic`), so both live and static get the feature with no
projection/serializer change. The storyline COMBINED-summary panel is left as-is (it's the
aggregated summary, not a per-chapter translation).

**Not touched:** the storyline summary/combined-story panels; the translation is still also used as
the lesson-generation context aid (unchanged). Two en-only i18n keys added
(`story.show_translation`, `story.show_original`). Guarded by the new
`unit-story-translation-toggle` (behavioral, both panels, DOM-stubbed). Suite 110 green; static
rebuilt.

## Addendum v60.7 (same session) — per-role reasoning toggle

**Feature (user):** the story-generation empty-response (v60.5) was `think:false` applied
unconditionally. But reasoning can *help* story/lesson quality — the user wants it opt-in. Also hit
the same empty-response + TIMEOUT on lesson generation (`qwen3.6:35b-a3b`, 3 failed attempts).
Decision (confirmed): per-role toggles for STORY and LESSONS only, OFF by default, and when ON
auto-bump both the token budget and the timeout.

**Design:** reasoning is a per-role axis, orthogonal to model choice. Only story + lessons can
benefit (QC and translation are mechanical and stay non-thinking always).
- `OLLAMA_THINK = { story:false, lessons:false }` runtime state; `thinkOpts(role, baseTokens)`
  resolves `{think, tokens, timeoutMs}`: OFF → `{think:false, tokens:base}` (the safe default that
  keeps the v60.5 empty-response protection); ON → `{think:true, tokens:base×2.5,
  timeoutMs:globalTimeout×3}`. The multipliers exist because a 35B-a3b think block routinely runs
  longer than the answer — without headroom the answer is truncated (empty) or times out.
- Story call uses `thinkOpts('story', …)`. `callLLMLesson` applies the LESSONS policy CENTRALLY, so
  all 6 lesson-generation sites honor the toggle without threading it through each (choke-point
  pattern). An explicit caller `opts` still wins (spread last).
- `llm.js` `_callOllama` now sends `think` when it's a boolean (true OR false; was false-only), and
  already honored a per-call `timeoutMs` override (the bump).
- `setRuntimeModels` accepts `think:{story?,lessons?}` (booleans only); `currentModels` exposes it;
  `/api/models` accepts a think-only POST (added to the "nothing to set" guard + the run condition)
  and still rejects a truly empty one. The switch log gains a 🧠 marker per reasoning-on role.
- Client: two 🧠 checkboxes in the model menu (story + lessons only), `switchThink(role,on)` POSTs
  `think:{role:bool}` and re-renders from the server's authoritative state. Three en-only i18n keys.
  The whole model picker is server-only, so (correctly) absent from the static build.

**On "should storyline generation get thinking too?":** a book/storyline run already invokes the
story role per chapter and the lessons role per chapter, so both toggles apply to it automatically.
The short structured calls (title, summary, storyboard) keep `think:false` — forcing reasoning
there mostly wastes tokens; the user opted only story+lessons in.

**Not changed:** QC/translation/storyboard/title/summary reasoning (stay off). Guarded by the new
`unit-reasoning-toggle` (thinkOpts behavior extracted+run; wiring; config; think-only POST; llm.js
boolean-think; client menu). Three prior tests updated for the boolean-think body form + the
story-call now using thinkOpts. Suite 111 green; static rebuilt.

**Caveat for the user:** ON is genuinely slower and heavier — a reasoning lesson call can be 2–3×
the tokens and time. If a role still times out with reasoning on, raise the base timeout in the
same menu (the ×3 multiplies whatever it's set to).

## Addendum v60.8 (same session) — clean completion card + teacher pass-mark threshold

Two requests. **(A) Clean card:** removed the trophy 🏆, the %-solved pill, and the four stat
panels (✓/✗/🔥/⚑) from the completion screen, plus their dead CSS (.trophy/.prog-pill/.stat-*,
@keyframes popIn), the orphaned `_setStatLbl` helper, and the stat-population + dead `_setAttr`
title calls in showComplete. Added a **%-solved bar** to `_compProgressHtml` — correct-answer
coverage (`topicCoverage().solved/total`), the real mastery signal, rendered below the existing
chapter + story bars. Reused the existing `complete.chapter_progress`/`complete.story_progress`
labels per the request; one new key `complete.solved`.

**(B) Global pass-mark threshold (teacher):** a global %-solved a student must reach for a chapter
to count complete. Confirmed design: global default (all chapters), set in the MODEL MENU, GATE not
force (below it the chapter stays incomplete and the card offers the drill; navigation still
allowed).
- Reuses the existing coverage machinery: `_coverageTarget()` precedence is now per-topic
  `coverageTarget` > **global threshold** (`APP.info.coverageThreshold`) > 1. `setComplete` gained
  a coverage gate for CLASSIC sets too (mixed sets already gated via coverageComplete): all counted
  lessons done AND, when the threshold < 1, solved/total ≥ threshold. Teachers/canGenerate exempt;
  only the active topic; threshold 1 (default) or an empty universe is a no-op → historical
  behavior preserved.
- Completion card: computes `_belowThreshold` (learner, non-drill, active topic, tgt<1, coverage
  below), sets a "Keep going!" title + a below-threshold hint, and offers the drill as the way up —
  to LEARNERS too (previously teacher-only). The drill gate is now
  `(_teacher || _belowThreshold) && drillAvailable`.
- Server: **discovered pre-existing dormant infrastructure** — `getSettings`/`setCoverageThreshold`
  on `store.settings` (default was 0.7), never wired to an endpoint or /api/info, and `loadStore`
  never read `settings` back (so it wouldn't survive a restart). Removed a duplicate flag-based
  helper I'd started, wired the existing one, FIXED the load-back bug (`loadStore` now returns
  `settings`), changed the default to **1** (off, so existing installs don't suddenly gate), and
  added `/api/coverage-threshold` (GET/POST, no Ollama needed) + exposed it in `/api/info`.
  Live-smoked: default 1 → set 0.8 → persists (re-GET, /api/info, file `settings`) → clamps >1 →
  rejects non-number.
- Client: a "Pass mark %" field in the model menu (teacher), `switchThreshold` POSTs value/100 and
  updates `APP.info.coverageThreshold` live so the gate applies immediately. Three menu keys + two
  card keys (en-only).

**Static build:** the clean card + gate logic are in the engine; the threshold MENU is server-only
(correctly excluded). Static `APP.info` has no `coverageThreshold` → `_coverageTarget()` falls back
to 1 → no gating (no teacher to set it). Guarded by the new `unit-coverage-threshold` (clean-card
removals, %-solved bar, setComplete gate behavior, target precedence, below-threshold drill offer,
server persistence/endpoint/info/client wiring). Two prior tests (drill, learner-nav) updated: the
drill is no longer teacher-only. Suite 112 green; static rebuilt.

**i18n running total for the pending translate pass:** v57–v60.8 added `storyboard.locked_resume`,
9×`prov.*`, 2×`tokens.*`, 6×`complete.*` (v60), 2×`story.*` (v60.6), 3×`models.think_*` (v60.7),
3×`models.threshold*` + `complete.solved` + `complete.keep_going` + `complete.below_threshold`
(v60.8) — all en-only, mirrored as placeholders. One `translate-ui.js` run clears them.
