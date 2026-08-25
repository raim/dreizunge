# Session prompt — written at the `v85_e` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v85_b`, `v85_c`, …) unless a future
session has a good reason to switch to `v86_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v85_e`** — `v85_a` was a fresh cut for
the generator-page redesign (`PLAN §13`); `v85_b` shipped two small unrelated fixes; `v85_c` shipped
`PLAN §13` milestone 1 (the wizard shell); `v85_d` shipped milestone 2's chaptering-card split but left
its "create storyline now" shortcut OPEN pending a ruling; **`v85_e` closed that ruling** (the user's
own answer: *"skip the arc, standard set only"*) and shipped the shortcut — **`PLAN §13` milestone 2 is
now FULLY done**. `v85_e` also fixed a real pre-existing bug the shortcut surfaced: `doGenerate()`'s
empty-topic guard used to `.focus()` a field that can now be hidden behind a wizard card — see
`roadmap_v85.md`'s `v85_e` entry for the full write-up.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v85.md` — its **index table** and **⚠️ Session protocol** block first, then
   the `v85_e` shipped entry (top of `# SHIPPED IN THE v85 LINE`) for the shortcut mechanism and the
   `doGenerate()` fix, then `PLAN §13` itself (search for it — near the end, under "THE LARGER PLAN")
   for the full generator-page redesign assessment and the approved milestone-by-milestone build
   order.
3. `INTERNALS.md` **§6b, the feature → function map** — read it BEFORE grepping for where anything
   lives (carries the wizard-shell entries for `v85_c`/`v85_d`/`v85_e`).
4. `roadmap_v84.md`'s own `# SHIPPED IN THE v84 LINE` if you need to know HOW something already
   working was built — not copied here, go there directly.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 270 checks
node test/run.js --quick                  → expect 236
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Corpus at this cut: **327 topics, 92 storylines, 33 languages, 670 `en` keys** (topics/storylines/
languages unchanged from the `v84` line's end; `en` keys grew by 2 at `v85_e` — `gen.wizard_create_now`
and `gen.wizard_create_now_hint`). `APP_VERSION = 'v85_e'`.

⚠️ **Check `git status --short lessons.json` at the start of this session.** If it shows modified,
that is very likely the user's own real, uncommitted evaluation/play data — not yours to revert,
commit, or "fix around" without asking. Back it up, `git checkout --` it for any build/test work,
restore it after.

⚠️ **The user's own main dev server (port 3000) needs a MANUAL restart to see anything past the
version it was last started with** — check its reported version against `APP_VERSION` before
assuming it's current, and ask before restarting it. **Additionally, as of `v85_e`: `ui.json`'s own
`fs.watch` hot-reload was observed NOT to pick up an edit live** (a known Node/editor-tool
interaction — an editor that writes via temp-file-then-rename can silently stop a `fs.watch` watcher
for the original path). If a live-browser check shows a UI string as its raw key instead of translated
text, check `curl -s localhost:3000/api/ui?lang=en | grep <key>` before assuming the code is wrong —
it may just be the server's stale in-memory copy, fixed by the SAME restart already gated behind
asking. `index.html` itself remains unaffected (served via `fs.readFileSync` PER REQUEST, no caching).

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
   EXISTING guard it touches, not just the new behaviour.
10. **When a change is the FIRST of its kind to touch the live app or write to a real corpus, ASK how
    far it should go before building.**
11. **When restructuring markup into new wrapper elements, verify div-balance with a real HTML parser
    over the changed region**, not by eyeballing indentation.
12. **When a plan document's own claim about "reuses existing machinery X" doesn't survive reading X's
    actual code, STOP and ask — don't build a plausible-looking substitute and don't force the literal
    claim to fit.**
13. **A new UI affordance that makes an EXISTING code path more reachable can surface a pre-existing
    bug in that path** — `v85_e`'s "create storyline now" button didn't introduce the empty-topic
    `.focus()`-on-a-hidden-field bug, it just made reaching it easy; the fix belongs at the guard
    itself (one choke point, both callers fixed), not duplicated into the new button's own handler.

# WHERE TO START

## `PLAN §13` milestone 3 — the lesson-selection card's own polish

`roadmap_v85.md`'s `PLAN §13` has the full assessment and the approved build order; `#gen-card-4`
(today: `#lesson-type-hdr`/`#diff-wrap`/`#format-wrap`/`#gen-btn-row`, all unchanged since `v85_c`) is
where this lands. Two concrete pieces, both already confirmed in scope at the `v85_a` assessment:

1. **Reword the "🎯 Build a learning arc per chapter" checkbox label** (`#gen-arc-lbl`, and the PDF
   path's identical `#pdf-arc-lbl`) — confirmed with the user as a wording/framing complaint about the
   word "arc," not a request to remove a second mechanism. No logic change, `en`-only `ui.json` update
   (check whether these already route through `t()`/`ui.json` or are still hardcoded — grep before
   assuming either).
2. **Per-chapter lesson-type override AT GENERATION TIME** — today this only exists post-hoc, via the
   storyline-screen's per-chapter "add lessons" dropdown (`openAddLesson`/`_pickLessonTypes`, the same
   picker `recreateStorylineLessons()` uses, referenced in `v85_d`'s own investigation). Offering it on
   `#gen-card-4` at generation time reuses that EXISTING picker/endpoint shape — new UI wiring, not new
   machinery, same discipline as `v85_e`'s own shortcut.

Same rules as every milestone so far: **no id renames on anything relocated, no behaviour changes to
what already works, pure re-layout plus the two additions above.** Grep `test/*.test.js` for
`gen-arc`, `format-select`, `diff-select`, `pdf-arc` before moving/renaming anything those tests
reference, and verify with a real browser click-through before calling milestone 3 done. **If the
per-chapter override turns out to need more than reusing the existing picker (e.g. a genuinely new
data shape for "types per chapter, chosen before any chapter exists"), stop and ask — same discipline
`v85_d`'s own investigation used, don't force a plausible-looking substitute.**

Milestones 4–5 (additional-features card; small independent gap-fills — the `doDialectImport()`
`continue-select`-ignoring bug, attribution fields) remain after that — see `PLAN §13`'s own
build-order list. **Do not fold multiple milestones into one commit.**

**Explicitly out of scope, confirmed with the user — do not reopen without asking**: comic/image
import (`PLAN §7.0` Track A4, no code exists); the CP1-6 pipeline's cross-chapter arc-sequencing;
spell-check-driven auto error-hunt generation. The browser-reachable single-chapter CP1-4 pipeline IS
in scope, but sequenced AFTER milestones 1–5 ship — it needs its own background-job design (CP2's
per-sentence calls are slow: one 4-sentence chapter took 12+ minutes even on a warm model, measured
live — see `roadmap_v83.md`'s own addendum note).

## ⚠️ OWED BY THE USER, not doable in a container

- **The whole `v84_g`…`v84_m` speech-recognition arc** past the ORIGINAL typed-answer/basic-MCQ
  surfaces is still not live-verified on a real device (mocked `SpeechRecognition` + desktop-browser
  checks only). `v85_b`'s own mic-default change is in the same boat.
- **Windows Tier 1 install docs (`v84_n`)** — reasoned, not measured on an actual Windows machine.
- **`apply-cp-lessons.js`'s `v83_p` re-verification** — attempted, blocked by real machine resource
  contention. Retry once the machine has headroom — see `roadmap_v83.md`'s own addendum note.
- **The PASS MARK** — still owed by the user, needs a browser pass, not code.
- **The `v85_c`/`v85_d`/`v85_e` wizard shell** — verified live against the running dev server (desktop
  viewport) every cut, but NOT on a real mobile device/viewport. Back/Next/shortcut buttons and the
  pill stepper are plain inline-styled elements matching the surrounding form's own conventions, but
  mobile wrapping/touch-target size was not checked live.
- **A real end-to-end run of the "create storyline now" shortcut against a live LLM backend** — the
  wiring (arc-off, format-standard, `doGenerate()` invoked) was verified with `doGenerate()` stubbed,
  deliberately avoiding a real (slow) model call for a pure UI-wiring check. `doGenerate()`'s own
  behaviour once called is exercised elsewhere in the suite, unchanged by `v85_e`, but the FULL
  button-click-to-generated-storyline path has not been watched end to end by a human.

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map, including the whole speech-recognition
subsystem, the `PLAN §7.0` pipeline, and the `v85_c`/`v85_d`/`v85_e` generator-wizard entries
(`_genWizardGoto`/`_genWizardNext`/`_genWizardBack`/`_genWizardCreateNow`, the `#gen-card-1/-2/-3/-4`
boundaries, the `#gen-form-section` nesting that keeps dialect mode's atomic hide working, the
`.pdf-stepper`/`.pdf-step` reuse, `doGenerate()`'s empty-topic-guard fix) — read those entries before
touching any of these areas.
