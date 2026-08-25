# Session prompt — written at the `v85_a` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v85_b`, `v85_c`, …) unless a future
session has a good reason to switch to `v86_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v85_a`**, cut fresh from
`roadmap_v84.md` at the user's own request ("let's cut to v85 for this, and perhaps we start the next
steps in a new session") — the "this" being a generator-page redesign the user proposed, assessed
against the existing codebase and `PLAN §7.0` this same session, and scoped into
`roadmap_v85.md`'s new **`PLAN §13`**. This file is short on purpose (a fresh cut, not an
accumulated one) — read `PLAN §13` itself before starting anything, it carries the real detail this
prompt only points at.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v85.md` — its **index table** and **⚠️ Session protocol** block first, then
   **`PLAN §13`** (search for it — near the end, under "THE LARGER PLAN") for the generator-page
   redesign in full: what already exists vs. what's genuinely new, the one real conflict with
   `PLAN §7.0`'s own deferred cross-chapter arc-sequencing note (found and reconciled with the user
   directly this cut), and the approved build order.
3. `INTERNALS.md` **§6b, the feature → function map** — read it BEFORE grepping for where anything
   lives.
4. `roadmap_v84.md`'s own `# SHIPPED IN THE v84 LINE` if you need to know HOW something already
   working was built — not copied here, go there directly.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 267 checks
node test/run.js --quick                  → expect 233
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Corpus at this cut: **327 topics, 92 storylines, 33 languages, 662 `en` keys** (unchanged from the
`v84` line's end — this cut touched no code, no `lessons.json`, no `ui.json`). `APP_VERSION = 'v85_a'`.

⚠️ **Check `git status --short lessons.json` at the start of this session.** If it shows modified,
that is very likely the user's own real, uncommitted evaluation/play data — not yours to revert,
commit, or "fix around" without asking. Back it up, `git checkout --` it for any build/test work,
restore it after.

⚠️ **The user's own main dev server (port 3000) needs a MANUAL restart to see anything past the
version it was last started with** — check its reported version against `APP_VERSION` before
assuming it's current, and ask before restarting it.

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is the thing to
> fix**, not the guard.

## The habits that cost this project the most (full incident history: `roadmap_v84.md`'s "Rules
earned in session N…the v84 line" blocks)

1. **Measure before editing.**
2. **Guard at the layer where the claim is observable**, and mutation-test every guard — an inline
   `style=""` beating a stylesheet rule was found THREE times across this project's history because
   the guard kept pinning source text instead of rendered/computed state (rules 5, 34, 39).
3. **For any refactor claiming to preserve behaviour, CAPTURE the old output and DIFF it.**
4. **`buildExercises` is NON-DETERMINISTIC IN CONTENT, not just order.**
5. **Ask before restarting a dev server you did not start, and before deleting data you did not
   create.**
6. **A live model call needs a live test AND a real human reading the output.**
7. **A fix to one stage's OUTPUT SHAPE can silently break a DOWNSTREAM consumer that assumed the OLD
   shape** — re-run the full suite for every affected file, not just the one you changed (rule 36).
8. **A per-caller fix does not generalize to other callers of the same primitive** — grep every call
   site (rule 37).
9. **A "safe-looking" optimization that reads fresh state can still defeat an existing guarantee
   whose enforcement lived in a step the optimization skips** — mutation-test it against every
   EXISTING guard it touches, not just the new behaviour (rule 40, from this cut's own predecessor
   session: a speech-recognition session-reuse idea was implemented, caught defeating a stale-
   generation guard, and reverted before shipping — see `roadmap_v84.md`'s `v84_m` entry).
10. **When a change is the FIRST of its kind to touch the live app or write to a real corpus, ASK how
    far it should go before building.**

# WHERE TO START

## `PLAN §13` — the generator-page redesign, milestone 1

`roadmap_v85.md`'s `PLAN §13` has the full assessment and the approved build order. Milestone 1,
concretely: a wizard shell (`#gen-wizard`, `.gen-card` per step, reusing the existing
`.pdf-step`/`.pdf-step.done/.active` pill visual language for a page-level stepper) WRAPPING the
existing language/script select and text-source panels (`#pdf-panel`/`#user-story-panel`/
`#dialect-panel`) exactly as they are today — **no `id` renames, no behaviour changes, pure
re-layout**. This is a 1.15MB single-file client with extensive `id`-selector test coverage; grep
`test/*.test.js` for `gen-arc`, `pdf-panel`, `dialect-`, `continue-select`, `style-select`,
`num-chapters` before moving or renaming anything the tests reference. Verify with a real
click-through of all three text sources in the Browser pane before calling milestone 1 done.

Milestones 2–5 (chaptering card + "create storyline now" shortcut; lesson-selection card + reworded
"learning arc" label + per-chapter override; additional-features card; small independent gap-fills)
are each their own release — see `PLAN §13`'s own build-order list. **Do not fold multiple milestones
into one commit** — this project's own "one release per commit" rule, and a redesign this size is
exactly what it's for.

**Explicitly out of scope, confirmed with the user this cut — do not reopen without asking**: comic/
image import (`PLAN §7.0` Track A4, no code exists); the CP1-6 pipeline's cross-chapter
arc-sequencing (`PLAN §7.0`'s own note already deferred this on effort/necessity grounds — reopening
it skips a prerequisite that still hasn't shipped either); spell-check-driven auto error-hunt
generation (flagged during the assessment as genuinely new, never confirmed in scope). The
browser-reachable single-chapter CP1-4 pipeline IS in scope, but sequenced AFTER milestones 1–5 ship
— it needs its own background-job design (CP2's per-sentence calls are slow: one 4-sentence chapter
took 12+ minutes even on a warm model, measured live this session — see `roadmap_v83.md`'s own
addendum note on the blocked `v83_p` re-verification attempt for the same finding from a different
angle).

## ⚠️ OWED BY THE USER, not doable in a container

- **The whole `v84_g`…`v84_m` speech-recognition arc past the ORIGINAL typed-answer/basic-MCQ
  surfaces** (continuous listening, the mute toggle, the listening-dots animation, interim results,
  the floating "heard" pill) **is still not live-verified on a real device.** Only proven against a
  mocked `SpeechRecognition` constructor plus desktop-browser computed-style checks.
- **Windows Tier 1 install docs (`v84_n`, `README.md`'s new `## Windows` section)** — reasoned, not
  measured on an actual Windows machine.
- **`apply-cp-lessons.js`'s `v83_p` re-verification** — attempted this session, blocked by real
  machine resource contention (near-zero free RAM, three Ollama models loaded, five concurrent
  Claude Code sessions running). `lessons.json` untouched either way. Retry once the machine has
  headroom — see `roadmap_v83.md`'s own addendum note for the exact numbers.
- **The PASS MARK** — still owed by the user, needs a browser pass, not code.

## Standing tools — use them (unchanged from the v84 line; nothing here moved at this cut)

`INTERNALS.md` §6b has the full feature → function map, including the whole speech-recognition
subsystem (`_speechKindFor`, `_speechMicRefresh`, `_speechListenSession`, `_speechHandlePhrase`,
`_speechHandleInterim`, `_micShowHeard`, the `#speech-mic-pill`/`#mic-heard-pill` CSS-specificity
lesson) and the `PLAN §7.0` pipeline (`canonical-text.js`/`canonical-analysis.js`/
`curriculum-plan.js`/`curriculum-lesson.js`/`apply-cp-lessons.js`) — read those entries before
touching either area, they carry the exact fixes and gotchas from the `v84` line.
