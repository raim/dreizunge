# Handover — state at end of session 25 (`v72`)

A single page for whoever picks this up. Read `roadmap_v72.md` first (its session-start list), then
`INTERNALS.md`. This file exists only to say **what is owed and by whom**, which is the thing that
gets lost across a long thread.

## Green baseline

`node test/run.js` → **159 checks** · `node test/run.js --quick` → **138**
`node test/check-inline.js` → 0 on `index.html` AND `docs/index.html`
Version **`v72`** — a fresh base cut; the current roadmap is `build_history/roadmap_v72.md`.
`docs/` rebuilt and matching.

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
| **Translate pass** | ongoing | 380 keys. Needs a live model. |
| **Native-speaker vocab review** | ongoing | |

## Open decisions blocking work

*(Decision 1 was ruled in session 25 and is kept below for context; 2–4 are still open.)*

1. ~~**The design principle's boundary.**~~ **RULED, session 25.** Correctness vs. handling, with
   the condition that *permitted* means **Unicode machinery, not a hand-authored table**. Sentence
   segmentation is handling → allowed; a hand-written `[.!?…]` list is still the wrong tool.
   This **unblocks** the `_sentenceUnits` work — see the roadmap, which now carries two ordered
   follow-ups and a corrected diagnosis (the Arabic premise was wrong: `،` is a comma, so Unicode
   correctly reads that prose as one long sentence; the real fix is a length-based fallback).
2. **Duplicate grammar targets** (`v71_r`): six lessons repeat a `target`, so two exercises collide
   on one qid — the round asks the word twice while coverage counts it once. Dedupe or repair?
3. **Crossword translation highlight**: word_forms items have no translation field.
4. **`el/storyboard.title`**: real Greek translation, or exempt as a loanword?

## Ready to implement, no decision needed

- **Drill result card** — the roadmap's "smallest item", deferred FOUR times *on purpose*. That
  branch chain has produced three user-reported dead ends (v66.1, v69.2) and the failure mode is a
  learner with no forward affordance: quiet, browser-only. **Start a session with this, not end one
  with it** — it needs room to re-read the branch order cold.
- **`_sentenceUnits` → `Intl.Segmenter`, then a length-based chunk fallback.** Unblocked by the
  session-25 ruling. Motivation is CJK (`。` is missing today), NOT Arabic — the roadmap carries the
  corrected diagnosis and the order. Riskier than it looks: it changes segmentation for every
  language at once, and the synonym context and PDF splitter both build on the current output.
- **`lib-dom` innerHTML parsing** — would unblock read-back testing for every future picker.
  Touches every harness, so it wants its own session.
- **Clamp the synonym context server-side** — small; needs a decision between sharing the helper and
  accepting display-side-only.

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
`v72` diacritic QC — deterministic scan generates candidates, the model decides.

Each has a `build_history/v71_*_session*_notes.md` with the reasoning, the measurements, and a
"how to see it work".

## A note on this thread

Sessions 17–24 ran in one long conversation. Toward the end the error rate rose in a
characteristic way — assertions that passed vacuously, a source pin whose slice window did not
reach the line it pinned, an "it's safe" claim that measurement contradicted. All were caught, but
by measurement rather than by noticing. **Prefer a fresh session over continuing a long one**, and
keep verifying claims against the code rather than against the conversation.
