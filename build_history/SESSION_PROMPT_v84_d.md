# Session prompt — written at the `v84_d` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v84_e`, `v84_f`, …) unless a future
session has a good reason to switch to `v85_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v84_d`** — four mobile progress-card
UI follow-ups, ALL from the user actually using the app on their own phone (made possible for the
first time this session by `v84_b`/`v84_c`): (1) `#comp-story-panel`'s header row split into two —
title/flags/read on top, prev/☰/next centered below — a long chapter title was overflowing a phone
screen; (2) the corner-pill cluster (account/settings/mute) and the tutor fab, previously two
floating widgets in opposite corners, now share one full-width translucent `#bottom-bar`
(`--bottom-bar-h` CSS var, everything else fixed-bottom offsets from it); (3) question-card flag/star
buttons moved below the collapsed story panel (pure reorder); (4) the mobile "ask the tutor" selection
popover — found to be rendering correctly, just hidden under the phone's own native "Copy/Share"
selection toolbar (a real, precise diagnosis from the user, correcting an earlier vaguer "doesn't work
on mobile" report) — now pins `position:fixed` above `#bottom-bar` on touch devices instead of trying
to anchor near a selection whose on-screen native-toolbar collision this page cannot see or avoid. All
four verified live against a real 375px mobile viewport, not just structurally. Full write-up (with
exactly what was verified and how) in `roadmap_v84.md`'s own `v84_d` entry — read it before touching
any of these four areas again.

**`v84_b`/`v84_c`, condensed** — PWA install support (confirmed working for real in Google Chrome on
Ubuntu, same day it shipped; a LAN IP over plain HTTP separately does NOT get an install option,
service workers need a secure context, not a bug, fix is a TLS proxy the user deprioritized) and the
`dreizunge` PATH launcher (`bin/dreizunge`, installed onto `~/.local/bin` by `install.sh`, starts the
server + opens the browser, `--no-browser` to skip). Also fixed at `v84_b`: `test/lib-dom.js`'s
`loadClient()` had a fragile trailing-regex assuming `init();` was the LAST statement in the client
script — fixed by anchoring on the `@static-engine-end` marker instead (falls back to the old regex
only for `docs/index.html`, which never carries that marker).

`roadmap_v84.md` was cut from `roadmap_v83.md` at the user's own request, "push to v84 for a fresh
session," purely for accumulated-context reasons — not a milestone cut. `roadmap_v83.md` is kept and
stays the record for everything `v83_b`…`v83_s` shipped: the whole `PLAN §7.0`/Track A migration
(CP1–5, all done), the first script that writes real lessons into `lessons.json`
(`apply-cp-lessons.js`, with two real bugs found reading its own output), and `install.sh` (the
one-line installer, its default model, and its no-auto-start + resource-check follow-ups). Read
`roadmap_v83.md`'s own `# SHIPPED IN THE v83 LINE` for how any of that was built — none of it was
copied into this file.

**Two discussion-only notes were also recorded at the very end of the `v83` line**, both explicitly
"not required for now" — read them in `roadmap_v83.md` (search "📝 Note") before re-deriving either:
Windows installability for a non-coder (two tiers laid out: written-steps vs. a real `winget`+
PowerShell installer), and mic-based spoken-reply recording/comparison (recording is trivial;
word-level correctness via speech-to-text is a real infrastructure decision — local model vs. browser
API vs. cloud call; pronunciation-quality scoring is hard and out of scope).

## Orient yourself

1. **This file**, whole.
2. `build_history/roadmap_v84.md` — its **index table** and **⚠️ Session protocol** block first, then
   `# ⚠️ OPEN AT THE v84 CUT` (findings, `§0`/`§0i`, the standing RULES — now 37, see "Rules earned in
   the v83 line" for the two newest), then `# SHIPPED IN THE v84 LINE` for `v84_d`'s four mobile UI
   items, `v84_c`'s launcher, and `v84_b`'s PWA work + the `lib-dom.js` fix — read all of it before
   touching any of those areas.
3. `INTERNALS.md` — constants, silent-failure modes, invariants. **§6b is a feature → function map**
   — read it BEFORE grepping for where anything lives.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 264 checks
node test/run.js --quick                  → expect 230
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Corpus at this cut: **327 topics, 92 storylines, 33 languages, 659 `en` keys** (unchanged since
`v83_m`). `APP_VERSION = 'v84_d'`.

⚠️ **Check `git status --short lessons.json` at the start of this session.** If it shows modified,
that is very likely the user's own real, uncommitted `PLAN §7.0`/CP4-pipeline evaluation data — not
yours to revert, commit, or "fix around" without asking. Back it up, `git checkout --` it for any
build/test work, restore it after — the dance every `v83` release touching this did.

⚠️ **The user's own main dev server (port 3000) needs a MANUAL restart to see anything past
`v83_f`** — check its reported version against `APP_VERSION` before assuming it's current, and ask
before restarting it.

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is the thing to
> fix**, not the guard.

## The habits that cost this project the most

*(Full incident history lives in `roadmap_v83.md`'s "Rules earned in session N" / "Rules earned in
the v83 line" blocks — this is the short form.)*

1. **Measure before editing.**
2. **Guard at the layer where the claim is observable**, and mutation-test every guard.
3. **For any refactor claiming to preserve behaviour, CAPTURE the old output and DIFF it.**
4. **`buildExercises` is NON-DETERMINISTIC IN CONTENT, not just order.**
5. **Ask before restarting a dev server you did not start, and before deleting data you did not
   create.** Applies equally to the user's own uncommitted `lessons.json` evaluation data.
6. **A live model call needs a live test AND a real human reading the output** — neither a crash-free
   run nor a plausible prompt proves correctness.
7. **A fix to one stage's OUTPUT SHAPE can silently break a DOWNSTREAM consumer that assumed the OLD
   shape** — re-run the full suite for every affected file, not just the one you changed.
8. **A per-caller fix (e.g. `think:false`) does not generalize to other callers of the same
   primitive** — grep for every call site before trusting a class of bug is closed.
9. **A new test that spawns a server belongs in its own e2e file** — `unit-run-summary.test.js`
   enforces this; split the file, never loosen the guard.
10. **When a change is the FIRST of its kind to touch the live app or write to a real corpus, ASK how
    far it should go before building.**

# WHERE TO START

## ⚠️ A follow-up UI batch (four more items) arrived as `v84_d` was being finalized — do this next

Sent by the user mid-session, immediately after the `v84_d` batch above (real phone use, same
session): (1) move progress/entry-card navigation icons (arrows + ☰) BELOW the text field entirely —
NOT just into a second row of the summary, as `v84_d` item 1 did; applies to BOTH the progress card
AND the entry/summary card (`v84_d` deliberately left the entry card's header untouched — this is
what supersedes that). (2) The entry card's "next" button should go to CHAPTER 1's progress/complete
card, not straight into the first question. (3) A SHORT tap on the entry card's summary text should
do what "next" does (per item 2); a longer tap/drag should still allow text selection. (4) Same shape
on progress cards: a short tap on the story text should behave like "next" (e.g. start a now-unlocked
comprehension lesson); a longer tap/drag should open the EXISTING grammar/meaning selection popover
(`PLAN §12`, `_storySelShowPopover`/`_storySelMaybeShow` — the exact mechanism `v84_d` item 4 just
touched). **User's own explicit clarification, sent right after item 4**: the short-tap-advances
behaviour must NOT fire on a HIGHLIGHTED word — those already lead to their own lesson via
`tapWord()`/`.wp-tap` and must keep doing exactly that. Only a tap on PLAIN, unhighlighted text
should behave like "next." This is not an edge case to handle later — it is the FIRST thing to get
right, since `tapWord()`'s existing behaviour is the one this must not regress.

**Real design risk worth flagging explicitly, not just building through**: distinguishing a "short
tap on plain text" from "a tap on a highlighted word" from "the start of a drag-to-select gesture"
needs a real threshold (time and/or movement) PLUS a target check (`.closest('.wp-tap')` or
equivalent — the highlighted-word exclusion above), and must coexist with THREE other things already
listening on the same text: `tapWord()` (per-word tap-to-lookup, `.wp-tap` marks — must keep firing,
unchanged, for a highlighted word), the `story-selectable` selection-to-tutor listener `v84_d` just
touched, and (for the entry card) whatever currently handles a tap there today (check before assuming
nothing does). Read `_storySelMaybeShow`/`_storySelInit` closely — it already solved a related
coexistence problem (`sel.isCollapsed` distinguishes a plain click from a real selection) that a
short-tap-vs-drag threshold will need to sit alongside, not replace.

## Other buildable-now items, unranked

- **Re-evaluate `apply-cp-lessons.js` output with `v83_p`'s register fix** — closes a real,
  already-known gap (the user's own two evaluation runs both predate that fix). Leans more on the
  user's own judgment (reading translations) than code.
- **`PLAN §7.0`'s still-open gaps**: no function-word filtering (`v83_n`), confidence not surviving
  into CP4's written lesson (`v83_n`), browser reachability for `apply-cp-lessons.js` (needs a UI
  trigger + a background job for CP2's slow per-sentence calls — not authorized).
- **The PASS MARK** — still owed by the user, needs a browser pass, not code.
- See `roadmap_v84.md`'s carried-forward `# ⚠️ OPEN AT THE v84 CUT` for the older, still-unresolved
  items (§C1's first bug, §0i's reconciliation) — read before assuming any of them are new.

## NOT yours to start without the user naming it

`PLAN §7.0` CP6 (a CONDITIONAL, not a queued slice). Mastery-driven progression (`PLAN §9b/D2`) — a
user product decision. Windows installability and mic-based speech comparison (both discussion-only,
`roadmap_v83.md`) — neither ruled, neither queued.

## Standing tools — use them

**Before grepping for where something lives, check `INTERNALS.md` §6b.** The whole `PLAN §7.0`
pipeline (`canonical-text.js`/`canonical-analysis.js`/`curriculum-plan.js`/`curriculum-lesson.js`/
`apply-cp-lessons.js`), `install.sh`, and `llm.js`'s `warmup()` all have their own §6b entries — read
those before touching any of them again, they carry the exact fixes and gotchas from the `v83` line.

`manifest.json`/`icon.svg`/`sw.js` (`v84_b`, repo root, local server only) — served by three new
`GET` routes in `server.js` right after `GET /`. `test/lib-dom.js`'s `loadClient()` now anchors on
`index.html`'s `@static-engine-end` marker to suppress the live bootstrap (falls back to a trailing
regex ONLY for `docs/index.html`) — if you ever add code after `init();` in `index.html` again, this
harness already handles it; if you touch `loadClient()` itself, re-read its own comment block first.

`bin/dreizunge` (`v84_c`, repo root) — the PATH launcher, symlinked to `~/.local/bin/dreizunge` by
`install.sh`. Resolves its OWN location by following symlinks BY HAND (portable to macOS's non-GNU
`readlink`) — if you ever touch its location-resolution logic, re-verify with a REAL symlinked run
(`test/unit-dreizunge-launcher.test.js` already does this; re-read it before assuming a source-level
change is safe).

`--bottom-bar-h` (`v84_d`, CSS var in `index.html`'s `:root`) — the ONE place `#bottom-bar`'s height
is stated; `.toast`/`#gen-status`/`.static-flag-banner`/`#tutor-widget`'s open position/the touch
selection-popover's fixed position ALL offset from it via `calc(var(--bottom-bar-h) + Npx)`. If the
follow-up batch above changes what's IN `#bottom-bar`, re-check whether this number still matches
reality (currently sized for the 44px `tutor-fab-btn`).

`_isTouchDevice()` (`v84_d`, `index.html`) — `'ontouchstart' in window || navigator.maxTouchPoints > 0`.
Used once so far (`_storySelShowPopover`'s touch/desktop branch) but is the right primitive for the
follow-up batch's tap-vs-drag distinction too — don't invent a second detection.
