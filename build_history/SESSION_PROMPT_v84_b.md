# Session prompt — written at the `v84_b` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v84_c`, `v84_d`, …) unless a future
session has a good reason to switch to `v85_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v84_b`** — PWA install support
(`manifest.json`/`icon.svg`/`sw.js`, local server only): browsers can offer "Install App," windowed,
no tabs/omnibox. **✅ Registration is CONFIRMED working** — a sandboxed preview browser failed during
the build itself (Chrome's generic "unknown error fetching the script," reasoned as a sandbox
restriction, not a bug), but the user then verified it for real in Google Chrome on Ubuntu via
`localhost:3000`, same day. **One separate, real, still-open limitation found in that same
follow-up**: a LAN IP over plain HTTP (tested on Android, `http://192.168.0.180:3000`) gets NO
install option — service workers need a secure context (HTTPS or the `localhost` loopback
exception), which a LAN address never satisfies. Same root cause as the app's own existing
insecure-transport warning, not a new bug. Fix (not built): a TLS-terminating reverse proxy in front
of the server — judged by the user themselves as "probably only required for a future deployment,"
not an immediate priority. See `roadmap_v84.md`'s own `v84_b` entry for the full story.

**Also fixed at `v84_b`, found while building the above** (a test-harness bug, not a PWA bug):
`test/lib-dom.js`'s `loadClient()` had a fragile trailing-regex assuming `init();` was the LAST
statement in `index.html`'s client script — the first code ever added after it (this release's own
SW registration) silently un-suppressed `init()` in ~80 unit tests. Fixed by anchoring on the
`@static-engine-end` marker instead (with a fallback for `docs/index.html`, which never carries that
marker). If a future change also needs to add code after `init();` in `index.html`, this is already
handled — but re-read `roadmap_v84.md`'s own write-up before assuming any NEW harness fragility here
is already covered.

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
   the v83 line" for the two newest), then `# SHIPPED IN THE v84 LINE` for `v84_b`'s own full
   write-up (the PWA feature AND the `lib-dom.js` fix — read both before touching either area).
3. `INTERNALS.md` — constants, silent-failure modes, invariants. **§6b is a feature → function map**
   — read it BEFORE grepping for where anything lives.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 263 checks
node test/run.js --quick                  → expect 229
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Corpus at this cut: **327 topics, 92 storylines, 33 languages, 659 `en` keys** (unchanged since
`v83_m`). `APP_VERSION = 'v84_b'`.

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

## PWA install support is DONE — closed, don't re-open without a reason

Confirmed working in a real browser (Google Chrome, Ubuntu, `localhost:3000`) the same day it shipped
— see `roadmap_v84.md`'s `v84_b` entry. The one remaining, SEPARATE limitation (a LAN IP over plain
HTTP gets no install option, since service workers need a secure context) is well-understood, not a
bug, and its real fix (a TLS-terminating reverse proxy) is explicitly a future-deployment concern the
user themselves deprioritized — don't build it unless asked.

## My suggestion: pick from the buildable-now list below

Nothing as clearly pre-chosen as PWA was this time — genuinely the user's call. Two that stand out:
**re-evaluating `apply-cp-lessons.js` output with `v83_p`'s register fix** (closes a real, still-open
gap in previously-shipped work), or **a `dreizunge` PATH launcher** (small, same zero-dependency
spirit as the PWA work, previously deferred rather than declined).

## Other buildable-now items, unranked

- **A `dreizunge` PATH launcher** (starts the server, opens the browser — `jupyter notebook`'s own
  shape) — discussed, explicitly deferred ("not yet"). Distinct from the PWA question above.
- **Re-evaluate `apply-cp-lessons.js` output with `v83_p`'s register fix** on real content — the
  user's own two evaluation runs both predate that fix.
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
