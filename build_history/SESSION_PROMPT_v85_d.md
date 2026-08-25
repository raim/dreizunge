# Session prompt — written at the `v85_d` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v85_b`, `v85_c`, …) unless a future
session has a good reason to switch to `v86_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v85_d`** — `v85_a` was a fresh cut for
the generator-page redesign (`PLAN §13`); `v85_b` shipped two small unrelated fixes; `v85_c` shipped
`PLAN §13` milestone 1 (the wizard shell: `#gen-wizard`, `#gen-card-1`/`-2`). **`v85_d` shipped ONLY
HALF of milestone 2** — the chaptering-card split (`#gen-card-3` = chaptering, `#gen-card-4` =
lesson-selection + Generate) — and stopped there, per the session's own instruction ("continue until
you need decisions from me"), because investigating milestone 2's OTHER half — the "create storyline
now, add lessons later" shortcut — surfaced a real ambiguity that needs a ruling, not a guess. See
`roadmap_v85.md`'s `v85_d` entry, its `### ⚠️ OPEN` subsection, for the full investigation.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v85.md` — its **index table** and **⚠️ Session protocol** block first, then
   the `v85_d` shipped entry (top of `# SHIPPED IN THE v85 LINE`) — READ ITS `### ⚠️ OPEN` SUBSECTION
   BEFORE doing anything with the "create storyline now" shortcut — then `PLAN §13` itself (search for
   it — near the end, under "THE LARGER PLAN") for the full generator-page redesign assessment and the
   approved milestone-by-milestone build order.
3. `INTERNALS.md` **§6b, the feature → function map** — read it BEFORE grepping for where anything
   lives (carries the wizard-shell entries for both `v85_c` and, once added, `v85_d`).
4. `roadmap_v84.md`'s own `# SHIPPED IN THE v84 LINE` if you need to know HOW something already
   working was built — not copied here, go there directly.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 270 checks
node test/run.js --quick                  → expect 236
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Corpus at this cut: **327 topics, 92 storylines, 33 languages, 668 `en` keys** (topics/storylines/
languages unchanged from the `v84` line's end; `en` keys grew by 1 at `v85_d` — a new
`gen.wizard_step4` key; `gen.wizard_step3`'s VALUE also changed, not a new key).
`APP_VERSION = 'v85_d'`.

⚠️ **Check `git status --short lessons.json` at the start of this session.** If it shows modified,
that is very likely the user's own real, uncommitted evaluation/play data — not yours to revert,
commit, or "fix around" without asking. Back it up, `git checkout --` it for any build/test work,
restore it after.

⚠️ **The user's own main dev server (port 3000) needs a MANUAL restart to see anything past the
version it was last started with** — check its reported version against `APP_VERSION` before
assuming it's current, and ask before restarting it. (Note: `index.html` itself is served via
`fs.readFileSync` PER REQUEST — a plain reload picks up markup/script edits with no restart; only
`APP_VERSION`/other server-boot state needs one.)

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
    claim to fit** — `v85_d`'s own "create storyline now" investigation is the fresh example: the
    no-op the plan pointed at solves a genuinely different problem than the one being scoped.

# WHERE TO START

## First: the "create storyline now, add lessons later" ruling — ask before building

`roadmap_v85.md`'s `v85_d` entry, `### ⚠️ OPEN` subsection, has the full investigation. Short version:
the plan's claim that this shortcut "reuses the existing empty-lesson-type no-op" does not hold up —
that no-op is in a POST-HOC add-lessons-to-an-existing-storyline endpoint
(`recreateStorylineLessons()` → `/api/storyline/recreate-lessons`), not the INITIAL generation flow.
`/api/generate-book`'s `lessonFormat` always clamps to `'standard'` — there is no "zero lessons" mode
for a freshly-generated batch today. **Ask the user which of these is meant** before writing any code:
(a) real new server-side scoping (a `'none'` `lessonFormat` / a "skip lesson generation this batch"
flag, threaded through `/api/generate-book` and `/api/generate`, plus whatever downstream code
currently assumes every chapter has at least one lesson), or (b) a narrower reinterpretation — the
shortcut just means "skip the arc, generate the default standard set, add more later via the
storyline screen's EXISTING add-lessons flow" (needs no new server work at all, since arc-off +
standard-only already exists) — which is cheap but does not literally mean "add lessons later" the way
"create storyline now" suggests it should. Do not guess; this changes real server behaviour either way.

## Then: `PLAN §13` milestone 2's remainder, or milestone 3 — the user's call

Once the shortcut question is resolved (built per the ruling, or explicitly deferred), milestone 2 is
either finished or intentionally left partial. Either way, milestone 3 is next in the build order:
**the lesson-selection card's own polish** — reword the "🎯 Build a learning arc per chapter" checkbox
label (confirmed with the user at the `v85_a` cut as a wording/framing complaint, not a request to
remove a second mechanism — see `PLAN §13`'s own assessment text) and add a per-chapter type override
AT GENERATION TIME (today this only exists post-hoc, via the storyline-screen's per-chapter "add
lessons" dropdown — offering it earlier reuses the existing picker/endpoint shape, not new machinery).
`#gen-card-4` (today: lesson-type-hdr/diff-wrap/format-wrap/gen-btn-row, all unchanged) is where this
lands — same discipline as milestones 1-2: **no id renames on anything relocated, no behaviour changes
to what already works, pure re-layout plus the one new reworded label**. Grep `test/*.test.js` for
`gen-arc`, `format-select`, `diff-select` before moving anything those tests reference, and verify with
a real browser click-through before calling it done.

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
- **The `v85_c`/`v85_d` wizard shell** — verified live against the running dev server (desktop
  viewport) both cuts, but NOT on a real mobile device/viewport. Back/Next buttons and the pill
  stepper are plain inline-styled elements matching the surrounding form's own conventions, but mobile
  wrapping/touch-target size was not checked live.

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map, including the whole speech-recognition
subsystem, the `PLAN §7.0` pipeline, and the `v85_c`/`v85_d` generator-wizard entries
(`_genWizardGoto`/`_genWizardNext`/`_genWizardBack`, the `#gen-card-1/-2/-3/-4` boundaries, the
`#gen-form-section` nesting that keeps dialect mode's atomic hide working, the `.pdf-stepper`/
`.pdf-step` reuse) — read those entries before touching any of these areas.
