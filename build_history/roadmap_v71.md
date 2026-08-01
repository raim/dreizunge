# Roadmap v71

> ## ⛔ SUPERSEDED — this is the historical record of the v71 line.
> **The current roadmap is `build_history/roadmap_v72.md`.** Start with
> `build_history/HANDOVER.md`. Every open item was carried forward verbatim into the v72 roadmap;
> nothing here is still a live queue. Kept because the v71 line ran 24 sessions and the reasoning
> behind each decision is recorded here and in the `v71_*_session*_notes.md` files.


> **STATE AT HANDOFF: cut as `v71`.** Clean cut after a long v70 line (15 point releases,
> `v70_b` → `v70_p`). Everything in v70 shipped and is green; this roadmap starts the next session
> from a true baseline rather than a repeatedly-patched one. `roadmap_v70.md` is now a **closed
> archive** — everything still open has been carried here.
>
> **`v71_z` shipped** (session 24, HANDOVER release): no code change — `build_history/HANDOVER.md`
> added and linked as step 0 of the session-start list, and the protocol's stale baseline figures
> refreshed (they still said 154/128 against an actual 158/137 — the exact drift that block warns
> about). Stopping point for a long thread; sessions 17–24 ran in one conversation.
>
> **`v71_y` shipped** (session 24): article symmetry moved from `normalizeVocabArticles` (deleted:
> article lists for 12 languages, could only ever STRIP, degraded real data) into the existing QC
> pair check — which sees the lesson's other pairs, can fix EITHER side, and PROPOSES rather than
> rewrites. Arabic `ال` handled as a stated property instead of by omitting Arabic from a table, so
> it holds for unlisted languages (99 of 131 asymmetric pairs are `ar<-en`). Suite **158**.
> **Live QC check owed.** See `v71_y_session24_notes.md`.
>
> **`v71_x` shipped** (session 23): user design principle — **no language knowledge in the code**;
> the model produces correct language content, the prompt instructs it. Recorded in `INTERNALS.md`
> with an inventory of existing violations. First application: the hardcoded `ARTICLE_CHOICES`
> table removed in favour of distractors derived from what the model has actually produced — which
> turned out **better, not equivalent**: article MCQs now build in 19 of 20 grammar lessons against
> 15 with the table (it covered de/fr/it/es/pt/nl/ru only, so English lessons could never build
> one). Suite **158**. See `v71_x_session23_notes.md`.
>
> **`v71_w` shipped** (session 22): closed the two-readers-for-chapter-complete item. It was worse
> than logged — the storyline page's connector line and progress-bar colour diverged from the shared
> `chapterComplete` in BOTH directions (too strict on mixed-driven chapters, too permissive below
> the pass mark — the exact `v69_l` bug, still live there). Measured, not assumed. New rule:
> a progress FRACTION may stay a raw count, but any signal asserting FINISHED must read the shared
> rule. Closes the one "Known outstanding" item in `INTERNALS.md`. Suite **157**.
> See `v71_w_session22_notes.md`.
>
> **`v71_v` shipped** (session 21): `INTERNALS.md` — the engineering counterpart to
> `DOCUMENTATION.md`. Tuning constants, silent-failure modes, load-bearing invariants, harness
> limits. Every factual claim verified against the code (17 checks) before shipping, since a wrong
> reference doc is worse than none. Linked from the session-start reading list as step 2 and from
> `DOCUMENTATION.md`. No code changes; suite unchanged at **157**.
> See `v71_v_session21_notes.md`.
>
> **`v71_u` shipped** (session 20): the book/PDF forms' two-option arc `<select>` became the SHARED
> tick-list the storyline path has used since `v71_p` — so `comprehension` (added `v71_l`) is
> reachable from a book at all for the first time. One `generateArcLesson` now serves both paths;
> legacy `arcMode` is translated at the edge rather than kept as a second live branch. **Found by
> revert-verification: making the server ignore `arcTypes` failed NOTHING in the 156-check suite** —
> source assertions on each side prove nothing about the join. Closed with a live-server e2e.
> Suite **157**. See `v71_u_session20_notes.md`.
>
> **`v71_t` shipped** (session 19): removed the 6,000-char story caps — but the roadmap's
> prescription was INCOMPLETE. `num_ctx` was never set, so Ollama ran at its ~4096 default and
> **truncates an over-long prompt silently**; deleting the app-side cap alone would have moved the
> trim from a deliberate one (current chapter kept whole) into a blind, invisible one. Added
> per-call `num_ctx` sizing + a settable ceiling first, then removed the caps. Measured: the
> single-chapter cap was dead code (longest chapter 4,691 chars), the chain cap bit 75 of 294
> chains. ~24,000 chars now reach the model vs 6,000. Suite **156**.
> See `v71_t_session19_notes.md`. **Live check still owed.**
>
> **`v71_s` shipped** (session 18): comprehension lessons were a CIRCLE — they ask about the
> chapter's story, but counted toward the gate that unlocks it, so learners were asked about text
> they had never been shown and could only guess. Split into `storyUnlocked` (narrowed gate, both
> the lesson AND coverage layers) vs `setComplete` (whole chapter, unchanged). The story now renders
> below the answer controls on a comprehension question; the lesson must be solved 100% ("repeat
> until correct") before the chapter completes; mixed lessons no longer pool comprehension. Suite
> **155**. See `v71_s_session18_notes.md`.
>
> **`v71_r` shipped** (session 17): grammar and conjugation rounds were a RANDOM 14-question cut of
> a complete pool, so a replay re-asked already-solved questions (~53% measured) and 11 of 25
> questions were unreachable — the `v71_f` defect, left live because `v71_g` filed grammar under
> "deterministic, needs nothing". Both builders now cut through the shared `_cutCoverageRound`
> (coverage-aware, and honouring the `_derivingUniverse` contract they had been ignoring). 100%
> coverage in 2 rounds with 0 repeats; first play unchanged. Found by the baseline being RED on a
> new `lessons.json`, not by a report. Suite **154**. See `v71_r_session17_notes.md`.
>
> **`v71_q` shipped** (session 16, FINAL of that thread): tutor reasoning ON by default (story and
> lessons stay off — reasoning starves structured JSON); a CPU-threads setting in the model menu
> (absent from the request when unset, rather than a guessed number); synonym reveal shown bare; and
> provenance relabelled `User:` / `Source` with 58 stale translations dropped for refill.
> Suite **154**. See `v71_session16_notes.md` — it carries the handover list.
>
> **`v71_p` shipped** (session 15): result card matched to the storyline page's column (it was 60px
> narrower, which is why its storyboard rendered smaller); chapter-title post-pass retries up to 3×
> on EMPTY titles (it parsed fine — the titles were blank); and the two-button arc chooser replaced
> by a shared lesson-type tick-list, with "Re-create all lessons" becoming **"Add lessons"** — it no
> longer hides what is already there, and it covers chapter 1. Suite **153**.
> See `v71_session15_notes.md`.
>
> **`v71_o` shipped** (session 14): comprehension follow-ups — quiz now in the LEARNER's language,
> full story chain up to the current chapter, the generator's "why" shown and read aloud instead of
> restating the answer. Plus the JSON-parse fix (the hand-rolled extractor never stripped `<think>`,
> which broke FIVE generators on reasoning models) and a whole-word fallback for badly mistyped
> answers. Suite **152**. See `v71_session14_notes.md`.
>
> **`v71_n` shipped** (session 13): drill/ledger correctness — a `v71_h` regression meant a finished
> drill wrote its outcome AFTER `endDrill()` had swapped the topic back, so mistakes never decayed
> (the reported "studiare" loop), drill mistakes were never counted, and the real chapter was
> credited instead. Also: review renders no longer inflate `seen`. Suite **152**.
> See `v71_session13_notes.md`.
>
> **`v71_m` shipped** (session 12): the result-card arc — the card now uses the storyline page's
> header block and progress bar (shared `_slProgressStats`, no second copy of the arithmetic), rows
> reordered to header → storyboard → chapter bars → status line → buttons, the pass mark DRAWN on
> the %-solved bar in place of the below-threshold sentence, and the story shown on white with
> solved words highlighted yellow. 4 of the arc's 5 TODOs; error-hunt-on-card still open.
> Suite **151**. See `v71_session12_notes.md`.
>
> **`v71_l` shipped** (session 11): QC flags no longer affect the learner — only human decisions
> (`userFlag`/`userDelete`) withhold an item, via one shared `_itemWithheld` predicate replacing
> three divergent copies; 450 items restored to coverage denominators across 157 lessons. Plus the
> new **comprehension** lesson type (🧠 story questions, counted normally, story-gated), and the
> suite re-greened against the new corpus. Suite **151**. See `v71_session11_notes.md`.
>
> **`v71_k` shipped** (session 10): the storyline-result UI arc — result cards show the FULL
> storyboard framed by chapter state (green = span finished, blue = the chapter just played),
> the storyline header replaces the "← Back to story" button, and the last chapter of a story
> now says "Story complete!". Plus a returning `ui.json` (+445 translations, 24 of 29 languages
> complete) and 18 verbatim-English fallbacks deleted for the next translate pass. Suite **150**.
> See `v71_session10_notes.md`.
>
> **`v71_j` shipped** (session 9): crossword clue bar given a fixed height (the grid no longer
> jumps); new `ui.json` (+567 translations, 15 languages now complete) and `lessons.json`
> integrated. Suite **148**. See `v71_session9_notes.md`.
>
> **`v71_i` shipped** (session 8): replay rounds no longer padded with already-answered questions
> (48 questions/11 repeats -> 41/4 on the user's data), and the coverage-driven mixed round is
> capped at 30 per sitting. Suite **148**. See `v71_session8_notes.md`.
>
> **`v71_h` shipped** (session 7): removed the redundant drill result card (a finished drill now
> returns to the real chapter card) and made every completion card show the same button row,
> greyed when unavailable. Suite **147**. See `v71_session7_notes.md`.
>
> **`v71_g` (session 6): tests + documentation only, app byte-identical to `v71_f`.** Answered two
> questions with regression guards — repeat-focus correctly does NOT extend to the deterministic
> synonyms/word_forms/grammar builders, and error-hunt lessons gate chapter completion on being
> PLAYED (they count but add 0 coverage). Suite **146**. See `v71_session6_notes.md`.
>
> **`v71_f` shipped** (session 5): repeat now reaches the unsolved questions a single derivation
> missed. Pass mark reached in 2 rounds instead of up to 10. Suite **145**.
> See `v71_session5_notes.md`.
>
> **`v71_e` shipped** (session 4): merged the user's `ui_json.bak` — +30 translations (including
> `crossword.done` in 7 languages), 203 stale `{lang}` entries held back, guard widened to all 7
> rewritten keys.
>
> **`v71_d` shipped** (session 4): vocab article symmetry (diagnosed from the user's own
> lessons.json), the {lang} grammar fix, and the below-pass-mark Next lock. Suite **144**.
> See `v71_session4_notes.md`.
>
> **`v71_c` shipped** (session 3): the typed-answer letter-by-letter diff, with real sequence
> alignment. Suite **142**. See `v71_session3_notes.md`.
>
> **`v71_b` shipped** (session 2): PDF chapters from the document's own paragraph structure, an
> LLM chapter-split option, and three defects found on the way — one of them pre-existing text
> corruption in every length-split chapter. Suite **141**. Full detail in `v71_session2_notes.md`.
>
> **The v71 cut is NOT a pure version bump.** It carries updated `ui.json` (a partial translation
> pass) and updated `lessons.json` (283 topics, 80 storylines), plus one test whose assertion was
> restated. Suite green at **138**, `check-inline` 0 on both builds.

---

## How to start a session (read these, in order)
0. `build_history/HANDOVER.md` — one page: the green baseline numbers, what is owed BY THE USER
   (browser passes, live model checks — none of it doable in a dev container), the open decisions
   blocking work, and what is ready to implement without one. Written end of session 24.
1. **This file** — the highest-numbered `build_history/roadmap_v*.md` is always the current one.
2. `INTERNALS.md` (repo root) — the constants, silent-failure modes, invariants and harness limits
   that hold RIGHT NOW. Read it instead of grepping the notes for "what is the value of X" or
   "why does this test do that". Add to it when a session discovers something a future one would
   otherwise rediscover.
3. The two most recent session-notes files: `build_history/v71_y_session24_notes.md` (`v71_y`) and
   `build_history/v71_x_session23_notes.md` (`v71_x`). The `v71_q` notes carry the full handover
   list, still current apart from what `v71_r`/`v71_s` closed. Sessions 1–2 cover the cut and `v71_b`.
4. Establish the green baseline BEFORE touching anything: `node test/run.js` and
   `node test/check-inline.js` (0 failures on both `index.html` and `docs/index.html`).
   **The runner reports its own total** (added v70): the closing line reads
   `ALL CHECKS PASSED (138 checks)`, and a failing run reads `FAILED <n> of 138: <labels>`.
   **Quote that line — never hand-derive the figure.** A hand-derived count once drifted to 152
   against an actual 133 and sat in two documents unnoticed; that is what the self-report prevents.
   Currently **158** (153 `test/*.test.js` files + 5 static checks). `--quick` reports **137**,
   skipping the server-spawning steps — a smaller number there is correct, not a regression.
   (Verified session 24. This line has gone stale before; re-check it rather than trusting it.)

---

## ✅ What shipped in v70 (full detail in `v70_session1_notes.md`, notes 1–16)

- **Harness self-reports its check count** (v70) — after a documented figure was found wrong in two
  places. Counted at one site inside `run()`, so it cannot drift.
- **`--quick` actually skips server-spawning tests** — six were registered outside the block.
- **Insecure-transport warning** (v70_b) — plain HTTP on a non-loopback host warns in the account
  modal and once per process on the console. Guidance, never a gate.
- **Crosswords** (v70_c → v70_j, plus v70_o) — the whole feature: layout engine, play mode as a
  *mode over an existing lesson* rather than a lesson type, learner reachability, UX (auto-advance,
  per-letter marking, reveal), varying puzzles + word-pool options, mixed/synonym/word-form
  sources, thin-lesson top-up, and the browser-pass fixes.
- **Completion screen** (v70_g, v70_l) — one icon action row; Repeat split from Next; drill no
  longer gated on the pass mark, so a finished lesson still has a route back in.
- **PDF chapters break on sentences** (v70_k) — false paragraph boundaries left by cleanup were
  cutting sentences in half.
- **Synonym context** (v70_m, v70_n) — trimmed to the sentence holding the word, then *clamped*,
  because the ten worst cases were each a single enormous sentence.
- **Storyline full-story translation toggle** (v70_p).

---

## ✅ What shipped in `v71_i`

- **No padding with repeats on a replay.** Opt-in (`trimToUnsolved`) so v69_h's "round always
  fills" invariant still governs the mixed round. 23% repeats -> 10% on the reported data.
- **`MIXED_ROUND_CAP = 30`.** The v69.1 sizing (one pass reaches the chapter mark, measured
  across all unhidden lessons) already did what was asked; it produced a 62-question sitting.
  Capped: 30/30/2 with zero repeats, mark reached on play 3.

---

## ✅ What shipped in `v71_h`

- **Drill result card removed.** A finished drill returns to the launching chapter's real
  completion card (below-mark or complete) instead of a stripped waystating card. endDrill runs
  at the single drill exit (renderEx), rendering the real card in review mode so lesson/index
  resolve against the restored topic. The old `if(lesson._drill)` branch is kept as a marked
  defensive fallback (it fixed three dead ends).
- **Consistent button row.** Next / Repeat / Drill / Crossword / Back are always present on
  every card, greyed + disabled when unavailable, via new `_compBtnState`. Card layout no
  longer shifts between states.

---

## ✅ What shipped in `v71_f`

- **Replay pool top-up.** `assembleCoverageRound` could only order the pool it was given, and the
  standard builder samples one exercise type per vocab item — so a replay's pool held 2 unsolved
  items out of 6 available. Re-derives until the missing unsolved questions surface.
- Surfaced a latent universe-cache staleness in a test fixture (see session notes §4).

---

## ✅ What shipped in `v71_d`

- **Vocab article symmetry enforced.** The prompt always forbade a one-sided article; nothing
  checked. Measured 42/64 asymmetric in `sl_15116115`, split per CHAPTER (each chapter is its
  own call, the model picks a convention per call). Strips the lone article — adding one needs
  gender, which is not derivable deterministically.
- **`{lang}` no longer used attributively** in 7 strings; 203 stale translations cleared.
  Cross-language attributive detection turned out NOT to be automatable (postpositional
  languages), so the guard checks the English source plus a language-neutral staleness rule.
- **Below the pass mark, Next is locked** instead of silently becoming Repeat or Drill. Two
  unreachable branches and two always-false flags removed.

---

## ✅ What shipped in `v71_c`

- **Typed-answer letter diff** for `listen_type` / `type_plural` / `type_conjugation`. Real
  sequence alignment, not positional comparison — `hause` vs `haus` marks ONE column, not the
  tail of the word. Grapheme-aware; respects the scorer's case/accent leniency; falls back to
  the plain correct answer whenever no useful diff exists.

---

## ✅ What shipped in `v71_b` (full detail in `v71_session2_notes.md`)

- **PDF paragraph structure from GEOMETRY** — `_extractPdfText` kept only text, so 15 paragraphs
  arrived as one. The modal line gap IS the body leading; anything clearly above it is a break.
  Spacing signal for articles, indent signal for novels (only when spacing found nothing).
- **Chapter per paragraph**, built on `_sentenceUnits` so the v70_k repair is inherited. Headings
  title the following section and stay in the body; a 40-word floor absorbs stubs. The size slider
  is deliberately ignored in this mode. Real article: 15 paragraphs → 8 chapters.
- **Split-mode control** `¶ / ↔ / 📄 / ✨`, paragraph as the default, guarded through a live DOM.
- **LLM chapter split** — the model returns paragraph NUMBERS, never text, so corruption is
  impossible to express rather than detected afterwards. Cleaning folds in as an optional drop list.
- **Pre-existing corruption fixed**: `500.000 → 500. 000`, `S.J. → S. J.` in every length-split
  chapter since the splitter was written.
- **`_autoTitle`** no longer returns the tail of a long opening sentence.

---

## ✅ [SHIPPED in `v71_k`] Fresh-session brief — Storyline-result UI arc

The next piece of work, bundling three user requests into ONE screen design. Everything below was
verified against the code and the user's own data during the v71_i triage; it is a starting point,
not a spec — re-read the current code before trusting any line number.

**The three requests**
1. A **final result card** when a story is fully played. `_allChaptersDone` already exists (it gates
   the read-full-story panel on the storyline page) — but there is no card for that state.
2. Result cards should show the **FULL storyboard**, with a **green** frame around fully-played
   chapters, **blue** around the currently open one, and **no frame** around unplayed ones.
3. Result cards should reuse the storyline page's **first two header lines**: the header (globe →
   main page, title → storyline page) and the progress bar. If that lands, the
   **"back to story" button can be removed**, since the header carries the link.

**Root cause of the reported bug (confirmed)**
`_renderCompStoryboard` crops the storyboard SVG to *this chapter's* `<g data-chapter>` group and
returns early when the chapter has no group. The user's `sl_1725748570` has **5 groups for 8
chapters** (1, 3, 4, 6, 7) — so chapters 2, 5 and 8 show no image at all. Showing the full
storyboard with per-chapter frames replaces the cropping entirely and dissolves the bug.

**Why it is a good fresh-session task**
Entirely presentation code — no flow branches, no coverage machinery. But it is a new screen PLUS a
card redesign PLUS removing a button and its tests, so it wants a clean context rather than being
tacked onto other work.

**Watch out for**
- The completion card is `showComplete`, the most fragile branch chain in the app (three prior
  user-reported dead ends). The BUTTON row was stabilised in `v71_h` — all five buttons always
  present, greyed when unavailable, guarded by `unit-card-consistency`. Removing "back to story"
  means updating that guard deliberately, not incidentally.
- `smoke-render` and `unit-card-consistency` both assert on `comp-back`.
- The user has browser-tested through `v71_h`; `v71_i` (round length / mixed cap) and `v71_j`
  (clue bar) are not yet browser-verified.

---

## 🔭 Open work carried into v71

### Near-term, concrete
- **[LATER — design goal, requested session 14] Ask the model to DESIGN a lesson set per chapter**
  as a deliberate learning arc toward understanding the text, rather than the caller picking a list
  of formats. The `v71_p` tick-list is the manual version of this; the automatic version would hand
  the model the chapter and let it choose which lesson types, in which order, build up to
  comprehension.
- **[✅ DONE in `v71_u`] Wire the learning-arc selects to the shared picker.** Both `<select>`s
  replaced; both forms send `arcTypes`; one `generateArcLesson` serves the book arc and the
  storyline add-lessons run. Legacy `arcMode` is translated into a list at the edge
  (`arcTypesFromLegacyMode`) rather than kept as a second live branch — two live branches is how
  these paths drifted apart to begin with. Default ticks `['review']` = the old `vocab` arc, so an
  untouched form behaves exactly as before. **`comprehension` is reachable from a book for the
  first time.** Two existing tests turned out to be guarding nothing and were rewritten (one
  re-implemented the deleted code inline and kept passing; the other guarded a bug class the
  picker makes structurally impossible).
- **[✅ DONE in `v71_k`] Storyline-result UI arc.** All three requests shipped. The crop bug hit
  TWO storylines, not the one recorded in the brief (`sl_795546417` as well), and the panel-span
  rule needed grouping by distinct chapter — the obvious per-panel rule inverts on 7 of 22 boards.
- **[NEXT — i18n] Run the translate pass.** `v71_l` adds four en keys (`lesson.type.comprehension`,
  `lesson.type.desc.comprehension`, `form.format.comprehension`, `ex.badge.comprehension`), `v71_s`
  adds two more (`ex.comprehension.story`, `ex.comprehension.story_listen` — the play-time story
  panel), and `el/storyboard.title` needs a decision: real Greek translation, or exempt it as a
  loanword. Queue now **380**.
- **[✅ DONE in `v71_s`] Comprehension lessons come AFTER the story unlocks.** Reported as a
  conceptual error: the lesson asks about the chapter's story but was COUNTED toward the gate that
  reveals it, so learners answered questions about text they had never seen — guesses that still
  wrote to the solved store and the learned ledger. The circle was two-layered (the lesson list in
  `setComplete` AND the question universe in `topicCoverage`); fixing only one leaves it intact at
  any pass mark below 1.0. Now `storyUnlocked` (narrowed, both layers, same shared
  `_setCompleteRaw`) vs `setComplete` (whole chapter). Plus: story rendered below the answer
  controls during play, 100% required to record the lesson, comprehension never pooled by a mixed
  lesson. **Standing lesson:** when a gate and the thing it gates are about the same content, check
  the coverage DENOMINATOR as well as the lesson list.
- **[✅ DONE in `v71_w`] Two readers for "is this chapter complete".** Both raw scans on the
  storyline page (connector line, bar colour) now read `chapterComplete`; the bar's FRACTION stays a
  fraction but counts `countedLessons`. Measured divergence in both directions before fixing —
  too strict on a mixed-driven chapter, too permissive below the pass mark. Original entry:
  The storyline chapter lock (~line 7080) scans raw done-flags while line 7045 defines
  `_chapterComplete` via the shared `chapterComplete` reader — the exact duplication `v69_l`
  consolidated elsewhere. Pre-existing; it agrees with `v71_s` by luck (a withheld done-flag locks
  the next chapter either way), so nothing failed. Should be one reader.
- **[✅ DONE in `v71_q`] Tutor default = thinking mode ON**, and a **cores/threads setting in the
  model menu** (`num_thread`, absent from the request when unset rather than a guessed number).
- **[✅ DONE in `v71_t`] Remove the 6,000-char story caps; raise the timeout instead.**
  Both caps gone. The item's own prescription was incomplete in a way that mattered: `num_ctx` was
  never set on the Ollama request, so the model ran at the ~4096 default and **Ollama truncates a
  long prompt silently**. Removing the app-side cap without sizing the context first would have
  replaced a deliberate trim (oldest chapters dropped, current chapter whole) with a blind one that
  reports nothing — worse than the cap, and indistinguishable from success in the live test this
  item asked for. Measured first: the single-chapter `MAX_STORY_CHARS` never once fired (longest
  chapter 4,691 chars — dead code), while the chain budget cut **75 of 294 chains** (worst: 14
  chapters, 46,758 chars → ~3 survived). Now: per-call `ctxTokens` + a settable `NUM_CTX_MAX`
  ceiling (default 16384), chain budget 40,000, timeout at `THINK_TIMEOUT_MULT`, and a last-resort
  fit that trims from the FRONT when the ceiling is lower than the chain needs. ~24,000 chars reach
  the model at the default ceiling vs 6,000 before.
  **Live check still owed** — whether it worked is a judgement about the questions the model asks,
  which no test can make. See the notes for what to watch in the log.
- **[✅ STARTED in `v71_v`] INTERNALS document: invariants, limits, and the tuning knobs.**
  `INTERNALS.md` at the repo root — first pass written and every factual claim verified against the
  code (17 checks). Ongoing by design: §6 says when to add an entry. Original brief follows.
  **[was NEXT — docs, requested session 20]** `DOCUMENTATION.md` is user-facing — the three layers, how to generate, the
  feedback loop. There is no engineering counterpart, and the gap is now costing real time: the
  facts a session needs are scattered across twenty session-notes files and only reachable by
  someone who already knows they exist. Every one of these was rediscovered by measurement or by a
  test failing, not by reading anything:
  - **Tuning knobs and what they buy.** `NUM_CTX_MAX` (16384 → ~24k story chars, 32768 → ~76k, KV
    cache grows linearly, may force a model reload since Ollama keys the loaded instance partly on
    load-time options), `CHAIN_STORY_CHARS` (40,000), `THINK_TOKEN_MULT`/`THINK_TIMEOUT_MULT`
    (×2.5/×3, and `callLLMLesson` spreads caller opts AFTER them so a caller can silently LOWER
    them), the 3,200 lesson token base, `MIXED_ROUND_CAP`, the 14-question builder cap.
  - **Silent-failure modes.** Ollama truncates an over-long prompt with no error. A new lesson type
    without a `fake-ollama` branch is skipped invisibly by the arc loop. A standard/vocab lesson has
    NO `type` field, so `l.type === 'standard'` is always false.
  - **Invariants that look like details.** `_derivingUniverse` means "full set, no cap, no coverage
    bias". A review render is not a play (`!C._review`). `collectChainStory` trims from the OLDEST
    end and keeps the current chapter whole. Comprehension is gated BY the story, so it cannot gate
    it. One rule per question — `_itemWithheld`, `chapterComplete`, `_setCompleteRaw`.
  - **Harness limits.** `lib-dom`'s `querySelectorAll` matches TAG names only and does not parse
    runtime `innerHTML`, so anything rendered that way cannot be read back headlessly.
  Scope it as a document a returning session reads INSTEAD of grepping the notes — the notes stay
  the narrative record of why, the internals doc becomes the reference for what is true now. Worth
  doing before the numbers above drift again.
- **[DECISION — `v71_t`] Is `NUM_CTX_MAX = 16384` right for this machine?** It is a MEMORY choice
  (the KV cache grows with the context), picked conservatively without knowing the hardware.
  `OLLAMA_NUM_CTX_MAX=32768` roughly doubles the surviving story. Deliberately not wired into the
  model menu yet — the v71_q `numThread` setting is the template if it should be.
- **[OPEN — cosmetics deferred in `v71_q`, with reasons]**
  - **Crossword: show the correct word's translation highlighted instead of the empty underline.**
    Needs a decision first. Clues come from three shapes — vocabulary (`target ← source`), synonyms
    (`base ← gloss`), and word_forms, where the clue IS a blanked sentence and the "empty underline"
    lives. A word_forms item stores only the sentence and its choices, **no translation**, so there
    is nothing to put in the gap. Either restrict this to vocabulary/synonym entries, or give
    word_forms clues a translation field.
  - **Global QC: a checkbox menu of what to QC**, including re-checking already-QCed items. Needs a
    scope picker and changes to how QC jobs batch — the same treatment the lesson-type picker got in
    `v71_p`, not a quick pass.
  - **Live mode with teacher mode OFF must hide every editing control**, like static mode does. The
    learner should be able to continue the story, download, and share a link — nothing else.
- **[DONE in `v71_o`] Generate one comprehension lesson against a live model.** Shape and wiring are
  verified; the PROMPT is not. If questions turn out answerable without reading the story, the
  distractor rules need tightening — that is the one part of `v71_l` no test can reach.
- **[QUEUE — triaged in session 11, ordered]** ~~result-card arc~~ (COMPLETE — 4/5 shipped in
  `v71_m`, and the fifth was **dropped by the user in session 14**: error hunt stays a normal
  lesson) →
  ~~drill/ledger correctness~~ (done in `v71_n`, except **drill traceability** — the ledger is keyed
  by word and has no lesson provenance; two options with real costs are written up in
  `v71_session13_notes.md` and need a decision) (3 TODOs, one root cause: the
  `wrong` counter never decays, evidenced by `studiare {seen:1,wrong:1}` being the entire it←de
  drill pool) → error-hunt word alignment (needs a real token diff, fixture in hand) → book
  generation (3) → tutor (4) → cosmetics (6). Full reasoning in `v71_session11_notes.md`.
- **[SUPERSEDED] Run the translate pass.** `complete.story_complete` is new (`en` only), 18
  fallbacks were deleted for refill, and nine Latin-script leftovers plus `hi/qc.editor.flag_save`
  (`"-flag"`) need a speaker's call. Full list in `v71_session10_notes.md` §2.
- **[✅ DONE in `v71_j`] Crossword clue bar jumps.** Fixed `min-height:3.9em`, never hidden, empty
  state renders a placeholder. Guarded in `smoke-render`.
- **[TRIAGED — less blocked than thought] Bulk-generate mixed lessons for all chapters** from
  the storyline page bottom row. Currently mixed can only be added to an OPEN lesson-set, one
  chapter at a time. `perType` does not gate coverage-driven rounds (v71_i), so no length work
  is needed first.

- **[⚠️ CORRECTED in `v71_r`] The `v71_g` scope claim above was half wrong.** It filed
  synonyms/word_forms/**grammar** together as "deterministic, no top-up needed". True for the first
  two (uncapped — a play build IS the universe). False for grammar *and* conjugation, which cap at
  14 and so cut a complete pool **at random**: a replay re-asked solved questions ~53% of the time
  and 11 of 25 questions were unreachable. They needed no top-up (the pool was already whole) but
  did need a coverage-aware CUT, now shared as `_cutCoverageRound`. §8 previously passed only
  because the then-bundled corpus had no grammar lesson above the cap; 28 of 36 do now.
  **Standing lesson:** "deterministic" and "needs nothing" are different claims — a builder that
  caps is sampling, whatever its pool looks like.
- **[quality — found in `v71_r`, logged not fixed] Duplicate targets inside one grammar lesson.**
  Six lessons repeat a `target` (`notification`, `dream`, `silence`, `Wahrheit`/`Ewigkeit`,
  `Bierkäsel`, `جامعة`/`مدينة`). The two exercises collide on one qid, so the round asks the word
  twice while coverage counts it once (a round of 12 against a universe of 10). Pre-existing and
  data-side; related to the cross-chapter vocab duplication item below.
- **[✅ DONE in `v71_f`, scope corrected in `v71_r`] Repeat focuses on unsolved questions.**
  Extends to standard/vocab, plus (since `v71_r`) the capped grammar/conjugation cut. The ordering was already
  coverage-aware; the POOL was the problem — one derivation surfaces ~half the universe. Now
  topped up by re-deriving, as the mixed builder already did. 80%/100% targets both reach the
  mark in 2 rounds (were 2.84 / 5.48 avg, worst 10). Replays only; first play unchanged.

- **[quality — from `v71_d` §1] Cross-chapter vocab duplication.** `sl_15116115` teaches 9 words
  twice, 4 of them with clashing article forms (`legge`/`la legge`). `PROMPTS.vocab.prevHint`
  already passes prior vocab to the model and is being ignored — so this is a prompt-adherence
  problem, and the deterministic option is to drop a duplicate at save time.
- **[NEXT — owed from `v71_c`] Browser pass on the typed diff.** Column alignment, strike-through
  and RTL order are unverified — the stub DOM does not parse `innerHTML`, so only the wiring is
  proven. Long sentences are the open question: the two rows wrap independently, and whether
  they still read as columns after a wrap has not been seen.
- **[NEXT — owed from `v71_b`] Browser pass on the PDF chapter work.** Nothing in the split-mode
  control or the ✨ model pass has been seen in a browser. The session notes carry a "how to see it
  work" for both. **Also empirical:** are the model's groupings actually better than the
  deterministic paragraph split? The fake model cannot answer that; if they are not, ¶ stays the
  default and ✨ stays an option, which is how it ships.
- **[small — `v71_b` interaction, logged not fixed] 🧹 cleanup deletes section headings.**
  `cleanExtractedText` rule 3 drops unpunctuated lines under 20 letters, which is exactly what a
  heading is (`"Selezione naturale"` = 17). Headings now MEAN something — they title chapters — so
  the rule costs a title whenever cleanup is on, which is the PDF default. Any fix must not
  resurrect what rule 3 exists to remove (bylines, nav crumbs): a byline is also a short
  unpunctuated line, and "followed by a substantial paragraph" does not separate them (in the
  user's article that rule keeps the kicker `scienze` and drops the title `Evoluzione`). Probably
  wants heading detection to run on the PRISTINE text before cleanup, which is a bigger change than
  it looks.
- **[i18n] `_sentenceSplit` abbreviation limitation.** A period followed by a space still ends a
  sentence, so `N. Eldredge` and `z. B.` split. Costs a split point, never text. Only worth fixing
  with a per-language abbreviation list, which is why it is logged rather than guessed at.
- **[NEXT — carried, still open] Drill result card is redundant.** A drill session shows its own
  completion card; it should return to the card the learner came from. Touches the `showComplete`
  branch chain and `APP._drillPrev`. **Deferred twice on purpose:** that branch order has already
  fixed three user-reported dead ends (v66.1, v69.2) and the failure mode is a learner left with no
  forward affordance — quiet, and only visible in a browser. Wants a session that re-reads the
  branch order cold. Smallest item here.
- **[✅ DONE in `v71_c`] Typing letter-by-letter diff.** Levenshtein backtrace over graphemes;
  per-character equality reuses `normDiacritics` so the diff never marks what scoring forgave.
  Live-DOM covered in `smoke-render` §4b. See `v71_session3_notes.md`.
- **[quality — specified against real data] Deterministic vocab QC.** Validated against the user's
  pre-edit export (`lessons_witharticles.json`, storyline `sl_613012330`):
  - **[⚠️ BLOCKED by the session-23 design principle] Article mismatch.** Detecting "one side has an
    article" needs a per-language article table — exactly what the principle above rejects. Evidence
    that the table is the hard part: two attempts at one in session 23 were both wrong (`le` matched
    the prefix of `legge`; a missing English entry made 19 symmetric `il tempo`/`the weather` pairs
    look like violations). Either would have "fixed" correct data.
    Corpus measurement, for whoever picks this up: 131 asymmetric pairs, but **99 are `ar<-en`**,
    where Arabic definiteness is the bound prefix `ال` and no word-splitting rule applies at all.
    Only 2 are target-only (`la grandine`/`hail`, `il danno`/`damage`) — and there the right fix is
    to ADD `the`, matching the symmetric siblings in the same lesson, not to strip `la`.
    **Do this as a model-backed check** (ask the model to judge symmetry and propose the fix that
    matches the lesson's own convention), or not at all. See also: `normalizeVocabArticles` already
    does the deterministic version and gets this exact case wrong.
  - **Missing umlaut** — a word whose umlaut-stripped form matches another form in the corpus that
    HAS umlauts, **with the same capitalisation**. Catches `naturliche`/`natürliche`; the case rule
    suppresses the `Zahlen`/`zählen` false positive. 2 candidates corpus-wide, 1 real.
  - Both defects **survived hand-editing** (`naturliche Selektion`, and `symbiosi` → `simbiosi`),
    which is the argument for automating it. Surface through the existing per-item flag UI; no
    model call needed.
- **[✅ DONE in `v71_y`] Retire `normalizeVocabArticles`.** Deleted; article symmetry is now check (3) in `qcCheckPair`, with up to 6 sibling pairs as context, able to fix either side, proposing not rewriting. Generation prompts still require symmetry, so QC is the safety net. **Live check owed** that the prompt alone holds. Original entry: It runs on every
  generated lesson, encodes article lists for 12 languages, and prescribes a direction — the
  clearest violation of the no-language-knowledge principle, and it demonstrably degrades data:
  `la grandine`/`hail` becomes `grandine`/`hail`, dropping the gender an Italian learner needs while
  its symmetric siblings keep theirs. The prompt already forbids one-sided articles (this was added
  in `v71_d` as belt-and-braces when the model obeyed per call). Options: delete it and strengthen
  the prompt; or replace with a model-backed QC pass that proposes rather than rewrites. **Needs a
  decision + a live check** that the prompt alone holds. `ARTICLE_CHOICES` (client) is the easier
  companion — it already falls back to deriving choices from the lesson's own items, so the table
  can just go. **`ARTICLE_CHOICES` was removed in `v71_x`** — and doing so IMPROVED coverage
  (19/20 lessons build article MCQs vs 15), so the remaining work here is `normalizeVocabArticles`.
- **[small] Clamp the synonym context SERVER-side too.** `findContextSentence` returns the first
  story sentence containing the word, uncapped, so a 135-word period is stored in full. The client
  clamps for display (v70_n), so nothing is broken — but the stored data stays bloated and any
  other consumer sees the full passage. Duplicating the clamp would create a second definition that
  can drift; decide between sharing the helper and accepting display-side-only.
- **[i18n] `_sentenceUnits` only splits on `.!?…`.** Arabic prose uses `،` `؛` `:` and often has no
  full stop for a whole passage, so it reads as ONE sentence. Harmless for synonym cards after the
  v70_n clamp, but **the PDF chapter splitter has the same blind spot** — an Arabic book would
  chunk far more coarsely than a European one. Not yet reported; real.

### i18n — partially done, needs a second pass
- **`v71_j`: the user supplied a new `ui.json`** — +567 translations. **15 languages are now
  complete** (ar de es fr hi it ja ko nl pl pt ru sv tr zh), including correct re-translations of
  the 7 attributive-`{lang}` strings cleared in v71_d. **715 entries still outstanding** (was
  1137), almost all in the 14 less-covered languages.
- **`v71_e` merged `ui_json.bak`**: +30 translations, `crossword.done` now covered in
  nl/pt/fr/de/it/pl/es (was "translated nowhere"), `pl` up to 556 keys. **1137 entries still
  outstanding**: best languages missing 21, the other 22 missing 45.
- **`v71_d` added `complete.next_locked` and REWROTE 7 strings** (§2 of the session notes),
  deleting **203 stale translations** that embedded the ungrammatical `{lang}` shape. Those 7
  keys now fall back to English in 29 languages until re-translated — the largest single item
  in the translate queue.
- **`v71_c` added 1 `en`-only key**: `check.you_typed`.
- **`v71_b` added 12 `en`-only keys** (listed in `v71_session2_notes.md`): the four split-mode
  buttons and label, and the seven ✨ chapter-split strings. `form.split_per_page` is now unused by
  the client but kept — it is already translated into six languages.
- **558 missing entries across 24 keys.** The v71 translation pass covered **6 of 29 languages**
  (nl pt fr de it es), all partial, and was exported before v70_o — so `crossword.done` was never
  in it. 23 languages are untouched: `tr hi ar sv ru zh ko pl ja he uk cs vi id ro th el fi hu da
  ca lb sw`. `--qc` reports **0 structural defects**; every "error" is one of these absences.
- **`crossword.done` was missing from `en`** in the uploaded file and had to be restored — the code
  calls `t('crossword.done')`, so shipping it would have shown a raw key on the crossword button.
  **Lesson: validate a returning `ui.json` against the current one before merging** (key counts per
  language, and whether any `en` key disappeared).

### Owed, and only the user can do them
- **Browser pass on the drill + typing changes** once they land.
- **PDF model-cleanup on a real article** — genuinely empirical: does the local model over- or
  under-delete? Knobs are the 40% floor and the `textCleanup` category list.
- **Native-speaker review** of generated vocabulary. The QC above catches mechanical defects, not
  wrong-but-plausible translations.

### Larger, not yet started
- **Concept graph / dependency-aware curriculum.** Deliberately untouched until the small queue is
  clear. Large authoring project; do not start it opportunistically.
- **Word games beyond the crossword** — wordle-like, other word-play. The crossword's conventions
  (deterministic seeding per attempt, credit only what the exercise genuinely demonstrates,
  content-based availability) should be reused rather than re-invented.

---

## ⚠️ Session protocol — READ FIRST, applies to every change

This block is the standing "definition of done." A fresh session is expected to follow it without
being re-told; several of these were missed in past sessions (LIVE-TEST updates, i18n listing,
version bump) and only caught because the user noticed. Treat it as a checklist.

**How to start a session:** read THIS file (the highest-numbered `build_history/roadmap_v*.md` is
the current one), then the most recent `build_history/v*_session*_notes.md`. Establish the green
baseline (`node test/run.js` + `node test/check-inline.js`) before touching anything.

**Working rules (per change):**
- One change at a time. Pure refactors stay byte-identical. After each change: full suite green
  (`node test/run.js`) and `check-inline` at 0. Re-run before moving on.
- Add or update a **unit test** for any new behavior. When adding a lesson type, exercise type,
  generator, or registry entry, update the matching registry test (`unit-*-registry`).

**Definition of Done — before calling any change finished, check ALL that apply:**
1. **Tests** — suite green + `check-inline` 0; new/changed behavior has a guarding test. For render
   paths (anything drawn in the client), add/extend a `smoke-render` case — source assertions cannot
   see runtime scope, TDZ, or layout.
2. **Browser-only behavior → session notes** *(the former LIVE-TEST-CHECKLIST.md is a closed
   archive — do NOT add sections to it)*. If the change is browser-only or Ollama-only (UI, RTL,
   TTS, rendering, anything not exercisable headlessly), the session notes MUST contain a short
   "how to see it work" description — what to click and what to expect — so the user can verify it
   in normal use.
3. **i18n** — new user-facing strings go in `ui.json` **`en` only** (never add English text to other
   languages — the user's `translate-ui.js` fills *missing* keys and can't detect English
   fallbacks). List every new key in the session notes + roadmap so the offline translate pass is
   run. Changed English values won't be re-translated automatically (script keys off *missing*, not
   *changed*) — call those out explicitly or hand-edit if language-neutral.
   **(v71) When a translated `ui.json` comes BACK, validate before merging:** per-language key
   counts, and whether any `en` key vanished. A returning file may predate recent releases.
   **A test asserting a key is "en-only" is correct while the key is new and wrong once it has been
   translated** — assert instead that no language holds the English string verbatim.
4. **Static build** — if client (`index.html`) or baked data (`lessons.json`, `languages.json`,
   `scripts.json`, `ui.json`) changed, re-run `node build-static.js` so `docs/index.html` is current.
5. **Data parity** — if a generator exists on both server and client (math, intro_script, furigana
   tokenizer), keep them identical and assert parity in a test.

**Definition of Done — at a release / packaging point:**
6. **Version** — bump `APP_VERSION` in `server.js` if it's a new release. NOTE (v49): the static
   build DERIVES the version from `server.js`'s `APP_VERSION` at build time (see
   `unit-version-derivation`), so a single bump in `server.js` + a `build-static.js` re-run is
   enough — no more hand-editing `build-static.js`.
   **Point releases use an alphabetic suffix** (user, v70): the base cut is the bare number and is
   implicitly `a`, so the sequence is `v71` → `v71_b` → `v71_c` → … — the same convention the v69
   and v70 lines ran. **The next release off this tree is `v72`** (`v71_z` shipped — the v71 letter suffixes are exhausted). A new base
   number (`v72`) is a fresh cut, not a point release. Roadmaps are per BASE version, so point
   releases do not each get one — `roadmap_v71.md` stays current through the whole v71 line.
7. **Roadmap** — mark shipped items ✅, carry every open TODO/idea forward, and at a version bump
   write the next `build_history/roadmap_v{N+1}.md` (carrying this protocol block forward).
8. **Session notes** — write/update `build_history/v{ver}_session{n}_notes.md`.
9. **Package** — sync the release dir, regenerate `docs/`, zip, and call out which deliverables are
   still owed (browser pass, i18n, native-speaker content checks).

**(v71) Test-quality rules — added because five guards failed in one session, in five distinct ways:**
- **Verify every guard by reverting its fix and watching it fail.** Four of the five were caught
  this way; the one that was not is the one that reached a release.
- **A vacuous guard passes for the wrong reason.** (v70_f: "a Check after reveal credits nothing"
  passed trivially, because reveal marks every entry done and Check skips done entries.)
- **A conditional guard only sometimes exists.** (v70_g: repeat assertions wrapped in
  `if (replayTargetExists)`, which in that scenario did not.)
- **A guard should fail as a named assertion, not a `TypeError`.** (v70_l: reverting the highlight
  threw inside the sandbox — a far weaker signal for whoever hits it.)
- **Test the caller, not just the helper.** (v70_m: five assertions on `_synContext`, none on
  `tSynSelect` — reverting the render passed them all.)
- **Test against the data that prompted the report.** (v70_n: the synonym trim was green and did
  nothing, because the fixture was a multi-sentence paragraph — the shape the fix handled, not the
  135-word single sentence the user was complaining about.)

**(v71) Reachability rule:** a learner-facing feature placed on the lesson-set page is unreachable —
learners skip that screen entirely (v60 learner nav). `_canEdit()` is NOT the gate that matters;
check against `_isLearner()`. When reporting a new affordance, say WHERE it lives in the navigation,
not just that it exists.

**(v71) Known harness traps** (each cost a debugging cycle):
- The stub DOM does **not** parse `innerHTML` — `querySelectorAll` returns `[]`. Assert against the
  markup string; `getElementById` persists stubs, which is what makes interaction testable.
- Values returned from `C.run` belong to another realm, so `deepStrictEqual` against a local `[]`
  fails on prototype identity. Compare lengths or spread first.
- `_lessonQidUniverse` caches on `topic|lessonIdx` and returns the cached Set **without
  re-deriving**. Swapping a lesson's content under a fixed topic+index is something only a test
  does — give such scenarios their own topic key.
- `build()` **samples**: it emits a round, not the full question set, and a different subset per
  call. Never derive a question's identity by rebuilding; synthesize the exercise shape and let
  `qid()` key it.
- Fixture data is **not** a constant. A scenario that leans on "the first topic in `lessons.json`"
  will break when the bundled data is replaced.
- **`APP.cur` has a DEFAULT (`lessonIdx: 0`, index.html:1651) that sections silently depend on.**
  `_exFlagTarget` resolves a flagged item through `APP.cur?.lessonIdx`, and `assembleCoverageRound`
  keys the solved-set through the same fallback. So a section that needs a real lesson index must
  **mutate and restore the field** (`APP.cur.lessonIdx = i` … `= 0`), never replace or `delete` the
  object — doing either broke an unrelated later section in v71_r. Mutating also mirrors real play,
  where `openLesson` sets `C.lessonIdx = idx` immediately before `buildExercises(idx)`.

**(session 23) DESIGN PRINCIPLE — no language knowledge in the code.** The code must not encode
facts about particular human languages: article lists, gender rules, pronoun sets, inflection,
"which languages use articles", sentence-final punctuation. Producing correct language content is
the MODEL's job — instruct it in the prompt instead. A per-language table is written by whoever is
editing the code, is wrong in ways invisible until a native speaker looks, and fails silently for
any language missing from it.
*Not* covered: mechanical/typographic facts that decide how text is HANDLED rather than whether it
is CORRECT — Unicode normalisation, script/RTL detection, diacritic folding for comparison.
The test: **does this decide whether content is right, or only how it is displayed/compared?**
Known violations inventoried in `INTERNALS.md` → "Design principle"; the worst
(`normalizeVocabArticles`) actively degrades real data.

**(v71_w) Rules:**
- **A progress FRACTION and a FINISHED signal are different questions.** "How much have you played"
  may stay a raw count; anything asserting completeness — a colour, a lock, a tick, a connector line
  — must read the shared rule. The storyline page got this wrong for two releases in both
  directions at once, and nothing failed because the two rules agreed on the bundled data.
- **A source-pin regex that falls outside its own slice window is a vacuous pass.** A 4,000-char
  slice of `_renderChapterCard` stopped before the line being pinned. Check the pin actually sees
  what it claims to.

**(v71_u) Rules:**
- **Wiring changes need a RUN, not source assertions.** When one side sends and the other consumes,
  assertions on each half prove nothing about the join: in `v71_u` the server could ignore
  `arcTypes` entirely and the whole 156-check suite stayed green. If a change is "A now passes X to
  B", the test must observe B's OUTPUT.
- **A standard/vocab lesson has NO `type` field** — it is the default shape. `l.type === 'standard'`
  is never true, and an assertion written that way is vacuous (this bit inside the very test written
  to catch a vacuous pass). Use `(l.type || 'standard')`.
- **A test that re-implements the code it tests cannot fail when that code is deleted.**
  `unit-arc-options` kept passing after its feature was removed. If a test builds its own copy of a
  block to run it, it is testing the copy.
- **New lesson types need a `fake-ollama` branch**, or an e2e will skip them silently — the arc loop
  correctly refuses to abandon a run for one bad type, so the omission is invisible. Order matters:
  place a new matcher before any looser one that could swallow it (`correctIndex` is shared by
  comprehension and word_forms).

**(v71_t) Rules:**
- **Ollama truncates an over-long prompt SILENTLY.** `num_ctx` defaults to ~4096 and there is no
  error when the prompt exceeds it. Any change that makes a prompt bigger must size the context
  window in the same commit, or the extra text is discarded invisibly and the change looks like it
  worked. A deliberate trim in our code always beats letting the backend cut blindly.
- **`callLLMLesson` spreads the caller's opts AFTER its think policy**, so a caller passing
  `timeoutMs` or `tokens` OVERRIDES the ×3 / ×2.5 that reasoning mode applies. Check you are not
  lowering them — "raise the timeout" is easy to write as a reduction.

**(v71_s) Rules:**
- **A review render is not a play.** `showComplete(true)` repoints `APP.cur` at the LAST counted
  lesson so the vocab recap resolves, so anything that JUDGES the learner — records a done-flag,
  locks Next, counts an exposure — must be behind `!C._review`, or it judges a lesson nobody just
  played. Third time this shape has bitten (v71_n, v71_s twice).
- **A withheld done-flag makes `_firstUnfinishedLessonIdx` keep returning that lesson.** Any rule
  that refuses to mark a lesson done must also stop Next pointing back at it, or the forward button
  silently means "replay this" and steps over the v71_d lock.
- **When a builder or gate is narrowed by lesson type, narrow the COVERAGE UNIVERSE to match.** A
  denominator that counts questions the round will never ask can never be satisfied.

**(v71_r) Diagnosis rules:**
- **A red baseline is a finding until proven otherwise.** When only the DATA files are newer than
  the code, the obvious read is "stale fixture" — but check whether the guard is *right* first.
  In v71_r the fixture had indeed moved AND the property it asserted was false, hiding a live
  defect. Fixing the fixture alone would have shipped the bug.
- **A failure appearing *after* you fix another one may not be new — it may be running for the
  first time.** An earlier `assert` aborts the file, so everything below it is unexecuted. Verify by
  patching the PRISTINE tree to skip the original failure and watching the later section pass,
  before assuming your change caused it.
- **Guard a guard against going vacuous on new data.** If a section only means something when the
  corpus contains a case (here: a lesson exceeding its builder's cap), assert that such a case was
  actually found. Without it the section silently becomes a no-op — which is precisely how §8
  passed while grammar sampled at random.

(If you add a new standing rule, append it here so the next session inherits it.)
