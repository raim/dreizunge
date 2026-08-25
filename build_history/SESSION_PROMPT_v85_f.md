# Session prompt — written at the `v85_f` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v85_b`, `v85_c`, …) unless a future
session has a good reason to switch to `v86_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v85_f`** — `v85_a` was a fresh cut for
the generator-page redesign (`PLAN §13`); `v85_b` shipped two small unrelated fixes; `v85_c`/`v85_d`/
`v85_e` shipped `PLAN §13` milestones 1–2 (the wizard shell, the chaptering-card split, the "create
storyline now" shortcut). **`v85_f` shipped milestone 3**: reworded the "learning arc" checkbox label
(a one-line fix — it was already `ui.json`-routed into all 33 languages) and added a per-chapter
lesson-type override at generation time, per the user's ruling: *"sequential, reusing existing
per-chapter endpoint"* — no new server-side per-chapter body shape, reuses `/api/lessons/add-lesson`
(the same endpoint the post-hoc per-chapter "add lesson" card already calls) once per (chapter, type)
pair after the book job finishes. See `roadmap_v85.md`'s `v85_f` entry for the full write-up.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v85.md` — its **index table** and **⚠️ Session protocol** block first, then
   the `v85_f` shipped entry (top of `# SHIPPED IN THE v85 LINE`) for the per-chapter override
   mechanism, then `PLAN §13` itself (search for it — near the end, under "THE LARGER PLAN") for the
   full generator-page redesign assessment and the approved milestone-by-milestone build order.
3. `INTERNALS.md` **§6b, the feature → function map** — read it BEFORE grepping for where anything
   lives (carries the wizard-shell entries for `v85_c` through `v85_f`).
4. `roadmap_v84.md`'s own `# SHIPPED IN THE v84 LINE` if you need to know HOW something already
   working was built — not copied here, go there directly.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 271 checks
node test/run.js --quick                  → expect 237
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Corpus at this cut: **327 topics, 92 storylines, 33 languages, 673 `en` keys** (topics/storylines/
languages unchanged from the `v84` line's end; `en` keys grew by 3 at `v85_f` — `gen.per_chapter_lbl`,
`gen.per_chapter_heading`, `gen.per_chapter_done`; `form.arc_lbl`'s VALUE also changed, not a new key).
`APP_VERSION = 'v85_f'`.

⚠️ **Check `git status --short lessons.json` at the start of this session.** If it shows modified,
that is very likely the user's own real, uncommitted evaluation/play data — not yours to revert,
commit, or "fix around" without asking. Back it up, `git checkout --` it for any build/test work,
restore it after.

⚠️ **The user's own main dev server (port 3000) needs a MANUAL restart to see anything past the
version it was last started with** — check its reported version against `APP_VERSION` before
assuming it's current, and ask before restarting it. **`ui.json`'s own `fs.watch` hot-reload was
observed NOT to pick up an edit live at `v85_e`** (a known Node/editor-tool temp-file-rename
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
    actual code, STOP and ask** — `v85_d`'s shortcut and `v85_f`'s per-chapter override both hit this;
    both times the investigation itself found the actual reusable machinery one layer down from where
    the plan pointed (a DIFFERENT endpoint that happened to fit, not the one literally named).
13. **A new UI affordance that makes an EXISTING code path more reachable can surface a pre-existing
    bug in that path** — `v85_e`'s own fix (doGenerate()'s empty-topic guard) is the example.
14. **This harness's `document.getElementById`/`.querySelector` NEVER return null on a miss** — they
    auto-vivify an empty stub (always a `<div>`), documented in `lib-dom.js` itself. A naive
    `!!getElementById(...)` or `!!querySelector(...)` existence check is therefore ALWAYS true;
    checking `.tagName` against what the real result would actually be (or a container's
    `.children.length`) is what distinguishes a genuine match from the stub — found writing
    `test/unit-per-chapter-types.test.js`, cost two rounds of a "passing" assertion that wasn't
    testing anything.
15. **`vm.runInContext` (this harness's `C.run()`) executes each string as a plain script — a bare
    top-level `await` inside one is a SyntaxError.** Wrap async work in its own `(async()=>{...})()`
    IIFE inside the string; do the REAL await outside, via a `settle()`-style delay, between separate
    `C.run()` calls — the shape `unit-ui-journeys.test.js` already used, now also documented in
    `unit-per-chapter-types.test.js`'s own header for the next file that needs it.

# WHERE TO START

## `PLAN §13` milestone 4 — the additional-features card

`roadmap_v85.md`'s `PLAN §13` has the full assessment and the approved build order. Milestone 4:
storyboard and QC (`/api/qc`) both exist today as separate MANUAL triggers (a `🎬` button post-hoc for
storyboard; QC run from the storyline/lesson-set screens) — folding them into the generation flow as
OPT-IN toggles is wiring onto existing machinery, not new pipeline work, per the original assessment.
Title generation (`generateStorylineTitle`) already runs automatically once a book has ≥2 chapters —
not a toggle today, but the machinery exists; consider whether milestone 4 should expose that as an
explicit opt-out too, or leave the current automatic behaviour alone (ask if unclear — this specific
point was not explicitly ruled on, only assessed as "machinery exists").

**Before building anything, verify what the plan claims about "toggle exists, just needs wiring"
against the ACTUAL endpoints/functions — the SAME discipline `v85_d`'s shortcut and `v85_f`'s
per-chapter override investigations both needed.** Read `/api/qc`'s handler and `generateStorylineTitle`/
whatever the `🎬` storyboard button calls before assuming the toggle is a pure UI wire-up; if either
turns out to need more than that, stop and ask rather than forcing a substitute — same as those two
cuts did.

Milestone 5 (the small independent gap-fills — `doDialectImport()`'s `continue-select`-ignoring bug,
found and confirmed at the `v85_a` assessment; attribution fields for generation-time text sources)
remains after that — see `PLAN §13`'s own build-order list. **Do not fold multiple milestones into one
commit.**

**Explicitly out of scope, confirmed with the user — do not reopen without asking**: comic/image
import (`PLAN §7.0` Track A4, no code exists); the CP1-6 pipeline's cross-chapter arc-sequencing;
spell-check-driven auto error-hunt generation. The browser-reachable single-chapter CP1-4 pipeline IS
in scope, but sequenced AFTER milestones 1–5 ship — it needs its own background-job design (CP2's
per-sentence calls are slow: one 4-sentence chapter took 12+ minutes even on a warm model, measured
live — see `roadmap_v83.md`'s own addendum note).

## ⚠️ OWED BY THE USER, not doable in a container

- **The whole `v84_g`…`v84_m` speech-recognition arc** past the ORIGINAL typed-answer/basic-MCQ
  surfaces is still not live-verified on a real device. `v85_b`'s own mic-default change is in the
  same boat.
- **Windows Tier 1 install docs (`v84_n`)** — reasoned, not measured on an actual Windows machine.
- **`apply-cp-lessons.js`'s `v83_p` re-verification** — attempted, blocked by real machine resource
  contention. Retry once the machine has headroom — see `roadmap_v83.md`'s own addendum note.
- **The PASS MARK** — still owed by the user, needs a browser pass, not code.
- **The whole `v85_c`…`v85_f` wizard shell** — verified live against the running dev server (desktop
  viewport) every cut, but NOT on a real mobile device/viewport.
- **A real end-to-end run of `v85_e`'s "create storyline now" shortcut AND `v85_f`'s per-chapter
  override against a live LLM backend** — both were verified with the network layer stubbed (a
  deliberate choice, avoiding real LLM calls for pure UI-wiring checks). The full click-to-generated-
  lessons path for either has not been watched end to end by a human yet.

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map, including the whole speech-recognition
subsystem, the `PLAN §7.0` pipeline, and the `v85_c`→`v85_f` generator-wizard entries
(`_genWizardGoto`/`_genWizardNext`/`_genWizardBack`/`_genWizardCreateNow`, the `#gen-card-1/-2/-3/-4`
boundaries, the `#gen-form-section` nesting, `_renderPerChapterTypes`/`_readPerChapterTypes`/
`_applyPerChapterTypes`, `_pollGenBook`'s return value, the `.pdf-stepper`/`.pdf-step` reuse,
`doGenerate()`'s empty-topic-guard fix) — read those entries before touching any of these areas.
