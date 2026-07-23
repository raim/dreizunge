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
