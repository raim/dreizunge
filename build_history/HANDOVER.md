# Handover — state at end of session 26 (`v73`)

A single page for whoever picks this up. Read `roadmap_v72.md` first (its session-start list), then
`INTERNALS.md`. This file exists only to say **what is owed and by whom**, which is the thing that
gets lost across a long thread.

## Green baseline

`node test/run.js` → **161 checks** · `node test/run.js --quick` → **140**
`node test/check-inline.js` → 0 on `index.html` AND `docs/index.html`
Version **`v73`** — the current roadmap is **`build_history/roadmap_v73.md`** (v72 is closed;
its history stays in `roadmap_v72.md`).
`docs/` rebuilt and matching.

> **Session 26 opened RED (3 of 159) and it was not one cause.** `ui.json` had been refilled *and*
> `lessons.json` had changed unannounced (archive timestamps: code 07:24, corpus 09:17, ui 11:19).
> One guard was wrong, one guard was right about defective data, and one test's corpus-picked
> fixture had drifted so it was silently guarding nothing. If you open red, diagnose each failure
> separately before assuming a single explanation — see `v72f_session26_notes.md` §1.

## Starting the next session — `lib-dom` first, then the cleanup pass

The next session is expected to be **two things in order**: the `lib-dom` work below, and then a
general cleanup / refactoring / documentation pass. Do them in that order — `lib-dom` decides how
much of the cleanup is even possible, because several of the cleanup candidates are tests that
currently pin *source text* precisely because they cannot read the DOM back.

### Part 1 — `lib-dom` runtime `innerHTML` parsing

This is the whole intended scope of the next session. It is the last ready item that needs a
session of its own, and it unblocks every future picker/widget test.

**The problem.** `test/lib-dom.js` (247 lines) is a hand-rolled fake DOM. It stores `innerHTML` as a
string but never parses it, and `getElementById` / `querySelector` return *fresh stubs* rather than
the nodes the markup describes. `index.html` assigns `innerHTML` in **128 places**, so anything
rendered that way — every tick-list from `renderLessonTypeChecks`, every picker, every dynamically
built card — cannot be read back headlessly. Tests are forced to regex the produced markup string,
which is why several assertions in the suite pin *source text* rather than *behaviour*.

**The task.** Make assigning `innerHTML` parse the markup into real child elements, so queries find
them and tests can assert on `disabled`, `classList`, `textContent`, `value` — the things a learner
actually experiences.

**Constraints, in order of how much trouble they cause:**
1. **Zero dependencies.** No jsdom, no parse5. A small hand-written tag/attribute/text parser, in
   the same spirit as the rest of `lib-dom`. It does not need to be a correct HTML5 parser — it
   needs to handle the markup *this app emits*, which is well-formed and generated.
2. **It changes behaviour for every existing harness.** Queries that today return an empty stub will
   start returning real nodes. Some current assertions pass *because* the stub was empty. Expect the
   suite to go red and treat each failure as a finding — some will be tests that were vacuous.
3. **Attribute vs property.** Render code emits `disabled`, `class`, `style="display:none"` as
   attribute strings; existing tests read them as properties (`nx.disabled === true`,
   `el.style.display`). The parser has to reflect attributes onto the same properties the rest of
   `lib-dom` already exposes, or half the suite will disagree with the other half.
4. **Realm boundary** (see `INTERNALS.md`): values built inside the vm have foreign prototypes.
   Nodes the parser creates must be created the same way `lib-dom` creates its existing elements.

**Definition of done for this one:** full suite green at its new count, `check-inline` 0 on both
builds, and **at least one existing test converted** from asserting on a markup string to asserting
on parsed nodes — otherwise the capability is unproven. Say in the notes which assertions turned out
to have been vacuous, because that is the real payoff.

**Do not** start this at the end of a session doing something else. It is exactly the item that was
deferred four times for that reason, and it will go red across the whole suite before it goes green.

### Part 2 — cleanup, refactoring, documentation

Candidates, each with the evidence that produced it. This is a list of *known* problems, not an
invitation to tidy generally — a refactor without a named defect behind it is how this codebase
grows second copies of rules.

**Test-quality work (do this while `lib-dom` is fresh):**

1. **A vacuity sweep.** Session 26 found **four** assertions that passed while proving nothing: the
   `smoke-render` lock fixture (guarding a branch it could no longer reach), a `_synClamp` fixture
   whose window started at word 0 so the branch never ran, an `assert(... || true)`, and a guard
   that read `prompts.json` only while reporting "all accounted for". All four were the same shape —
   **asserting on something downstream of the thing under test**. They were found by accident, not
   by looking. Look systematically: for each assertion, ask what edit to the *product* code would
   make it fail, and if there isn't one, it is decoration.
2. **Source-text pins → behaviour assertions.** Several guards match exact prompt wording or an exact
   opts-object literal. Two broke in session 26 for reasons unrelated to what they protect
   (`unit-prompt-strictness` on a reworded rule, `unit-reasoning-model-safety` on an added property).
   A guard that fails on unrelated edits trains people to edit the guard. `lib-dom` parsing is what
   makes the DOM-side ones convertible.
3. **A shared extraction helper for tests.** Three tests broke in session 26 purely because an
   extracted function gained a dependency (`unit-syn-context`, `unit-pdf-chunking`,
   `unit-pdf-paragraphs` — all had to have `_splitLongUnit` or `_sentenceSplit` added by hand).
   Every test re-implements the same brace-matching `extract()`. One helper that resolves
   dependencies would remove a whole class of false failures.

**Product-code work:**

4. **`num_ctx` sizing is per-call-site, by hand.** Five generators embed the full story and each
   sizes it separately; there is no rule, only a test that counts them (`v72_f`). A helper that sizes
   or warns would make the next generator safe by default rather than by review.
5. **`_SENT_END_RE`** (`index.html` ~4044, 4062, 4156, 4210) — the last hand-authored punctuation
   list in the segmentation area. It answers "does this string END like a sentence?" for the
   paragraph-wrap repair and title heuristics, so it is a *different* question from splitting and
   was deliberately left alone. Fair game now.
6. **Arabic presentation forms** — measured in session 26 (`v72f_session26_notes.md` §7), not
   urgent, and explicitly **not** a blanket NFKC: that corrupts IPA, Japanese punctuation and two
   lesson types whose glyphs are the content. Scope any fix to the two presentation-form blocks, at
   comparison time only.

**Documentation:**

7. `DOCUMENTATION.md` §3 gained "What each generator actually sees" in `v72_f`. The equivalent does
   not exist for the **QC pipeline** or the **coverage/qid model**, both of which are load-bearing
   and currently only described in scattered `INTERNALS.md` entries and session notes.

**One caution.** "Refactoring" in this codebase has a specific failure mode, recorded under *One rule
per question* in `INTERNALS.md`: the recurring bug is a second copy of a rule that then drifts, and
two of them (client/server sentence splitters, the prompt floor vs the server filter) were found in
session 26 alone, having agreed with each other by coincidence for releases. Prefer *removing* a
second copy over *reorganising* code that works.

## Owed by the USER — nothing here can be done in a dev container

This list is the reason to stop adding code rather than continue. It has grown across eight
releases without a browser or a live model in the loop.

| owed | since | why it needs a human |
|---|---|---|
| **Browser passes on `v71_i`–`v72`** | 9 releases | Several changes are only visible in a browser: the comprehension story panel, the storyline connector line and bar colour, the arc tick-list's actual clicking (headless harness cannot read it back — see `INTERNALS.md`). |
| **Live QC run — article symmetry** | `v71_y` | Whether the model CATCHES an asymmetric pair is a judgement no test can make. **Check Arabic first**: `ال`-prefixed words must not be flagged as one-sided articles. |
| **Live QC run — diacritics** | `v72` | The scan finds 5 candidates corpus-wide; the model must reject the minimal pairs (`souffle`/`soufflé`, `inizio`/`iniziò`) and accept only real typos. If it rejects all 5, that is CORRECT — both originally-reported defects are already hand-fixed. |
| **Live comprehension generation** | `v71_t` | Whether the removed story caps actually improved the questions. Watch for `Story context: … → num_ctx≈…` in the log. |
| **`NUM_CTX_MAX` decision** | `v71_t` | A memory choice on hardware nobody here can see. 16384 default; 32768 roughly doubles the surviving story. |
| **QC on 8 `ui.json` entries** | `v72_b` | **One key, `models.threads`, in ar/he/hi/ko/uk/zh/th/el.** Came back verbatim English. **Nothing was deleted** — parked in `PENDING_QC` in `test/unit-ui-verbatim-en.test.js`, which fails if a new fallback appears AND if a parked one gets translated (remove it from the list then). |
| **Native-speaker vocab review** | ongoing | Nothing in the suite can judge whether a generated word is the one a native speaker would use. |
| **Live synonyms run** | `v72_d`, `v72_e`, `v73` | The model now receives the story, quotes the sentence it chose the synonyms against, and is told to prefer FEWER certain entries over more shaky ones. Neither gain is testable without a model. **Two log lines to watch:** `Synonyms context: N quoted, M rejected` — 0 quoted means the model ignored the field or the prompt was truncated; and `N antonym-only` — 0 of those with consistently full 4-synonym lists means the strictness change was ignored. |
| **Browser pass on `v72_a`–`v73`** | `v72_b` | Segmentation feeds the synonym context card and the PDF chapter splitter, both DOM-owed. **Check a Japanese story's synonym cards** (33 → 176 units corpus-wide) and **an Arabic or Italian synonym card**, where long sentences are now shown as `…`-marked fragments. |

## Open decisions blocking work

*(Decision 1 was ruled in session 25 and is kept below for context; 2–4 are still open.)*

1. ~~**The design principle's boundary.**~~ **RULED, session 25.** Correctness vs. handling, with
   the condition that *permitted* means **Unicode machinery, not a hand-authored table**. Sentence
   segmentation is handling → allowed; a hand-written `[.!?…]` list is still the wrong tool.
   This **unblocks** the `_sentenceUnits` work — see the roadmap, which now carries two ordered
   follow-ups and a corrected diagnosis (the Arabic premise was wrong: `،` is a comma, so Unicode
   correctly reads that prose as one long sentence; the real fix is a length-based fallback).
2. **Duplicate targets** (`v71_r`) — **evidence re-measured in session 26; the original data is
   gone.** The "six grammar lessons" this item was written about are no longer in the corpus (it was
   replaced between v72 and v72_b). What is live now is **2 synonyms lessons with a repeated
   `base`**, both Arabic. The defect class is the same — two exercises collide on one qid, so the
   round asks the word twice while coverage counts it once — but rule on the CURRENT shape, not the
   v71_r one. Dedupe or repair?
3. **Crossword translation highlight**: word_forms items have no translation field.
4. ~~**`el/storyboard.title`**~~ **RULED, session 26: keep "Storyboard"** as a loanword. Moved to
   `APPROVED_LOANWORDS` in `test/unit-ui-verbatim-en.test.js`, separate from the parked list, so the
   v71_k → reinstate → re-queue loop is closed for good.

## Ready to implement, no decision needed

- **Clamp the synonym context server-side** — small; needs a decision between sharing the helper and
  accepting display-side-only. Cheaper than it was: `_sentenceSplit` is now genuinely shared between
  `index.html` and `server.js`, so there is a precedent and a parity test to copy.

> **Removed from this list: "Drill result card".** It was **already shipped in `v71_h`** and was
> carried forward through four releases by mistake — `roadmap_v71.md` records it as shipped on line
> 227 and as open on line 491. Verified against the code in session 26. The protocol now carries a
> standing rule to cross-check carried items against the same file's shipped list.

## What changed in sessions 17–24, one line each

`v71_r` grammar/conjugation rounds were a random cut → coverage-aware ·
`v71_s` comprehension gated BY the story, not gating it (two layers) ·
`v71_t` story caps removed + `num_ctx` sizing (Ollama truncates silently) ·
`v71_u` book arc uses the shared lesson-type picker ·
`v71_v` `INTERNALS.md` created ·
`v71_w` one reader for "chapter complete" (diverged both ways) ·
`v71_x` article MCQ choices derived from data, not a table ·
`v71_y` article symmetry moved into the QC pass ·
`v71_z` handover release ·
`v72` diacritic QC — deterministic scan generates candidates, the model decides ·
`v72_a` sentence segmentation via `Intl.Segmenter`, client and server splitters merged ·
`v72_b` length-based sub-split for over-long units, plus the CJK `sep` fix ·
`v72_c` clause detection for the synonym clamp switched to Unicode ·
`v72_d` synonyms generation now SEES the story and quotes its own context sentence ·
`v72_e` synonyms prompt made strict — fewer, certain entries; antonym-only words kept ·
`v72_f` num_ctx sized on all five full-story generators; comprehension gets the chain from every
call path; generation flows documented ·
`v73` antonyms held to a looser standard than synonyms — user-reported scarcity (session 26).

**Note on version strings:** `APP_VERSION` is **`v73`** and the release folder is `dreizunge_v73/`.
The v72 line ran `v72` … `v72_f`; `v73` is a fresh base cut, not a suffix release. Keep the folder name and
`APP_VERSION` in step — they drifted once in session 26 because the folder was named before the
last change landed.

Each has a `build_history/v71_*_session*_notes.md` with the reasoning, the measurements, and a
"how to see it work".

## A note on this thread

Sessions 17–24 ran in one long conversation. Toward the end the error rate rose in a
characteristic way — assertions that passed vacuously, a source pin whose slice window did not
reach the line it pinned, an "it's safe" claim that measurement contradicted. All were caught, but
by measurement rather than by noticing. **Prefer a fresh session over continuing a long one**, and
keep verifying claims against the code rather than against the conversation.
