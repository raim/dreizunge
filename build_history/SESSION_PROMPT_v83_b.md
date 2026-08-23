# Session prompt — written at the `v83_b` cut

*(Rename this file for the version the session WRAPS UP WITH. `SESSION_PROMPT_v83_a.md` was the
previous one — superseded by this file and renamed, not kept alongside. Keep using the double-
letter suffix scheme (`v83_c`, `v83_d`, …) unless a future session has a good reason to switch to
`v84_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Fresh session picking up from the **`v83_b`** release —
`PLAN §12` (the interactive text-selection tutor) built end to end, the reason the `v83_a` cut was
made.

**`v83_a`, in brief**: a new BASE LINE, cut from `v82` at the user's own request rather than at a
milestone, to hand off `PLAN §12` to a clean-context session. No code changed at that cut — only
`roadmap_v83.md`, `INTERNALS.md`, and the session prompt were written.

**`v83_b`, in brief** (full write-up in `roadmap_v83.md`'s `# SHIPPED IN THE v83 LINE`): `PLAN §12`
shipped whole, in one release. The plan's own text flagged one real ruling needed before the request
payload could even be designed — reply in `APP.uiLang` for the new flow only, or move the WHOLE tutor
off `srcLang`? Asked the user directly; the answer was **the whole tutor**. Wired ADDITIVELY, not as
a rename — `srcLang` still drives `tutorRetrieveContext`'s content-pairing filter and the client's
ledger lookup, genuinely different jobs from the reply-language `S` variable, which now reads
`APP.uiLang` with a `srcLang` fallback for an old cached client. **Live-verified against a real model,
not just asserted from the prompt text**: a throwaway server on a spare port (the OTHER session's own
already-running dev server was left untouched — rule 8) confirmed a reply requested with
`srcLang:'en'`/`uiLang:'fr'` came back entirely in French. The new mechanism itself — a second,
independent free-text-selection popover ("grammar"/"meaning") coexisting with the existing per-word
tap over the same `_storyBodyHtml` container — reuses the tutor's existing single-thread conversation
path entirely; no new `/api/tutor` payload shape was needed beyond the `uiLang` field above. One real
DOM-shape gotcha was measured and fixed: furigana readings (`<ruby>base<rt>reading</rt></ruby>`) sit
in the DOM as ordinary text, so a raw `selection.toString()` would fold the READING into a selected
segment — stripped before use. **The throughline worth carrying forward again**: this is the THIRD
release running (`v82_e`, `v82_i`, now `v83_b`) where a live generation against the real model — not
source-reading, not a plausible design — was what actually confirmed the feature works. Keep
budgeting for it.

## Orient yourself

1. **This file**, whole.
2. `build_history/roadmap_v83.md` — its **index table** and the **⚠️ Session protocol** block first,
   then the standing RULES, then `# SHIPPED IN THE v83 LINE` for how `PLAN §12` was actually built.
   (Nothing is in TRACK T right now — steps 1–4 and `§T7` all shipped in the v81 line.)
3. `INTERNALS.md` — constants, silent-failure modes, invariants, harness limits. **§6b is a
   feature → function map** — read it BEFORE grepping for where anything lives.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 252 checks
node test/run.js --quick                  → expect 225
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Corpus at this cut: **327 topics, 92 storylines, 33 languages, 655 `en` keys** (topics/storylines/
languages unchanged from `v83_a`; `en` keys grew by 4 — `tutor.sel_grammar`, `tutor.sel_meaning`,
`tutor.sel_grammar_q`, `tutor.sel_meaning_q` — for the new selection popover, not yet translated into
the other 32 languages, which fall back to English on those four keys until the offline translate
pass catches up).
`APP_VERSION = 'v83_b'`.

> **These four expectations and the four corpus numbers are GUARDED** by `unit-roadmap-version`
> against the actual suite and against the data files. **If that test fails, the number in THIS file
> is the thing to fix.**

- `unit-static-freshness` red → `node build-static.js`. **Read what it NAMES first.**
- `unit-script-choice` red saying topics are unstamped → `node backfill-script.js --write`.
- **Order matters: backfill FIRST, build-static SECOND.** A fixer is not a diagnosis (rule 23).

## The habits that cost this project the most

*(Full incident history for each numbered rule lives in `roadmap_v82.md`'s "Rules earned in session
N" blocks — this is the short form, not a replacement for reading those before citing one.)*

1. **Measure before editing.** A warning in the notes is a claim about a DESIGN, not about the
   problem (rule 35).
2. **Guard at the layer where the claim is observable** (rule 34). A guard that pins SOURCE TEXT for
   a claim about BEHAVIOUR cannot fail — cost multiple releases across the v80/v81 lines. Render and
   inspect, then **MUTATION-TEST**: break the rule and check the guard goes red.
3. **For any refactor claiming to preserve behaviour, CAPTURE the old output and DIFF it.** "The
   tests still pass" is a weaker claim — a whole suite has been green with a real contamination bug
   in place before, found only by diffing real data.
4. **`buildExercises` is NON-DETERMINISTIC IN CONTENT, not just order** (`v80_t`). Any test that
   samples the corpus must accumulate across builds and be verified over ~15 consecutive runs — and
   accumulating across builds is NOT the same precondition as co-occurring in ONE build. When a
   section needs the run to contain something specific, STEER it there rather than sampling and
   hoping. Run the suite in the staged release directory too, not only the working tree.
5. **A zero-callers finding is not by itself permission to delete** (`v81_q`). Check for a standing
   warning before assuming a measurement is the whole story; ask the user if the two disagree.
6. **Never put emoji in a Python string literal** (rule 25); write them via a `cat` heredoc. And
   check what a mechanical rewrite DID, not just that it ran.
7. **A live model call needs a live test, not a plausible prompt** (`v82_e`, `v82_i`, `v83_b`). The
   first reasonable-looking design was wrong twice already in the `v82` line; `v83_b` is the first
   release where it was RIGHT on the first try, but was still verified live rather than trusted.
8. **Ask before restarting a dev server you did not start, and before deleting data you did not
   create** (`v82_e`, `v82_f`). Check `lessons.json`'s mtime and the server's reported version
   before touching either. `v83_b` needed a live generation and solved it by starting a THROWAWAY
   server on a spare port instead of touching the one already running — that pattern is reusable:
   `/api/tutor` and `/api/writing-feedback` are both stateless, so a spare-port instance is safe for
   verifying either without any risk to `lessons.json` or another session's process.

---

# WHERE TO START

## 1. The PASS MARK is still owed, and still by the user

`Churros` is 40 items where it was 83 questions, and an item is solved by ANY correct answer, so 80%
is a materially lower bar. Needs a browser pass, not a code change.

## 2. BUILDABLE NOW, no ruling needed

- **`PLAN §7.0` CP1, canonical text + report-only analysis records** — the first buildable slice of
  the accepted parallel curriculum pipeline. It defines stable chapter/sentence/span/token IDs and
  provenance, but must not change existing lessons, player, learner progress, or publishing. See the
  durable roadmap diagram and migration sequence in `roadmap_v83.md`'s THE LARGER PLAN section; CP1
  comes before a new generator.
- **`PLAN §C1`'s FIRST gate bug** — *"browsed forward to the story card and back, solved no
  comprehension lesson, yet could proceed."* **⚠️ THREE readings are already DEAD ENDS** — see the
  `v80_b` entry in `roadmap_v80.md` and the `v81_j` addendum in `roadmap_v81.md` before spending time
  on it (story-unlocked-page round trip and cross-chapter browsing, both builds, all clean). **What
  is still unmodelled is the "Back LINK" specifically, distinct from the "← Back" button the third
  reading already covers — get the exact click sequence from the user before trying a fourth
  reading.**
- **The dead-taps HIGHLIGHTING question** — closed to zero for the tap itself (`v81_f`+`v81_h`), but
  a different, still-open decision remains: **should the story panel mark a word at all when its
  ONLY teaching lesson is hidden?** `probe_tap_reachable_v81d.js` measures it. Needs a ruling before
  building either direction.
- **`PLAN §F2`'s second half** — the "answer visible in the stem" detector, measured and deliberately
  left unenforced because prefix-matching is mild morphology. Reported by
  `probe_word_forms_defects_v80g.js`.
- **`PLAN §D4`'s one measured rough edge** — on a completely off-topic writing answer specifically,
  the grading model sometimes folds a content comment into the language-issues list as a fake
  arrow-format "correction" on a sentence with no actual mistake. Harmless to the learner, a real but
  minor prompt-compliance gap. If picked up: reproduce across more than the three verdicts `v82_f`
  tested before deciding whether it is worth a prompt change, and measure against several REAL
  learner answers, not just synthetic ones — the same "one lesson proves nothing" caution `PLAN §F3`
  already carries elsewhere in this document.
- **`test/lib-dom.js`'s `textContent` ordering bug**, found while building `v83_b`'s own test:
  trailing text after a child element (`'x<b>A</b>y'.textContent`) comes back mis-ordered — a
  pre-existing defect in the shared DOM test stub, not something `v83_b` introduced or needed to fix.
  Flagged as a separate background task; worth picking up since any future test relying on
  `textContent` after a mixed text+element run will hit the same bug.

## 3. ⚠️ OWED BY THE USER, not doable in a container

- **`PLAN §F3`** — the article prompt fix shipped at `v80_j` and is **UNVERIFIED BY DESIGN**.
  Regenerate MANY lessons, then re-run `probe_article_symmetry_v80j.js` against its baseline: **1.0%
  overall but BIMODAL** (191 chapters at 0%, two at 100%). **One lesson proves nothing.**
- **The translate pass** for the remaining `en`-only keys (4 new ones from `v83_b`, plus whatever was
  already outstanding), `translate-ui.js --langnames`, the `hr` `ui.json` pass, and a
  **native-speaker check of the `cyrillic-sr` table**.
- **A device pass on the WHOLE `v81_a`…`v81_ad` UI-redesign arc — never done by the user.** The v80
  line changed every card and question screen; `v81` then split generation off the landing page
  (`§C5`) and built the Settings Card with its floating pills, mute-pill consolidation, and the
  language/speech mismatch pills (`§C4`). Every individual release from `v81_x` onward carries its
  own "verified live" paragraph in `roadmap_v81.md` from an AGENT's browser pass — that is not the
  same thing as the user's own device pass, and none of it has happened yet. Read `roadmap_v81.md`'s
  own release entries (`v81_w` onward especially — the first and biggest real visual changes) for
  exactly what to click through; `build_history/v81i_session38_notes.md` also still applies for what
  should stay locked on the lesson path.
- **`PLAN §12`'s own new UI, never seen by the user in a real browser.** `v83_b` was verified against
  a live model call and by the test suite, but the selection-popover UX itself (positioning, the
  grammar/meaning buttons, coexistence with the per-word tap on a touch device) has not had a human
  look at it. Worth a pass before calling the feature done-done.

## 4. NOT yours to start

Import "new" mode is POSTPONED. **Track A's CP1 report-only analysis (`PLAN §7.0`) is authorised;
new input/UI import mode remains postponed.** **Mastery-driven progression (`PLAN §9b/D2`) remains a
user product decision**: B4 runs in shadow mode, but it must accumulate a meaningful disagreement log
before that decision is reconsidered. The learner/teacher rework — `_canEdit()` is done; `Edit /
rename topic` stays visible by user ruling.

**⚠️ THE TRACK T COLOURING NUMBERS MOVED AT `v81_d`** — the denominator used to count questions no
round can build. GREEN 18.6% → **27.8%**, PARTIAL 19.5% → **11.8%**, mean questions per word 2.20 →
**1.79**. **No ruling is reversed; none may be re-opened without re-measuring** via
`probe_word_green_impact_v81d.js` (NOT `probe_learner_known_v80l.js`, which re-derives the colouring
inline and cannot see inside `_wordProgress`).

**Do not re-derive the per-text learning scheme measurements.** A chapter's lessons teach **9.2% of
its story's tokens, 8.2% of its distinct words**, rarest words least covered (**5.1%**). Inflection
share measured at `v80_f`: **47.3% of taught words are findable in the story, 36.4% ABSENT in any
form**, and a matcher is worth ~10 points, not fifty — **the ceiling is a GENERATION problem.**

## Standing tools — use them

**Before grepping for where something lives, check `INTERNALS.md` §6b** — it is the permanent,
actively-maintained function map. This prompt only keeps the probe scripts, since those are quick
reference and not duplicated in INTERNALS.md.

- `probe_gates_v80c1.js` — the `PLAN §C1` gate probe. Reports, does not assert.
- `probe_gates_v77.js` — re-run **and diff** after any progress-card change. **⚠️ It SELECTS its
  chapters from the corpus, so a data drop moves the selection.** Disambiguate by re-running the
  PREVIOUS client against the CURRENT corpus. Baseline: `v80i_card_gates.txt`.
- `probe_word_green_impact_v81d.js` — what TRACK T's colouring paints, through `_wordProgress` /
  `_wordState`. `PROBE_CLIENT=` diffs two builds. Use this one for anything about the screen.
- `probe_word_green_v81c.js` — declared probe keys vs the BUILDABLE universe (60.8% at `v81_d`).
- `probe_comp_skip_v81c.js` — drives `showComplete(true)` over every later chapter and CLICKS
  `comp-next`. Re-run after ANY change to the progress card's Next wiring.
- `probe_tap_reachable_v81d.js` — highlighted words whose tap resolves to nothing. A related but
  DIFFERENT question from "which free-text selections does the `PLAN §12` popover accept" (that one
  is answered — raw, as-selected, no snapping; see `roadmap_v83.md`'s `v83_b` entry).
- `probe_learner_known_v80l.js` — the older colouring probe. ⚠️ It RE-DERIVES the colouring inline
  rather than calling `_wordProgress`, so it is blind to changes inside the collector.
- `probe_inflection_v80f.js`, `probe_article_symmetry_v80j.js`, `probe_lesson_script_v80h.js`,
  `probe_word_forms_defects_v80g.js`, `probe_forks_v79k.js`, `probe_coverage_v78n.js`.
  **All report; none assert.** The article one is explicitly NOT language-blind — its article lists
  must never migrate into the app.
- `_cardErrors()` — assert it is empty after any card render you add.
- `_storyBodyHtml(d, opts)` — **the ONE story renderer** for question panels and progress cards. Now
  also the ONE place the `PLAN §12` selection hook (`.story-selectable`) is applied, so every caller
  gets it for free — see `_storySelInit`/`_storySelMaybeShow` (index.html) for the listener itself.
- `_wordProgress(d)` / `_wordState(rec)` — **the ONE per-word progress collector.**
- `_storyLockedLesson(L, d)` — the ONE "is this lesson closed" rule.
- `_cardHeader(prefix)` + `.card-screen` — every new card page uses both.
- `scriptPinNote(lang, script, role)` — every prompt emitting target-language text calls it.
- `_tutorGatherContext()` / `_tutorRenderScope()` / `/api/tutor` — the tutor's core machinery.
  `_tutorGatherContext()` now sends `uiLang` (reply language) ADDITIVELY alongside the unchanged
  `srcLang` (retrieval content-pairing + ledger lookup) — the two are genuinely different jobs, see
  `roadmap_v83.md`'s `v83_b` entry before touching either.
- `recordObservation(ex, correct)` / `APP.progress.observations` / `refreshBktShadow(d)` — the
  `PLAN §8/B1–B4` evidence path. See `INTERNALS.md` §6b before extending it: only `check()`-graded
  exercises are logged, only resolved vocabulary IDs feed BKT, and no BKT value may become a reader
  of progression without a separate product ruling; `learners.js`'s `MAX_STATE_BYTES` growth ceiling
  remains unaddressed.
