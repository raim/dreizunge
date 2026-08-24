# Session prompt — written at the `v84_e` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v84_f`, `v84_g`, …) unless a future
session has a good reason to switch to `v85_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v84_e`** — a SECOND mobile follow-up
batch, sent while `v84_d` was still being finalized (same real-phone-use conversation), refining two
of `v84_d`'s own decisions and adding a genuinely new interaction: (1) nav icons (prev/☰/next) moved
BELOW the whole text field on BOTH progress and entry cards — superseding `v84_d`'s own two-row-
within-`<summary>` split, which this follow-up explicitly said didn't go far enough; (2) the entry
card's "next" now goes to the chapter's own progress card instead of starting a lesson directly (the
old `v77_k`-era "two destinations" design collapsed to one); (3) a short tap on PLAIN story/summary
text now advances like Next — built on the SAME `sel.isCollapsed` signal `PLAN §12`'s selection
popover already trusts, so a drag-select still opens that popover unchanged; (4) a highlighted word
(`tapWord()`/`.wp-tap`) keeps its own tap-to-lesson behaviour, per the user's own explicit follow-up
clarification sent right after item 3 shipped. All verified via REAL DOM `.click()` dispatch against
a real chapter's real data, not just direct function calls. Full write-up in `roadmap_v84.md`'s own
`v84_e` entry — read it before touching any of these areas again.

**`v84_d`, condensed** — the FIRST mobile follow-up batch, same conversation: `#comp-story-panel`'s
header row split into two (superseded above); the corner-pill cluster and tutor fab unified into one
full-width translucent `#bottom-bar` (`--bottom-bar-h` CSS var, still current); question-card
flag/star buttons moved below the collapsed story panel; the mobile selection popover — found
rendering correctly but hidden under the phone's own native "Copy/Share" toolbar — now pins above
`#bottom-bar` on touch devices via `_isTouchDevice()`.

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
   the v83 line" for the two newest), then `# SHIPPED IN THE v84 LINE` for `v84_e`'s second mobile
   batch, `v84_d`'s first, `v84_c`'s launcher, and `v84_b`'s PWA work + the `lib-dom.js` fix — read
   all of it before touching any of those areas.
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
`v83_m`). `APP_VERSION = 'v84_e'`.

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

## The mobile UI follow-up arc is DONE — closed, don't re-open without a reason

Two full batches (`v84_d`, `v84_e`), all from real phone use in the same conversation, all verified
live. Nothing known-broken remains on this surface. If the user reports something new here, treat it
as genuinely new feedback (their phone, their real usage), not a reopening of a settled decision.

## My suggestion: re-evaluate `apply-cp-lessons.js` output with `v83_p`'s register fix

Carried forward from `v84_d`'s own prompt, since the mobile arc took priority instead: the user's own
two `PLAN §7.0` evaluation runs (`v83_n` qwen2.5:7b, `v83_o` qwen3.6:35b-a3b) both predate `v83_p`'s
register-mismatch fix. Re-running with `--replace` would show whether the fix actually produces
correct output on real content. Leans more on the user's own judgment (reading translations) than
code — flag that up front.

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
Used by `_storySelShowPopover`'s touch/desktop branch.

`_storyTapMaybeAdvance()`/`_storyTapInit()` (`v84_e`, `index.html`) — a short tap on plain
`#comp-story-text`/`#sum-sumtext` fires `comp-next`/`sum-next`. Reuses `PLAN §12`'s own
`sel.isCollapsed` signal (NOT a new time/movement threshold) to tell a tap from a drag-select, and
excludes `.wp-tap` (highlighted words) by target. If you touch this, re-verify with a REAL DOM
`.click()` dispatch (`test/unit-tutor-selection.test.js` §11 already does this) — a direct function
call alone would not have caught the cross-realm `vm.Context` gotcha this section's own testing hit
(`assert.deepStrictEqual` on an object returned straight from `C.run()` fails even when equal —
round-trip through `JSON.stringify`/`JSON.parse` instead).

`sum-next`'s onclick (`index.html`, the `showComplete()`-adjacent summary render function) — both
the ENTRY and WALK cases now call `sumForwardToCard()`; the `_entry`-derived label ("Start"/"Next")
is the only thing still branching on `_entry`. If a future change needs the entry card to start a
lesson directly again, that is a explicit product reversal, not a bug fix — confirm with the user
first, the same way this change itself came from an explicit user request.
