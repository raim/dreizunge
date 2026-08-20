# Session 38 — `v81_h` → `v81_i`

One user ruling, delivered directly (not queued in the roadmap): remove the lesson-path's sequential
"previous lesson done" lock. Measured first, guarded on the rendered node, mutation-tested. Nothing
else was started.

## What shipped

| release | what |
|---|---|
| `v81_i` | the lesson-path SEQUENTIAL lock is removed (user ruling) — the story gate is the only lock a node still carries |

Full write-up is in `build_history/roadmap_v81.md` under `# SHIPPED IN THE v81 LINE`, `v81_i` entry
(measurement, mutation results, the probe diff).

## ⚠️ THE DEVICE CHECKLIST — how to see it work

**Not exercisable headlessly for the visual claim** (the 🔒 padlock disappearing), though the
underlying lock state is guarded in `test/unit-hidden-lessons.test.js` §4 against a rendered DOM.

Open any chapter's lesson-set page (the node-path view, not a progress card) where you have **not**
completed the first lesson.

- Before this release, every lesson after the first showed a 🔒 padlock and was not clickable, no
  matter its type.
- Now: any ordinary lesson (vocab, word_forms, synonyms, conjugation, grammar, mixed, error_hunt —
  anything that is not the chapter's comprehension/"post-story" lesson) is clickable regardless of
  what came before it. Tap one out of order; it must open.
- The **comprehension lesson** (and anything else marked story-gated) must still show 🔒 and refuse
  the tap, until the chapter's story is unlocked (finish enough of the other lessons to raise
  coverage past the pass mark). This part is UNCHANGED — it is the `v80_b` story gate, not touched.
- In **teacher mode**, nothing is ever locked, including the comprehension lesson — also unchanged.

If a comprehension lesson ever becomes clickable before its story unlocks, that is a real
regression — pull the release. If an ordinary lesson still shows a padlock while the chapter's story
is already unlocked and it isn't the first lesson, that's a real regression too.

## Probes re-run

`probe_gates_v77.js` and `probe_gates_v80c1.js`, diffed against `v80i_card_gates.txt`. The diff
against baseline is present but is **pure corpus drift** — verified by re-running the pre-`v81_i`
client (the `v81_h` `index.html`) against the same corpus and getting the byte-identical diff. Diffing
prev-client output directly against `v81_i` output (isolating the code change alone) is **empty**
for both probes. No card-gate regression from this change.

## New i18n keys

**None.** No new user-facing strings.

## What is owed after this session

Unchanged from the `v81_h` cut — see `build_history/SESSION_PROMPT_v81_i.md` §4 ("Owed by the
user"): the pass mark, a device pass across `v81_a` … `v81_i` (this release's checklist above folds
into it), `PLAN §F3`'s regeneration check, the translate pass, the `cyrillic-sr` native-speaker
check.

## `unit-tap-word` flake protocol, re-run as instructed

Per the roadmap's habit 4, `unit-tap-word.test.js` was run 15–40 times before trusting this session's
green baseline (it has flaked at `v81_d`, `v81_e`, and again inside a section written the same
session at `v81_h`). Not touched by `v81_i`'s change; run purely as the standing precaution before
shipping. See the suite output for the pass count actually observed this session.
