# Session prompt — written at the `v85_g` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v85_b`, `v85_c`, …) unless a future
session has a good reason to switch to `v86_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v85_g`** — `v85_a` was a fresh cut for
the generator-page redesign (`PLAN §13`); `v85_b` shipped two small unrelated fixes; `v85_c`–`v85_g`
shipped `PLAN §13` milestones 1–4 in full (wizard shell; chaptering-card split; the "create storyline
now" shortcut; label reword + per-chapter override; storyboard/QC toggles). **Only milestone 5 —
small independent gap-fills — remains before `PLAN §13` is FULLY done.** See `roadmap_v85.md`'s `v85_g`
entry for the full write-up of what just shipped.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v85.md` — its **index table** and **⚠️ Session protocol** block first, then
   the `v85_g` shipped entry (top of `# SHIPPED IN THE v85 LINE`) for the storyboard/QC toggle
   mechanism, then `PLAN §13` itself (search for it — near the end, under "THE LARGER PLAN") for the
   full generator-page redesign assessment and the approved milestone-by-milestone build order —
   milestone 5's own two gap-fill items are named there explicitly.
3. `INTERNALS.md` **§6b, the feature → function map** — read it BEFORE grepping for where anything
   lives (carries the wizard-shell entries for `v85_c` through `v85_g`).
4. `roadmap_v84.md`'s own `# SHIPPED IN THE v84 LINE` if you need to know HOW something already
   working was built — not copied here, go there directly.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 272 checks
node test/run.js --quick                  → expect 238
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Corpus at this cut: **327 topics, 92 storylines, 33 languages, 675 `en` keys** (topics/storylines/
languages unchanged from the `v84` line's end; `en` keys grew by 2 at `v85_g` —
`gen.post_gen_storyboard_lbl`, `gen.post_gen_qc_lbl`). `APP_VERSION = 'v85_g'`.

⚠️ **Check `git status --short lessons.json` at the start of this session.** If it shows modified,
that is very likely the user's own real, uncommitted evaluation/play data — not yours to revert,
commit, or "fix around" without asking. Back it up, `git checkout --` it for any build/test work,
restore it after.

⚠️ **The user's own main dev server (port 3000) needs a MANUAL restart to see anything past the
version it was last started with** — check its reported version against `APP_VERSION` before
assuming it's current, and ask before restarting it. **`ui.json`'s own `fs.watch` hot-reload was
observed NOT to pick up an edit live at `v85_e`/`v85_g`** (a known Node/editor-tool temp-file-rename
interaction) — if a live-browser check shows a UI string as its raw key, check
`curl -s localhost:3000/api/ui?lang=en | grep <key>` before assuming the code is wrong. `index.html`
itself remains unaffected (served via `fs.readFileSync` PER REQUEST, no caching).

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is the thing to
> fix**, not the guard.

## The habits that cost this project the most (full incident history: `roadmap_v84.md`'s "Rules
earned in session N…the v84 line" blocks)

1. **Measure before editing.**
2. **Guard at the layer where the claim is observable**, and mutation-test every guard.
3. **For any refactor claiming to preserve behaviour, CAPTURE the old output and DIFF it.**
4. **`buildExercises` is NON-DETERMINISTIC IN CONTENT, not just order.**
5. **Ask before restarting a dev server you did not start, and before deleting data you did not
   create.**
6. **A live model call needs a live test AND a real human reading the output.**
7. **A fix to one stage's OUTPUT SHAPE can silently break a DOWNSTREAM consumer that assumed the OLD
   shape** — re-run the full suite for every affected file, not just the one you changed.
8. **A per-caller fix does not generalize to other callers of the same primitive** — grep every call
   site.
9. **A "safe-looking" optimization that reads fresh state can still defeat an existing guarantee
   whose enforcement lived in a step the optimization skips** — mutation-test it against every
   EXISTING guard it touches.
10. **When a change is the FIRST of its kind to touch the live app or write to a real corpus, ASK how
    far it should go before building.**
11. **When restructuring markup into new wrapper elements, verify div-balance with a real HTML parser
    over the changed region**, not by eyeballing indentation.
12. **When a plan document's own claim about "reuses existing machinery X" doesn't survive reading X's
    actual code, STOP and ask** — `v85_d`'s shortcut and `v85_f`'s per-chapter override both hit this
    and needed a ruling; `v85_g`'s own investigation (storyboard/QC) is the counter-example — read the
    machinery FIRST regardless, sometimes the claim holds up cleanly and no ruling is needed at all.
13. **A new UI affordance that makes an EXISTING code path more reachable can surface a pre-existing
    bug in that path** — `v85_e`'s own fix (doGenerate()'s empty-topic guard) is the example.
14. **This harness's `document.getElementById`/`.querySelector` NEVER return null on a miss** — they
    auto-vivify an empty stub. Check `.tagName` (or a container's `.children.length`) against the
    expected real result, not `!!` truthiness.
15. **`vm.runInContext` (this harness's `C.run()`) rejects a bare top-level `await`.** Wrap async work
    in its own `(async()=>{...})()` IIFE inside the string; do the real `await` OUTSIDE via a
    `settle()`-style delay between separate `C.run()` calls.
16. **Two code paths that both produce "the same observable zero-calls result" can still differ in
    WHY** — `v85_g`'s own "no storyline resolved" mutation test needed a second signal
    (`setGenStatus` never called with the storyboard status) because a guard-less crash and a
    deliberate skip are indistinguishable from a `fetch`-call-count check alone. When a mutation test
    doesn't go red, check whether the mutated code is failing SILENTLY via some OTHER path before
    concluding the guard is genuinely redundant.

# WHERE TO START

## `PLAN §13` milestone 5 — the small independent gap-fills (LAST milestone)

`roadmap_v85.md`'s `PLAN §13` has the full assessment; the milestone 5 items, named explicitly in the
original assessment:

1. **`doDialectImport()` does not read `#continue-select` at all** — hardcodes `base:'de', source:'de'`
   regardless of the actual selected language pair. A real, narrow bug, confirmed at the `v85_a`
   assessment, independent of the wizard work. Read `doDialectImport()`'s current body before touching
   it — same discipline every prior cut this line used: verify the claim against the actual code
   first, don't assume the fix is as simple as it sounds.
2. **Attribution fields for generation-time text sources** — the schema already supports this
   (`topic.source = {author, licence, url, note}`, `v58` provenance) with a working endpoint
   (`/api/topic-source`), but the only existing client call site edits an EXISTING topic AFTER THE
   FACT, not during generation itself. Wiring attribution fields into `#gen-card-2` (the text-source
   card) at generation time is the same "expose existing machinery through new UI" pattern every prior
   milestone this line used — read `/api/topic-source`'s handler and its one existing call site before
   building, per this line's own standing rule.

Once milestone 5 ships, **`PLAN §13` is FULLY DONE** — update the roadmap's own index-table language
to reflect that (it currently still lists open milestones).

**Explicitly out of scope, confirmed with the user across this whole line — do not reopen without
asking**: comic/image import (`PLAN §7.0` Track A4, no code exists); the CP1-6 pipeline's cross-chapter
arc-sequencing; spell-check-driven auto error-hunt generation. The browser-reachable single-chapter
CP1-4 pipeline IS in scope, but sequenced AFTER `PLAN §13` milestones 1–5 ship — it needs its own
background-job design (CP2's per-sentence calls are slow: one 4-sentence chapter took 12+ minutes even
on a warm model, measured live — see `roadmap_v83.md`'s own addendum note).

## ⚠️ OWED BY THE USER, not doable in a container

- **The whole `v84_g`…`v84_m` speech-recognition arc** past the ORIGINAL typed-answer/basic-MCQ
  surfaces is still not live-verified on a real device. `v85_b`'s own mic-default change is in the
  same boat.
- **Windows Tier 1 install docs (`v84_n`)** — reasoned, not measured on an actual Windows machine.
- **`apply-cp-lessons.js`'s `v83_p` re-verification** — attempted, blocked by real machine resource
  contention. Retry once the machine has headroom — see `roadmap_v83.md`'s own addendum note.
- **The PASS MARK** — still owed by the user, needs a browser pass, not code.
- **The whole `v85_c`…`v85_g` wizard shell** — verified live against the running dev server (desktop
  viewport) every cut, but NOT on a real mobile device/viewport.
- **A real end-to-end run of `v85_e`'s shortcut, `v85_f`'s per-chapter override, AND `v85_g`'s
  storyboard/QC toggles against a live LLM backend** — all three were verified with the network layer
  stubbed (deliberate, avoiding real LLM calls for pure UI-wiring checks). None has been watched
  click-to-finished-result by a human yet.

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map, including the whole speech-recognition
subsystem, the `PLAN §7.0` pipeline, and the `v85_c`→`v85_g` generator-wizard entries
(`_genWizardGoto`/`_genWizardNext`/`_genWizardBack`/`_genWizardCreateNow`, the `#gen-card-1/-2/-3/-4`
boundaries, `_renderPerChapterTypes`/`_readPerChapterTypes`/`_applyPerChapterTypes`,
`_applyPostGenFeatures`, `_pollGenBook`'s return value, the `.pdf-stepper`/`.pdf-step` reuse,
`doGenerate()`'s empty-topic-guard fix) — read those entries before touching any of these areas.
