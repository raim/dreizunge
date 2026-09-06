# Session prompt — written at the `v89_ad` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. The base cut is the bare number and is implicitly `a`, so point releases run
`v89_b`, `v89_c`, … A bump to a new BASE (`v90`) needs its own roadmap, per the protocol.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v89_ad`**. `roadmap_v89.md` was cut at
`v89` and is the current roadmap.

**IMPORTANT — the user is translating `ui.json` locally by hand.** Before adding or editing ANY `en`
key, tell them explicitly and let them pause first. Every cut in the `v87` and `v88` lines asked
first and was given an explicit budget, often smaller than proposed. **Ask again fresh THIS
session** — and try ZERO first: whole stretches of the `v88` line (`v88_ab`, `v88_ad`, `v88_af`,
`v88_ag`, `v88_ai`, `v88_al`, `v88_am`) shipped real features with no new keys at all, by reusing
strings the app already had.

**The user's own server runs on port 3000 across sessions** and WRITES to `lessons.json` while you
work. Check `git status --short lessons.json` at the start and again at commit time — the corpus
counts below are guarded, and their server moving a number is the usual reason that guard goes red.

⚠️⚠️ **`server.js` serves `index.html` with `readFileSync` PER REQUEST, so a CLIENT edit is LIVE in
the user's browser the instant it hits disk.** This is not a convenience note — at `v88_aj` a
half-applied rename (a function replaced before its three call sites were removed) put a
`ReferenceError` into their running app: the library rendered nothing and every `#sl=` deep link
died. **A rename deletes the callers FIRST, or lands as one atomic edit.** There is no window in
which a dangling reference is merely "not finished yet". A SERVER edit is not live — start your own
instance on another port to verify, and **kill it by PID** (`pkill -f "node server.js"` matches
theirs too).

---

## What the `v88` line was, in one screen

Thirty-nine point releases (`v88_a`…`v88_am`). `roadmap_v88.md` is the record — go there for how any
of it was built. What it closed:

- **The thirteen TODOs** handed over after `v88_a` (items `AM`…`AX`), plus two live bug reports and a
  flake audit.
- **Item `AU`** end to end: job cancel, idle release (30 → 60 min at the user's ruling), and the
  swallowed-cancel audit that found EIGHT sites where a reading had found two.
- **Item `AI`**: a curator can correct CP2's token analysis, the correction survives a re-analysis,
  and a per-chapter table works through the 63 unresolved tokens.
- **Item `Y`**: the storyline header's edit buttons behind one pencil — extended at `v88_am` to the
  library storyline cards and the chapter cards.
- **The chapter-wise progress lock**, removed on both surfaces that carried it.
- **The teacher walkthrough**, then generalised into a student BROWSE mode (▶ plays, → browses).
- **The standing "some LLM jobs have no cancel button" item**: all EIGHT formerly-blocking model
  routes are now listed, cancellable jobs behind one shape — `runAsJob` (server) + `_jobAwait`
  (client).

# WHERE TO START

**NOTHING IS OWED.** Every item the `v88` line was handed shipped, and the two the `v89` line was
handed shipped too. **Ask the user what they want next** — that is the right first move here.

## What the `v89` line has shipped so far

- **`v89_b`** — the progress card swipes left/right, pressing its own `comp-prev`/`comp-next`. Touch
  only, `passive:true`, scoped to `#complete-screen` minus `#comp-nav-modal`. ⚠️ Its
  **capture-phase click swallow** is load-bearing, not defensive: a horizontal touch drag still
  synthesises a `click`, which would otherwise ALSO fire `tapWord` or `_storyTapMaybeAdvance` on top
  of the swipe. `unit-card-swipe-nav.test.js`, twelve mutations all red.
- **`v89_c`** — inflections readout. The lemma question speaks its answer again, in the TARGET
  voice, **reversing `v86_ae`** (the user asked for it back with that ruling's trade-off known — if
  the mispronunciation returns, the lever is the VOICE policy, not that branch). ⚠️ **User ruling:
  the grammar-form label STAYS a source-language explanation.** Measured at the cut: the live corpus
  is genuinely MIXED — nl/de and it/nl chapters carry target-language labels, en/ja, de/en, it/en and
  en/de carry source-language ones — so reading the label with the target voice would fix one half by
  breaking the other. `PROMPTS.inflections` was hardened instead (explicit `NOT in {L}`, a field
  PARTITION, a re-read step) — and **MEASURED against the live model: OLD 0 of 3 runs compliant,
  NEW 1 of 3.** A partial mitigation, NOT a fix; it ships because it strictly improves and costs
  nothing. ⚠️ **The drift is per-RUN and all-or-nothing** (five German labels or five Dutch, never a
  mix). ⚠️ `unit-prompt-strictness`'s new section pins prompt TEXT and **cannot** guard model
  behaviour — the 1-of-3 came from a scratch spike, not the suite. The lever that would settle it is
  in the open list: normalise `formLabel`/`formChoices` after parsing, in `generateInflections`.
- **`v89_d`** — that normalisation pass, built at the user's request. `normaliseInflectionLabels`
  (server.js) runs AFTER `validateInflectionsItems`, sends every `formChoices` string of the lesson
  in ONE request keyed the way `metaTranslation` already keys its own, and re-derives `formLabel`
  from the normalised list at `formCorrectIndex`. Gated on `srcLang !== 'en'` — the same gate the
  meta pass uses, and the one item AJ justifies. Falls back PER ITEM (a missing key, an empty value,
  or two options collapsing onto one phrase), never per lesson. ⚠️ It only fixed NEW lessons
  at the time; `v89_f` backfilled the corpus.
  ⚠️ `explanation`/`title`/`desc` drift the SAME way (measured) and are deliberately NOT in scope:
  `explanation` quotes target-language word forms inside itself, so a translation pass over it can
  corrupt the very forms the exercise teaches.
- **`v89_e`** — the progress card now FOLLOWS THE FINGER and springs back (tier A of the evaluation
  the user asked for before committing to it). `#comp-body` is the element that moves, and that is
  load-bearing: **a transformed ancestor becomes the containing block for its `position:fixed`
  descendants**, and `#comp-nav-modal` is one — moving `#complete-screen` would quietly stop the ☰
  overlay covering the viewport. The axis locks ONCE at 10px and is never revisited; `touchmove` is
  the only non-passive listener and `preventDefault` is reached only on an 'x' lock, so scrolling a
  long card is untouched. ⚠️ **Tiers B and C were rejected on evidence**: the neighbouring chapter's
  text is not in memory (`_backToChapterProgress` fetches it; all 343 `APP.savedList` entries carry
  no `story`), and where forward LEADS lives in `comp-next`'s closure, resolved by `showComplete`'s
  gate chain at render time.
- **`v89_f`** — the BACKFILL, run for real against the corpus: 15 lessons, **28 of 60 items
  rewritten**, the rest already correct. `inflection-labels.js` now owns the RULES (gate, request
  shape, per-item fallback) and BOTH callers use it — server.js's generator and
  `backfill-inflection-labels.js`. ⚠️ The backfill re-reads `lessons.json` at write time and matches
  each repair on CONTENT (topic id → lesson id → the item's own sentence + surfaceForm + original
  choices), **never on an index**: the user's server writes that file while a run spends minutes
  inside model calls. ⚠️ `--write` RE-QUERIES the model, so what lands is not character-identical to
  what the dry run printed. **Known limitation, not fixed:** terminology is consistent WITHIN a
  lesson but not across the corpus — one German lesson says `Präteritum`, another `Vergangenheit`.
- **`v89_g`** — the swipe reaches the ENTRY card too. WHICH cards swipe is a TABLE now
  (`_SWIPE_CARDS`), not a hard-coded id; the entry card has NO back button at all (`prev: null`),
  which needs no special case — it flows into the same "nothing there" answer a hidden or disabled
  arrow already produced. ⚠️ **Two of this cut's assertions had to INVERT**: `unit-card-swipe-nav`
  §4/§16 pinned "the entry card is out of scope", and that was only ever true because the harness has
  no page tree and the fixture left `#sum-sumtext` DETACHED. The replacement out-of-scope surface is
  `#finished-screen`, and it is BUILT into the fixture, so the claim is about the page.
- **`v89_h`** — ⚠️ **A RUNNING SERVER SILENTLY REVERTS EVERY OFFLINE EDIT TO `lessons.json`.**
  `server.js` reads it ONCE at boot (`let store = loadStore()`) and `saveStore` writes its whole
  in-memory copy, so a server already running holds a pre-edit snapshot and writes it back the next
  time anything saves. It ate `v89_f`'s 28 backfilled items within minutes; found only by diffing the
  worktree against the commit. Affects **every** `backfill-*.js` here. Now in INTERNALS' silent-
  failure-modes section, and `backfill-inflection-labels.js` REFUSES to write while a server answers
  (`serverIsAnswering`, `--force` overrides). **Recovering a clobber: do NOT `git checkout` the file**
  — the clobbering write carries the other writer's genuine work too; re-apply content-keyed.
  Also records two new user items in the open list: **a "wrong" answer that is also correct** (with
  the instance, and why an instruction alone is not a mechanism), and **the phone select-text→tutor
  popover**, diagnosed but NOT fixed.
- **`v89_i`** — the phone select-text→tutor popover, FIXED. It is pinned to the **TOP of the VISIBLE
  area** (`visualViewport.offsetTop + 8`, because `position:fixed` is relative to the LAYOUT
  viewport and the two diverge as Android's URL bar collapses). ⚠️ **The durable lesson, now earned
  twice: pinning to a fixed viewport EDGE is the losing move** — `v84_d` moved it to the bottom to
  escape the Copy/Share toolbar, and the bottom is where Chrome draws *Touch to Search*. Both edges
  belong to the browser. Verified in emulation: rect `top 8 / bottom 44` of 812, **768px clear of the
  bottom band**, and identical for a completely different selection rect. ⚠️ **The Google bar itself
  is NOT suppressed and cannot be** from a page — moving the popover out of its way is the whole
  remedy available.
- **`v89_j`** — the answer-time **"was my wrong answer also correct?"** re-check. ⚠️ **It REPORTS,
  it does not GRADE**: nothing touches `markSolved`, the ledger, hearts or BKT, because a model
  deciding the learner was right after all would write PROGRESS state and a bad verdict would
  corrupt their history. **Default OFF** (user ruling — live-only and slow), settings row hidden
  without a backend. Scope: the four MEANING-based MCQ types only. ⚠️ **The parser's asymmetry is
  the safety property**: ONLY an explicit, ANCHORED `also acceptable` counts — a hedge
  (`probably also acceptable-ish`) read as approval until the guard caught it. **Live-measured on
  the user's own model: ~31s per check**, which is exactly why it is opt-in. **The first `ui.json`
  keys of the whole `v89` line — 3, granted explicitly** (`settings.answer_check`,
  `settings.answer_check_title`, `check.also_correct`).
- **`v89_k`** — ⚠️ **A REGRESSION `v89_e` SHIPPED, and the real reason the user still saw no popover
  after `v89_i`.** A finger adjusting a SELECTION moves horizontally, so the swipe's axis lock called
  it a swipe — and `_cardSwipeDragBegin` sets `user-select:none` on the card, which **COLLAPSES a
  selection live inside that container**. `_storySelMaybeShow` then read `sel.isCollapsed` and
  returned, so PLAN §12 stopped working on touch entirely. Reproduced in a real browser (selection
  came back EMPTY, card had travelled 68px, chapter had changed), fixed by checking for a live
  selection AT THE AXIS LOCK — before any drag begins, any `user-select` is touched, or
  `preventDefault` is reached. ⚠️ **The lesson: `v89_i`'s placement fix was correct and was not the
  bug.** Two releases were spent on the visible symptom.
- **`v89_l`** — the answer re-check gets **its own model role**, `OLLAMA_ANSWERCHECK_MODEL`, after
  measuring four installed models on the real prompt with 5 known-answer cases (3 of them tempting
  near-misses, because the failure that matters is a FALSE accept):
  `qwen2.5:7b` **3/5 with 1 FALSE ACCEPT** at 22.6s · `translategemma:12b` 5/5 at 106s ·
  **`qwen2.5:14b` 5/5 at 25.3s ← the new default** · `qwen3.6:35b-a3b` 5/5 at 39.1s (the old one).
  ⚠️ **The cheapest model is the disqualified one**, and a dense 12B loses badly to a 3B-active MoE.
  ⚠️ Five cases is an indication, not a verdict — re-measure before treating the default as settled.
  It is the ONLY role whose default names a model no other role does, which is why it also had to
  join `configuredModels()` (the idle/shutdown release list).
- **`v89_m`** — documentation only, at the user's request as the line wound down. Two new roadmap
  sections: **🖥️ what a real GPU server would buy** (⚠️ **measured**: `vram=0.0GB`, everything runs
  on a 15 W laptop CPU at **13.9 tok/s prefill / 5.5 tok/s decode** — tutor ≈ **40×** faster on a
  GPU, whole-chapter CP2 analysis **50–150×**) and **🌐 putting this on the internet, multi-user**
  (⚠️ Tier 0.1 is the wholesale `lessons.json` write — the same mechanism that ate `v89_f`; nothing
  else on that list matters until it is fixed). Plus two new open items: the **comic-chapter
  "continued from" loss** (confirmed from the data, cause not found, two hypotheses and the decisive
  next step recorded) and the **static build's missing `loadScripts()`**.
- **`v89_n`** — ⚠️ **A CORRECTION.** `v89_m` recorded the comic chapter's missing lessons as a
  "race, not a loss". **It was a loss.** The user: *"i restarted those manually."* The lessons that
  appeared were their own re-adds, and the job LABELS said so at the time (`Adding … lesson` is
  `/api/lessons/add-lesson`, not the book job) — **the evidence was in hand and read the wrong way
  round.** Both halves of that report are real. The open item now carries the corrected hypothesis
  space, what was RULED OUT by reading the source (the type list IS rendered for a one-panel comic —
  `_genArcApplicable()` returns `n >= 1` for non-LLM modes), and an explicit **do not attempt a fix
  before reading the server log**.
- **`v89_o`** — ⚠️ **DIAGNOSED from the user's server log, and it is a one-line cause.** A
  **one-chapter book silently discards every selected lesson type**: `_runBookJob`'s arc block is
  gated on **`i >= 1`**, so for a single photographed panel or one-chunk PDF (`i` is only ever `0`)
  the whole block is skipped. The log shows the five types RECEIVED and echoed back
  (`arc=[standard,word_forms,inflections,conjugation,comprehension]`) and then `Lesson 1/1` — one
  standard lesson, nothing else. ⚠️ **It needs a RULING, not a patch**: the tick-list reads as "which
  types should each chapter get", the code is built as "which types reinforce EARLIER chapters".
  Separately, the same log line shows **`continuedFrom=-`** — the lineage was lost CLIENT-side, the
  server never received it, and that send path reading controls the learner's route may never have
  populated is now a THREE-TIME hazard (`AL`, `v86_v`, here).
- **`v89_p`** — **FIXED**, on the user's ruling *"the ticks mean lesson types per chapter."* The
  `i >= 1` gate is gone: every chapter gets its ticked types. Two types are FILTERED and each skip is
  **logged with its reason** — `'standard'` (⚠️ `generate()` already produced it whenever arc is on,
  so the arc loop was a straight duplicate; **pre-existing for chapters 2+**, removed for all
  chapters rather than left inconsistent) and `'review'` **when there is no parent** (it drills prior
  chapters' vocab; on chapter 1 that list is empty). ⚠️ `e2e-book-arc-types`' *"chapter 1 is still
  the gate lesson only"* assertion pinned the very gate the ruling replaced and was **RE-SCOPED, not
  deleted**. Five mutations red, including restoring the bug itself. **The lineage half of that same
  report is still OPEN** — it is client-side (`continuedFrom=-`).
- **`v89_q`** — the static build now **calls `loadScripts()`**. `scripts.json` was baked in as
  `window.SCRIPTS_DATA` and the loader existed to pick it up, but the static `init()` never called
  it, so `SCRIPTS_DATA` stayed `{}`, `scriptsForLang()` returned `[]`, and **the LLM-free alphabet
  course could not be offered in any published build**. Guarded BEHAVIOURALLY against
  `docs/index.html` (`unit-static-scripts-data.test.js`) — a source check could not see it, because
  both halves were individually correct. ⚠️ Two standing traps hit while writing it: a **backtick in
  a comment inside `build-static.js`'s template literal** broke the build, and a **bare-name regex
  matched the new comment** so the mutation check stayed green with the call deleted (now matched on
  `await loadScripts();`).
- **`v89_r`** — `OLLAMA_TUTOR_MODEL` and `OLLAMA_ANALYSIS_MODEL` join `configuredModels()`, the
  idle/shutdown RELEASE list. They had been missing since they were introduced: a role absent from
  that list is a model this server can LOAD and never FREE. ⚠️ **The list is now guarded
  STRUCTURALLY** — `unit-model-roles.test.js` enumerates every `let OLLAMA_*_MODEL` in server.js and
  requires each to appear both there AND in `/api/models`'s validated `requested` array. **Adding a
  role and forgetting either now fails the suite**, which is the only reason three of eight could go
  missing. A guard that must be edited when a role is added is a guard that will be forgotten
  exactly when it matters.
- **`v89_s`** — the **continue-from send paths read the RECORD, not the view**. `#continue-select` is
  a view: ⚠️ **measured in a real browser — a `<select>` clears its value on ANY `innerHTML` rebuild**,
  even when the matching option survives, so `repopulateContinueSelect()` relies entirely on its own
  restore line, which fails when the wanted chapter is not among the freshly built options (an empty
  or stale `APP.savedList` at rebuild time). `APP.contPin` already had every property needed — set by
  the picker's onchange, persisted, restored at boot, **cleared when the learner picks "— new
  story —"**, so the fallback cannot resurrect a cancelled choice. `_continueFromRef()` is now the
  ONE resolver and all **eight** send sites use it; a pin whose chapter no longer exists is dropped
  rather than sent as a dangling ref. ⚠️ The harness **cannot** reproduce the reset (its stub
  `select.value` is independent of its options) — recorded in INTERNALS §5.
- **`v89_t`** — the chapter-title parser reads **an array of bare STRINGS** (`["Hub Domburg"]`), the
  shape behind the user's `0/1 titles came back named` × 3. ⚠️ **The log's two failure wordings are
  what identified it without guessing**: an unparseable reply logs `Attempt N failed: …`, a
  wrong-SHAPED one logs `0/N came back named` — theirs was the second, so the answer was valid JSON
  the normaliser read nothing out of. Same class as `v77_x`'s pair arrays, and the same lesson:
  **a parse that succeeds into the wrong shape is worse than one that fails.** A bare OBJECT is now
  accepted too, but **only when `n === 1`**, where it is unambiguous — for `n > 1` it must still fail
  so the retry can get a real answer.
- **`v89_u`** — ⚠️ **strategy 1 does NOT work, and the measurement says so.** Two findings.
  **(1)** The roadmap's framing — *"harden the prompt so DISTRACTORS must be wrong for this item"* —
  aimed at a lever that **does not exist**: distractors for the meaning-based MCQ types are chosen
  **CLIENT-side** by `wS`/`wV` sampling sibling glosses, filtered only by exact string inequality.
  The model never picks them. **(2)** The nearest real lever — a rule in `PROMPTS.vocab`/
  `vocabFromText` that no two items in one lesson may be interchangeable — was added AND measured
  against the live model on the exact sign that produced the bug: **3 of 3 runs defective before,
  3 of 3 after.** No improvement at all. The reason is structural: the source text itself says
  *"gratis en kosteloos"*, so "teach the words in this text" and "don't include interchangeable
  items" are in direct conflict, and the text wins. The rule is KEPT (free, correct, may help texts
  that do not force a synonym pair) but **must not be believed** — `v89_j`'s answer-time re-check is
  the only thing measured to handle this case.
- **`v89_v`** — an **explicit** QC run now catches it (user ruling: *"don't do on default. it is a
  very rare case"*). `qcCheckAmbiguousOptions` is a **LESSON-level** check — the ambiguity is a
  property of a PAIR, and there is no option set to inspect because `wS`/`wV` resample the
  distractors every round, so the POOL is what gets judged. ONE call per lesson. ⚠️ **The ROLE was
  measured**: the QC-role model returned `[]` twice on the user's own lesson (catches nothing), while
  the **answer-check** role's default found the pair twice with a correct German reason AND stayed
  silent twice on a clean control — so it uses `callLLMAnswerCheck`. ⚠️ It writes under its own
  `QC_AMBIGUOUS_BY` bucket: `_check` clears whatever flag exists for the model it writes under, so
  sharing the QC key would have wiped every translation flag. Reached by the **shift-click** QC
  gesture (zero `ui.json` keys); an explicit `scope.checkAmbiguous` overrides.
- **`v89_w`** — **roadmap item B is CLOSED**: the model picker now has rows for `vision`, `analysis`
  and `answerCheck`, so all EIGHT server roles are settable in-app. ⚠️ Item B's open design question
  ("Ollama's capabilities field vs. a family-name allowlist") was settled by **measurement**: the
  vision row is filtered by `/api/show`'s `capabilities`, because `translategemma:12b` and
  `qwen3.6:35b-a3b` both report vision — a name allowlist would have kept only `qwen2.5vl` and
  dropped six working models. ⚠️ **One row, two features**: `answerCheck` drives BOTH the answer-time
  re-check (`v89_j`) and the ambiguous-options QC (`v89_v`), since both call `callLLMAnswerCheck`.
  **3 `ui.json` keys, granted.**
- **`v89_x`** — two speech-input bugs. ⚠️ **The app was answering its own questions**: `renderEx`
  opens the mic and only THEN queues the readout, so on `listen_type` — where the readout IS the
  answer — recognition heard the app speak `ex.target` and filled it in. The mic now waits for the
  engine to fall quiet, POLLED (the readout runs on its own timer and can be re-queued by the unlock
  path, so a poll observes the ENGINE whoever started it), with `_speakAndAdvance`'s three-way shape:
  spoke-then-stopped / never-started-within-grace / hard cap. Gated on `_exAutoSpeaks(ex)` — **one
  shared predicate**, used by `renderEx` to DO the readout and the mic to WAIT for it. And the four
  `ex.mic_no_match` toasts are gone (they fired on background noise); the heard WORD and the filled
  input remain — ⚠️ the key STAYS in `ui.json`, hand-translated into five languages.
- **`v89_y`** — a failed chapter-title post-pass is now VISIBLE (user ruling). ⚠️ **A MARK, not a
  replacement title**: the raw placeholder stays and gets a ⚠️ badge whose tooltip says to rename it.
  An invented title would read as deliberate, which makes a bad one HARDER to notice. `_titleFailed`
  is set only where a title genuinely failed (never on a user-named chapter, `topicAuto === false`),
  cleared by ANY applied title and by a manual rename — **before** the no-op check, so re-confirming
  the existing name also dismisses it. ⚠️ It rides in the **savedList whitelist**: the projection's
  own comments record that trap twice (`v74_i`, `v79_n`) — a field left out works in the static build
  and is silently dead live. **1 `ui.json` key, granted.**

- **`v89_z`** — the comic review card has **ONE** text box, not two (user question, then ruling).
  ⚠️ **This reverses `v88_ab`'s "keep the split as-is"** — that ruling was about the DESCRIPTION and
  waved the caption/in-scene split through without examining it. Asked directly this time, the code
  answered the user: `_comicTextFromFields` joins the two with a single newline, every consumer
  re-joins identically, and a story edit already collapses them. **No consumer ever distinguished
  them.** `_comicReviewEdit(k,'text',v)` writes the whole value to `caption` and **CLEARS `inScene`**
  — load-bearing, since a survivor is re-appended downstream and a deleted line comes back. The
  extraction prompt's `CAPTION:`/`IN-SCENE:` contract is UNCHANGED (two named slots is a better
  prompt than one). **ZERO `ui.json` keys.**

- **`v89_aa`** — extracted image text is un-shouted AUTOMATICALLY, and a text QC can be run on
  demand on the comic review card and the PDF chunk panel (user report + rulings: 2 `ui.json` keys,
  both surfaces). ⚠️ **The clearest "an instruction is not a mechanism" case this project has
  produced**: `_comicExtractPrompt` has asked for normal capitalization since `v85_k` with a German
  worked example `v85_l` proved necessary, and the corpus holds THAT EXAMPLE'S OWN SENTENCE shouted
  back. A deterministic detector (floor 4, measured over all 20 corpus panels — real signs score
  1-3 and must be LEFT) gates a repair pass whose reply is structurally verified: **surface only**,
  word count and line count pinned, a changed word allowed only as a bounded repair.
  ⚠️ `_surfaceKey` folds **UP** because German ß upper-cases to SS — a live run caught that, and
  folding down made the retry return a WORSE result. ⚠️ The on-demand QC deliberately does NOT gate
  on the detector: typos leave no all-caps trace. Model measured across 4 real panels
  (translategemma:12b 4/4; **an earlier draft picked a different model off ONE sample and was
  reversed**). 19 mutations red across two new files, 3 of them vacuous on the first pass.

- **`v89_ab`** — the text QC now **proposes** through the same reviewable diff panel story QC has
  used since `v55_g`, instead of applying and leaning on undo. ⚠️ **The user's question was the
  finding**: they asked whether this was the same as "Proofread with QC model", and the comparison
  should have happened before `v89_aa` was designed. They are genuinely different (saved chapter vs
  draft text; may change words vs may not — **a transcription has ground truth a generated story
  does not**), but the older one had the better interaction and `_renderQcProposalInto` was already
  factored for reuse. It gained two options (`prop.pairs`, `o.cleanKey`); both existing callers are
  untouched; **zero new `ui.json` keys**. One row per ITEM, ticked rows only. Nine mutations red.

- **`v89_ac`** — **ONE QC engine, two modes, one picker.** `generateStoryQc`, `generateSummaryQc` (a
  near-verbatim copy of it) and `normaliseExtractedText` collapsed into `qcProse(text, lang, {mode,
  kind})`. ⚠️ **`mode` names a BEHAVIOUR, not a flag on one**: it picks a prompt AND a verifier AND a
  retry policy together — heavy may change words and is checked statistically, light may not and is
  checked structurally. `_qcPickMode` fronts all four QC buttons (story, summary, comic, PDF); the
  per-surface default is a safety property, not a convenience. ⚠️ **Behaviour preservation is proven
  by a DIFF**: `test/fixtures/qc-premerge.json` holds 9 outputs captured from the pre-merge functions
  and the parity test replays each through the merged engine. ⚠️ **Two bugs found in a BROWSER, not
  by tests**: the picker rendered invisibly behind the comic review card (z-index 300 vs its 400),
  and a flagged heavy verdict showed no warning. **2 `ui.json` keys.** 23 mutations red.

- **`v89_ad`** — **the flake audit is DONE, and the tests were never the problem.**
  `unit-ui-journeys`/`unit-word-progress` measure 40/40 standalone, 60/60 under seeded shuffles,
  15/15 under 8-way CPU load. The failures were TORN READS of `lessons.json`: `fs.writeFileSync` on
  a 10MB file is a truncate plus many `write()` calls, so a concurrent reader can see a prefix —
  reproduced 3-in-25 with a churning corpus, 0-in-25 through an atomic writer. ⚠️ **The severe half
  is not the tests**: a crash in that window truncates the corpus, and there is NO backup anywhere
  in this project — same exposure on `learners.json`, `ui.json`, `drafts.json`,
  `canonical-analysis.json`. All seven live-server writes now go through `atomic-write.js`.
  ⚠️ Two traps: `fs.watch` follows the INODE (so `saveUI` re-arms the watcher, or hand edits stop
  hot-reloading), and `rename` preserves the TEMP's mode (so 0600 goes on the temp). **Four for
  four** — every examined "known flake" label was hiding a real defect.

`roadmap_v89.md`'s **"🆕 THE SHORT LIST"** at the top of `# ⚠️ OPEN AT THE v89 CUT` is the reconciled
open list, and it is the one to read: every line in it was cross-checked against `roadmap_v88.md`'s
shipped section at this cut, and **three items the previous prompt still carried as open turned out
to be stale and were dropped**. Do not re-derive it from older prompts.

**The shortest paths to value if the user has no preference:**
- **Item `V`** (multi-image upload) — fully specified, unblocked, no decision needed.
- **Delete the superseded `kind:'sync'` popover path** — `_jobsTracked` and `_jobsInflight` have had
  NO callers since `v88_al` and are marked as such in place. Removing them means re-scoping the tests
  that pin them; deliberately left for its own release.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v89.md` — its **index table** and **⚠️ Session protocol** block first, then
   **"🆕 THE SHORT LIST"**, then the standing RULES (which now include a block for the `v88` line).
3. `build_history/roadmap_v88.md` is KEPT as the record for the whole `v88` line (`v88_a`…`v88_am`,
   thirty-nine point releases) — go there for how anything from that line was built.
   `roadmap_v87.md` likewise for the `v87` line, and it holds that line's own rules block.
4. `INTERNALS.md` **§6b, the feature → function map** — read it BEFORE grepping for where anything
   lives. Current through `v89`.

## Establish a green baseline before changing anything

**⚠️ Run `node build-static.js` at EVERY release, even a server-only one.** `APP_VERSION` lives in
`server.js` and is BAKED into `docs/index.html`, so "no client change → no rebuild" is wrong and cost
a red suite at `v88_g`. `unit-static-freshness` will NOT catch it (it compares the eight baked
inputs, and `server.js` is not among them); `unit-version-derivation` is the one that does.

```
node test/run.js                          → expect 352 checks
node test/run.js --quick                  → expect 291
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

⚠️ **The full suite now takes ~9 minutes** and sits close to a 10-minute tool timeout. Run it in the
BACKGROUND and wait on the output file. ⚠️ **Do NOT wait with `until ! pgrep -f "test/run.js"`** —
`pgrep -f` matches the waiting shell's OWN command line and the loop never exits; twenty leaked
processes once spanned 11 hours. Wait on the file (`until tail -1 out.txt | grep -qE '^(ALL CHECKS
PASSED|FAILED [0-9]+ of)'`) or bracket the pattern (`"[t]est/run.js"`). Same family as the standing
`pkill -f "node server.js"` warning, from the other direction.

**Check `ps -eo pid,cmd | grep '[f]ake-ollama'` before trusting a load flake** — four orphaned fake
servers, the oldest 29 hours old, were once holding ports.

### The flake picture, as it actually stands

- **`e2e-idle-release` — EXPLAINED at `v88_ak`, and it was never flaky.** One sweep releases every
  configured model IN PARALLEL, so it writes one log entry PER MODEL (two in the harness); the test
  counted ENTRIES as a proxy for SWEEPS and its §2 exited on the first one. The metric is now the
  number of sweeps. ⚠️ **NOT "cleared"**: the fix is justified by construction, not by reproducing
  the failure (the old counting passed 6/6 under three busy-loop CPU hogs). **If it fails again,
  capture the entry arrival times from the failing run — do not re-run it.**
- **`unit-tap-word` (`v87_i`) and `unit-observations-log` (`v88_h`) are FIXED, not flaky.** A failure
  in either now is a genuine regression.
- **`unit-ui-journeys` / `unit-word-progress` are UNVERIFIED**, not clean — 12/12 each is far too few
  runs to mean anything.
- **A DETERMINISTIC failure is not the documented flakiness.** At `v87_o` two tests failed 8/8
  because the user's server had written a chapter and broken two fixture SELECTIONS;
  `git show HEAD:lessons.json` isolated it in one command. Don't run the full and `--quick` suites
  CONCURRENTLY on this box (`v86_ae`).

Corpus at this cut: **352 topics, 99 storylines, 33 languages, 766 `en` keys** — an inherently live
snapshot; re-measure fresh at commit time. `APP_VERSION = 'v89_ad'`.

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is usually the thing
> to fix** — but diagnose which side is wrong first, and remember the user's live server is the most
> common cause of a moved corpus count.

## The habits that cost this project the most

The standing rules live in `roadmap_v89.md`: "Rules earned in session 28…34" plus dedicated blocks
for the `v83`/`v84`/`v85`/`v86` lines and **a new one for the `v88` line**. Read the **"⚠️ How the
rules are NUMBERED"** note before citing one. The `v87` line's block is in `roadmap_v87.md`.

**If you read only four of them, read these — each cost a release in the `v88` line:**

1. **⚠️ CONTAINMENT IS THE PROXY THAT KEEPS HIDING DEFECTS.** THREE releases in a row shipped a bug
   past a guard that used `includes`: a button whose `onclick` was truncated by mis-escaped quotes
   and could not work at all; a label that rendered its icon twice; and a too-greedy string strip
   that the button's own `title` attribute satisfied. **Assert on the delimited value** — the label
   span, the whole attribute, an equality — never on "the string appears somewhere".
2. **A guard can become an assertion of the WRONG THING without ever going red** — seven times in the
   `v88` line. When a user replaces a ruling, **grep the suite for the ruling's own words before
   writing code**, and re-scope rather than delete.
3. **Mutation-test every guard you write.** When one stays GREEN, that is the finding: ask whether
   the two branches are distinguishable at all, and whether the FIXTURE covers the case (a fixture
   using `"Een … een"` made every token occurrence 0 of its own surface, so a mutation ignoring the
   occurrence index stayed green in TWO files).
4. **Verify at the layer the user touches.** A live check that CALLS a function proves nothing about
   the button wired to it — `v88_ai`'s ▶ table button was verified by calling `_teOpenCuratorTable`
   and shipped inert. Click the button.

**Harness traps that are not about your code:** `getElementById` AUTO-VIVIFIES and caches, so a test
that creates its own element with the same id inspects a DIFFERENT object and fails on a correct
tree. Any backslash or backtick inside a template literal is processed TWICE — a comment containing
backticks terminates the literal, and a regex with escaped slashes can arrive as a line comment.

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map. Read it BEFORE grepping for where anything
lives.

**The shapes this project has settled on, so a new one is not invented:**
- A long model-backed route becomes a job with **`runAsJob(res, meta, producer)`** (server) and
  **`_jobAwait(response)`** (client). Validation stays OUTSIDE the producer; only `running`/`pending`
  may continue polling; add a per-item `CANCELLED` re-throw and a checkpoint wherever there is a loop.
- A card's edit affordances go behind one pencil with **`_cardEditPopHtml`**; the storyline page's
  static header uses **`_slEditMenuSync`**. Row labels come from the buttons' own `title` attributes,
  which is why these cost no `ui.json` keys.
- Per-chapter state that must survive a regeneration belongs in an OVERLAY store keyed on something
  stable (**never** an index — see `analysis-corrections.js`'s header), merged on read, and pruned by
  the chapter-delete route.
