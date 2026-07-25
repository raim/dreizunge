# v69 session 1 — single-pass mixed rounds + article symmetry (v69.1, post-cut)

Both user-requested 2026-07-23, built on the v69 tree. Suite 141 checks green; `check-inline` 0 on
both builds; static rebuilt.

## 1. ✅ Article symmetry in vocab pairs (prompt fix)
qwen3.6 produced pairs like "das Feld" ↔ "campo" (article on the source side only — reported in
`tp_17847396989280000125`). The base-form rule said "with the usual article where applicable" but
never demanded SYMMETRY. All three vocab prompts (`vocab`, `vocabFromText` — the one PDF chapters
actually use — and `vocabTable`) now carry an ARTICLE SYMMETRY rule: article on BOTH sides
("der Hund" ↔ "il cane") or on NEITHER ("Hund" ↔ "cane"), never one side only; if either language
has no articles, omit on both. Guarded in `unit-prompt-strictness`. Prompt-only — existing lessons
are untouched; the fix applies to newly generated ones (QC can flag old asymmetric pairs as usual).

## 2. ✅ Mixed lesson: one pass to the coverage threshold, drill closes the gap
Three coordinated changes:

**(a) Coverage-driven round sizing** (`buildMixedExercises`). The old round sampled `perType` (3)
questions per sibling — far fewer than the coverage universe — so the threshold was only reachable
by replaying the mixed lesson many times. Now: `needed = ceil(target × universe) − solved`, and the
round contains exactly `needed` distinct UNSOLVED questions, collected per earlier sibling by
re-deriving its builder until every wanted qid has an exercise object (builders sample/shuffle, so
one derivation surfaces only a subset — the same convergence idea `_lessonQidUniverse` uses).
Solved questions are never re-asked; `perType`/`roundSize` (sampling knobs of the replay model)
don't cap this path; `needed === 0` (target already met — replay/practice) keeps the old sampled
70/30 round; the no-audio filter runs BEFORE the slice so unanswerable listen items can't eat the
budget. All machinery typeof-guarded, so the unit harnesses (and any stripped environment) degrade
to the pre-v69.1 sampled round — `unit-mixed-lessons` still covers that path unchanged.

**(b) Drill credit-back** (`markSolved`) — a latent v60.8 gap found while wiring this: the drill
was designed as "the way up" below the pass mark, but its solves landed only under the synthetic
`__drill__` topic — **the launching chapter's coverage never moved**, so the drill could never
actually close a gap. Now a drill solve ALSO credits the chapter stashed in `APP._drillPrev`:
qid = `lessonId:type:hash(canonical content)`, and the drill builds the same exercise shapes over
the same words, so re-keying the solved qid's hash with each parent lesson id **that contains the
word** marks exactly the chapter questions the learner just demonstrated. A re-keyed qid outside a
lesson's universe is inert (coverage counts the intersection), so this can only credit real
questions. Monotonic; persists once per batch of new solves.

**(c) The gate routes into the drill** (`showComplete`). "Below threshold" previously fired only
when target < 1 — at the default 1.0 an errorful mixed pass just replayed. A MIXED-driven set
completes by coverage at ANY target (that is `setComplete`'s own rule), so `_belowThreshold` now
fires there too. Resulting learner flow: **mixed once (auto-sized) → all correct → chapter
complete; errors → "keep going" card with the drill CTA → drill retrains the missed words AND
raises the chapter's coverage via (b) → complete.** Residual: sentence-based misses (order /
read-translate) have no drill counterpart, so after the drill the card falls back to a SHORT mixed
top-up round containing only what's still unsolved (the v69 mixed-resume fallback) — one pass is
necessary in the success case, and error cases converge in drill-first order.

Guarded by the new **`unit-mixed-coverage-round`**: exact-needed sizing at targets 1.0 and 0.6 with
sampling builders (proves the convergence loop), no re-asked solved questions, no duplicates,
sampled-path fallback at needed=0; drill credit-back (containing lesson credited, non-containing
and mixed lessons skipped, monotonic persistence); and the mixed-driven gate structurally.

**How to see it work (browser, teacher mode OFF):**
1. Open a mixed-driven chapter with fresh progress — the round is longer than before (it holds
   every question needed to reach your threshold). Finish it error-free → the chapter completes in
   that single pass.
2. Repeat on another chapter but answer a few vocab questions wrong → the card says "keep going"
   and offers "practise your mistakes"; run the drill → returning, the coverage bar reflects the
   drilled words, and the chapter completes (or offers one short top-up round if you also missed
   sentence questions).
3. Re-opening a completed mixed chapter still gives the familiar shorter practice round (replay
   mode is unchanged).

No new `ui.json` keys. lessons.json unchanged (prompt + client only); static rebuilt for the
client change.

## 3. ✅ v69.2 — the drill dead end (user-reported, live mode, student)

Two halves of one report ("stuck on an almost-empty result card after a drill; reopening, stuck at
10/34 with no Next or drill button"):

**(a) The drill's completion card had NO forward affordance at all.** Every `compNext` branch in
`showComplete` excluded `lesson._drill`, and Back is hidden for drills — the comment "a drill
returns via Next" was never actually wired. This was masked until v69: the TDZ crash killed every
completion card before it rendered, so the drill's dead-end card had never been SEEN working; v69
un-crashed it and v69.1 made drills prominent, so it surfaced immediately. Fix: a `_drill` branch
FIRST in the wiring — Next runs `endDrill()` and returns to the LAUNCHING chapter: straight into
its remaining questions when a resume target exists, else its completion/review card, which then
shows the right affordance (drill again, coverage replay, next chapter, or done). Exactly the
requested "the drill should just lead to the complete card of the respective lesson".

**(b) Below threshold with no drill = no way up.** A SUCCESSFUL drill deliberately walks the
wrong-counts back down (`recordLearnedFromLesson`'s decrement), so `drillAvailable` goes false
while coverage can still be short (10/34 in the report) — and a CLASSIC (non-mixed) chapter then
rendered the review card with `nextLessonIdx = -1`, no drill CTA, and no Next. The only way up for
a classic set is REPLAYING (rounds re-sample, so fresh questions advance coverage), and nothing
offered it. Fix: new `_firstCoverageShortLessonIdx()` (typeof-guarded like its siblings; skips
mixed lessons — mixed sets resume via the v69 mixed fallback) + a coverage-replay branch in the
Next wiring: below threshold, no drill → Next resumes the first counted lesson whose own coverage
is still short.

The pinned v66.1 branch strings (unit-coverage-threshold §5b) were preserved verbatim; guards for
both fixes live in the new §5c (structural ordering + behavioral helper checks).

**How to see it (live, teacher mode OFF):** get a chapter below the pass mark → drill from the
"keep going" card → the drill card now has **Next**, which lands you back in the chapter (its
remaining questions, or its card). If the drill cleared your wrong words but coverage is still
short (your 10/34 case), the chapter card's Next now says "next" and replays the first
under-covered lesson instead of leaving you stranded.

## 4. ✅ v69.2b — live/static drill divergence (user-reported)

The teacher's global pass mark (`store.settings.coverageThreshold`, 0.8 in the user's library) is
served live via `/api/info` — but the static build's hardcoded `APP.info` never carried it, so
`_coverageTarget()` fell back to 1 in static and a below-mark CLASSIC chapter showed neither the
"keep going" card nor the drill offer there. `build-static.js` now derives `COVERAGE_THRESHOLD`
from the store settings (clamped 0..1, fallback 1) and bakes it into the static `APP.info` exactly
like the version. Verified: the built `docs/index.html` contains `coverageThreshold: 0.8`. Guarded
by `unit-coverage-threshold` §5d (derivation + interpolation + a numeric value in the BUILT
artifact). Note the static mark is a snapshot: changing the threshold on the server needs a
`build-static.js` re-run to reach static learners — same as every other baked datum.

**How to see it:** open the static build, same below-mark chapter as before — the completion card
now says "keep going … 80%" and offers the drill / coverage replay, identical to live.

---
**RELEASE: packaged as `v69_b`** (point release on v69). Suite 141 checks green; check-inline 0 on
both builds; static rebuilt with the v69_b version + baked pass mark. Owed unchanged from v69:
translate-ui pass (55 keys × 29 langs + stale `toast.no_voice` deletion), normal-use verification
(this file's "how to see it" sections), native review of `latin.sounds.*`.

## 5. ✅ v69.2c — two roadmap items that need NO new ui.json keys

Picked deliberately while the offline `translate-ui.js` pass is running: neither adds user-facing
strings, so the translation run stays valid.

### (a) Latin script lesson spoke BOTH cases
User-reported 2026-07-14, carried in roadmap_v65. A two-case glyph is DISPLAYED as "A a" (correct —
the learner should see both forms) but the TTS read it twice ("ay … ay"). Fixed at the SPEAK sites
only, via a new `_glyphSpeakForm()`: it collapses a pair of whitespace-separated tokens **only when
they are case-variants of each other** ("A a" → "A", "Dh dh" → "Dh"); two different letters
("A b"), single glyphs, and caseless scripts ("ا") pass through untouched. The BUILDERS still emit
the two-case glyph, deliberately — display, qid stability, and the server/client `intro_script`
parity all depend on that string. Both `check()` speak paths (correct + wrong answer) route through
it; the listen renderer already spoke a single case (`L.lower || L.ch`), so it needed no change.
Guarded in `unit-intro-script` (unit cases + both wrap sites + the builder contract).
**How to see it:** play a Latin intro-script lesson (e.g. an Arabic/Cyrillic speaker learning
English) — each letter is now read once, while the card still shows "A a".

### (b) Beginner mode restricts EXERCISE types
Roadmap item, user 2026-07-14: *"In beginner mode, don't add lessons that require already knowing
the word — only ones where you pick a word from 4 options. And if listening mode is OFF, avoid
lessons that require already knowing the translation. Lessons with sound where you type the word you
hear ARE fine."* Implemented as a play-time policy in `buildStandardExercises` — that is where the
exercise mix for a difficulty is actually chosen, so it also flows automatically into the coverage
universe (`_lessonQidUniverse` re-derives from the same builder) and into mixed-lesson pooling.
At difficulty ≤ 1:
- **`order` always drops.** Its shuffled word bank *looks* like options, but assembling a sentence
  is production and needs word order a beginner hasn't met.
- **`listen_type` drops only when there is no audio** (muted, or no voice for the target). With
  audio it stays — the user explicitly allowed "hear it, type it" as transcription. Muted, its own
  render falls back to `type_translate` ("show the source, TYPE the target") = exactly the
  recall-production task rule 1 excludes. That is the "listening OFF" clause: the audio was the
  scaffolding, and without it the item silently changes character.
- Every 4-option MCQ (`listen_mcq`, `mcq_source_target`, `mcq_target_source`, `read_translate`)
  survives in both audio states.
Difficulty resolves **lesson → topic → 2**, the same fallback the lesson list displays, so a
beginner lesson inside a harder topic is still treated as beginner. Applies in teacher mode too:
it is a property of the lesson's difficulty, not a visibility rule, so a teacher previewing a
beginner lesson sees what the learner will get. Guarded by the new `unit-beginner-types`.
**How to see it:** open a difficulty-1 vocab lesson — no sentence-ordering questions; with sound on
you still get "listen and type", with the 🔇 mute on you don't (only pick-from-four remains).
**Known pre-existing wrinkle (NOT introduced here, not fixed here):** `_qidUniverseCache` is keyed
on (topic, lessonIdx, teacher) but the mix now also depends on mute state — as it already did for
the v55_z no-voice filter. Toggling mute mid-chapter can therefore shift the coverage denominator
until the cache is invalidated. Worth a follow-up: fold the audio state into the cache key.

## 6. ✅ v69.2c — the THIRD stuck report, diagnosed by measurement (+ storyline provenance cleanup)

### (a) Why the drill could never close the gap — measured, not guessed
Reported topic `tp_17847405220340000250` ("Die wissenschaftliche Erklärung", difficulty 1,
threshold 0.8). Running the REAL builder against the REAL lesson data:
- lesson 0 can ask **29 distinct questions** (13 without a target voice), but a round serves a
  **random 12** — `shuffle(_exs).slice(0,12)`;
- reaching 80% (24/29) by replay therefore took a measured **median 5, worst 8 perfect rounds**,
  mostly re-answering already-solved questions;
- and the drill can only ever re-ask **wrong VOCAB words** — never the `order` / `read_translate`
  sentence questions that make up much of the universe.

**The actual trap was branch ORDER.** In v69.2 the below-threshold drill branch sat *before* both
progress branches, so while any wrong word remained, Next was ALWAYS "practise your mistakes":
card → drill → card → drill, with coverage plateaued. The drill is *also* offered as its own
`#comp-drill` button, so Next duplicating it bought nothing. Fixed:
1. **Branch order is now progress-first**: drill-card exit → next unfinished lesson → coverage
   replay → drill (last resort) → next chapter. v66.1's guarantee is intact: no branch below the
   mark advances to the next chapter.
2. **Rounds are coverage-aware.** `buildStandardExercises` now ends in
   `assembleCoverageRound(_exs, 12, 1)` — the same assembler the mixed lesson uses, with the
   unsolved share made a parameter: mixed practice keeps its 0.7 blend, a standard round passes 1
   (a review slot is a wasted question when closing a gap). Measured convergence: **median 5 → 3
   rounds**, and no solved question is re-asked while unsolved ones remain.
3. **The universe stays exact.** Coverage-aware rounds would otherwise be sampled to derive the
   denominator, which could SHRINK it. `_lessonQidUniverse` now sets `APP._derivingUniverse` (on
   APP, not a module `let` — the unit harnesses extract functions individually and a bare
   identifier would ReferenceError), and builders return their FULL uncapped set while it is on.
   Bonus: derivation is now exact in one pass instead of relying on repeated random 12-slices to
   eventually surface every question — which could miss rare items outright.

Guards: `unit-coverage-threshold` §5c (branch precedence: next-lesson and replay both BEFORE the
drill CTA) and `unit-beginner-types` §5 (flag wiring, ratio parameter, and a behavioral replay
check on a fixture that deliberately builds more than one round's worth — a smaller fixture makes
"leads with unsolved" untestable, which cost one debug cycle).

**How to see it:** the reported chapter — finish a lesson below the mark; Next now says "next" and
replays only what you have NOT solved yet (the drill stays available as its own button). Two or
three rounds should carry you past 80% instead of looping through the drill.

### (b) Storyline page: no per-chapter provenance line
`savedItemHtml` gained an explicit `hideProv` flag, passed by the three `_renderChain` call sites —
the storyline SCREEN's chapter cards only. That page already carries one aggregate "by … · from …"
line at the bottom (v68.1), so repeating it per chapter was noise. The landing library keeps its
per-topic line (each row there is an independent topic with no aggregate anywhere).
**Parity bug caught while doing it:** the static build has a SEPARATE `savedItemHtml` alias
(`function savedItemHtml(s, connector) { return itemHtml(s, connector); }`) while the storyline
screen's `_renderChain` is INHERITED from index.html — so the 2-arg alias silently dropped
`hideProv` and static chapter cards kept the line the live build had dropped. The alias now
forwards every argument, and the guard asserts the opt-out is present in the BUILT
`docs/index.html`, not just the template.

---
**RELEASE: packaged as `v69_c`** (point release on v69). Suite 142 checks green; check-inline 0 on
both builds; static rebuilt (client + version). Contents beyond v69_b: two-case glyph spoken once;
beginner-mode exercise types; the third-stuck-report fix (progress-before-drill ordering,
coverage-aware rounds, exact universe derivation); storyline per-chapter provenance removed with
static-alias parity. Owed unchanged: translate-ui pass (57 en-only keys × 29 langs incl. the stale
`toast.no_voice` deletion — NOTE this session added NO new keys, so a run started earlier is still
valid), normal-use verification, native review of `latin.sounds.*`.

## 7. ✅ v69_d — translated `ui.json` adopted after a QC + repair pass

User supplied the completed translation run (all 30 languages, 522 keys, 0 missing — the long-owed
i18n debt is cleared) and asked for QC, flagging that German "Lernarc" is not a word.

The run was **complete but not clean**: **71 defects repaired** via a new, auditable
`tools/qc-ui-translations.js` (explicit fix tables; re-runnable on future runs). Full write-up in
`build_history/v69_ui_translation_qc.md`. Summary:
- **27 placeholder defects** — the model translated placeholder NAMES (`{word}`→`{woord}`,
  `{title}`→`{otsikko}`), so substitution would silently fail and users would see literal braces.
  Renames repaired positionally (translation preserved); drops/inventions repaired per key. The 4
  entries where placeholders are merely REORDERED were left alone — correct for those word orders.
- **15 corrupted entries** — cross-script bleed (`es form.arc_script_lbl` was entirely Chinese;
  Cyrillic spliced into Polish; Chinese in `ro`/`hu`) and model artifacts ("almart", "-Taught",
  "scribe_"); `hi` had 🔒 instead of 🔡.
- **29 leading-icon drifts** — the per-concept icon (🔡/🔢/🎭) had been swapped or dropped, so the
  same lesson type showed different icons per language. Variation-selector-only diffs ignored.
- **German** — "Lernarc" fixed to "Lernbogen pro Kapitel aufbauen"; plus a false friend that
  INVERTED a destructive option's meaning ("Lösungen" = solutions, where English says "deletes"),
  "Datei-Datei", the non-word "Inhaltsbleiben", untranslated "Cancel"/"Flag"/"Unflag", a wrong
  article, and terminology unified on "Markierung".

Verified after adoption: 0 remaining placeholder defects, 0 garbage tokens, `en` byte-identical,
`--check` clean, static rebuilt and the new German strings confirmed baked into `docs/index.html`.
**Left for a native speaker (reported, not auto-fixed):** German register split (22 formal *Sie* vs
22 informal *du*), untranslated leftovers (nl 30, lb 28, da 26, ro 24 — mostly legitimate loanwords
but with real misses), and two suspect Finnish/Hebrew phrasings.

## 8. ✅ v69_e — storyline lock coherence + two cheap follow-ups

### (a) The lock skipped a locked chapter (user screenshot, `sl_2123771959`)
The storyline showed a LOCKED chapter 3 sitting between reachable chapters 2 and 4, with the blue
progress bar apparently hopping over it. Cause: `_isLocked` inspected only the IMMEDIATE
predecessor. The user had added a mixed lesson to chapter 2 on 23 Jul (the single diff found when
their library was adopted), which made chapter 2 incomplete → chapter 3 locked; chapter 4 stayed
open because ITS predecessor (3) still carried all its done-flags. Fixed in two parts:
- **Transitive gate**: `chainBlocked` propagates "something earlier is unfinished" down both the
  linear and the branching recursion, so an untouched chapter can never be reachable behind a gap.
- **Never re-lock started work**: transitivity ALONE would have locked chapters 3 and 4 — chapters
  the learner had already played and was midway through. The gate exists to stop reading AHEAD, not
  to confiscate progress, so any chapter with a progress record stays open. Net effect on the
  reported screen: chapter 3's 🔒 clears (it is complete), chapter 4 keeps its progress, and a
  genuinely untouched chapter behind the gap stays locked.
Guarded in `unit-storyline-lock-hardening` with a behavioural replica of the reported storyline
(5 chapters: ch2 unfinished by a freshly added lesson, ch3 complete, ch4 partial, ch5 untouched).

### (b) Universe cache ignored the audio state — another stuck-below-threshold path
Self-reported follow-up from v69.2c, confirmed real. The buildable question set depends on audio
(v55_z drops `listen_*` without a voice or in dialect lessons; the v69.2 beginner policy drops
`listen_type` while muted), but the cache key was `topic|lessonIdx|teacher`. Since the cache is
MONOTONIC (it seeds from the prior Set so a denominator never shrinks), toggling 🔇 accumulated the
union of both states under one key — leaving questions in the denominator that can no longer be
BUILT and therefore never solved, capping coverage below 100% permanently. The key now includes an
audio component (`na` / `m` / `a`). Safe because coverage counts universe ∩ solved: solves made in
the other state simply aren't counted while it's inactive, and return when the learner switches
back. Guarded in `unit-beginner-types` §6 (key composition + three distinct states).

### (c) Dead `toast.no_voice` key removed (owed since v55_z)
Verified unreferenced in client, server, builder and tests, then deleted from all 30 languages.
521 keys remain; `--check` still reports complete.

### Deferred deliberately → roadmap
Reconciling the **two definitions of "chapter complete"** (lock/dot use lesson done-flags; the
completion card enforces coverage against the pass mark). This is the expensive one — the coverage
functions read `APP.lessonData`, so pricing other chapters means swapping that global and
re-deriving every universe on each storyline render. The roadmap now carries a cheap design:
persist the verdict (`APP.progress.chapterDone[topic]`) when `showComplete` finds a chapter at or
above the mark, and have the lock read that stamp with a done-flag fallback.

## 9. ✅ v69_f — translation QC becomes tooling + the static storyline-progress bug

### (a) `translate-ui.js`: hardened prompt, validated writes, and a `--qc` mode
The v69 run proved a prompt alone cannot prevent these defects — the OLD prompt already said
"preserve ALL {placeholder} tokens exactly as-is" and the model still shipped `{woord}`. So the fix
is verification, not persuasion. New `ui-qc.js` holds the checks and is shared by BOTH the writer
and the auditor, so a defect can neither be written nor survive an audit.
- **Prompt** now names each failure concretely (`{word}` → `{woord}` breaks the app and the user
  sees the literal text), pins the leading icon, forbids emitting another script, and lists the
  tokens to leave untranslated. Concreteness is the point: the old abstract rule was ignored.
- **Every generated value is validated before it is written.** Mechanically repairable defects
  (localised placeholder names → restored positionally; dropped/swapped leading icon) are fixed and
  kept; blocking defects (dropped/invented placeholder, foreign script, model artifact, empty) are
  REJECTED so the key stays missing. That is deliberate: **a missing key falls back to English and
  is usable; a broken placeholder renders as literal `{woord}` and cannot fall back to anything.**
  Rejected keys are reported and retried.
- **`--qc`** audits an existing ui.json against the English source — no backend needed, nothing
  written. **`--qc --fix`** applies only the safe repairs. **`--qc --retranslate`** deletes the
  unrepairable values and refills them through the normal translation path (same prompt, same
  validation). `--qc` deliberately runs even when nothing is missing — that is exactly the case
  where completeness reports "all complete" and the content is still wrong.
- Verified by injecting one of every defect class into a scratch copy: all five detected and
  correctly classified; `--fix` repaired exactly the two safe ones and left the three needing new
  text. The one-off `tools/qc-ui-translations.js` is retired (superseded).
- **One genuine defect found in the shipped file** that the earlier one-off scan had missed (it only
  checked Latin-script languages): `el storyboard.scheme_pastel` was `Παстеλ` — **Cyrillic с
  (U+0441) and е (U+0435) disguised inside Greek**, visually identical but breaking search and
  sorting. Fixed to `Παστέλ`. The file now audits clean: 0 blocking, 0 warnings.
Guarded by the new `unit-ui-qc` (7 sections incl. a standing assertion that the SHIPPED ui.json has
no blocking defects, so a future bad run cannot be released unnoticed).

### (b) Storyline progress read "0/4" in the static build (user screenshot)
The completion card's storyline row counts OTHER chapters from `ch.lessonCount` / `ch.lessonTypes` —
**list-projection fields that only the live API emits** (`server.js` builds them for
`/api/lessons`). The static build bakes whole topics: full `lessons` arrays, no projection fields.
So `cnt` was always 0, every chapter hit the `continue`, and the row showed `0/4` however much was
finished — visible only on the deployed static site, which is exactly where it was reported.
Fixed to prefer the real lessons when present, counted with the same `lessonCountsFor` rule the rest
of the app uses, falling back to the projection for the live list. A stale assertion that encoded
the wrong assumption ("the projection has no lessons[]") was updated, and a behavioural guard now
exercises BOTH topic shapes: baked (static) and projected (live) must both tally 3 of 4.

## 10. ✅ v69_g — error-hunt: "model returned identical story with no changes"

Reported while adding an error_hunt lesson to "Unwetter zieht weiter" (diff=3, qwen3.6:35b-a3b).
Two defects behind one message:

**(a) No retry.** Every other generator retries; `generateErrorHunt` made a SINGLE call and threw,
so one bad response failed the whole add-lesson. Now up to 3 attempts with **escalating, specific**
feedback — the rejection reason is fed back verbatim ("you returned the story completely
unchanged", "the text was rephrased", "only N word(s) were altered", "far more than the N
requested", "much shorter than the story"). A vague "try again" teaches the model nothing.
**Strategy also changes on the final attempt:** v68.1 set `think:false` because corrupting a story
is a verbatim rewrite and reasoning models otherwise burned the budget inside `<think>` and timed
out — but a reasoning model with thinking OFF sometimes just echoes the input, which is exactly the
reported failure. So: fast path twice, then let it reason (the timeout is already widened either
way). Tokens accumulate across attempts (retries cost real money), and the final error is
actionable rather than merely descriptive.

**(b) Validation too weak — the more interesting half.** The only checks were "not empty" and "not
byte-identical", so a model that changed ONE word, or rephrased the whole text, produced an
UNPLAYABLE lesson that passed silently. The client pairs tokens BY POSITION, and the prompt already
demands "copy all other text EXACTLY" — so the corrupted story must keep the same word count and
differ in a sane number of single words. New `errorHuntChanges()` checks exactly that; the accepted
band is `[max(2, wanted/2), wanted*2+2]` — models rarely hit the requested count exactly and a
slightly light lesson is still good, but a rewrite is not. `errorHuntCounts()` is now the single
source for how many errors are requested, shared by the prompt builder and the validator so they
cannot police different numbers.

**Test-quality finding:** the fake backend had NO error-hunt branch — the request fell through to
the vocab default and returned JSON, which the old validation stored as the corrupted story. The
e2e had been passing on a broken lesson. The fake now does what the prompt asks (same story, single
words altered in place), and an end-to-end probe confirms the result is playable: word-aligned,
7 words corrupted at difficulty 3, exactly the number requested. Guarded by the new
`unit-error-hunt-validation` plus an updated assertion in `unit-reasoning-model-safety` documenting
the adaptive think flag.

## 11. ✅ v69_h — rounds weighted to material the learner does NOT know

User: "reaching the threshold gets slower and slower, since we get offered the same questions over
and over again. Is it easy to generate vocab lessons with e.g. only 15% of vocab the learner already
knows? This can include the complete recorded learner history, but should at least include the
vocab … of this lesson that was already successfully played."

**It was easy, because the data already existed.** `_learnedLedger(lang, srcLang)` has kept a
whole-history, CROSS-TOPIC record per word since v57: `{ source, seen, wrong }`, with `wrong` walked
back down by drills. So both signals the user asked for were already persisted — the per-question
solved map (this lesson, the minimum they asked for) and the per-word ledger (the full history they
hoped for). Only the round composition had to change.

`assembleCoverageRound` now sorts the pool into THREE tiers instead of two:
1. **unsolved here + word not in the ledger** — genuinely new, fills the round;
2. **unsolved here + word the ledger calls known** — still needed for coverage, spent after tier 1;
3. **already solved here** — review, limited by the caller's ratio.
A standard lesson now asks for `1 - FAMILIAR_SHARE` (0.85), so ~15% of a round is familiar material
and the rest is new — literally the requested mix. "Known" is deliberately conservative: `seen >= 2`
AND no outstanding `wrong`, so a word met once does not count, and a word still being missed keeps
coming back.

**The trap avoided:** known words are ORDERED LAST, never EXCLUDED. The pass mark is a fraction of
the lesson's whole question universe, so dropping known words from rounds would leave those
questions permanently unsolved and strand coverage below the threshold forever. The existing
backfill keeps every round full, and a lesson whose words are all known stays fully playable
(asserted).

Measured on the reported 29-question lesson (perfect play, to 80%): **median 4 rounds**, against 5
for the pre-v69_c random-12 round. Reserving the 15% review costs about one round versus a pure
new-material round (median 3) — a deliberate trade for spaced repetition, and a single constant
(`FAMILIAR_SHARE`) if it should be tuned.

Guarded by the new `unit-round-composition` (ledger semantics incl. the drill-decayed case; tier
order; round stays full; the all-known lesson; one named constant; typeof-guarded deps). Both new
dependencies are typeof-guarded because the unit harnesses extract these functions individually —
the same fragility that bit `_derivingUniverse` in v69.2c.

**Note for the user:** the "same questions over and over" symptom should ALREADY be gone in v69_c
(rounds became unsolved-first there). If the deployed static site still repeats questions, it is
running a build older than v69_c — `node build-static.js` + redeploy `docs/`.

## 12. ✅ v69_i — question wording, highlighted {word}, and per-storyline / per-chapter pass marks

### (a) The source→target question no longer names the target language
`ex.mcq_source_target.q_nolang` became the canonical `ex.mcq_source_target.q` in all 30 languages
and the old lang-bearing variant was deleted; the client dropped its dialect branch for the
question (one string for every case now). The BADGE keeps its `_nolang` variant — naming the
language is right there, above the question, next to the flag→flag direction.

### (b) The asked-about word is highlighted instead of quoted
Every question string carried its own quote characters, and each language used different ones
(`""`, `«»`, `„“`, `‘’`, `「」`). The quotes are gone from ui.json — **142 entries stripped across
30 languages** — and the client now wraps the substituted value in `qWord()` → `.q-word`
(bold, coloured, underlined). Applied at all 8 question call sites (article, plural, type-plural,
both synonyms, glyph-order, target→source ×2, source→target). Emphasis is presentational and
identical in every language, and RTL/CJK strings no longer carry stray Latin quotes.
`unit-attr-escaping` caught a real bug in this work — `escHtml` used inside a double-quoted
attribute — before it shipped.

### (c) Pass mark per storyline, overridable per chapter
Resolution is now **chapter → its storyline → global default**, with the default moved from 1
("solve everything") to **80%** as requested, in BOTH the server and the client fallback so the two
cannot disagree about what "unset" means. `d.coverageTarget` already existed, so only the storyline
level and the UI were new.
- **One route, both scopes**: `POST /api/pass-mark {scope:'storyline'|'topic', id, value}`. A single
  handler so the validation and the clearing semantics cannot drift between two near-identical ones.
- **`value:null` clears** the override by DELETING the field — deliberately not the same as `0`,
  which is a real setting meaning "no pass mark, anything completes". Both cases are asserted.
  Out-of-range values clamp rather than error (a typo should not 400).
- **One control, two mount points**: `#sl-passmark` on the storyline screen and `#ls-passmark` on
  the lesson-set page ABOVE the lesson chain (asserted by document order). Teacher-only. It shows
  the EFFECTIVE mark plus an "inherited" label, so a teacher can see at a glance whether the level
  is overriding or inheriting, and a ✕ appears only when there is an override to clear.
- Storyline marks apply to **that storyline only** — asserted that setting one does not write onto
  its chapters. Static needs nothing new: both fields ride along in the baked topics/storylines.

**i18n debt (small, new):** 2 English keys added (`passmark.inherited`, `passmark.clear`) → 58
missing across 29 languages; they fall back to English until the next `translate-ui.js` run.
Guards: `e2e-pass-mark` (client wiring + full route behaviour) and an extended precedence section in
`unit-coverage-threshold` (chapter > storyline > global > 80%, inherit-vs-zero, a storyline without
a mark not shadowing the global one).

## 13. ✅ v69_j — "sl is not defined" on every storyline open (regression from v69_i)

The v69_i storyline pass-mark block referenced `sl`, which in `_renderStorylineScreen` exists ONLY
as the arrow parameter of `_slArr2.find(sl => sl.id === chainId)` — the storyline object there is
`_slById` (a find(), despite the name). Every storyline open threw before rendering. Fixed to use
`_slById`, plus a null guard: it is undefined when the chain id no longer resolves.

**Why the test suite missed it, and what changed.** The v69_i guard asserted
`/passMarkRowHtml\('storyline', sl\.id,/` — which matched the source text happily while the
identifier was undefined at RUNTIME. That is the same blind spot that let the v68.1 TDZ crash
through: a regex over source cannot see scope. `e2e-pass-mark` now guards the CLASS, not the
instance: for each call site it resolves the identifier actually passed and proves it is declared
(`const`/`let`/`var`) or is a parameter of the ENCLOSING function. Verified both ways — restoring
the original bug makes the suite red, and an independent check confirmed the generic guard (not
just the literal assertion) is what catches an undeclared identifier.

**Standing lesson for this codebase:** structural assertions are cheap and catch drift, but they
prove nothing about scope or execution order. Anything that touches a render path wants either a
behavioural harness or, at minimum, a declared-identifier check like this one.

## 14. ✅ v69_k — render smoke harness (the gap that let two crashes reach the user)

### Files adopted first
- **`ui.json`** — the user's translation run on the NEW tooling: 522 keys × 30 languages, `--check`
  clean, and `--qc` reports **0 errors, 0 warnings**, against **71 defects** on the previous
  pre-tooling run. Diff vs the shipped file: exactly 58 entries (the 2 new keys × 29 languages),
  `en` byte-identical — no drift anywhere else. The hardened prompt + write-time validation worked
  on first contact.
- **`lessons.json`** — 278 topics, 0 duplicate/missing lesson ids, 0 provenance or flag-mode gaps;
  booting the server against it changed **nothing** (already healed). Four topics differ from the
  shipped copy: new lessons the user added while testing (incl. a `mixed` lesson on "Unwetter zieht
  weiter"). Note: that chapter still has no `error_hunt` lesson, so the v69_g retry work has not yet
  been exercised against a real model.

### The harness
Two runtime errors reached the user through a fully green suite — the v68.1 TDZ crash in
`showComplete` and v69_i's "sl is not defined" in `_renderStorylineScreen`. Both were in render
paths; both passed every source-level assertion, because **a regex over source cannot see scope or
execution order**. The only thing that finds that class is executing the code.

`test/lib-dom.js` is a zero-dependency DOM stub (~150 lines) plus a loader that evaluates the whole
640 KB client engine in a `node:vm` context — the trailing `init();` is the ONLY thing stripped,
since it is async and network-bound; every function and top-level statement runs as shipped.
Because a vm context shares its top-level lexical scope across `runInContext` calls, test code can
reach the client's `const APP` and call its functions directly. Elements are auto-vivified: a null
from `getElementById` would hide errors behind `if (el)` guards, which is the opposite of the point.

`test/smoke-render.test.js` drives four entry points with fixtures built from the **shipped
corpus** (a real multi-chapter storyline, real lessons): `buildPath` (learner + teacher),
`_renderStorylineScreen` (real chain, teacher, and an unresolvable id), `showComplete` (fresh,
review, below-pass-mark, drill card, teacher) and `renderEx` across every exercise type the fixture
yields (6: mcq_source_target, listen_type, listen_mcq, read_translate, word_form, syn_select) plus
the muted branch. It asserts that output was produced and that nothing threw — deliberately NOT what
the markup looks like, which would freeze the design.

**Verified against both historical bugs rather than assumed:** reintroducing the v69_i identifier
error fails with `sl is not defined`; reintroducing the v68.1 declaration order fails with
`Cannot access '_belowThreshold' before initialization` — and `check-inline` passes on that same
file, exactly as it did when the bug originally shipped. Suite: **147 checks**.

**Known limits (honest scope):** no layout, no styling, no event dispatch, no real parsing of
assigned `innerHTML`. It catches crashes, undefined references, TDZ violations and bad property
access on render — not visual regressions, and not anything that only manifests after a user
gesture. Browser testing is still required for those.

## 15. ✅ v69_l — one definition of "chapter complete" (roadmap item)

The app had two, and they disagreed:
- **`setComplete()`** — every counted lesson played AND coverage at or above the pass mark. The
  honest rule, but authoritative only for the ACTIVE topic, because coverage reads live state
  (`_lessonQidUniverse` walks `APP.lessonData`).
- **"all lessons carry a done-flag"** — what the storyline lock, the green dot and the completion
  card's story-progress row used for every OTHER chapter.

So a chapter could unlock its successor, show a green dot and count toward the storyline total
while its own completion card still said "keep going" — precisely the reported case: three lessons
flagged done in `tp_…250`, coverage 10/34, pass mark 80%.

**Why the obvious fix was rejected:** recomputing coverage for other chapters means swapping
`APP.lessonData` and re-deriving every question universe on each storyline render (~16 builder calls
per lesson × every lesson in the deck). Instead the verdict is **persisted when computable and read
back when not** — the design sketched in the roadmap.

- `setComplete` became a thin wrapper that records its verdict for the active topic on EVERY exit
  (a wrapper rather than a call at each `return`, so a future edit cannot miss one); the rule itself
  is untouched in `_setCompleteRaw`. The recorder is typeof-guarded so harnesses can extract the
  rule without stubbing persistence, and it writes only when the verdict CHANGES — `setComplete`
  runs inside render paths.
- `chapterComplete(t)` is the single reader: live rule for the active topic → fresh stamp →
  done-flag fallback. All three consumers now call it.
- **Staleness matters more than freshness here.** The stamp stores `n`, the counted-lesson count it
  was valid for. Add or remove a lesson — exactly what the user did to "Verwüstete
  Agrarlandschaften" — and the stamp is ignored, falling back to flags rather than claiming a
  chapter is finished when it grew. Asserted directly.
- The fallback can only ever be MORE permissive than the truth, never less, so no learner loses
  access to something they had.
- Works in the static build unchanged: progress is client-side, so no server or bake changes.

**Verified against the real library**, not just fixtures: loading the user's `lessons.json` in the
smoke sandbox, "Die wissenschaftliche Erklärung" with all lessons flagged done reads complete under
the old rule and NOT complete once the card records the honest below-the-mark verdict — so the
following chapter stays locked instead of being unlocked by flags alone.

Suite: **148 checks**.

## 16. ✅ v69_m — PDF cleanup stage 2: the model pass (completes the v68 item)

Stage 1 (`cleanExtractedText`, v68.1) fixes what code can fix reliably. What survives it is text
that READS like prose but is not part of the article — the inline real-estate advertisement in the
user's Corriere example, "read also" teasers, photo captions, subscription prompts. No mechanical
rule can classify those, so the model is asked.

**The design point is the contract, not the prompt.** The pass is DELETION ONLY, and the server
verifies it instead of trusting the instruction: `cleanTextChanges()` checks the returned text is a
word-level SUBSEQUENCE of the input. That single check rejects rewriting, rewording, translating
and reordering at once — much stronger than a length ratio, and cheap. A floor (keep ≥ 40% of the
words) catches the other failure: summarising, or mistaking the article itself for furniture.
Rejections are fed back in words the model can act on, over up to 3 attempts, with `think:false`
first and reasoning as a last resort — the same shape as the v69_g error-hunt fix, for the same
reason: **a prompt cannot guarantee a contract; verification can.**

Client: an opt-in **✨** button beside the 🧹 toggle. It runs **per chunk** (each request stays
lesson-sized, and one failure cannot lose the rest — failures are counted and reported, not fatal),
keeps the pre-pass chunk texts so the whole thing is **undoable**, and is hidden when there is no
backend, so it never appears in the static build.

Verified end to end against a fixture carrying an advert, a teaser and a caption: all three
removed, both article sentences kept verbatim, the result confirmed to be a true subsequence of the
input, and the pass provenance-stamped (`type: 'text_cleanup'`) like every other generation. The
fake backend gained a matching branch — deletion-only, so a fake that "helpfully" reworded anything
would be rejected by the real verifier.

**i18n debt:** 3 new English keys (`pdf.aiclean_lbl`, `pdf.aiclean_done`, `pdf.aiclean_partial`) →
87 missing across 29 languages, together with v69_i's two. One `translate-ui.js` run clears them;
they fall back to English meanwhile.

## 17. ✅ v69_n — teacher dashboard: overview + flag triage

Scoped with the user (aspirational for now — accounts are not yet in use — but built so it is there
when they are). Teacher-only screen reached from the library header; hidden without a backend,
because learner accounts and the flag store are both server-side and an empty screen in the static
build would be worse than no button.

**Panel 1 — who is learning.** Reads `GET /api/learners` (shipped v65, rendered nowhere until now):
per learner, chapters finished, chapters started, words known, last seen, and their hardest words
with wrong-counts.

**Panel 2 — what has been reported.** New `GET /api/flag-summary`. Item-level flags live INSIDE
lessons (`item.userFlag`), lesson notes in `_miscFlags`, and story-level flags in the flags store —
three places, so a teacher had nowhere to see what had actually been reported. The endpoint unifies
all three, newest first, and carries enough context (topicId, lessonId, field, index) to open the
item in the existing editor. **Student reports lead the list**: a learner flagging a wrong pair is
the QC signal most worth acting on, and v69 made that mode distinction available.

**The bug fixed along the way.** `summarize()` computed
`chaptersCompleted = Object.keys(progress.completed).length` — chapters TOUCHED, not completed. A
learner who opened ten chapters and finished none reported "10". Honest counting was not really
possible before v69_l; now it is. The summary prefers the persisted per-chapter verdict, falls back
to "every lesson flagged done" when the shared library is passed in (the route now passes it), and
**claims nothing when completion is unknowable** rather than guessing. Both numbers are reported
under honest names, since "started" was useful — only mislabelled. The old `unit-learners`
assertion encoded the bug (`chaptersCompleted === 2` for two merely-opened chapters) and was
rewritten to document the fix, with new cases for the library fallback and the stamped verdict.

Guards: `e2e-teacher-dashboard` (client wiring + both endpoints against a seeded library carrying a
student item flag, a teacher flag and a story flag; ordering and editor context asserted) and a new
section in `smoke-render` that actually RENDERS both panels — populated and empty — since the two
runtime crashes this project has shipped were both in render paths.

**i18n debt:** 11 new English keys (`teacher.*`) on top of the earlier ones → **406 missing across
29 languages**. One `translate-ui.js` run clears them; they fall back to English meanwhile.

## 18. ✅ v69_o — text cleanup, corrected by its first real run

User ran v69_m on a real PDF (4 chunks). Three cleaned well — 10, 17 and 3 words dropped. The
fourth failed twice ("kept 64 of 197", then 62) and then appeared to hang. Two distinct faults, one
of them a design error of mine:

**(a) The "hang" was a 36-minute call.** Attempt 3 enabled reasoning (`think:true`) with
`THINK_TIMEOUT_MULT`, i.e. base 12 min × 3, on a 200-word chunk. That escalation was copied from
the error-hunt generator without re-examining it, and it is wrong here: this contract is verbatim
copying minus deletions, which reasoning does not help with, and the observed failure was
OVER-deletion, which reasoning does not address either. Every attempt is now `think:false` with the
plain request timeout — output length is bounded by input length for this task.

**(b) The 40% floor was wrong as a hard reject.** It assumed every chunk is mostly article. A chunk
can legitimately BE mostly furniture — a related-links block, a teaser farm, a footer — and two
attempts independently agreeing on ~32% retention is evidence the model is RIGHT, not that it
misbehaved. The floor is now a WARNING: a heavy-but-structurally-valid answer is remembered, used
if nothing better arrives, and returned `heavy: true` with a note. The client applies it, counts it
and says so ("N heavily cut — check them"); the pass is undoable, so the human makes the final call.
The subsequence check remains a HARD reject — that is the real contract.

**(c) A run must never stall.** If nothing usable arrives (typically a model that rewrites rather
than deletes), the text is returned UNCHANGED with `unchanged: true` and the reason, instead of
throwing — so the remaining chunks still get processed. Reported as "N left unchanged".

Both failure modes are now permanent guards, driven through the real server via a
`FAKE_CLEAN_MODE` switch in the fake backend (`overdelete` / `rewrite`) rather than asserted from
source. Two test-authoring notes: `boot()` binds a pid-derived port, so the first server must be
stopped before the failure-mode servers start (the first version silently talked to the wrong
backend and looked like a code bug); and an over-broad assertion again matched my own explanatory
comment — scoped to actual usage, the same lesson as the `q_nolang` case.

**i18n:** 2 more English keys (`pdf.aiclean_heavy`, `pdf.aiclean_untouched`).

## 19. ✅ v69_p — cleanup reporting + cleanup tokens on the storyline

Three user requests, all about being able to SEE what the cleanup did.

**(a) Deterministic pass reports its work.** `cleanExtractedText` now records stats
(`_lastCleanStats`, a side channel so the return type stays a plain string for its several callers)
and `_applyUploadCleanup` logs a summary: words in → out, wrapped lines rejoined, junk lines
removed, unpunctuated fragments removed, and whether it also ran per page. Turning the toggle OFF
is logged too. Verified against the real Corriere sample: 3 junk lines, 2 wraps rejoined, 2
fragments dropped, 30 → 22 words.

**(b) The model pass announces itself up front, with the model name.** The old log only appeared
once a chunk had FINISHED, so a slow pass looked like nothing happening — which is exactly how the
36-minute stall in v69_o presented. The server now prints `[model] Cleaning text (N words, Lang)…`
before the first call; the client prints a run header, one line per chunk as it lands (kept/total,
HEAVY or unchanged, tokens), and a closing summary.

**(c) Cleanup tokens are booked to the storyline.** The ✨ pass is spent BEFORE any storyline
exists — it runs on the upload panel's chunks — so the spend used to vanish from the ledger. The
endpoint now returns its `tokens`; the client accumulates them across chunks and sends them with the
book job; the server sanitises the client-supplied figure (it is only ever added to a ledger, but
it is still client input) and books it via `addTokenUsage(sl, …, 'cleanup')` in the same place the
storyboard post-pass resolves the storyline. Undoing the pass clears the pending charge — the
tokens were really spent, but the text they produced was discarded, so charging the storyline for
it would be wrong; the discarded spend is logged rather than silently dropped.

Guards: structural (all three) plus a BEHAVIOURAL check that a book job carrying
`cleanupTokens: {1234, 567}` ends with `tokensByType.cleanup === 1801` on the storyline. One
test-brittleness fix along the way: `unit-storyboard` sliced a fixed 1600 characters from the
post-pass anchor, and this change pushed the delegation past it — now sliced to the end of the
block instead.

## 20. ✅ v69_q — same-title book chapters no longer overwrite each other

The v69 diagnosis (session note above / roadmap) named the upsert name-dedup window; the fix
required going one layer deeper and turned up a latent scope bug.

**Real root cause — the EARLY save.** `generate()` upserts the story before lessons exist (so a
crash mid-generation never loses it). That early upsert had NO id, so it deduped by
name+lang+srcLang. Two chapters in one book sharing a headline merged HERE, before
`_persistGenerated` (the place the diagnosis pointed at) ever ran. Fix: mint `_genTopicId` at the
early save and thread it through `generate()`'s return so the final lesson-bearing save updates the
same row. Reuse an existing row's id only when title AND `continuedFromId` match — so a genuine
regenerate still updates in place (verified: regenerating one topic twice → 1 row), but two
same-titled siblings (different parents) stay distinct.

**Chaining by id, not name.** `_persistGenerated` now takes the parent's id explicitly (the book
loop had it in `parent.id` but was passing `parent.topic`), and records `continuedFromId`. This is
what stops the survivor of a (now-prevented) merge from chaining to itself.

**Latent scope bug surfaced.** `_newTopicId` was defined at depth 1 — nested inside `boot()`, which
in this file encloses nearly everything and is called once at startup. Every existing caller was
also boot-nested, so it worked by accident. `generate()` is at module scope (depth 0, outside
boot), so its new call to `_newTopicId` threw "ReferenceError: not defined". Chased it via a real
brace-depth scan after source-level reasoning misled me twice (an unrelated brace imbalance, then
the wrong assumption that a top-level `function` must hoist — it only hoists within its OWN scope).
Moved `_newTopicId` + `_idCounter` to true module scope. This removes the hazard for any future
module-scope caller, not just this one.

Guard: `e2e-book-duplicate-titles` — structural (id minted pre-upsert, parent linked by id, minter
at module scope) + behavioural (3 chapters with 2 sharing a title → 3 distinct topics, storyline
lists all 3, nothing chained to itself). Verified it FAILS without the fix (5 topics) and that a
single-topic regenerate still updates in place. 150 checks green.

## 21. ✅ v69_r — two UI fixes: empty "Learners" page, and pass-mark placement

### (a) Clicking "Learners" opened an empty page
Could not reproduce from code alone — markup, CSS, endpoints and both renderers were all correct
(the empty state renders 540 chars). So rather than ship a guess, the open path was made
FAIL-VISIBLE: it can no longer present blank. Changes to `openTeacherDashboard`:
- If reached without a backend (`!APP.info.canGenerate`) it shows an explanatory notice
  (`teacher.no_backend`) instead of the previous silent `if(!_canEdit()) return;` — which, if it
  ever ran AFTER show(), would leave the switched-to screen empty.
- The two endpoints are fetched INDEPENDENTLY (not `Promise.all`), so one failing no longer falls
  through to a bare error that blanks both panels; each panel renders with its own empty state and
  any error is APPENDED, not substituted.
Guard: `smoke-render` now opens the dashboard with `canGenerate:false` and asserts the body is
non-empty and mentions the backend.

### (b) Pass mark: two on the storyline page, none on the lesson-set page
Root cause: `#ls-passmark` had been inserted INSIDE the lesson-set header's progress-bar wrapper
(between the bar div and its close), so on the lesson-set page it rendered in the header / got
visually lost ("none locally"), and the misplacement is what made the storyline page look like it
carried an extra control. Fix: moved `#ls-passmark` to the BOTTOM of the lesson-set screen, directly
above `#prov-stats` — the exact mirror of where `#sl-passmark` sits on the storyline screen (just
above `#sl-screen-prov`), per the user's "bottom position for both". Verified in the smoke sandbox:
exactly ONE control per page (`pm-input-topic` ×1, `pm-input-storyline` ×1). Guards in
`e2e-pass-mark`: one slot of each id, chapter control BELOW the chain and above the provenance
stats, storyline control above its provenance stats.

**i18n:** 1 new key (`teacher.no_backend`).

## 22. ✅ v69_s — the REAL pass-mark duplicate, and dashboard diagnostics

v69_r fixed the wrong thing for the "two controls" report. The user confirmed on v69_r: lesson-set
control now correct, but the storyline page STILL showed a pass mark in the header AND at the bottom.

**Root cause I had missed: a SECOND, older control.** `#sl-threshold-row` (v65.1) sets the GLOBAL
default via `/api/coverage-threshold` and lives in the storyline HEADER, shown in teacher mode. My
v69_i `#sl-passmark` (per-storyline, bottom) was built as a parallel control without removing the
v65.1 one — so the storyline page carried BOTH. v69_r's placement work never touched the header row
because I only ever looked at `#sl-passmark`. Fix: removed the header row markup and neutralised
`_refreshSlThreshold` to a no-op (single call site kept). The `/api/coverage-threshold` endpoint is
RETAINED — it sets the global default, which is the fallback of the chapter→storyline→global
hierarchy; only its on-storyline UI is gone (a global setting does not belong on one storyline's
page). `unit-coverage-threshold` updated: asserts the old row is gone, one `#sl-passmark` remains,
and the endpoint is retained.

**Empty learner page — still could not reproduce; added instrumentation.** Every code path (incl.
failing/ rejected fetch, no backend) provably fills the body — verified again in the smoke sandbox
(654 chars even on a rejected fetch). So on the user's live v69_r the render must be aborting from
OUTSIDE the function, or a mid-load exception (the concurrent `ui.json` translate run rewriting the
file mid-read is a live suspect — the console showed repeated "ui.json reloaded"). Made the open
path log (`[teacher] opening…` / `rendered: N learners, M flags` / explicit error) and wrapped the
render in a try/catch that writes the error INTO the body (`teacher.render_error`). Next time it is
empty, the console + on-screen message will name the cause. This is diagnosis-enabling, not a claimed
fix — stated as such.

**i18n:** +1 key (`teacher.render_error`).

## 23. v69_s2 — dashboard visibility diagnostic (empty page persists)

User on v69_s: console shows `[teacher] opening dashboard…` then `[teacher] rendered: 1 learner(s),
40 flag(s)` — so the render SUCCEEDS and content is in #td-body — but the page is still blank. That
rules out every logic/fetch cause and points to the SCREEN element being hidden or zero-size despite
show() adding .active.

Exhaustively ruled out from source this session:
- DOM parentage: #teacher-screen is a true sibling of #storyline-screen and #lesson-set, all
  body-children (confirmed three ways after stripping <script> content, which had polluted earlier
  regex counts). The −1 depth between lesson-set and storyline-screen is just lesson-set's internal
  `.ls-inner` wrapper, not a parentage difference.
- CSS: `.screen{display:none}` / `.screen.active{display:flex}` — no wrapper dependency, no height
  trap. #teacher-screen carries class="screen" and gets .active (verified in the smoke harness;
  landing's .active is correctly removed).
- Render: produces content even on rejected fetch / no backend (654 chars).

Since nothing static explains it, added a computed-visibility probe to openTeacherDashboard that
logs, after show(): hasActive, display, visibility, opacity, width, height, parent id, and the list
of `.screen.active` ids. The next click will report the ACTUAL browser state and pin the cause
(leading candidates: a cached old stylesheet overriding .screen.active, a second active screen
stacking over it, or a zero-height layout). This is a diagnostic build — NOT a claimed fix.

## 24. ✅ v69_t — empty learner page FIXED (screen was nested in another screen) + latest translations

The v69_s2 computed-visibility probe settled it in one click:
`{hasActive:true, display:'flex', visibility:'visible', width:0, height:0, parent:'storyline-screen'}`.
The dashboard content rendered fine (`rendered: 1 learner, 40 flags`) but its SCREEN was a CHILD of
`#storyline-screen`, which is an inactive `.screen` (display:none) — so the child collapsed to 0×0
even with `.active`. `parent: "storyline-screen"` was the proof my source analysis had missed.

Root cause: `#storyline-screen` was missing its closing `</div>` (a PRE-EXISTING bug — it only
"worked" because it was the last screen and the browser auto-closed it at `</body>`). When
`#teacher-screen` was added after it in v69_n, it was absorbed as a child. Fix: added the missing
`</div>` so storyline-screen closes at its own end (line 1217) and teacher-screen is a true
body-level sibling. Verified by bracket-matching the script-stripped HTML and by the browser symptom
description; removed the diagnostic probe.

**Why it took so long to see:** every regex/brace scan of the raw file was fooled by `</div>` and
`<div` appearing inside the 640 KB inline `<script>` (JS strings, template literals). The lesson —
recorded before — is that structural scans MUST strip scripts first. The new guard does exactly
that.

**Guard:** `unit-screen-structure` parses index.html and docs/index.html with scripts removed and
asserts no `.screen` is nested inside another `.screen` (which can only display when its parent is
also active — always a bug). Verified it FAILS on the pre-fix markup (`#teacher-screen is inside
#storyline-screen`) and passes after. This would have caught the bug the instant the dashboard
screen was first added.

**Translations:** adopted the user's latest `ui.json` (30 langs, 539 en keys). `en` differs from
the tree only by `teacher.render_error`, which I added AFTER their export — re-added it (English
fallback). QC: the only 29 "errors" are that single key missing in the 29 non-English languages;
zero structural defects, zero broken placeholders, zero cross-script corruption. One
`translate-ui.js` run clears the remaining key.
