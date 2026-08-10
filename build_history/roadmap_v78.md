# Dreizunge roadmap — v78

Current cut: **`v78`**. Baseline `node test/run.js` **192**, `--quick` **168**, `check-inline` 0 on
both builds. Corpus: **308 topics, 86 storylines**.

> **Carried forward from `roadmap_v77.md` in full.** Everything below — the session protocol, the
> standing rules (now twenty-six, sessions 28–32), the §0 rulings, and every open item — survives
> the cut. The user's triaged testing notes are in "USER TESTING NOTES"; start there. The shipped table lists the
> v76 line for context; new releases are appended above it.

> **Carried forward from `roadmap_v75.md` in full, from §3 onward.** The v71→v72 boundary lost three
> items that were only recovered in `v73_k`; everything still open is reproduced below rather than
> referenced. `roadmap_v75.md` remains for the shipped table and the session-28/29 rules.

## The v78 cut

**`v78` is a CUT, not a change.** Session 31 shipped `v77_b` … `v77_x` (23 point releases); this
renames the line and takes the user's current data files. Nothing in the code changed at the cut.

**Data arrived with the cut** — `lessons.json` 305 → **308 topics**, 84 → **86 storylines**;
`learners.json` and `languages.json` also newer; `ui.json` unchanged. Two things followed from it,
both the documented guards doing their job:
- `unit-script-choice` went red — the 3 new topics were unstamped. `node backfill-script.js --write`
  stamped them, exactly as the handover says.
- `unit-mixed-unlock-reachable` went red on a NEW chapter, and the test was wrong rather than the
  product: it asserted coverage was COMPLETE at unlock, which held on the v77 corpus only because
  the replay loop stops when the gate opens and there it happened to open at 100%. The prep gate is
  not pure coverage; the new chapter unlocked at 31 of 43. Corrected to assert what the file is
  actually for — that the unlock is reachable by playing.

## Shipped after the v76 cut

| release | what |
|---|---|
| `v78_r` | **(user) Three fixes to the story-CONTINUATION pipeline.** (a) **The full-story-context checkbox now defaults ON.** Continuing with only the previous chapter as context is how a continuation loses the thread; the full chain is what "continue this story" means. (b) **The chapter-title post-pass sees the WHOLE CHAIN**, not just the chapters the job added — which is why it failed. The user's report: adding chapters 3-4 to a six-chapter storyline gave `0/2 titles came back named` on all three attempts, while the storyline-header button (which passes all six) succeeded first time. **A mid-story fragment with no beginning is not enough for the model to name anything, and `v71_p`'s three-attempt retry cannot fix missing context — it retries the same impossible request.** Worth keeping as a diagnostic: a retry loop makes a context bug look like a flaky model. Titles now come back for the whole chain and are applied **only to the chapters this job added**, matched BY ID rather than by position (`chapterIds` need not be a contiguous tail). (c) **An existing storyline title or summary is no longer overwritten** — and the old behaviour was worse than a rename, because it regenerated them from the NEW chapters alone, replacing whole-story text with text about its tail. Skips are logged, so "generated nothing" stays distinguishable from "failed". When they ARE generated for the first time, they now use the whole chain too (§5 asserts that half, since skipping regeneration is only half the ruling). **And a seventh window pin retired — my own**: the first draft of §5 sliced 600 bytes back from `indexOf('generateStorylineSummary')`, which matched the name inside that section's own COMMENT and looked backwards into the title block. Replaced with marker-bounded slices. Written in the same session that retired six such pins, which is the point: the shape is easy to reach for and wrong every time. |
| `v78_q` | **(user hint, following the `v78_p` report) An explicit SCRIPT PICK was discarded by a no-op language re-selection.** The user's own lead — "it may be related to the recent fix to avoid losing the selected 'continue from' when selecting other languages" — was the right thread. `selectLang(code)` has **no early return**, so it runs in full even when `code` is the language already active, which every mirror/refresh does; it then cleared `APP.script` unconditionally (`v76_i`, correct for a REAL change). `_renderScriptPicker` next recomputes `cur = APP.script \|\| _inheritedScript()` and inherits the **CONTINUED CHAPTER'S** script — so continuing a Latin Serbian chapter turned an explicit Cyrillic pick back into Latin, with the dropdown following, so nothing looked wrong. **Intermittent by construction** — it depended on whether anything re-selected the language between the pick and the submit, which is exactly the "worked on the second attempt" the user saw; and the continue-pin surviving language changes is what makes an inherited script available to overwrite with. Now cleared only on a REAL change, both sides. `v76_i` still holds (§3 asserts a genuine language switch still clears) and so does `v76_g`'s inheritance ruling (§5 asserts it still applies when nothing was picked). **Also: the book route now LOGS `script`, `srcScript` and `arcScript`.** The `v78_p` report could not be diagnosed from the console because that line never showed whether the chosen script had arrived — the one fact separating "the client did not send it" from "the server dropped it" from "the model ignored it". **And one more window pin retired**: `unit-tts-test-row` sliced a fixed 900 characters of `selectLang` and broke when a comment was added inside it, while the ordering claim it makes stayed true — replaced with a brace-matched slice (rule 18; the sixth such pin this session). |
| `v78_p` | **(user-reported) A multi-chapter job dropped the chosen SCRIPT — one omission, two symptoms.** The user continued a `de → sr` storyline with 2 chapters, selected Serbian **Cyrillic**, and got Latin stories and no script lessons. Cause: the client's multi-chapter body (`gbody`) never set `script`/`srcScript`, and the server's book-route `userOpts` did not carry them either — so fixing one end alone would have moved the failure one hop. `generate()` reads `userOpts.script` for THREE things, which is why one missing field produced both complaints: the story prompt's `scriptNote` (v76_h) was omitted so the model wrote `sr` in its default Latin; the saved topic went unstamped; and the arc primer then ran `introExtendLetters('cyrillic-sr', <a Latin text>)`, found **no Cyrillic letters in the chapter**, and built nothing. **"Script lessons were never made" was not a second bug — it was a consequence of the first**, and diagnosing it as two would have produced two wrong fixes. `/api/generate` had always passed the scripts; only the book route did not, which is why `v78_g` missed it — its reproduction case was a single-chapter storyline. Both halves revert-verified independently. **Also, the case-insensitivity request was MEASURED ALREADY TRUE and closed with a guard rather than a change**: the matcher's regex carries `i` and `_hlKey` folds case on both sides, and a 120-chapter sweep found only 8 vocabulary entries present-but-unmarked, all Arabic and none a case problem. `unit-highlight-split` now asserts folding in Latin, Cyrillic and Greek and in the solved shade — sentence-initial capitals are exactly where the reading eye lands first. |
| `v78_o` | **Measurement and documentation only — NO product change.** Given its own version rather than re-issuing `v78_n`'s zip with different contents, because two packages with one name is worse than an extra letter. Contains **THE COVERAGE MEASUREMENT** (roadmap section of that name; session-32 notes §22) and the two probes that produced it, kept in `build_history/` with their results in the headers so a later run has something to diff: `probe_coverage_v78n.js` and `probe_coverage_bands_v78n.js`. The finding, in one line: **a chapter's lessons teach 9.2% of its story's tokens and 8.2% of its distinct word types (median chapter 13.2%, none above 50%), and the RAREST words are the LEAST covered at 5.1%** — so the per-text learning scheme is a GENERATION problem *and* a POLICY change, not a top-up, and "for a simple text go towards the basic words too" is not a separate mode because the top-100 frequency band sits at 9% as well. Measured through the PRODUCT matcher (`_highlightVocabHtml` + `_storyWordSources`), never a re-implementation, and the frequency bands are derived by corpus statistics rather than a word list (INTERNALS §4). |
| `v78_n` | **(user, §0d) The three remaining card items — two fixed, one measured already true.** (a) **The ✕ on a question card returns to the PROGRESS CARD of the lesson being played**, not the storyline deck. Quitting is a step back inside the chapter, and the card is the page that says what this lesson is and how far through it you are. Uses the REVIEW render, which records nothing — the round's partial score is already folded into `completed` by `confirmQuit` itself, and a play render would count it twice. `showComplete` gained an optional `lessonIdxOverride`, because review mode deliberately points at the LAST counted lesson (it exists for re-opening a finished chapter, where "which lesson" has no answer) and quitting has a very definite answer. Not for a drill — `endDrill()` has just restored the real topic — and it falls back to the old behaviour whenever the card cannot render, so ✕ always goes somewhere. (b) **The post-unlock bar shows on EVERY progress card of a chapter that has such lessons**, not only while one is blocking Next. It came from `_lessonGate`, set only when a story-gated lesson is both unfinished AND the one just played, so the learner saw "Verständnis 3/8" on one card and nothing on the next with no way to tell the work still existed — the user's screenshot exactly. One row per post lesson, labelled with the lesson's OWN TITLE (data, no new `ui.json` key, the same choice `v73_d` made), marked at 100 because a story-gated lesson must be fully solved. The gate row is no longer emitted separately: it is already among them, and two bars for one quantity is the `v74_g` mistake. (c) **"Replay must ALWAYS be available" was MEASURED ALREADY TRUE** and left alone — `v71_h` shows the button always and `repeatForCoverage` falls back to the current lesson when nothing is coverage-short, so 100% stays reachable. Asserted anyway (§5) so a future coverage change cannot quietly strand it. **Two more rule-18 signature pins retired on the way** (`unit-learner-nav`, `unit-card-errors` both pinned `function showComplete(review)` exactly) and one positional pin (`unit-coverage-threshold` read the %-solved bar as `rows[rows.length-1]`; it now finds it by LABEL — it had been passing on the chosen chapters rather than on the rule, since `v73_d`'s gate row could already append after it). **`probe_gates_v77.js` re-run and diffed against the `v78_l` baseline: the 16-row gate table is byte-identical.** |
| `v78_l` | **(user) Replay targets the LEAST-COVERED lesson, not the first coverage-short one.** The user asked whether "replay lessons not yet seen" conflicts with the button's definition. **It does not** — Replay is `repeatForCoverage`, whose job is to raise COVERAGE, so a lesson at 100% is correctly skipped; but an unplayed lesson is not at 100%, it is at ZERO, so "prefer ones not yet seen" is the STRONGEST case of the rule already there, not a competing one. Only the ORDER was wrong: the scan returned the first short lesson in DOCUMENT order, and a comprehension lesson sits early and stays short (since `v77_t` a repeat asks only the questions still unanswered), so it won every scan and later unplayed lessons were never reached — exactly what the user saw. Now the minimum of `solved/total`. **A FRACTION, not a remaining count**: a 4-question lesson never played must outrank a 40-question one that is 90% done, though both have 4 left — §3 asserts that with the remainders deliberately equal, so only the rule can decide it. **Ties keep document order** (stable scan), so an evenly-covered chapter behaves exactly as before, which is what keeps this an ordering fix rather than a reshuffle. Revert-verified three ways: first-in-order fails §1; fewest-remaining fails §1; MOST-remaining passes §1 and §2 and fails §3, which is the only weakening that isolates the fraction rule. **`probe_gates_v77.js` re-run and diffed against the `v78_k` baseline — the 16-row gate table is byte-identical**, as the protocol requires after any progress-card change. |
| `v78_k` | **§3 whitespace splitting — the last unshipped part of §3, ruled in sessions 29/30.** A multi-token vocabulary entry matched only as a whole phrase, so `la variazione genetica` marked nothing in a story containing just `variazione` — the commonest shape in the corpus, since vocabulary is stored with its article (181 of 1408 entries across 96 chapters carry a space). Each entry now contributes the whole phrase AND each token; longest-first ordering means **the phrase still wins wherever it is actually present**, so this only adds marks where the phrase could not reach. **Measured A/B on the current corpus, splitting off vs on: 761 → 1071 marks, +310, 41 of 96 chapters gaining.** The ruling recorded +782; that figure predates `v77_u` (the apostrophe fold, which independently recovered part of the same gap) and a corpus that has turned over several times — **the direction and decisiveness hold, the number does not, and the guard states the measured one rather than repeating the stale one.** **BOTH SHADES split together:** the stronger shade is keyed on the MATCHED text, so splitting only the light set would have shown `variazione` as unlearned inside the very phrase the learner had answered; §5 asserts that, and both halves were revert-verified independently. **Article noise is the RULING, not a defect** — bare `la`/`il` are marked, and §4 asserts it deliberately so a future session does not read it as the v73_d one-letter bug returning and "fix" a decision. Consequence, restated: **no article set is derived anywhere, and none is needed.** |
| `v78_j` | **(user) Three small specified items.** (a) **Grammar and Konjugation restored to the single-chapter add-lesson menus.** There was no gate, only an omission — both are full registry types with builders, editors and translated labels, and the storyline-wide arc has offered them all along. The real defect is structural and is what the new guard pins: **the option list is written out three times** (progress card, library, `ADD_LESSON_TYPES`), which is how they drifted. `unit-add-lesson-menu` asserts the two add-lesson menus AGREE — and it immediately earned itself by catching a second difference I had not noticed: the library menu lacks `mixed`. That one is REAL and now documented as the single allowed exception, because a mixed lesson pools the OPEN set's other lessons and its handler throws `mixed.need_open_set` without one; the guard also asserts that handler exists, so the exception is a reason rather than an excuse. (b) **Slovenian (`sl`)** added — `languages.json`, `_langScript` (latin) and both language selects. `unit-lang-menu-coverage` fired exactly as predicted and then caught a second thing: my first edit reflowed `languages.json`, and that guard protects the hand-written line shape (a reflow makes every future diff unreadable). Re-done as a textual append. 33 languages; **65 name cells reopen** for the next `--langnames` run. (c) **`--batch N` and `--threads N` for `translate-ui.js`.** `setNumThread` had existed in `llm.js` since `v71_q` but only the model MENU ever called it, so a batch run could not set either. Flag beats env var, matching `--model`. Guarded behaviourally — the same 20 keys go out as 1 batch at `--batch 20` and 4 at `--batch 5`, driven through the real script with a counting stub. |
| `v78_i` | **(user, screenshots) Three rulings, and a defect the new corpus exposed.** (a) **Chapter auto-read REMOVED** from the progress card and added nowhere else — supersedes §0f (`v77_v`) and the brief "card before comprehension lessons" re-scoping. The helper is kept (the speaker control still reads the story, and it carries the four restraints), but **`unit-story-autoread` now asserts it has NO CALL SITE**, revert-verified by re-adding one; the ruling is a property of the product, not a fact about one commit. (b) **Conjugation prefers MCQ over typing** — typing is a FALLBACK for forms that cannot be asked as an MCQ, not a second question on the same form. **This fixed a real defect:** `mcq_conjugation` and `type_conjugation` share ONE qid (`infinitive|pronoun`), so emitting both put two exercises with one identity into a round, and `unit-replay-focus` measured 2 repeats in a round of 14 on the user's first conjugation lesson. (c) **The conjugation reveal shows the whole phrase** (`vi ste`, not `ste`) — the read-out has composed pronoun+form since it was written, so the app SAID the full phrase while SHOWING half of it; same composition now, so they cannot disagree. **Also: `unit-replay-focus` §8c was measuring the corpus, not the product.** It asserted a replay has ZERO repeats, and passed for years because grammar — the only capped builder in the corpus — leaves 11 unsolved against a cap of 14, so trim mode never had room for the `FAMILIAR_SHARE` (0.15) review slots the cut deliberately reserves. The user's 30-question conjugation lesson left 16 unsolved, the round filled to 14, and the two designed review slots appeared. Bound corrected to the designed share, keeping the original power (a random cut re-asks ~half the round and still fails). **And `unit-syn-count` §5 flipped as predicted** from "en-only, owed to the translate pass" to "no language drops the `{n}` placeholder" — the pass has run and all 32 languages carry both keys. |
| `v78_h` | **(user) Every word-bearing source feeds the story highlight, in two shades.** Only `L.vocab[].target` was ever marked, so a chapter that teaches through conjugation, word_forms, grammar or synonyms showed a story with almost nothing lit up. Now **synonyms** (base + every alternative), **word_forms** (every offered choice), **grammar** (noun + plural) and **conjugation** (infinitive + each inflected form, pronoun stripped — the corpus stores `io parlo`, the story contains `parlo`) all contribute. **Measured over 90 corpus chapters with a story: 704 marks → 1043, +48%, with 44 of the 90 gaining** — and the shipped collector was re-measured after wiring and reproduced that figure exactly. **One collector drives BOTH shades:** `_storyWordSources` emits each word together with the PROBE identifying the question that teaches it, so light ("in your lessons") and dark ("you have answered it") are two reads of one list — computing them separately is how this panel and the storyline page came to light the same story differently before `v74_n`. The probes are the shapes `_qidCanonical` already switches on and solved-ness is tested with the product's own `qid`, so a qid change moves both sides together. A word_forms **distractor is light but can never be dark** — no question has it as its answer, and calling it learned would be a lie the shading tells. Wired into all four story panels (progress card, comprehension, chain, library reader); the library reader stays base-shade-only, having no per-learner progress in hand. Revert-verified twice: removing the conjugation source fails §1, and making the dark shade ignore the solved map fails §4 while §3 correctly still passes (an empty solved map short-circuits). |
| `v78_g` | **(user-reported) §7 — script lessons for a DIGRAPHIC source.** `needsIntroScript` computed the learner's readable scripts as `scriptsForLang(srcLang)` — every script the source LANGUAGE admits. For the user's `sr`(latin) → `sr`(cyrillic-sr) storyline that is `["cyrillic-sr","latin"]` on **both** sides, so every target script was already "readable" and the gate concluded no alphabet was needed — exactly backwards for a storyline whose whole point is the script. It was answering *"which scripts CAN this language be written in"* where the question is *"which script is THIS pair actually written in"* — a per-topic fact stored since `v76_g`/`v76_h`. Both sides now narrow through one `_scriptSideOf(lang, chosen)`, in **both copies** (server + client, byte-identical, asserted). **The builder had to narrow too:** gate-narrows-but-builder-does-not would pass the gate and then skip every script inside the loop, returning `[]` with no error — the silent-empty shape INTERNALS §2 is full of. Threading found two real gaps: `base` did not carry the chosen scripts (so `base.script` was `undefined` downstream and the arc primer would have kept the old behaviour while the gate reported the new one), and `/api/generate-book` destructures its own body set, which lacked them — a **`ReferenceError` in nine e2e tests**, caught by the suite rather than by review. Guarded against the REAL storyline in the shipped corpus, with a 31-pair sweep proving no non-digraphic pair moved. Revert-verified two ways: the narrowing reverted reproduces the user's report, and the SERVER copy alone reverted fails only the parity section while every behavioural section still passes. **Also fixed: three extraction sites in `unit-intro-script`** needed the new helper injected — a harness limit (`ext()` grabs one named function), not a product constraint. **NOT done, deliberately: the reverse direction** (teaching Latin to a Cyrillic-Serbian reader) stays unoffered — `latin.soundsFor` carries `cyrillic` (Russian-flavoured "эй"/"си") but not `cyrillic-sr`, and aliasing them is a LANGUAGE judgement (Serbian Cyrillic has no э/ы/ё) that INTERNALS §4 puts outside the code. Asserted with its reason, so adding a real column flips it deliberately. |
| `v78_f` | **(user notes, group B) The teacher-mode switch is on every page that carries the footer controls**, beside the UI-language and mute controls — it had lived only on the landing page. Compact 🔓/🔒 icons in `lang-footer-lessonset` and `lang-footer-storyline` join the existing full-width landing button, and **all three are driven by ONE updater**: three copies of "which icon means which state" is how `v71_w`'s connector line drifted and how `v77_q` produced four card headers with four different titles. The compact glyph is **derived from the same label string** the landing button renders rather than spelled a second time — revert-verified by hard-coding it, which fails the agreement check. **Reachability (v71 rule) is why all three were wired rather than the easiest one:** the lesson-set page is invisible to learners, so a switch placed only there would not exist for the people who need it; landing and the storyline page are the learner-reachable ones. **Also fixed on the way: `toggleTeacherMode` synced the button BEFORE re-rendering the screens.** That was harmless while the control lived only on the landing page and wrong the moment it moved into the screens this function redraws — the clicked page would have shown its pre-click state. Sync moved after the re-renders, revert-verified by ordering. Handlers assigned in JS, never inline (rule 22). **No new i18n:** the existing `teacher.*` keys carry both presentations, asserted so a later "just hard-code the emoji" edit has to justify itself. |
| `v78_e` | **(user notes, group B) Clear progress for ONE CHAPTER**, plus a third copy of the `v77_s` bug found and killed. The wipe rule is extracted to **`_clearChapterProgress(topicKey)`** and every entry point goes through it: the storyline-wide control loops over it, the new `comp-wipe` 🧹 on the progress card calls it for the current chapter, and **`clearLessonProgress` (the lesson-set page) — which turned out to be a THIRD implementation carrying the exact `v77_s` defect: it cleared `completed` and `solved` but not the `chapterDone` STAMP or `storyShown`, so clearing from that page left the chapter still reading "finished".** The user's note named the trap ("reuse it, do not re-implement, or the new button will forget `chapterDone` all over again") and it was already true of shipped code. The guard's payload assertion is PARITY: wiping every chapter one-by-one must leave byte-identical state to the storyline-wide wipe, so a future re-implementation that drops a store fails even while its own checks pass — revert-verified by reintroducing exactly that mistake. The card re-renders via `showComplete(true)`, the REVIEW render, because a play render would re-judge a chapter nobody just played and re-record the completion it had just erased. **Found on the way:** `unit-qid-stability` §5 pinned two SOURCE PHRASINGS (`delete APP.progress.solved[tp]`) that the extraction broke while the product stayed correct — standing rule 18, and one of the pins §0a asks to retire. Replaced behaviourally, and the replacement itself revert-verified (session-29 rule 8). 3 new `en` keys. |
| `v78_d` | **(user notes, group B) Conjugation MCQ distractors are OTHER FORMS OF THE SAME VERB, and the question is no longer padded to four.** The pool was a shuffled UNION of this verb's other forms and every form of every OTHER verb in the lesson, capped at 3 — and because it was shuffled, the intruders crowded out the real paradigm even when the verb had six forms of its own. Measured under revert on a two-verb Italian fixture: `essere (voi)` was offered **`siete / parli / parla / parlano`**, three of four from `parlare`. That is not a grammar question — the learner picks the form whose stem matches the infinitive and never considers the paradigm. Now same-verb only, and **no padding**: a two-form verb asks a two-option question rather than being topped up from a neighbour (user: "need not be padded to four"). **Checked for the v71_s trap** — narrowing a builder can strand coverage, since a form that yields no MCQ leaves its universe key unreachable. It does not: a fully syncretic verb merges to ONE cleanForm, so `fi % 3 === 0` still emits the typed variant, and any verb with more than one distinct form gives every form a same-verb distractor. Asserted rather than argued (§5). §1 and §4 revert-verified independently, the second by a targeted weakening that pads only when short — which passes §1 and fails §4, as it must. Client-only: no server copy of `buildConjugationExercises`. |
| `v78_c` | **(user-reported crash) `translate-ui.js --langnames` died on the first REJECTED name.** `isBlocking` is `issues => issues.some(i => i.severity === 'error')` — it takes the whole array. The `--langnames` writer called it as `issues.some(isBlocking)`, handing it one issue OBJECT per invocation, so it evaluated `issue.some(...)` and aborted with `Fatal: issues.some is not a function`. **Unreachable on the happy path**, which is why it shipped and why the mode's own guard was green: when a name validates, `issues` is empty and `[].some(fn)` never calls `fn` at all — the same "only the no-op path was ever exercised" shape as `v76_c`, in the same mode. The other two call sites in the file were already correct. `unit-langnames` §4 forces a rejection, asserts the run COMPLETES, reports the rejected cell, does not write the bad value, and still writes the good cells in the same and later batches; under revert it reproduces the user's exact message. The survey half was never affected — the 119 missing cells were counted correctly, and `v76_f`'s per-batch save kept the names earned before the crash. |
| `v78_b` | **(user notes, group B) A synonym/antonym question STATES HOW MANY words are to be found**, plus one guard that retires a note. (a) `syn_select` is the only MULTI-select exercise in the app, so it is the only one where "have I finished answering?" is a real question — and there was no signal: a learner who tapped one of three correct words had nothing telling them two remained, and Check scored the round. The prompt now reads **"3 similar to Haus"**, counted from `ex.correct` — the same array `check()` scores against — so the number shown and the number required cannot drift; `unit-syn-count` §3 asserts that join by rendering and scoring ONE object. **New `_n` keys, not reworded old ones**: `translate-ui.js` fills keys that are MISSING, not keys whose English value CHANGED, so an in-place edit would have left 31 languages on the uncounted prompt for ever. A missing/zero count falls back to the uncounted key rather than rendering "0 similar to" — that is the section that caught the real mistake under revert (using `_n` unconditionally). §1's revert aborts the file, so **§2–§6 were each verified against a revert only they could see**; one weakening of §4 was behaviourally equivalent and correctly still passed. (b) **`unit-roadmap-version`** — the protocol's one version-specific sentence had shipped stale FOUR times (v73, v76, and the v78 cut in BOTH of its two sentences, the second having survived every previous correction). Replaced the reminder with an assertion against `APP_VERSION`; the roadmap is found by NUMBER, so it survives the next cut unedited. Both sentences revert-verified separately. **Also, and separately: the red baseline this session was a FINDING — see the session-32 notes §1 before reaching for the data-drop fixers, and run backfill BEFORE build-static.** |
| `v77_x` | **(user notes) Two defects fixed.** (a) **Chapter-title generation failed on multi-chapter storylines.** The model answered with PAIR ARRAYS, one per line and with no enclosing array (`["Erste Begegnung", "🐕"]` / `["Parkfreundschaft", "🌳"]`); every rung of the parsing ladder looks for `{…}` objects, so a perfectly readable answer was rejected three times. **This is why the lesson-set page worked and the storyline post-pass did not** — one chapter is asked for one object and returns one. Fixed in BOTH places: a pair-array rung in the ladder, and the normaliser now accepts a pair, because a parse that succeeds into the wrong shape yields empty titles and reports nothing. (b) **Math ordering presented the numbers already sorted.** `shuffle` is uniform, so it returns the answer about 1 build in 24 for four numbers — the learner sees a finished question. Reshuffles until the presented order differs, bounded. |
| `v77_w` | **(user) NO QC PASS during storyline/book generation.** Story QC was already excluded — an LLM pass per chapter, unprompted, on an already-long job — and the user made the same call for LESSON QC, for the same reason: it is the slowest part of the job, and QC loses nothing by being deferred because it is a REVIEW step, not a generation step. Everything it would flag is still there afterwards. **On-demand QC is untouched:** the storyline 🔍 sweep (defaults `includeStory: true`), the per-chapter QC, `_runQc` itself and the `/api/qc` endpoint. Two guards updated to assert the ABSENCE of the automatic pass — paired with positive assertions that QC still exists, so "no auto-QC" cannot pass by QC having been deleted. |
| `v77_v` | **§0f — the story is READ ALOUD when it unlocks on the card.** Cheap only because of `v75_h`. Four restraints, each revert-verified because each protects something that has broken before: **muted means muted** (note `speakBodyText` force-unmutes on a tap — auto-play has no such consent, so it goes to the speech layer directly), **never on a review render**, **once per chapter per session** (the card re-renders into the same DOM repeatedly), and **never interrupts speech already in progress** — `v75_h` made `cancel()` conditional for exactly these races and auto-play must not undo it. Dialect chapters excluded by the same rule the speaker button uses. |
| `v77_u` | **The APOSTROPHE defect — a plain bug, shipped independently of ruling 3.** Vocabulary stores `l'evoluzione` with ASCII U+0027; stories are written with U+2019, so a word EXACTLY present in the story never matched. Fixed as **Unicode machinery, not a table**: one character class folds the apostrophe code points, the same class of rule as the case-insensitivity the matcher already applies — no language knowledge added. Both sides fold, so a SOLVED word also keeps its strong mark across forms (only fixing the regex would have left the defect half-cured). **Measured on the shipped corpus: 17 vocabulary words across 13 chapters (`it` 5, `en` 6, `lb` 2) now match that never could.** Inflection still misses under whitespace splitting — Tier 2, still open. |
| `v77_t` | **§0g — the comprehension flow after a wrong answer.** (a) **A repeated comprehension lesson asks ONLY the questions not yet answered correctly.** The filter reads the SOLVED store — monotonic, and the same signal `v71_s` uses to decide the lesson is done — so the round empties exactly when the lesson completes and the two cannot disagree. A first play still asks everything, and the round never empties into a blank screen. (b) **Next restarts THAT lesson** while any of its questions remain: a wrong answer used to send the learner back to the card, where Next walked on to an earlier normal lesson and the questions they had just got wrong sank out of reach. Only for the lesson just played — "finish this", not a general preference for gated lessons. Both revert-verified; one more `unit-learner-nav` source pin retired behaviourally. Found on the way: **`_lessonQidUniverse` returns a SET**, like `_lessonItemUniverse` — an Array method on it throws, and inside a `try` that silently means "no override". |
| `v77_s` | **(user) Three notes, and one finding that retracts part of `v77_p`.** (a) **Wiping progress now RE-LOCKS chapters.** `slBottomClearProgress` cleared `completed` and `solved` but not **`chapterDone`** — the cached completeness STAMP `chapterComplete` trusts ahead of the flags — so after a wipe every chapter still read "finished": later chapters stayed unlocked AND the storyline bar stayed fully green with nothing played. **Both of the user's first two notes were this one bug.** `storyShown` is cleared too, so the story-unlocked page is offered again. (b) **Both summaries now sit in the standard bordered field** with a read-aloud button, and a translate button only when a translation exists — one `_renderSummaryField(prefix, sl)` for the entry card and the starter card. (c) **RETRACTION: `v77_p`'s re-ordering inside the below-mark branch is unreachable while any lesson is unfinished.** `showComplete` tries `nextLessonIdx >= 0` FIRST, so the next-lesson branch already starts the unplayed lesson; the below-mark branch only runs when `_firstUnfinishedLessonIdx` is -1, where its first choice can never match. That is why the `v77_p` guard could not be made to discriminate — the scenario never entered the branch. The ordering is kept as a correct fallback and the guard now states what it actually exercises. **Still open: why `_firstUnfinishedLessonIdx` returned -1 while an unplayed comprehension lesson remained** — that is where the reported replay came from. |
| `v77_q` | **(user) One card family.** (a) **The next-chapter-unlocked card becomes the STARTER for chapters 2..N**, carrying what the entry card carries: the shared header, the storyboard, the story SUMMARY and the chapter progress bars (empty on a first visit). The entry card is now genuinely entry — **chapter one only** — so a learner meets one starter per chapter rather than two competing ones. The planned "how the game works" text belongs on both, from one place. (b) **All five progress cards now render an IDENTICAL header**, itself identical to the storyline page's: title row, storyline progress bar, fraction, storyboard beneath, same 540px column. Four of the five had only a title row. One `_cardHeader(prefix)` fills them all, using the same `_slProgressStats`/`_slProgressLabel` as the storyline page. **Measured, not assumed:** the first attempt had matching ids and matching fractions but four different TITLES, because each renderer overwrote the shared one and dropped the storyline icon — the guard now compares what the headers RENDER, not what the markup contains. |
| `v77_p` | **(user) Four more.** (a) **Next opens UNPLAYED work first.** `v77_o` preferred a coverage-short lesson, so on a chapter whose story had just unlocked Next replayed earlier lessons instead of opening the comprehension questions — the learner had to press Replay to get past their own replays. Order is now: first unfinished lesson → coverage-short → re-render. (b) **No story PREVIEW at all.** The panel appeared while the story was still LOCKED, truncated, for teacher/canGenerate, pushing the vocabulary below a paragraph the learner is not meant to read. It now appears ONLY on a genuine unlock. (c) **The headline fraction counts CHAPTERS, not lessons** — unlocked chapters, in `_slProgressStats`/`_slProgressLabel`, so the storyline page and every card change together. (d) **The entry card shows the real progress bars**, via the same `_compProgressHtml`; §0c's "bars empty" was right when the page only preceded the first question, but it is now the entry point for every visit including resuming. **Known gap: the ordering claim in (a) is asserted as a RESULT but does not discriminate under revert** — see the note in `unit-story-unlocked-page` §6. |
| `v77_o` | **(user) Four items.** (a) **The entry card is laid out like every other progress card** — storyboard, bars, summary, actions, title at the bottom; its own 📖 icon is gone (the storyboard is the picture). The storyboard comes from the SAME `_renderCompStoryboard`, now taking an optional target id, rather than a second implementation. (b) **The static build now opens on the entry card too.** `build-static.js` re-implements `loadSaved`, so `v77_k`'s entry point had landed in `index.html` only — **rule 15 again, third time**. Both now call the same `_enterViaSummaryCard`. (c) **LIVE-mode fix (user-reported): the finished card's chapter drop-downs were EMPTY.** The live `/api/lessons` list is a PROJECTION with `lessons[]` metadata-only and **no `story`**, while static ships whole topics — the v55_s / v74_i asymmetry in a third place. Chapters are now hydrated (STATIC_LESSONS, then `/api/lessons/load`), cached, with the card rendering immediately and re-rendering when the fetches land. Reproduced against a real projection and revert-verified. (d) **NEXT IS NEVER GREYED** (user ruling): below the mark it leads to a COVERAGE-short lesson first — so a mixed round re-samples toward what is not yet solved — then the first unfinished lesson. `v71_d`'s principle is kept (Next means forward, never silently Repeat); the dead arrow is gone, and six guards were replaced behaviourally. |
| `v77_n` | **(user) The card header finally matches the storyline page, and the verdict moves to the bottom.** (a) `align-items:stretch` on `.card-screen`: the card screens ARE the `.screen` element, and `.screen` is a **centring** flex column, so every direct child shrank to its own content width — the header rendered as a narrow centred pill while the storyline page's spanned the full column. The storyline page never showed this because it nests its content in a full-width `.sl-screen` inside its `.screen`. **Copying the header markup verbatim could never have fixed this**; it was the container. (b) The progress message ("Mach weiter!" / "Lektion abgeschlossen!") moves BELOW the play buttons on every progress card — it is a verdict on what just happened, not a heading for what follows, and putting it first pushed the storyboard and bars down so the card did not open like the page. Order is now header → storyboard → bars → story → words → icons → actions → verdict. Both revert-verified. |
| `v77_m` | **(user, from a browser pass) Three fixes.** (a) **Row order now MIRRORS THE STORYLINE PAGE** — title+bar → storyboard → chapter-wise bars → story (+vocabulary) → icons → buttons — so moving between the two screens jumps in neither width nor order. `v77_l` had put the story directly under the title, which led the card but no longer matched the page; §0d's principle is unchanged and still asserted (the story precedes the icons and the action row). (b) **The story-finished card no longer fires on a STALE done-stamp.** `chapterComplete` trusts a cached `chapterDone` stamp whose lesson count still matches, and a stamp outlives the progress it described; for every other caller that is the right trade, but for the end-of-story celebration it retires a story with chapters still unplayed. The celebration now requires the done-FLAGS, and an unverifiable chapter counts as NOT done. (c) **The story-unlocked page highlights vocabulary**, via the same `_highlightVocabHtml` two-shade pass the progress card panel has had since `v74_n` — the same story was lighting up on one screen and not the other, on the page whose whole job is reading it. |
| `v77_l` | **§0d — THE STORY LEADS, and `v74_l`'s hide-list is RETIRED (ruling 1).** The card ran storyboard → bars → verdict → icons → buttons → *then* the story: the thing the whole lesson flow exists to deliver arrived last, under a screenful of machinery. It now runs **verdict → THE STORY → the words in it → storyboard → bars → icons → actions.** `v71_m`'s point survives inside the lower group (bars still precede what describes them); the group moved below the text. Ruling 1's hide-list is gone — **Replay is always available and Next is no longer the only route out**. §0d removed the PREMISE rather than the buttons. Measured: **exactly 8 of 32 rows changed, repeat/drill `-`→`YES` in each**, matching `v77_e`'s prediction. Five guards updated behaviourally, none re-pinned. |
| `v77_k` | **(user) One column for the whole walk, and the entry card becomes the ACTUAL entry point.** (a) The 540px cap moved off `#complete-screen` onto a shared **`.card-screen`** worn by all five card screens — the four pages added in `v77_f..v77_j` had **no width rule at all** and sized to their content, so entering a lesson jumped the column and moved the title line. Now the storyline page, the entry card, every progress card and the final card share one column and one inset (`.comp-body` == `.sl-screen-body`). `v71_p`'s guard was widened from "the result card matches" to "EVERY page matches, and each one wears the class". (b) **`loadSaved` now opens a chapter on the summary card**, whose forward starts the lesson — §0c's "the FIRST page … before any question". Skipped when the storyline has no summary (37 of 84) and when arriving from the next-chapter-unlocked card, so two interstitials never stack. Decision extracted as `_enterViaSummaryCard` so the guard calls the product rather than a copy; guard drives the real `loadSaved` with `fetch` stubbed. 1 new `en` key (`summary.start`). |
| `v77_j` | **§0c's THIRD PAGE — the story-unlocked card. THE WALK IS NOW COMPLETE.** The moment the story becomes readable — what every prep lesson was for — was only ever a panel among the bars and buttons. **User ruling: the page "sits beside it"** — the panel STAYS on the progress card and is asserted to stay; this page gives the moment a page of its own, with the story as the only thing on it. Shown when the prep gate flips and work remains, **once per chapter** (`APP.progress.storyShown`), then → continues into the lesson the card resolved, so forward never skips one. Reuses existing `en` keys — no new i18n. Revert-verified. Honest finding recorded: the `!C._review` condition is **defence in depth, not load-bearing** — measured, a review render leaves `nextLessonIdx` at -1, so the branch is unreachable there anyway, and the guard says so instead of claiming credit. |
| `v77_i` | **§0c's FOURTH PAGE — the next-chapter-unlocked card.** Finishing a chapter opens the next one, and that moment passed SILENTLY: Next called `loadSaved` directly and the learner arrived mid-lesson without being told what they had earned. Next now goes through a card that names the chapter and shows the position along the deck, then carries them in — **same Next, same destination, one acknowledgement in between**; ← returns to the progress card. The target is stashed at RENDER time (`APP._unlNext`) rather than re-resolved by the card, so the two cannot disagree about which chapter is next (the reason `v74_o` reused `APP._compBack`). Revert-verified; gate table identical. 4 new `en` keys. One more `unit-learner-nav` source pin retired behaviourally — the `loadSaved` call it matched moved into the card. |
| `v77_h` | **§0c's FIRST PAGE — the story-summary card**, plus the first link of the navigation spine. New `summary-screen`: the storyline summary in the SOURCE language (it is authored there — measured, 47 of 84 storylines carry one), the chapter count, and the **progress bar EMPTY**, because this page sits before any question of the chapter. Reached by a new **`comp-prev`** ← on the progress card and returns by →. **A new id, not `comp-back`** — that was deleted in `v71_k` and its absence is asserted deliberately, so the spine is BUILT. The control is **hidden** when the storyline has no summary (37 of 84), so it can never lead to a blank page. Direction is taken from the client's one `RTL_LANGS` rule rather than a second spelling. Both halves revert-verified; the gate table diffs identical. 4 new `en` keys. |
| `v77_g` | **The story PANEL is renamed to `comp-story-panel`** — §0c's prerequisite. The old id claimed "the story is unlocked", but the panel is shown while the story is still LOCKED (a truncated preview for teacher/canGenerate) in most of the 24 of 32 rows it appears in, and §0c's genuinely distinct story-unlocked PAGE would have collided with it. It is the whole bordered panel: the caption and `comp-story-text`/`-spk`/`-xlate` are children. Pure rename, proven so — the corrected gate table diffs identical in every state cell, only the column name moves. `unit-card-consistency` now sweeps the client for the old id, because a half-done rename is INVISIBLE otherwise: the stub DOM auto-vivifies any id, so a leftover lookup returns a live-looking element for ever (rule 16). Caught on the way: the explanatory comment naming the old id failed that very sweep — session-29 rule 1, arriving exactly as written. |
| `v77_f` | **§0c's LAST PAGE — the story-finished card.** New `finished-screen`: festive icon, the whole story chapter by chapter (native `<details>`, so it collapses without script and survives the static build), the **cumulative** vocabulary learned across the story, Back to the progress card and onward to the storyline. `showComplete`'s terminal branch now leads here **when the story is genuinely finished**. **Ruling 2a is applied to ONE path deliberately:** the terminal branch also fires for a learner who finished the LAST chapter with earlier ones unplayed, where celebrating would be a lie — that case keeps `v74_o`'s hand-off. Both halves clicked and revert-verified. Found on the way: reading `_storyDone` at the Next wiring is a **temporal-dead-zone throw** (it is declared 59 lines below — the v68.1 shape in the v68.1 function), and the obvious fix duplicates the rule, so `_storyAllChaptersDone(slCtx)` is now the single reader for both sites. The `v77_b` ledger asserted empty across the walk; verified against `docs/index.html` too. 4 new `en` keys. |
| `v77_e` | **Docs only, no product change, no version bump. The card truth table is REGENERATED** as `v77_card_gates.md`; `v76_card_gates.md`'s table is superseded. Findings 2 and 5 audited and both were the same class of artefact — `comp-storyboard` renders fine once `APP.savedList` is seeded (the renderer uses `appendChild`, so the stub's `innerHTML` reads empty even when the board is there), and the learner/teacher asymmetry all but vanishes once every store is written. **Finding 6 withdrawn:** `v74_l`'s hide-list is not "barely observable" — measured by neutralising it, it changes **8 of 32 rows**, hiding three otherwise-live buttons in each. New probe `probe_gates_v77.js` asserts element existence in the markup and seeds every store the card reads. |
| `v77_d` | **Docs only, no product change, no version bump.** §0d's open question answered: **`comp-drill` is not dead.** The gate table's "never once enabled in 32 rows" was a third seeding artefact — the drill reads `APP.progress.learned[lang\|srcLang]`, which the probe never wrote, so grey was the correct answer to "this learner has nothing to drill". With the real writer (`recordLearnedFromLesson`, 2 wrong answers) the button is LIVE. **`unit-card-consistency` §4 had asserted this since `v71_h` and was green throughout** — a passing test and a "measured" table contradicted each other for a release. Probe preserved as `probe_drill_v77d.js`. |
| `v77_c` | **§0b, second half — the coverage key-space question is SETTLED as a seeding artefact.** `v74_c` moved coverage onto SOURCE ITEM keys (`lessonId:i:hash`) while round assembly kept QUESTION ids (`lessonId:type:hash`); the two spaces are **disjoint**, so the v76 probe's 86 seeded qids counted 0 against a 31-item total. `markSolved` writes both, so no learner was ever affected — driven through `buildExercises`+`markSolved` with no seeding, coverage converges 62→95→95→100 and unlocks in 4 rounds (builders SAMPLE, so replaying is the designed way up). New guard `unit-mixed-unlock-reachable` drives the real solve path, because seeding is the mistake that produced the question. |
| `v77_b` | **§0b, first half — the 7 swallowing `catch(_) {}` blocks in `showComplete` are visible.** Each now reports site + message to a per-render ledger (`_cardErrors()`); `APP._cardStrict = true` rethrows at the site. **Default behaviour is unchanged** — still swallowed, just no longer invisible. `var` not `let` for the ledger, deliberately: `v68.1` was a TDZ crash in this very function. Call sites are `typeof`-guarded per the harness convention. Measured after: **0 swallowed errors across 1216 renders over all 304 topics**, and the `probe_gates_v76` truth table diffs identical. Found on the way: **`comp-back` and `comp-story` do not exist** — two columns of the "measured" gate table are stub-DOM phantoms. |
| `v77` | **Base cut.** The `v76_k` static-build fix, folded into the version bump. |
| `v76_k` | **The `v76_e` bug was still live in the published `docs/` build** (user-reported). `build-static.js` carries its OWN copy of `loadSavedList` which overrides the client's, so the fix landed in `index.html` only. Same duplication hazard as `v76_b`. Now guarded by a test that drives **the built artefact** (`loadClient({file})`), because every source-level assertion about `index.html` passed throughout. |
| `v76_j` | **"Continue story" landed with an empty "continue from" field** (user-reported, `sl_9302163`). `continueFromLesson` switched the TARGET language — which repopulates the menu — before switching the SOURCE, so the menu was built for a pair with no chapters and the chapter's own option never existed. Only a mixed-language storyline can show it. Plus the **pin**: arriving by this route fixes the story, it is offered whatever the language filters say, and it is cancelled by the ✕ or by "— new story —" (persisted, user's rulings). Note: the reordering is defensive and NOT independently observable — the pin subsumes it, and the test says so. |
| `v76_i` | **The script picker.** Rendered under each language select, only when `scripts.json` `_scriptChoice` lists that language, labelled `Cyrillic`/`Latin`. **Inherits from the chapter being continued**, explicit pick only for a brand-new story (user's ruling); an explicit pick is the per-chapter override. Because `continueFromLesson` prefills the landing form rather than opening its own dialog, "new story" and "add chapter" share one control. New `en` key: `form.script_pick`. |
| `v76_h` | **The model is told which script to write in.** `langName(code, script)` — the choke point every prompt fills `{L}`/`{S}` from — now names it (`"Serbian (written in Cyrillic script)"`), plus a `story.scriptNote` consistency rule. `script`/`srcScript` accepted at `/api/generate`, **validated against scripts.json rather than trusted**, threaded through the generator opts, and persisted on the topic so the next chapter can inherit. Found on the way: a `ReferenceError` in `generateErrorHunt` swallowed by its own catch, and `fake-ollama` truncating logged prompts at 400 chars, which made any tail assertion vacuous. |
| `v76_g` | **Script choice for digraphic languages — the data half.** Serbian is written in Cyrillic OR Latin and nothing told the model which, so it chose per generation (target → Latin, source → Cyrillic). `scripts.json` now declares **`_scriptChoice: ["sr"]`**, and `backfill-script.js` stamps `script`/`srcScript` on existing topics by Unicode detection. **The obvious gate `scriptsForLang(x).length > 1` is WRONG** — it is equally true of `ja`, which mixes hiragana and katakana concurrently; measured, `sr` texts mix in 0 of 5 and `ja` in 9 of 13. Nothing reads the field yet. |
| `v76_f` | **`--langnames` wrote only at the end** (user-reported) — every language accumulated in memory and `languages.json` was written once, after the loop, so any interruption discarded the whole run. `translateLang` in the same file has saved per batch all along; this mode never copied it (**standing rule 10, second time in the same function**). Extracted `_flushLangs()` and call it after every batch. `unit-langnames` §3 runs the REAL mode and kills it mid-run. |
| `v76_e` | **A mixed-language storyline lost its identity on the main page** (user-reported, `sl_9302163`). `loadSavedList` projected each chain through the **language-filtered** id index, and `storylines_renderChain` recovers the storyline by an exact full-length positional match — which a truncated chain can never satisfy — so it fell through to a synthetic `'c'+hash` id with no storyline behind it: no title, icon, storyboard or summary, and a short chapter count and deck. Reproduced the user's exact `c1935658823` at `libFilter=sr` / `libSrcFilter=all`. **A storyline is one unit: the filter decides WHETHER it is shown, never WHICH of its chapters are.** Same class as `v75_f`. |
| `v76_d` | **Test-only.** Two guards had pinned the shape of the corpus rather than their claim: `unit-coverage-threshold` compared a progress-row label against the raw title while the card truncates at 40 chars (the corpus moved to a 42-char one), and `unit-live-static-progress-parity` asserted `total 🔒 === 1`, which encoded a *two*-chapter storyline where the chain is now six. **In both cases the product was correct.** No version bump, no `docs/` rebuild — no shipped artifact moved. |
| `v76_c` | **`--langnames` shipped broken** — `callLLM` is positional and returns `{text}`; it was called with an options bag and its result read as a string. Only `--check` had ever been run, and `--check` never calls the model. Fixed, `llm.js` now rejects a non-string model with an actionable message, and `unit-langnames` runs the real mode against a stubbed backend. |
| `v76_b` | **`sr`/`hr` were missing from both language drop-downs** — the menus are hand-written `<option>` markup, not generated from `languages.json`, so adding a language is a two-file change and only one file had a guard. Options added; `unit-lang-menu-coverage` now asserts both directions plus `name`/`flag`/`tts`. Added **`translate-ui.js --langnames`** to fill `languages.json`'s 32x32 `names` matrix (151 cells were empty — including 31 for `lb`, a pre-existing hole nobody knew about). |

**Open from `v76_e`, needs the user:** the fix means filtering the library to one language now shows
a mixed-language storyline **whole**, including chapters in the other languages. The alternative
(fix identity only, keep truncating) leaves *"the lessons in a different language didn't show up"*
unfixed and still hands `openStorylineScreen` a short chain. Confirm or reverse.

**Open from `v76_e`, not fixed:** `_tryOpenStorylineByChainId`'s legacy fallback rebuilds chains
through `makeParentResolver`, which is **same-language guarded** (`index.html:1429`), so an old
bookmark or shared link carrying one of the synthetic `c…` ids cannot be resolved for a
mixed-language chain and lands on the landing page. No new `c…` ids are produced after `v76_e`.
Widening the parent resolver changes chain CONSTRUCTION and wants its own release.

**Open, not done:** the two menus should eventually be GENERATED from `languages.json`. Not done in
`v76_b` because they are deliberately ordered differently (`lang-select` leads with Italian) and
generating would silently reorder a user-visible menu. The guard makes the duplication safe until
someone decides the order.

## ⚠️ Session protocol — READ FIRST

Unchanged from `roadmap_v75.md`. Re-read its protocol block and its definition-of-done before
writing anything, plus **"Rules earned in session 28"** and **"Rules earned in session 29"** — eight
rules now, and each one cost a wrong finding.

Standing design principle: **no language knowledge in the code**, where *permitted* means Unicode
machinery or corpus statistics, not a hand-authored table.

---

# 0. THE PROGRESS-CARD REWORK (user, at the v76 cut)

**Principle, in the user's words: THE STORY TEXT MUST BE THE FOCUS OF ATTENTION.** The lesson flow
exists so that the student ends up understanding the text. "Complete cards" are renamed **progress
cards** and become the spine that guides a learner through a story.

**Read `build_history/v77_card_gates.md` before touching the card** — the CORRECTED truth table
(32 rows, both gate families) and `probe_gates_v77.js` to re-run and diff.
**`v76_card_gates.md`'s TABLE is superseded and must not be built on**: four of its five findings
were artefacts of state its probe never seeded. That file is kept only for its corrected findings
and the settled coverage question.

## 0a. RULED — session 30 (user). These are decided; do not re-derive them.

All three were answered by the user at the end of session 30, after walking through each one against
the code. **Two of them delete shipped, tested behaviour.** Where a rule is superseded, delete it and
its assertions rather than layering a new rule on top — that layering is what §0a existed to prevent.

### Ruling 1 — `v74_l` is SUPERSEDED as a mechanism; its intent survives

> **User: "move the actions below the text as §0d already wants".**

`v74_l` (`index.html` ~14891) hides `comp-repeat`/`comp-drill`/`comp-crossword`/`comp-back` by id on
a genuine learner unlock and forces `comp-next` visible, so the story is not crowded by four routes
back into practice. **Keep that intent, drop that mechanism.** The story leads because the actions
move BELOW the text (§0d), not because buttons are taken away.

Consequences, all of them required together:

- **The hide-list goes.** With it go the three §0d conflicts it caused: Replay becomes ALWAYS
  available (a learner must be able to reach 100%), `comp-back` is freed for the §0c navigation
  spine, and `comp-next` stops being forced as the single route out.
- The premise `v74_l` was written on is gone anyway: once the card carries a third progress bar,
  cumulative vocabulary and back/next, it is no longer the "quiet card" the rule assumed.
- ~~Measured support: `v74_l`'s hide-list is **barely observable today**…~~ **WITHDRAWN `v77_e` —
  that measurement was wrong.** It came from the unseeded v76 table, where those buttons were
  already hidden for unrelated reasons. Re-measured by neutralising the hide-list and diffing the
  whole table: it changes **8 of 32 rows**, hiding **three otherwise-live buttons in each** (repeat,
  drill, crossword), on exactly the genuine learner unlocks. **The ruling stands — it was made on
  principle — but expect a bigger visible change than §0a assumed.**
- **Nuance not to lose:** the hide-list already keeps Repeat while coverage is short
  (`_coverageLeft`) and hides it only at 100%. So *"a learner must be able to reach 100%"* is
  already satisfied today; Repeat disappears only AT 100%, never on the way there. The case for
  moving the actions below the text stands on its own — the story should lead — but it is not
  rescuing a stranded learner.

### Ruling 2a — `v74_o` is SUPERSEDED (scope CONFIRMED by the user, session 31)

> **User, after the `v77_f` browser pass: "🎉 card only on finished stories."**
>
> **SETTLED — the shipped behaviour is correct, do not widen it.** `showComplete`'s terminal branch
> fires whenever there is nothing left in this chapter and no next chapter, which INCLUDES a learner
> who finished the LAST chapter while earlier ones are unplayed. That case is **not** a finished
> story and keeps `v74_o`'s hand-off. The gate is `_storyAllChaptersDone(slCtx)`, and both halves
> are asserted by clicking in `unit-story-finished`. **Do not "simplify" this to always show the
> card** — the narrower gate is the ruling, not an implementation detail.


> **User: "superseded — the story-finished card is the answer to the dead end".**

`v74_o` makes "nothing left to do" a TERMINAL state: Next is relabelled ↩ and hands the learner back
to the storyline (or home), reusing `APP._compBack` so the header and Next cannot disagree.

§0c makes that same state a WAYPOINT — the **story-finished card** (full story collapsible, complete
vocabulary learned, festive icon) is the next page in the walk. Under `v74_o` that card can never be
reached by pressing forward.

**The dead end `v74_o` fixed is real and must not come back.** It existed because `v71_h` greyed Next
here while `comp-back` was hidden — measured on the shipped "Paella und Chaos" with both chapters
complete: `comp-next` `disabled=true`, `comp-back` `display=none`. The story-finished card is a
better answer to that dead end than the hand-off, but only if it is actually reachable: **do not
delete `v74_o` until the story-finished card exists and Next reaches it.**

### Ruling 2b — below the pass mark, Next LEADS; the destination card is inert

> **User: "next could lead to the next card in the walk, but with no button active" → clarified:
> ALL of that card's action buttons inactive.**

This supersedes **`v71_d`**, not `v74_o` — worth stating plainly, because §0a originally attributed
the grey Next to `v74_o` and that was wrong: `v74_o` is the release that REMOVED greying from the
terminal branch. The surviving grey Next is `v71_d`'s `_belowThreshold` branch
(`_nextBlocked = true; compNext.disabled = true; compNext.classList.add('locked')`).

New behaviour: below the mark, **Next is active and moves to the next card in the walk**, and that
card renders with **all of its action buttons inactive** until the mark is met. The learner can read
ahead; they cannot act ahead.

`v71_d`'s principle is PRESERVED and in fact strengthened: Next never silently repurposes itself
into Repeat or Drill. It always means forward. What goes is the disabled button, not the rule behind
it. Inertness becomes a property of the CARD, not a lock on one button.

### Ruling 3 — article noise is accepted; take the high-recall matcher

> **User: "article noise was 'ok for now' still stands. we may later add a LLM call to judge which
> exact vocabulary is covered by lessons."**

So the mark means *"something from your vocabulary occurs here"*, not *"you have learned this
word"* — recall over precision. Take **whitespace splitting**: `+782` marks corpus-wide, 96 chapters
improved, 8 on the screenshot chapter — accepting that 4 of those are the article `la`. The clean
composed option (`+60`, 0 articles) is NOT chosen.

Two useful consequences:

- **No article table is needed at all.** Whitespace splitting needs no article set, so the
  corpus-derived `es: el, la` / `it: il, la, l'` / `ar: ال` work — and its two Italian false
  positives (`reti`, `per`) and the threshold tightening they wanted — is **not needed for this
  ruling**. That is squarely better under the standing design principle.
- **Keep "also mark articles" reversible.** The user's phrase is "ok for NOW", and the stated
  intention is to revisit with an LLM pass judging which vocabulary a lesson actually covers. Build
  the matcher so precision can be raised later without redoing the display.

**✅ SHIPPED `v77_u`** — 17 words across 13 chapters recovered. ~~**Not part of this ruling, ship regardless:** the apostrophe bug.~~ Vocab stores `l'evoluzione` with
ASCII `'` (U+0027), stories use `l’evoluzione` (U+2019), so even an exactly-present word never
matched — 15 `it`, 7 `en`, 4 `lb` chapters affected. That is a plain defect, not a judgement.

Inflection (`mutazione`/`mutazioni`) still misses under whitespace splitting; it is Tier 2 and stays
open.

### What these rulings cost in tests — read before starting

Eight test files touch the superseded rules: `smoke-render`, `unit-comprehension-gate`,
`unit-coverage-threshold`, `unit-drill`, `unit-lang-placeholder`, `unit-learner-nav`,
`unit-story-unlocked-card`, `unit-vocab-articles`.

**Several assert on SOURCE TEXT, not behaviour** — e.g. `unit-learner-nav` matches
`/_nextBlocked = true;/`, `/compNext\.disabled = true;/` and the literal `_endLbl` line against the
`showComplete` source. When the rework changes that code these fail as text mismatches. **Do not
re-pin them to the new text.** Replace each with an assertion about what the learner can DO — the
whole point of rulings 1, 2a and 2b is behavioural, and a source regex cannot express any of it.
`unit-story-unlocked-card`'s "Next-only for learners" line is `v74_l`'s and goes with it.

## 0b. Do this FIRST, before restructuring

**Make the 7 swallowing `catch(_) {}` blocks in `showComplete` visible** (564 lines, `index.html`
~14212–14776). A throw in any of them leaves the card half-rendered with the suite green. Session 29
lost real time to a bug that *looked* like a swallowed throw and was not. A counter the harness can
assert is zero, or a rethrow under a test flag, is enough. One small release, revert-verified, before
any of the work below.

**✅ DONE `v77_b`** — the 7 catches now report to a per-render ledger (`_cardErrors()`), with
`APP._cardStrict = true` rethrowing at the site. Default behaviour is unchanged: a throw is still
swallowed, it is merely no longer invisible. Measured across the whole corpus at the `v77_b` cut:
**1216 renders over all 304 topics swallowed ZERO errors**, so the catches hide nothing today — the
ledger is a net for the rework, not a bug-catcher for now. Guarded by `unit-card-errors`, which also
asserts no empty `catch` survives in `showComplete`.

**✅ DONE `v77_c` — the coverage key-space question is SETTLED: a seeding artefact, not a bug.**
`topicCoverage` reads ITEM keys (`v74_c`); the probe seeded QID keys; the two spaces are disjoint,
so 0 of 86 counted. `markSolved` writes both, and a learner driven through the real solve path
reaches 100% and unlocks in 4 rounds. Full measurement in `v76_card_gates.md`; guarded by
`unit-mixed-unlock-reachable`.

## 0c. The sequence (the big one)

Progress cards become an ordered walk, with back/next, over:

  **summary → chapter questions → story-unlocked → next-chapter-unlocked → story-finished**

**✅ WALK COMPLETE:** summary `v77_h` · chapter questions (existing progress card) · story-unlocked
`v77_j` · next-chapter-unlocked `v77_i` · story-finished `v77_f`. Every page exists and every link
is asserted by clicking. **What remains in §0c is the spine's REACH, not its pages** — see §0d for
the layout work, and note that the summary page is reachable by ← but is not yet forced before the
first question (a lesson-entry change the user has not seen).

**✅ The story-finished page SHIPPED in `v77_f`** — built first because ruling 2a forbids deleting
`v74_o` until it exists and Next reaches it, so the rest of the walk is downstream of it.
`finished-screen` / `showStoryFinished()` / `finBackToCard()`, guarded by `unit-story-finished`.
**✅ `v77_g` renamed the preview panel to `comp-story-panel`**, so the name `story-unlocked` is now
free for the real page. **Still to build: summary (the walk's FIRST page), story-unlocked,
next-chapter-unlocked**, and the
back/next spine connecting them. `comp-back` does not exist — the spine must be built (see below).

- ✅ **SHIPPED `v77_h`.** The **summary card is the FIRST page** in the back/next sequence, showing
  the story summary in the SOURCE language, with progress bars empty, before any question of that
  chapter. `summary-screen` / `showStorySummary()` / `sumForwardToCard()`, reached by `comp-prev`.
  **Note on scope:** it is reachable by ← FROM the progress card; it is not yet forced before the
  first question on lesson entry. That would change the lesson-entry path (`loadSaved`'s learner
  auto-start, v60) and is a UX change the user has not seen — **ask before doing it.**
- Back/next also walks **already-played chapters**, to revisit, replay, or complete vocabulary.
  Hint from the user: such buttons already exist in the teacher-only lesson-set view.
- A **"story finished"** card at the end: full story (collapsible), the complete vocabulary learned,
  and a festive icon.
- ~~**`comp-back` already exists and is hidden in all 32 measured rows.** Decide: revive or replace.~~
  **CORRECTED `v77_b`: `comp-back` DOES NOT EXIST** — 0 occurrences of `id="comp-back"` in both
  `index.html` and `docs/index.html`. It was deleted in `v71_k` (`#comp-hdr`, whose title is the
  route back, replaced it), and `unit-card-consistency` asserts its absence deliberately. The table
  showed it because **`lib-dom` auto-vivifies any id**, so the probe measured a phantom; `comp-story`
  is the same. **There is nothing to revive — the spine must be BUILT**, and reusing the id
  `comp-back` means updating that guard too.
- **`comp-story-unlocked` does not mean what its name says** (it is the preview label, shown while
  locked whenever canGenerate or teacher is on). Rename before adding a real unlocked card.
  **Note (`v77_b`): it is the whole bordered PANEL, not a label** — `comp-story-unlocked-lbl` is the
  caption inside it, and `comp-story-text` / `-spk` / `-xlate` are its children. The rename touches a
  container, so it is a slightly larger change than "rename the label".

## 0d. Layout and navigation

- Move progress bars, lesson icons and the replay/drill/crossword/next buttons **BELOW the text** on
  all progress cards. ~~(Check `comp-drill` first — grey or hidden in all 32 rows; possibly dead.)~~
  **CHECKED `v77_d`: `comp-drill` is ALIVE — keep it in the row.** It was grey in all 32 rows because
  the gate probe never wrote the wrong-answer ledger it reads; with mistakes recorded it goes LIVE,
  and `unit-card-consistency` has asserted exactly that since `v71_h`. Note it is `hidden` on the
  unlocked-learner row today — `v74_l`'s hide-list — so ruling 1 restores it there.
- ✅ **SHIPPED `v78_n`** — the ✕ returns to the progress card of the lesson being played.
- ✅ **MEASURED ALREADY TRUE (`v78_n`)** — `v71_h` always shows Replay and `repeatForCoverage` falls
  back to the current lesson when nothing is coverage-short, so 100% stays reachable. No code
  change; asserted in `unit-card-0d` §5 so it cannot regress silently.
- ✅ **SHIPPED `v78_n`** — one row per post-unlock lesson on every card of the chapter, labelled
  with the lesson's own title (no new ui.json key).

## §0e ordering — DROPPED by the user (session 32), replaced by a LOW-PRIORITY idea

**User: "forget about the ordering for now."** The measured re-plan below stands as the record of
WHY; the three options are withdrawn and no ruling is owed. `v77_f`'s deck-then-lesson order stays.

**Replacing it, at LOW priority and explicitly "needs more thinking" —
`PROGRESSIVE STORY REVEAL`:** *"at a later point we may show the story but just HIDE all non-learned
vocab and progressively reveal the story."*

Not scheduled. Recorded so it is not re-derived from scratch, with what is already known about it:

- **It inverts the highlight.** Today the matcher answers "which spans are known"; this needs the
  complement, "which spans are not", over the same offsets. `v78_h`'s `_storyWordSources` is the
  right input — it already carries per-word learned/not-learned — so this is a consumer of that
  collector, not a new matcher.
- **The measurement that killed ordering is the one to check first here too.** 83% of a learner's
  cumulative vocabulary does not occur in the chapter on screen; the question for reveal is the
  reverse — what fraction of a STORY's words are covered by ANY source. `v78_h` measured 1043 marks
  over 90 chapters, which is marks, not coverage. **Measure coverage as a share of story tokens
  before designing anything**: if a typical story is 10% covered, "hide everything not learned"
  hides the story, and the feature is a blank page rather than a reveal.
- **It is a reading feature, so the failure mode is severe.** A story panel that hides too much has
  no fallback the learner can reach — unlike a highlight, which is ignorable. Any design needs an
  escape (reveal-all toggle), and the read-aloud must be decided too: does TTS speak hidden words?
- Interacts with §0f/§0c (the auto read-out being moved) and with the finished card, which shows
  the whole story. **Do not design it before the auto-read move lands**, or the same page will be
  redesigned twice.

## §0e ordering + §3 highlighting — the measurement that produced the above

The roadmap said this pair "needs re-planning, not implementing", because the v75 plan was measured
twice and found wrong. Re-planned here against the current corpus. **Two of the v75 plan's premises
are now dead, one item is ready to build, and one needs a USER RULING.**

### What is already done, and was not when the plan was written

- **The apostrophe fix shipped** as `v77_u` (`_hlKey` folds U+0027/U+2019 and case on both sides).
  The v75 note listed it as "ships regardless, it is a defect not a judgement". It is done.
- **The article-set work is moot.** Session 30 ruled article noise ACCEPTED, so the corpus-derived
  `es/it/ar` article sets, the `reti`/`per` false positives and the threshold tightening are all
  unnecessary. `roadmap_v74.md`'s claim that `_articleStatsFor` already derives them was wrong, and
  it no longer matters that it was wrong.
- **A matcher already exists**: `_highlightVocabHtml` + `_hlKey`, with per-word boundaries applied
  only to spaced scripts (`v73_d`). Any "one shared matcher" is an EXTENSION of this, not a new one.

### ✅ SHIPPED as `v78_k` — §3's ruled half

`_highlightVocabHtml` matches a multi-token vocab entry only as a whole phrase. Measured just now:
`['la variazione genetica']` against a story containing exactly that phrase marks it, but a story
containing only `variazione` marks nothing. **Whitespace splitting is the ruled change** (`+782`
marks over 96 chapters, session 29's measurement) and it is still unshipped. Article noise is
accepted, so no filtering is needed. This is a self-contained release.

### DEAD PREMISE: "ordered as the words appear in the story" is undefined for most of the panel

The v75 note says story-ordering is "the same token-alignment problem, not a separate nicety", which
is why it was coupled to §3. **Measured against the corpus, that is true of a seventh of the data.**

Simulating the cumulative panel — every solved word across a storyline, matched against the chapter
story actually on screen, via the PRODUCT matcher, 612 entries over 12 multi-chapter storylines:

```
exact match in the shown story        82   13%
only a word-form / stem match         24    4%
absent entirely                      506   83%
```

Per storyline it is worse than the average suggests: `The Lion's Mischief` has **221 cumulative
words and 25 in the story**; `Nights in Cairo` has **0 of 23**. Sorting by story position would give
a 25-word ordered head and a 196-word arbitrary tail — or, for Cairo, change nothing at all.

**Why the plan and the data disagree: two releases made decisions that were never compared.** The
v75 ordering note assumed the panel showed the CHAPTER's vocabulary. `v77_f` then made it cumulative
across the deck (133 words vs 24, measured at the time). Each was right on its own; together they
make "order as they appear in the story" an instruction about 17% of the list.

**And word forms do not rescue it.** The v75 note's "greedy matching, to allow for word forms" is
worth exactly the 4% above (`preferenza`, `lezione`, `планина` — real, and a rounding error against
83% absent). Greedy stem matching is a genuine cost — it is the one part of this that risks marking
the wrong word — for four points.

### NEEDS A USER RULING before anything is built

The intent behind §0e's ordering half is sound: **connect the vocabulary panel to the story in front
of the learner.** Story-ORDER turns out to be a poor instrument for it. Three ways to serve the
intent, all using the SAME matcher (so the coupling to §3 survives, on better grounds):

**~~The three options below are WITHDRAWN — the user dropped ordering (see above). Kept only as the
record of what was measured.~~**

1. **Mark, do not reorder.** Keep the existing deck-then-lesson order and use the matcher to flag
   the panel words that occur in THIS chapter's story. Well-defined for 100% of the panel (each word
   either occurs or does not), reuses §3's matcher exactly, and the panel stops jumping around as
   the learner moves between chapters. **Recommended.**
2. **Two zones**: an ordered "in this chapter" head, then everything else in the current order.
   Delivers the v75 wording literally, at the cost of a panel that is 17% sorted and 83% not.
3. **Order by recency of solving**, ignoring the story. Well-defined for the whole panel and needs
   no matcher — but it abandons the story connection, which was the point.

Option 1 is what the measurement argues for; **the user should rule**, because "ordered as the words
appear in the story" is their sentence and the substitution is a product judgement, not a bug fix.

### Sequencing, once ruled

1. §3 whitespace splitting — ruled, measured, self-contained, no dependency on the above.
2. Extract the shared matcher to return MATCHES WITH OFFSETS rather than substituted HTML. Today
   `_highlightVocabHtml` does a regex replace and returns a string, so it can answer "mark this" but
   not "where, and in what order" — every option above needs the second answer. Highlighting then
   becomes a thin wrapper that wraps the offsets, which keeps §3's behaviour byte-identical and
   revert-verifiable.
3. The ruled §0e behaviour, on top of that matcher.
4. **The Replay ordering fix rides here** (session-32 batch): pick the LEAST-COVERED counted lesson
   rather than the first coverage-short one. It touches the same card. Independent of the ruling.

### Traps carried forward

- **`probe_gates_v77.js` must be re-run and diffed** after any change to the progress cards, against
  `v77_card_gates.md` (**not** `v76_card_gates.md`, which is superseded).
- **One matcher, not two.** `v77_f`'s finished card deliberately did NOT order, precisely so it
  would not disagree with a matcher that did not exist yet. Whatever ships must serve both that card
  and the progress-card panel, or the two will disagree about the same story.
- `_cardErrors()` empty after any card render, and `_cardHeader(prefix)` + `.card-screen` on any new
  card page.

## 0e. Vocabulary on progress cards

- **Cumulative per lesson-set**: every word the learner has already solved correctly, not just the
  current lesson's. **User screenshot 2 shows the panel EMPTY** on a comprehension card, because a
  comprehension lesson has no vocab of its own — so today the panel is blank on exactly the cards
  where the story is the focus. This is not polish; it is a blank panel.
- Ideally ordered as the words appear in the story (greedy matching, to allow for word forms).
  **Do this as part of §3, sharing one matcher** — it is the same token-alignment problem, not a
  separate nicety. **`v77_f` deliberately did NOT attempt it** on the story-finished card: ordering
  there before §3 exists would guarantee the two disagree. That card lists every solved item across
  the story in deck-then-lesson order (133 words vs 24 for a single chapter, measured), which is the
  cumulative half of this item done; the ORDERING half is still open.
- Include vocabulary that was the question or the correct answer in **synonym and word_forms**
  lessons.

## 0f. Story read-out — ✅ SHIPPED `v77_v`

~~**Auto-start a read-out of the story chapter when it is unlocked and shown on the progress card**
(unless muted).~~ Done; `_autoReadStory`, guarded by `unit-story-autoread`. Cheap now, and only because of `v75_h`: the old flat 4-second advance net would have
cut a story chapter to ribbons. Watch for cancel-races with the card's other speech — `v75_h` made
`cancel()` conditional, and that must not be undone here.

## 0g. Comprehension flow

- ✅ **SHIPPED `v77_t`.** ~~A wrong answer currently returns to the card; Replay then replays only
  the normal lessons.~~ Next is green and active (`v77_o`) and now **restarts that lesson** while
  questions remain; the repeat **asks only the questions not yet answered correctly**. Guarded by
  `unit-comprehension-repeat`, both halves revert-verified.
- **Still OPEN, needs the user:** the model prompt change below.
- Model prompt change (user, needs a live model — OWED BY THE USER): explanations must NOT quote
  story sentences literally; keep the explanation in the SOURCE language; if a quote is required,
  translate it; and additionally report the exact underlying quote in the TARGET language. Read out
  the explanation for CORRECT answers too — both the source-language explanation and the
  target-language quote.

## 0h. Question navigation — its own release, probably its own session

Back/next on the QUESTION cards. Already-made choices are shown (right or wrong) and cannot be
reverted, but the lock lasts only for that question set: replaying via the progress card makes them
playable again.

This is not a card change — it is a question-runner change (`C.cur`, `check()`, per-run answer
state) and it interacts with `_speakAndAdvance`, which today advances in one direction only. Scope
it separately.

---

# 0i. LESSON GENERATION REWORK (user, at the v76 cut) — BLOCKED on §1

- Align the teacher-only "add lessons" button on the lesson-set/chapter page with the storyline-level
  bulk "add lessons" selection menu. Per-type options on the right of each lesson type (math: LLM
  prompt; vocab: extend/neutral/reinforce), possibly including the difficulty selector, plus a
  per-type **count** defaulting to 1 (e.g. 2 vocab, 1 synonym, 1 comprehension).
  **MERGE HERE: the recovered "Global QC checkbox menu" item** — same menu, and it also wants the
  book's automatic QC made opt-in from the lesson-type menu and run AFTER the storyboard pass.
  That reverses the `v68.1` ordering decision.
- **PERHAPS: remove extend/neutral/reinforce entirely** and make "extend" the standard: whenever a
  lesson is generated it uses words of the chapter NOT YET covered by previous lessons up to this
  chapter. Aim to cover a story's vocabulary as completely as possible, focused on specific/rarer
  words. Re-inject unsolved items from previous sections outside the model, the way the lesson flow
  already reduces to unsolved.
  **BLOCKED on §1 (the pass mark).** This moves the denominator; settling the target afterwards
  means both moved at once and neither measurement is interpretable.
- Add a real **re-generate lessons** function on the storyline page, beside "add lessons", that
  regenerates the EXISTING lesson types with the same settings but new prompts and models — so older
  storylines can get better lessons.

---

# CARRIED FORWARD from the v75 line (unchanged unless noted)

> §4 "Browsing completion cards" is **ABSORBED into §0c** and deleted as a separate item — it was
> the back/next request. Everything else below is still open.

### 3. Highlighting — measured TWICE, NOT shipped; the v75 plan was too narrow

> **REVISED at the v76 cut, after the user's screenshot.** The chapter in
> `Screenshot_2026-08-04_23-28-47.png` (`Genetik und Mendel`, it←de, `tp_17851395481530000335`)
> scores **0 marks today**, from THREE independent causes, only one of which the plan below covers:
>
> 1. **Stored articles** — `"la variazione"` vs the story's `"della variazione"`. (Covered below.)
> 2. **An apostrophe mismatch nobody had spotted.** Vocab stores `l'evoluzione` with ASCII `'`
>    (U+0027); the story has `l’evoluzione` with U+2019. Not equal — so even the exactly-present
>    word never matched. 15 `it`, 7 `en`, 4 `lb` chapters have ASCII apostrophes in vocab; 18 `it`
>    and 92 `en` stories carry the typographic one.
> 3. **Inflection** — `mutazione`/`adattamento` vs `mutazioni`/`adattamenti`. That is Tier 2 below.
>
> **Measured comparison of the candidate fixes** (product highlighter, 282 chapters):
>
> ```
>                                    screenshot ch.   corpus            improved in
>   as stored (today)                    0 marks       3233 marks        -
>   split vocab on whitespace            8             4015   (+782)     96 chapters
>   strip leading token (plan below)     4             3377   (+144)     56 chapters
>   normalise apostrophes only           1             3235   (+2)       10 chapters
>   articles + elided + apostrophes      5             3293   (+60)      22 chapters
> ```
>
> **Whitespace splitting wins on count and loses on meaning:** on that chapter 4 of its 9 marks are
> the article `la` — it highlights the commonest word in the text as if it were learned vocabulary,
> and `mutazione`/`adattamento` still miss. The composed version marks
> `variazione, trasmissione, genetica, DNA, evoluzione` — **5 marks, 0 articles**, and corpus-wide
> **0 bare articles**. Corpus-derived article sets came out as `es: el, la` / `it: il, la, l'` /
> `ar: ال`, with `it` also catching two false positives (`reti`, `per`) that want the threshold
> tightened before shipping.
>
> **RULED (session 30 — see §0a ruling 3): article noise stays accepted.** Take **whitespace
> splitting** (`+782`, 96 chapters), NOT the composed version — the mark means "something from your
> vocabulary occurs here", not "you have learned this word". Consequence: **no article set is
> needed at all**, so the corpus-derived `es/it/ar` article work below, and the `reti`/`per` false
> positives and threshold tightening it wanted, are not required for this. Keep "also mark
> articles" reversible — the user's word is "ok for NOW", with an LLM pass judging which
> vocabulary a lesson actually covers as the intended later refinement. The apostrophe fix
> (U+0027 vs U+2019) ships regardless: it is a defect, not a judgement.
>
> Also new here: include vocabulary that was the question or correct answer in **synonym and
> word_forms** lessons (§0e), and share ONE matcher with §0e's story-order vocabulary display.

### (original v75 note follows) Highlighting — measured, NOT shipped, and the old plan is WRONG

`roadmap_v74.md` §2 said the article set "is already derived — `_articleStatsFor` collects exactly
this". **It does not.** That function reads `x.article` from GRAMMAR items via `_forEachGrammarItem`;
`Churros und Chaos` has no grammar lesson, so it returns `{choices:[], predictable:false,
sampleSize:0}` — empty on the very chapter the complaint came from.

Reproduced (16 vocab, 1150-char story): **2 exact, 8 recovered by stripping the leading token,
3 stem-only, 3 genuinely absent.**

A corpus-derived replacement, statistics rather than language knowledge — a true article appears
often as the FIRST token of a multi-token vocab entry and almost never as a standalone entry:

```
es  ["el:25","la:19"]      it  ["il:38","la:30"]
de  ["sich:6"]   <- German vocab stores no articles; nothing to fix
fr / nl  []      <- too little data to clear the threshold
```

End-to-end across 284 chapters with a story and vocab: **3233 → 3278 marks (+1% overall)**, but
`Churros` 2 → 10 and `Barbera` 4 → 10. **Narrow corpus-wide, decisive where it bites** — size it by
the per-chapter effect, not the aggregate. The filter (`count>=3`, `standalone*4<leading`,
`len<=4`) is a first cut and wants its threshold justified by measurement in its own release.

**Do NOT revert the word boundaries** — `v73_e` traded the every-`i` bug for 2 real marks.

Tier 2 (corpus inflections from `word_forms` / `grammar.plural`) is untouched and would address the
3 stem-only cases.

### 3b. The Android English voice — MEASURED session 29, a real hole in `v74_j`, NOT shipped

User, at the v75 cut: *"i still get caribbean sounding english on the static site at github, and
only on android"*. Not a cache and not a stale deploy — **`v74_j` fixed only the case where the
exact locale is PRESENT.** `languages.json` maps `en → en-GB`; with no `en-GB` voice installed,
`_ttsRankVoices` falls through `usable → exact → quality`, nothing is exact, and quality alone
decides — so a NETWORK voice in an arbitrary region beats the LOCAL `en-US`. Measured by calling the
product ranker: `en-GB` absent → **`en-NG`**; typical Android inventory → **`en-IN`**.

`unit-tts-voice-ranking` §5 builds exactly this inventory but asserts only that the app *speaks*,
never which voice — deliberately, from `v55_x` (*"a regional accent is not the failure v55_x
refuses"*). **That position is what the user is disputing, so this needs a ruling, not a patch.**

**Blocked on a design-principle decision.** "`en-US` is closer to `en-GB` than `en-JM`" is a
hand-authored language fact. Non-violating signals: **`voice.default`** (the platform's own pick) or
**`navigator.language`** (the device's region). Third option: leave the ranking and ship §6's
selector, so the user picks once and `imp3_voice_*` persists it — that store is written ONLY on an
explicit pick and is **not** the cause here.

### 3c. Serbian and Croatian — ✅ SHIPPED `v75_g` (table authored; native review OWED)

**Serbian does NOT "just use standard Cyrillic".** `scripts.json`'s `cyrillic` table is the
**33-letter Russian alphabet** — it contains `Ё Й Ы Э Щ Ъ Ь Ю Я`, none of which are Serbian, and
reads `Е` as *ye* (`ipa: je`) where Serbian has plain `/e/`. Serbian Cyrillic is 30 letters and adds
`Ђ Ј Љ Њ Ћ Џ`. Mapping `sr → cyrillic` would teach the Russian alphabet under a Serbian flag, and
leaving `sr` unmapped is not an option either (the file's own header: an unmapped code reads as
"no script"). Croatian is Latin only — `"hr": "latin"`, no new table.

Serbian is digraphic (both scripts official and equal), so the `ja: ["hiragana","katakana"]`
precedent fits: `"sr": ["cyrillic-sr", "latin"]`. **Needs a ruling** because one option is content
authoring: (a) author a 30-row `cyrillic-sr` table — which is exactly what the design principle
exists to prevent; (b) ship `sr` Latin-only now, add Cyrillic when a native speaker or the model
produces it; (c) have the model generate it under the existing prompt machinery, then QC it.
Both languages also need a `tts` code (`sr-RS`, `hr-HR`), 29 `names` entries each, and a `ui.json`
stub for `translate-ui.js`.

### 4. Browsing completion cards — ✅ ABSORBED into §0c (the progress-card rework)

Deleted as a separate item at the v76 cut: it *is* the back/next request. Its warning survives in
§0a — it interacts with `v74_l` and `v74_o`, and both need a ruling rather than a third navigation
rule layered on top.

### 5. `_sbChapterTarget` — the seventh and last known raw-lessons instance

`index.html` ~8065. Not fixed in session 28 because its test extracts it in isolation and calls it
with synthetic progress maps, so switching to `chapterComplete` (which reads `APP.progress` and the
v69_l stamp) needs that harness reworked first.

### 6. The storyline-page TTS selector

`dreizunge_v39_summary.md:331` records `_buildGlobalTtsSelectors()` building selectors "in all footer
rows (lesson-set, **storyline** screens)". Today `const ids = ['ls']`, the `-sl` elements are absent
from the markup, but the function's own existence check still looks for `tts-lang-select-sl`.
**No note anywhere in build_history explains the removal** — the dangling reference suggests an
incomplete removal rather than a decision. The user wants to choose between English variants for
readout; `v74_j` makes that safe (the menu now preselects what would actually be spoken).

Also dead: `#tts-row` / `buildTtsSelector()`, permanently `display:none` with the comment "replaced
by global TTS selectors in footers", still rebuilt on every lesson-set entry.

---

## USER TESTING NOTES — session 32, second batch (screenshots) — TRIAGED

### ✅ Done in `v78_i`

- **Chapter auto-read REMOVED from the progress card, and added nowhere else.** *"This supercedes
  previous instructions on putting it somewhere else."* §0f (`v77_v`) and the brief re-scoping to
  "the card before comprehension lessons" are both **withdrawn**. `_autoReadStory` is KEPT — the
  story is still readable from the speaker control, and the helper carries the four restraints
  (muted, review renders, once per chapter, never interrupting) that a future caller would otherwise
  rediscover. **`unit-story-autoread` now asserts it has NO CALL SITE**, so the ruling is a property
  of the product rather than a fact about one commit; a next session reading three releases of
  discussion about where to put it will fail the suite instead of putting it back.
- **Conjugation: multiple choice strongly preferred over typing.** Typing is now a FALLBACK for
  forms that cannot be asked as an MCQ, not a second question layered on the same form. **This also
  fixed a real defect the new corpus exposed:** `mcq_conjugation` and `type_conjugation` share ONE
  qid (`infinitive|pronoun`), so emitting both put two exercises with one identity into a round.
- **Conjugation solution shows the WHOLE phrase** — `vi ste`, not `ste`
  (`tp_17862850223960000178`, screenshot). The read-out had combined pronoun and form since it was
  written, so the app SAID the full phrase while SHOWING half of it; the reveal now uses the same
  composition, so the two cannot disagree.

### ✅ Done in `v78_j` — the three small specified items

- **Restore the FULL lesson suite to the single-chapter "add lesson" menu**
  (`Screenshot_2026-08-10_00-58-41.png`). Grammar and conjugation were hidden from this
  single-chapter version and should come back; the screenshot shows Vokabeln, Synonyme/Antonyme,
  Wortformen, Fehlerjagen, Verständnis, Mathematik, Mischübung, Schrift lernen — **missing Grammatik
  and Konjugation**. Find the menu's type list and the gate that trims it; check whether the
  omission is a hard-coded list or a capability gate (the script entry is gated by
  `scriptLessonAvailableForSet`, so at least one is real). **No new i18n** — both types already have
  registry entries and labels.
- **`translate-ui.js`: `--threads` and `--batch` on the command line.** Threads may already exist as
  an env var; batch size is the hard-coded 10-per-batch. Goal stated by the user: **integrate
  completely new languages more efficiently.** Cheap, and `unit-langnames` already drives the real
  mode with a stubbed backend, so it is testable headlessly.
- **Add Slovenian (`sl`).** `languages.json` entry + `_langScript` mapping (latin) + a `names` cell
  in all 32 languages. **Check `unit-intro-script`'s "every language is mapped in `_langScript`"
  assertion** — an unmapped code reads as "no script", which wrongly makes a Latin course look
  teachable to its speakers (v53). The `--langnames` run that just completed filled 1024/1024 cells;
  adding a language makes it 33×33 and reopens 65 of them.

### THE COVERAGE MEASUREMENT — done, session 32. Read this before designing anything.

The roadmap has said for three sections that this number comes first. It is measured now, through
the PRODUCT matcher (`_highlightVocabHtml` + `_storyWordSources`, never a re-implementation), over
**120 corpus chapters with a story**, and it reframes the request.

**How much of a chapter's story do its lessons teach today?**

```
TOKEN coverage (running words)  :  9.2%   (1946 of 21048)
TYPE  coverage (distinct words) :  8.2%   (1127 of 13764)

per-chapter TYPE coverage   min 0%   p25 5.3%   median 13.2%   p75 19.2%   max 48.6%
chapters below 25%: 108 of 120        chapters above 50%: 0
```

**So it is a GENERATION problem, not a gap-filling problem** — decisively, and that was the question
the number was for. A learner who has solved every lesson in a chapter can read roughly one word in
eleven of its story. "Exhaust the vocabulary of the input text" is not a matter of topping up the
last few items; the current corpus is an order of magnitude away.

**And the second cut changes the design, not just the scale.** Splitting the story's word types by
CORPUS FREQUENCY per language (statistics, not a word list — INTERNALS §4):

```
top-100 most frequent types    350 / 3878  =  9.0% covered
top-500                        466 / 3821  = 12.2% covered
rare (everything else)         311 / 6065  =  5.1% covered
```

**The RAREST words are the LEAST covered** — the exact opposite of the user's "start with the
hard/unusual words". The generator today skews slightly toward the common ones. So the request is a
change of POLICY, not only of volume: even at ten times the output, a generator that keeps picking
by whatever it currently picks by would still leave the hard words last.

**What this settles, and what it does not:**
- **Settled:** the per-text scheme needs generation aimed at the text, and it needs a difficulty
  ordering to aim with. Both are the user's own framing, and the data supports both.
- **Settled:** "if it's a simple short text, go towards the basic words as well" is not a separate
  mode — at 9% coverage of the top-100 band, the basic words are not covered either.
- **NOT settled, and the next thing to measure:** how much of the gap is *reachable*. A story
  contains proper nouns, numbers and inflected forms of words the lessons DO teach; the matcher
  counts an inflection as uncovered unless a `word_forms` lesson happens to list it. **Before
  sizing any generator, measure what share of the uncovered types are inflections of covered
  lemmas** — that is the difference between "generate ten times as much" and "teach the forms of
  what is already taught", and `v78_h`'s tier-2 note (corpus inflections from `word_forms` /
  `grammar.plural`) is the machinery that would answer it.
- **Caveat on the method, stated so it is not over-read:** "covered" here means the word appears in
  some lesson of that chapter, which is a strict reading — a learner also carries vocabulary from
  earlier chapters. The cumulative figure is worse in the other direction (83% of a learner's
  cumulative vocabulary does not occur in the chapter on screen — see the §0e re-plan), so the two
  measurements bracket the real answer rather than agreeing on it. Neither is above 20%.

### → NEEDS DESIGN, and the user wants it discussed before it is built

**"DEVELOP A LEARNING SCHEME FOR EACH TEXT, where lessons are focussed on teaching the text."**
The user's framing, recorded close to verbatim because the shape matters more than any summary:

- Adding vocab lessons to a chapter should **exhaust the vocabulary of the input text** — the model
  should use vocab **not already covered by existing lessons**, ideally covering all non-basic
  vocabulary, and for a simple/short text (e.g. children's) going down to the basic words too.
- In the long run: **a full word-by-word dissection of the text**, with lessons presented
  semi-randomly around that dissection. **Start with the hard/unusual words**; the learner can
  indicate — or the app can detect — whether they understand the text sufficiently or need more
  basic lessons first.
- **Dynamic difficulty**: start mid-level; too hard → easier vocab; too easy → more specific/harder.
  Guided by the learner's history.
- **No short-cuts to the source-language interpretation.** The learner MUST prove vocabulary
  understanding first. (This is a hard constraint on the UI, not a preference — it rules out
  "reveal translation" affordances on the path being designed.)
- For a language pair, **draw on OTHER existing stories** for the dynamic quizzing, or suggest
  solving a simpler storyline first. **This needs both stories and individual questions ranked by
  difficulty.**

**Related existing item: the `extend` / `reinforce` redefinition.** The user is right that there is
already a TODO in that area — this supersedes and enlarges it. `reinforce` currently means "reuse
prior chapters' vocabulary"; the request above makes the real axis **coverage of THIS text**, which
is a different quantity and measurable today.

**The first measurement is DONE — see "THE COVERAGE MEASUREMENT" above: 9.2% of tokens, 8.2% of
types, rarest words least covered. It is a GENERATION problem, and a policy change as well as a
volume one.** The original framing of that question is kept below because the distinction it draws
is the one that mattered: **what fraction of a chapter's story tokens are already covered by its
lessons?** `v78_h` built
exactly the collector for it — `_storyWordSources` returns every word every source teaches — but
`v78_h` measured MARKS, not COVERAGE. Marks count occurrences; coverage is the share of the text a
learner could actually read. **Do that measurement first**: if a typical chapter covers 15% of its
story, "exhaust the vocabulary" is a generation problem; if it covers 70%, it is a gap-filling
problem, and those are different products. The same number is the prerequisite for the progressive
reveal idea below, so it is owed twice over.

## USER TESTING NOTES — session 32 batch, TRIAGED AND SCHEDULED

Five notes. Triaged with the code loaded, and **placed in the existing plan rather than queued as a
flat list** — two belong to sections that already exist, one is a decision rather than a defect, and
one was fixed on the spot.

### ✅ Fixed immediately — `v78_c`

- **`--langnames` crash: `Fatal: issues.some is not a function`.** Full note in the shipped table.
  **Invisible until a name is actually REJECTED** — on the happy path `issues` is empty and
  `[].some(fn)` never invokes `fn`. The 119 missing cells the run reported are unaffected: the crash
  was in the writer, not the survey.

### ✅ §7 — script lessons for a DIGRAPHIC SOURCE — `sl_56647998` — SHIPPED as `v78_g`

**User: "I generated a serbian-latin → serbian-cyrillic storyline but I can't add script lessons to
it. Script lessons would obviously fit such a script-focussed lesson."** Correct, and the cause is
exact — now with the reproduction case in the corpus (`tp_17862984310970000000`: `lang sr`,
`script cyrillic-sr`, `srcLang sr`, `srcScript latin`, both stamped by the v76_i picker).

`needsIntroScript(target, src)` computes the learner's readable scripts as
**`scriptsForLang(srcLang)` — every script the source LANGUAGE admits**. For `sr → sr` that is
`["cyrillic-sr","latin"]` on *both* sides, so `tgt.some(s => !src.has(s))` is **false** and the gate
concludes the learner already reads everything. `buildArcIntroLessons` skips every script for the
same reason (`srcScripts.has(scr) → continue`).

**The gate encodes "which scripts can this language be written in", where the question is "which
script is THIS chapter's source actually written in".** Since `v76_g`/`v76_h` that is a stored
per-topic fact: **`srcScript`**. The fix reads the chosen script when there is one —
`srcScript ? [srcScript] : scriptsForLang(srcLang)` — the same one-line shape in both functions.

Notes for whoever takes it:
- **The bug only bites when the SOURCE language is digraphic**, i.e. exactly the languages in
  `scripts.json` `_scriptChoice` (`["sr"]` today). `sr→en`, `ar→en` etc. are unaffected — which is
  why it survived: the corpus had no digraphic-source chapter until the user made one.
- **`index.html` carries its OWN `needsIntroScript`/`scriptTeachable` (≈1762/1894) — DoD item 5,
  data parity.** Fix both and assert parity, or the menu and the generator disagree about whether
  the option exists at all.
- Callers must pass the script through: `index.html:2540` and `:5033` gate the arc-script checkbox
  off `APP.lang`/`APP.srcLang` only; the v76_i picker already holds the chosen scripts.
- **Re-check `scriptTeachable` at the same time.** Once the source set narrows to ONE script its
  `soundsFor` test is being asked a sharper question than before — confirm the sr→sr direction is
  teachable in both directions rather than assuming it.
- Its own release. The gate itself is headless; only the end-to-end needs a live model.

### ✅ SHIPPED as `v78_l` — Replay's target ordering (NOT a conflict, an ORDER bug)

**User: "the replay button plays only comprehension lessons after a lesson is complete… preferably
those that haven't been seen before. Is this request in conflict with the definition of this
button?"**

**Answered: no. The definition is fine and the ORDER is wrong.** Replay is `repeatForCoverage`,
whose defined job is to raise COVERAGE. A lesson at 100% has nothing unsolved, so replaying it
raises nothing and it is correctly skipped. **An unplayed lesson is not at 100% — it is at zero**,
so "prefer ones not yet seen" is not a competing rule, it is the *strongest case* of the rule
already there.

What actually goes wrong: `_firstCoverageShortLessonIdx` returns the **first coverage-short lesson
in document order**, not the least covered. A comprehension lesson sits early and, since `v77_t`
narrows a repeat to the questions still unanswered, stays short for a long time — so it wins that
scan every time and later unplayed lessons are never reached.

Fix shape: choose the **least-covered** counted lesson (unplayed = 0% sorts first) rather than the
first short one. Keeps the button's meaning intact, no ruling needed. **Schedule with §0e/§3**,
which already owns the same card; re-run and diff `probe_gates_v77.js` after it.

### → §0c — auto read-out: RULED (user, session 32), but HELD for a screenshot

**User: "move auto-read from the progress card when the story unlocks to the card that is shown
before comprehension lessons. No other place. But the mute button should work on it."**

The read-out does not go on the finished card at all; it **moves**, and the current §0f call site is
**removed in the same change** — "no other place" is part of the ruling, not a side effect.

**HELD: do not implement yet.** The user will send a screenshot pinning which card is meant. "The
card shown before comprehension lessons" is ambiguous in the current walk — the summary card
(`v77_h`), the story-unlocked card (`v77_j`) and the progress card can all precede a comprehension
lesson, and `v77_j` exists *because* the story-unlock moment was given its own page. Guessing would
move the feature to the wrong screen and delete the working call site on the way.

When it is built:
- **Mute must work on it** — a REAL change, not a restatement of §0f's first restraint. §0f only
  checks `APP.muted` at fire time and then goes straight to `_doSpeakLang`, deliberately bypassing
  `speakBodyText` (which force-unmutes on a tap). "The mute button should work on it" means pressing
  🔇 **while it is reading** must stop it — i.e. `toggleMute` has to cancel speech in flight. Check
  what `toggleMute` does today before assuming.
- §0f's other three restraints carry over verbatim: never on a review render, once per chapter per
  session, never interrupt speech already in progress (`v75_h`).
- `_autoReadStory` already takes `(topicKey, story, langCode)`, so the move is a call-site change
  plus the mute wiring — not a rewrite.
- The `v77_v` guard asserts §0f's behaviour at the OLD site and must move with it, or it passes
  vacuously against a call site that no longer exists.

Measured, and still true: `_autoReadStory` has exactly one call site today (the progress card story
panel, `v77_v`), and the finished card `v77_f` has none. So this was never a regression.

### → Group B, unchanged

The remaining group-B items are **not** displaced by this batch and stay next in line.

## USER TESTING NOTES — session 31 batch, TRIAGED (not yet done unless marked)

Triaged with the code loaded. Grouped by what each needs, because several look like separate items
and are not. **Two were fixed immediately as `v77_x`** (chapter titles, math order).

### A. Fixed this session
- ✅ **Chapter-title generation failing on multi-chapter storylines** — `v77_x`. Root cause above;
  note it explains the user's own observation that the lesson-set page worked.
- ✅ **Math ordering shows the solved order** — `v77_x`.

### B. Small and self-contained — good first work for a fresh session
- ✅ **Clear-progress at CHAPTER level** — `v78_e`, on the **progress cards** (🧹 `comp-wipe`), via the
  shared `_clearChapterProgress`. The storyline page keeps its storyline-wide control and now shares
  the same rule; **`clearLessonProgress` turned out to be a THIRD copy carrying the `v77_s` defect
  and is fixed too.**
  **RESOLVED by the user (session 32): the "inside error / AI-error-hunt lessons" half meant
  something different — clearing the errors the LEARNER had marked, so they can be re-tagged, not a
  chapter wipe. The user then dropped it: "we can actually skip this." Not carried forward.**
  Still optional, never requested: a per-chapter control on the storyline page's chapter cards. Not
  scheduled — the progress card already carries it and those cards have the lock overlay and the
  `v76_d` element-counting trap. Raise it if it is wanted.
- ⚠️ **Sentence-translation read-out should include the `"Übersetze: "` prefix** (tp_579238210) — read
  the whole question in the source language. **RETRIAGED session 32 → needs the USER, not a fix.**
  `Übersetze: "{sentence}"` is `ex.order.q`, the WORD-ORDER exercise, and its question is entirely
  in the source language — which fits the note exactly. But **there is no read-out of it to add a
  prefix to**: every `speak`/`speakLang`/`speakBodyText` call site was enumerated, and `renderEx`
  auto-speaks only `listen_mcq`/`listen_type` (and speaks `ex.target`). `tOrder` renders no speaker
  control at all. So this is either a request to ADD a source-language question read-out to the
  order exercise — a new affordance, not a prefix fix — or it is about a screen other than the one
  found. **Ask before building.** Full note in the session-32 notes §3.
- ✅ **Synonym/antonym questions should state how many are to be found** ("<n> similar to <word>")
  — `v78_b`. Counted from `ex.correct`, the array Check scores against. New `_n` keys (owed to the
  translate pass); the uncounted keys stay as the fallback and must not be deleted.
- ✅ **Conjugation options must be alternative forms of THE SAME verb**, not other verbs, and need
  not be padded to four — `v78_d`. Same-verb pool, no cross-verb padding; the coverage universe was
  checked for the v71_s stranding trap and is unaffected.
- ✅ **Teacher-mode switch at the bottom of every page**, beside the UI-language and mute controls
  — `v78_f`. Three controls, ONE updater; the compact footer icon derives its glyph from the same
  label string the landing button shows, so there is no second spelling of "which icon means which
  state". Reused the existing `teacher.*` keys — nothing new owed to the translate pass.
  (User's "will later depend on credentials" is unchanged and still ahead: the control is wired to
  `APP._teacherMode` exactly as the landing button always was, and gating it on credentials is the
  same one change in the same one place it would have been before.)
- **Highlight word forms from conjugation and word-form lessons**, so covered vocabulary lights up
  more fully. **Belongs with §0e/§3 and the ONE shared matcher** — do not add a second matcher.

### C. Needs a live model — prompt work, verify with the user
- **Error-hunt lessons fail too often.** The user's diagnosis is concrete: make the error count
  length-dependent (1/2/3 by difficulty per paragraph or per word budget), relax "exactly", and use
  1/2/3 in TOTAL as the rejection floor. The reported failure ends in an empty Ollama response after
  three retries, so this also costs a whole add-lesson attempt.
- **Vocab lessons: article mismatch** (target `palazzo`, source `der Palast`). Prompt needs to be
  stricter, with BAD examples.
- **Word-form sentences are too long** — same treatment as synonyms.
- **Comprehension scope:** ask for chapter-level questions first, then whole-story ones, via the
  prompt rather than a new selector.
- **§0g's model-prompt change** (already recorded) belongs with these.

### D. Bugs needing reproduction — ask the user for the case
- **Bulk "add lessons": ticking mixed produced no mixed lessons**, and adding mixed alone appears to
  require another lesson type alongside it. Should work on its own, per chapter.
- **Live mode: edit windows keep the PREVIOUS chapter's content** when browsing between chapters
  (lesson editor, QC story proposals). Smells like a render that reuses a panel without clearing it
  — the same shape as several card bugs this session.

### E. Larger features — need their own release, and a decision first
- **Second script for Serbian (Latin ⇄ Cyrillic):** an LLM-generated alternative script plus a
  toggle beside the translate button in every read-story field. Note `v75_g` already ships an
  `sr`/`hr` table and a native review is OWED — settle that first.
  **Extended session 32 — the SAME toggle is wanted for the UI.** The `sr` `ui.json` pass that
  arrived at the session-32 drop is complete (612 keys) and **written entirely in LATIN script,
  zero Cyrillic**. User's ruling: *"we can keep this for now, but later perhaps add both options."*
  So `sr` UI stays Latin-only and is **not** a defect. When it is picked up, note the shape: this is
  the same question as the story toggle and the same question as `_scriptChoice`, in a third place —
  a language whose UI, whose story text and whose lesson content can each be in either script. It
  wants ONE notion of "which script is this learner reading", not three toggles that can disagree.
  **Sequence it after §7** (script lessons for a digraphic source), which is the first thing to
  actually READ the per-topic `script`/`srcScript` fields; §7 establishes whether that pair is the
  right carrier before a third consumer is built on it.
- **Live main page should mirror the static one**, with generation moved behind a button/card, and
  every "continue story" affordance redirecting there.
- **Floating pill listing running LLM jobs, one row each, with a working STOP per job.**
- **Token accounting must include deleted lessons/chapters** — record the spend when deleting, or
  the total is not a total.
- **Social-media preview for storyline URLs** (title + storyboard). Server-side OG tags; cheap only
  if the storyboard is already reachable as an image.
- **Startup check for missing ENGLISH ui.json keys**, not only other languages. Note
  `unit-ui-key-exists` already does this in the SUITE — this is about the running app.

## RECOVERED — carried since v71, still not done

These were lost once at the v71→v72 roadmap boundary and recovered in `v73_k`. **Do not let them
drop again.**

- **Global QC**: a checkbox menu of what to QC, merged with the user's request to make the book's
  automatic QC opt-in from the lesson-type menu and run it AFTER the storyboard pass. **Note this
  reverses the `v68.1` ordering decision.**
- **Crossword**: show the correct word's translation instead of the empty underline. **Needs a
  decision first** — `word_forms` items have no translation.
- **Live mode with teacher mode OFF must hide every editing control.** Same `_canEdit()` conflation
  as the authorization plan. (`v74_h` deliberately did NOT reuse `hideProv` as a screen proxy for
  exactly this reason — see the session notes.)

---

## Owed by the USER — not doable in a container

**New `en`-only keys from `v78_b`, owed to the translate pass:** `ex.syn.q_synonyms_n`
(`{n} similar to {word}`) and `ex.syn.q_antonyms_n` (`{n} opposite to {word}`). **Both carry TWO
placeholders** — a translation that drops `{n}` silently loses the feature for that language, so
these are worth a glance when the file comes back. The uncounted `ex.syn.q_synonyms` /
`ex.syn.q_antonyms` are still in use as the fallback and are already translated: **do not delete
them.** `unit-syn-count` §5 asserts en-only, which is correct only while the keys are new — flip it
to "no language holds the English string verbatim" once the pass has run (`v71_q`).

**New `en`-only keys from `v77_i`, owed to the translate pass:** `unlocked.title`
("Next chapter unlocked!"), `unlocked.next`, `unlocked.back_card`, `unlocked.progress`
("{done} of {total} chapters").

**New `en`-only keys from `v77_h`, owed to the translate pass:** `summary.title`
("The story so far"), `summary.open`, `summary.next` ("Back to your progress"),
`summary.chapters` ("{n} chapters").

**New `en`-only keys from `v77_f`, owed to the translate pass:** `finished.title`
("Story finished!"), `finished.vocab` ("Everything you learned"), `finished.next`
("See the whole story"), `finished.back_card` ("Back to the chapter"). `t()` falls back through
English meanwhile. **`v71_q`: never assert a dropped key absent.**

- **A browser pass.** Nineteen releases deep. `v74_c` changed what coverage MEANS, `v74_i` was the
  only `server.js` change of the session (live mode is the half that cannot be exercised headlessly,
  only simulated), and `v74_j` / `v74_n` are visual.
- **Serbian/Croatian follow-ups (`v75_g`):** the 28 non-English `names` entries in
  `languages.json`, the `ui.json` translate pass for `sr` and `hr` (both are empty stubs), and
  **a native-speaker check of the 30 `cyrillic-sr` rows** — especially the letter names and the
  IPA column. The table was authored in-container, which is exactly the case the design
  principle warns is wrong in ways that stay invisible until a native speaker looks.
- **The comprehension QC checker** — needs a new prompt and a live model. Correctly queued, not
  started in a container.
- **The translate pass.** Changed in English and DROPPED from the other 29 languages for refill:
  `complete.story_unlocked`, `ex.badge.comprehension`. New and English-only:
  `complete.words_solved` = "Words you can read in this chapter",
  `form.finish_mixed` = "Finish the chapter with a mixed review round (no AI)".
  **(v75_b) These two were MISSING FROM `en` TOO** — the returning `ui.json` predated them, so they
  rendered as raw key text. Now present in `en`; every other language is missing exactly these two
  and nothing else (verified). `t()` falls back through English, so nothing is broken meanwhile.
  **`v71_q`: never assert a dropped key absent.** **When the file comes back, `unit-ui-key-exists`
  catches it if it predates the code again.**

---

## Rules earned in session 28 — read these before writing a probe

1. **A probe must call the product function, never a re-typed copy** — and least of all one lifted
   from a test stub. Two false findings came from re-implementing `lessonCountsFor` and the
   read-full-story lock instead of invoking them. One reported a hole that did not exist; the other
   reported a fix as not working when it already was.
2. **A claim about behaviour is only measured if the assertion touched the thing being claimed.**
   `setComplete=false` is not evidence about a button. Three inference-not-measurement errors this
   session: math's generator, the `lessonCountsFor` stub, and the error-hunt "lock".
3. **A non-vacuity check must be evaluated on the data the assertion actually runs against**, not on
   the data it was derived from. Two guards passed under their own reverts because the fixture had
   been projected before the assertion saw it.
4. **A guard that reads its own explanatory comment is a guard that lies.** A negative match on
   `white-space:nowrap` found the comment naming what had been replaced.
5. **A headless harness that builds `APP.savedList` from whole topics is testing STATIC mode**,
   whatever else it thinks it is testing. That blind spot hid `v74_i` from 167 green checks — every
   existing test ran in the static shape, and the live shape existed only in a browser.
6. **Where the environment admits only one writer, unexplained state is yours.** Mid-session a
   version bump and three edits landed without the definition-of-done being run, so the tree drifted
   past the artifact the user held; the changes were then not recognised as mine. The suite-docs-
   package cycle exists to make that drift impossible. Follow it per change.

---

## ⚠️ Session protocol — READ FIRST, applies to every change

This block is the standing "definition of done." A fresh session is expected to follow it without
being re-told; several of these were missed in past sessions (LIVE-TEST updates, i18n listing,
version bump) and only caught because the user noticed. Treat it as a checklist.

**How to start a session:** read `build_history/HANDOVER.md` first (one page: baseline numbers,
what is owed by the USER, open decisions), then THIS file (the highest-numbered
`build_history/roadmap_v*.md` is the current one), then `INTERNALS.md`, then the most recent
`build_history/v*_session*_notes.md`. Establish the green baseline (`node test/run.js` +
`node test/check-inline.js`) before touching anything.

**Working rules (per change):**
- One change at a time. Pure refactors stay byte-identical. After each change: full suite green
  (`node test/run.js`) and `check-inline` at 0. Re-run before moving on.
- **A carried-forward open item must be cross-checked against the SHIPPED list in the same file
  before it is carried again.** Added session 26: the "Drill result card" item was carried through
  four releases while `roadmap_v71.md` recorded it as shipped in `v71_h` on line 227 — the open
  entry sat 264 lines below the entry that closed it. Deferring an item is not evidence that it is
  still open.
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
   implicitly `a`, so the sequence is `v77` → `v77_b` → `v77_c` → … — the same convention the v69–v76
   lines ran. **This is the `v78` line.** Roadmaps are per BASE version, so point
   releases do not each get one — this file stays current through the whole v78 line.
   (This paragraph is the one version-specific line in the block and had shipped stale FOUR times by
   session 32 — `roadmap_v73.md` said "the `v72` line", `roadmap_v76.md` said "the `v75` line" for
   its whole run, and this file was written at the v78 cut still naming the v77 line, in BOTH
   sentences. **It is no longer maintained by hand: `unit-roadmap-version` asserts that the
   highest-numbered roadmap names the same base version as `server.js`'s `APP_VERSION`.** A note
   telling the next session to check something is not a guard; four repeats is enough evidence that
   this one was never going to be checked.)
7. **Roadmap** — mark shipped items ✅, carry every open TODO/idea forward, and at a version bump
   write the next `build_history/roadmap_v{N+1}.md` (carrying this protocol block forward).
8. **Session notes** — write/update `build_history/v{ver}_session{n}_notes.md`.
   **(v75) Prompt files are named for the version the session WRAPS UP WITH**, not the one it starts
   from: the prompt that opened the session ending in `v75` is `build_history/v75_prompt.md`. The old
   `session_{n}_prompt.md` names were renamed to match (`session_28_prompt.md` → `v74_prompt.md`,
   `session_29_prompt.md` → `v75_prompt.md`) — the session numbering had drifted from the version
   numbering and only one of the two is meaningful later.
9. **Package** — sync the release dir, regenerate `docs/`, zip, and call out which deliverables are
   still owed (browser pass, i18n, native-speaker content checks).
   **(v77_h, user) The zip's TOP-LEVEL DIRECTORY must be named for the release it contains**, not
   for the base cut: `dreizunge_v77_f.zip` unpacks to `dreizunge_v77_f/`. Unpacking every point
   release into the same `dreizunge_v77/` silently overwrites the previous one, or merges into it —
   which is how a stale file survives a release. Rename the directory before zipping; do not rely
   on the working directory's name.

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

## Rules earned in session 29 (continued — see the session notes for the full set)

5. **A whitelist fails silently and per-type, so its guard must be per-type AND driven off the
   registry**, or it guards only the types someone thought of.
6. **A "curated title" is a proxy for authorship, not for content.** Deciding which copy of a
   duplicated record survives by any signal other than its content will eventually delete content.
7. **"Every language has key X" goes stale when a LANGUAGE is added**, exactly as "key X is absent
   everywhere" goes stale when the translate pass runs. Scope such claims to the languages actually
   translated, and floor them for non-vacuity.
8. **Replacing a brittle source pin is itself a change that needs revert-verifying.** The first
   replacement of the `if (!u)` pin was vacuous in a NEW way — its match window reached past the
   block it meant to check — and only the paired behavioural test exposed it.

## Rules earned in session 29

1. **A comment near a source-scanned pattern must not spell the pattern.** The repair comment for
   `common.cancel` contained a literal `t('…')` call and failed the very sweep it documented —
   rule 4 above, arriving from the other direction: a correct guard made to fail by prose *about*
   code. A source scanner cannot tell the two apart.
2. **When a guard asserts the precondition of a render, assert it against the state the render
   LEAVES.** A precondition checked before `showComplete()` passed under its own revert, because
   rendering the card is what marks the lesson done and flips the branch it was guarding.
3. **A test that does not reset shared state is a test of whatever ran before it.** `seed()`
   preserves `APP.progress` by design and the §3 lock probe writes completion keyed by topic NAME;
   one corpus change made two fixtures the same chapter and the leak surfaced. A section needing
   empty progress must clear it and say so.
4. **Timestamps are evidence, and cheap.** `ui.json` older than `index.html` was the entire
   diagnosis of the first red check.

## Rules earned in session 30

15. **A fix to the client is not a fix to the published build.** `build-static.js` re-implements
    part of `index.html` — currently `loadSavedList` and `savedItemHtml`. Any change to the landing
    page must be applied twice and asserted against `docs/index.html`. The `v76_e` guard passed for
    two releases while the published build stayed broken.

12. **A test that hard-codes a COUNT of a repeated element is pinning the fixture, not the claim.**
    `total 🔒 === 1` meant "a two-chapter storyline"; it broke on a six-chapter chain while the
    product was correct. Count by element KIND (the chapter-card overlay and the full-story row are
    different elements), or assert the specific element the claim is about.
13. **A guard whose scenario matches nothing may never reach the branch it tests.** `loadSavedList`
    returns early on an empty filtered list, so a "this must NOT be shown" check written with a
    filter matching nothing passed under its own revert. A negative assertion needs a positive one
    beside it proving the render got that far.
14. **Identity must be CARRIED through a projection, never recovered by hashing it.** Third time:
    `v75_f` (a storyline rebuilt because its stored id was not the hash of its chapters), `v76_e`
    (a storyline unrecognised because its chapter list was filtered before it was matched). If a
    list is filtered and then matched back against its source by length or position, the filter and
    the match are the same bug waiting.

## Rules earned in session 31

21. **A variable declared with `let` further down the same function cannot be read earlier — check
    the declaration line before reaching for a value.** `showComplete` computes `_storyDone` ~60
    lines BELOW its Next wiring; reading it there is a `ReferenceError` on every terminal card, and
    it is the exact `v68.1` bug in the exact `v68.1` function. **And the obvious fix is worse:**
    re-deriving the value inline creates a second copy of the rule, which is how the storyline
    page's connector line drifted in `v71_w`. Extract one function both sites call.
22. **A handler declared inline in markup is one a headless test can never click.** The stub DOM
    does not turn an `onclick="f()"` attribute into a callable property. `comp-next` has always
    assigned its handler in JS; anything testable must do the same.

19. **Three of `v76_card_gates.md`'s findings were seeding artefacts, in three different stores**
    (`comp-back`/`comp-story`: the stub DOM itself; the coverage rows: `solved` keyed by item vs
    qid; `comp-drill`: `learned` never written at all). A gate table is only as good as the state it
    seeds, and "the element was never enabled in 32 rows" usually means **the store that enables it
    was never populated** — not that the feature is dead. Before deleting a control as unreachable,
    find its enabling store and write it the way the PRODUCT writes it.
20. **When a passing test contradicts a written finding, the test is usually right.**
    `unit-card-consistency` asserted "drill is live once mistakes exist" while the truth table said
    "never once enabled", and the contradiction sat in the tree for a release because prose is read
    as measurement and a green assertion is read as a detail. Grep the suite for the element before
    trusting a table about it.

16. **An element-visibility probe against the stub DOM must first assert the element exists in the
    MARKUP.** `lib-dom` auto-vivifies any id, so `getElementById('anything')` returns a fresh stub
    with no `display` and no `disabled` — which reads as "present and visible", or as "present and
    hidden" once the probe's own legend maps it. Two of the nine columns in `v76_card_gates.md`
    (`comp-back`, `comp-story`) were phantoms for a whole release, and the roadmap carried
    "the button is already there and already dead" into a rework that was about to reuse it.
    The probe DID call the product function — but the READOUT went through the stub, so the
    assertion never touched the thing being claimed (session-28 rule 2, from a new direction).
17. **When two stores are keyed differently, seeding one and reading the other measures nothing.**
    The `v76` coverage question — "86 keys in, 0 counted" — was a probe seeding the QID universe
    into a store `topicCoverage` reads by ITEM key. Before concluding a gate is unreachable, seed
    it the way the PRODUCT writes it (here: `markSolved`), or drive the real path.
18. **A guard that asserts a construct is ABSENT survives a rewrite; one that pins a phrasing does
    not.** `unit-card-errors` asserts zero empty `catch` blocks in `showComplete` rather than
    matching the new call text — so it keeps working as the rework moves that code, which is
    precisely what §0a asks of the eight files that currently pin source text.

## Rules earned in session 32

23. **A fixer is not a diagnosis, and two guards firing together may be one cause seen twice.** The
    `v78` baseline opened red on both data-sensitive guards, each with a documented one-line remedy.
    Running either remedy **destroys the evidence** that says whether the remedy was right: three
    cheap facts (corpus counts unchanged at 308/86, `lessons.json` the OLDEST file in the tree, the
    hash the freshness guard names) narrowed it before anything was written, and the first
    hypothesis they suggested turned out to be **wrong** — the backfill did not reproduce the hash
    `docs/` was built from. The real cause was one thing: the shipped `lessons.json` was the user's
    NEWER file (7 topics with an `ai_error_hunt` lesson `docs/` lacked). **Corollary: when the
    remedies interact, the ORDER is part of the diagnosis** — `build-static.js` first, the fixer the
    failure literally asks for, would have baked the unstamped corpus and overwritten the evidence.
    Backfill, then rebuild.
24. **A note instructing the next session to check something is not a guard.** The protocol's
    version sentence went stale four times, each correction ending in a fresh reminder to check it
    next time; the fourth repeat got BOTH its sentences wrong, the second having survived every
    earlier fix. If a fact can be derived from a source of truth, assert it (`unit-roadmap-version`).
    A reminder is what you write when you have decided not to.

25. **Never put emoji — or any non-BMP character — in a string literal inside the script that writes
    a file.** Session 32 truncated `roadmap_v78.md` **to zero bytes** with a heredoc containing
    `\ud83e\uddf9` surrogate escapes: encoding rejects lone surrogates, and the exception arrives
    AFTER the file is opened for writing, so a "failed" write is not a no-op. Write such blocks with
    a `cat` heredoc to a temp file and splice the FILE in, so the bytes come from disk rather than
    from an escape the writer must encode. `unit-roadmap-version` caught it on the next run, and the
    packaged zip was the only intact copy — both worth remembering.

26. **When two releases each change the same surface, re-measure the older plan against the newer
    behaviour before scheduling it.** §0e's "order the vocabulary as the words appear in the story"
    assumed a per-CHAPTER panel; `v77_f` later made that panel CUMULATIVE across the deck. Neither
    was wrong, and nothing forced them to be compared — so a plan carried unchanged across three
    roadmaps turned out to describe **17% of the data** (measured: 83% of cumulative panel words
    never occur in the story on screen). The check was one probe over the corpus and was available
    the whole time. **A plan carried forward unchanged across N roadmaps is a plan whose premises
    have not been checked against N roadmaps' worth of changes.**

(If you add a new standing rule, append it here so the next session inherits it.)
