# Session prompt — written at the `v90_b` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. The base cut is the bare number and is implicitly `a`, so point releases run
`v89_b`, `v89_c`, … A bump to a new BASE (`v90`) needs its own roadmap, per the protocol.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v90_b`**. `roadmap_v90.md` was cut at
`v90` and is the current roadmap.

**IMPORTANT — the user is translating `ui.json` locally by hand.** Before adding or editing ANY `en`
key, tell them explicitly and let them pause first. Every cut in the `v87` and `v88` lines asked
first and was given an explicit budget, often smaller than proposed. **Ask again fresh THIS
session** — and try ZERO first: whole stretches of the `v88` line (`v88_ab`, `v88_ad`, `v88_af`,
`v88_ag`, `v88_ai`, `v88_al`, `v88_am`) shipped real features with no new keys at all, by reusing
strings the app already had.

**The user's own server runs on port 3000 across sessions** and WRITES to `lessons.json` while you
work. Check `git status --short lessons.json` at the start and again at commit time — the corpus
counts below are guarded, and their server moving a number is the usual reason that guard goes red.

⚠️⚠️ **`server.js` serves `index.html` with `readFileSync` PER REQUEST, so a CLIENT edit is LIVE in
the user's browser the instant it hits disk.** This is not a convenience note — at `v88_aj` a
half-applied rename (a function replaced before its three call sites were removed) put a
`ReferenceError` into their running app: the library rendered nothing and every `#sl=` deep link
died. **A rename deletes the callers FIRST, or lands as one atomic edit.** There is no window in
which a dangling reference is merely "not finished yet". A SERVER edit is not live — start your own
instance on another port to verify, and **kill it by PID** (`pkill -f "node server.js"` matches

⚠️⚠️ **AND POINT IT AT A COPY OF THE STORE: `LESSONS_FILE=/tmp/x.json PORT=3461 node server.js`.**
Starting a second instance on the default store is **silently destructive**, and it cost the user
real work at the `v89_aj` cut. Both processes hold the WHOLE store in memory and `saveStore` writes
all of it, so it is last-write-wins over the entire file: a test server started at 10:13 held a
snapshot from 10:12, the user's server translated three more chapters, and the next write from the
TEST server reverted all three. It was reported as "the batch only translated the first three
chapters" and looked exactly like a product bug — the user diagnosed it, not me.
⚠️ `v89_ad`'s atomic writes do NOT help here: `rename(2)` prevents a TORN read, not a LOST UPDATE.
theirs too).

---

## What the `v89` line was, in one screen

**Forty point releases** (`v89`…`v89_an`). ⚠️ **`roadmap_v89.md` is the record for that line** —
go there for how any of it was built, or why a guard is shaped the way it is. `roadmap_v90.md` (the
current one) carries the protocol, the open items and the RULES, but none of that history. What it closed:

- **The two items it was handed** (swipeable progress card, inflection read-out language), plus a
  long run of live bug reports.
- **Item `V`** (multi-image comic upload), open since the `v86` line: each image is its own
  whole-image panel, so N images give N chapters.
- **The flake audit.** The two "known flaky" tests were never flaky — 40/40, 60/60 seeded, 15/15
  under load. The real defect was a **non-atomic `fs.writeFileSync`** on every durable store, which
  also risked truncating the corpus on a crash. `atomic-write.js` now covers all seven.
- **The job-coverage ENUMERATION**, after two user reports of the same class. 21 model-backed routes
  walked; two were still blocking and nobody had reported them.
- **Extracted-text QC** — automatic un-shouting gated by a measured detector, plus an on-demand
  proofread on four surfaces behind one engine with two modes.
- **Storyline-level provenance**, inherited by chapters; a chapter entry exists only when it differs.
- Three user-reported defects whose causes were *not* what they looked like: a Save button broken in
  its own markup, a badge that never refreshed, a "batch stopped early" that was **my own test server
  clobbering the store**.
- **29 dead `ui.json` keys** removed (957 translated entries), with the detector kept as a guard.

# WHERE TO START

**NOTHING IS OWED.** Every item the `v89` line was handed shipped, and the three the user queued at
the end (job audit, item V, the `kind:'sync'` deletion) all landed. **Ask the user what they want
next** — that is the right first move here.

⚠️ **THE USER WAS TRANSLATING `ui.json` BY HAND ACROSS THE v90, v90_a AND v90_b CUTS** and will commit it themselves.
Do not touch that file until `git log ui.json` shows their commit, and do not trust any translated
count in this document until then.

⚠️ **AND `docs/index.html` BAKES `ui.json`.** Every v90-line cut so far has committed a `docs/` built
from a mid-translation `ui.json`, because `APP_VERSION` is baked there too and had to be current. So
`unit-static-freshness` will be RED until someone re-runs `node build-static.js` after the user's
translation lands. **That is the expected first action of the next session if `git log ui.json`
shows a commit newer than `docs/index.html`** — it is not a finding, and the fix is one command:

```
node build-static.js && node test/run.js --quick
```

⚠️ **ONE THING IS GENUINELY UNRESOLVED, and it is not a code defect you can go and fix:** the
false `⚠ Ollama unreachable` on wlan loss. `v89_af` made the ping tolerant of a stall, but a
controlled test **did not reproduce the original symptom at all** — the ping stayed at 1-3ms through
a clean wlan off/on, so the fix is UNTESTED against the real thing. The original failures show
`ip-config-unavailable` (DHCP timing out, 1564 times in one boot), which a clean toggle does not
reproduce. If it recurs, the monitor shape is in `roadmap_v90.md`'s `v89_af` entry.

⚠️ **THE `v90_b` MUTATION AUDIT WAS A SAMPLE, AND IT LEFT A NAMED REMAINDER.** 17 mutations, 9 of
them survived the whole suite, 7 guard files repaired. The static screen that picked the targets
found **16** test files whose only claim about some function is that it EXISTS; nine of those
functions are now actually run. The ones still guarded by name alone, if someone wants to continue:

| file | the function it only names |
|---|---|
| `unit-learner-nav` | `howComplete`, `_renderCompStoryboard` |
| `unit-story-stamp` | `fixMetaSource`, `classifyOrigin`, `flagValue` |
| `unit-reasoning-model-safety` | `callLLM` |
| `unit-static-freshness` | `sourceFingerprint` |
| `unit-translation-stamp` | `stampTranslationMeta` |
| `unit-intro-script` | `scriptLessonAvailableForSet` (mutation CAUGHT elsewhere — lower priority) |

Reproduce the method from the `v90_b` roadmap entry: mutate the app, **rebuild `docs/`** so the
parity and freshness guards cannot fire on the byte change instead of the defect, run the named
guard, then the full suite for anything still green. And note the screen's blind spot — it cannot
see a guard that runs the RIGHT function on a fixture where every branch answers the same.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v90.md` — its **index table** and **⚠️ Session protocol** block first, then
   **"🆕 THE SHORT LIST"**, then the standing RULES (which now include a block for the `v88` line).
3. `build_history/roadmap_v88.md` is KEPT as the record for the whole `v88` line (`v88_a`…`v88_am`,
   thirty-nine point releases) — go there for how anything from that line was built.
   `roadmap_v87.md` likewise for the `v87` line, and it holds that line's own rules block.
4. `INTERNALS.md` **§6b, the feature → function map** — read it BEFORE grepping for where anything
   lives. Current through `v89`.

## Establish a green baseline before changing anything

**⚠️ Run `node build-static.js` at EVERY release, even a server-only one.** `APP_VERSION` lives in
`server.js` and is BAKED into `docs/index.html`, so "no client change → no rebuild" is wrong and cost
a red suite at `v88_g`. `unit-static-freshness` will NOT catch it (it compares the eight baked
inputs, and `server.js` is not among them); `unit-version-derivation` is the one that does.

```
node test/run.js                          → expect 360 checks
node test/run.js --quick                  → expect 299
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

⚠️ **The full suite now takes ~9 minutes** and sits close to a 10-minute tool timeout. Run it in the
BACKGROUND and wait on the output file. ⚠️ **Do NOT wait with `until ! pgrep -f "test/run.js"`** —
`pgrep -f` matches the waiting shell's OWN command line and the loop never exits; twenty leaked
processes once spanned 11 hours. Wait on the file (`until tail -1 out.txt | grep -qE '^(ALL CHECKS
PASSED|FAILED [0-9]+ of)'`) or bracket the pattern (`"[t]est/run.js"`). Same family as the standing
`pkill -f "node server.js"` warning, from the other direction.

**Check `ps -eo pid,cmd | grep '[f]ake-ollama'` before trusting a load flake** — four orphaned fake
servers, the oldest 29 hours old, were once holding ports.

### The flake picture, as it actually stands

- **`e2e-idle-release` — EXPLAINED at `v88_ak`, and it was never flaky.** One sweep releases every
  configured model IN PARALLEL, so it writes one log entry PER MODEL (two in the harness); the test
  counted ENTRIES as a proxy for SWEEPS and its §2 exited on the first one. The metric is now the
  number of sweeps. ⚠️ **NOT "cleared"**: the fix is justified by construction, not by reproducing
  the failure (the old counting passed 6/6 under three busy-loop CPU hogs). **If it fails again,
  capture the entry arrival times from the failing run — do not re-run it.**
- **`unit-tap-word` (`v87_i`) and `unit-observations-log` (`v88_h`) are FIXED, not flaky.** A failure
  in either now is a genuine regression.
- **`unit-ui-journeys` / `unit-word-progress` are UNVERIFIED**, not clean — 12/12 each is far too few
  runs to mean anything.
- **A DETERMINISTIC failure is not the documented flakiness.** At `v87_o` two tests failed 8/8
  because the user's server had written a chapter and broken two fixture SELECTIONS;
  `git show HEAD:lessons.json` isolated it in one command. Don't run the full and `--quick` suites
  CONCURRENTLY on this box (`v86_ae`).

Corpus at this cut: **355 topics, 99 storylines, 33 languages, 737 `en` keys** — an inherently live
snapshot; re-measure fresh at commit time. `APP_VERSION = 'v90_b'`.

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is usually the thing
> to fix** — but diagnose which side is wrong first, and remember the user's live server is the most
> common cause of a moved corpus count.

## The habits that cost this project the most

The standing rules live in `roadmap_v90.md`: "Rules earned in session 28…34" plus dedicated blocks
for the `v83`/`v84`/`v85`/`v86`/`v88` lines and **SEVENTEEN from the `v89` line** — eleven from its
first half and six more (numbers 12–17) from its second. Read the **"⚠️ How the rules are NUMBERED"**
note before citing one. The `v87` line's block is in `roadmap_v87.md`.

**If you read only five, read these — every one cost a release, and several are an earlier rule
failing a second time:**
- **`v89` rule 1** — an unbounded search used to DELIMIT an edit destroyed 2,518 lines of the
  roadmap, then did it again and was committed. **Assert the SPAN SIZE, and `git diff --numstat`
  before committing.**
- **`v89` rule 12** — driving a FUNCTION proves nothing about the BUTTON that calls it. A Save
  button was broken in its own markup while every test passed.
- **`v89` rule 13** — a decision buried in an expression cannot be tested. Twice, flattening an
  inline ternary to `true` restored the reported bug and left the suite GREEN.
- **`v89` rule 15** — **never run a second server on the user's `lessons.json`.** Use
  `LESSONS_FILE=/tmp/x.json`. It silently reverted three of their chapter translations, and they
  diagnosed it, not me.
- **`v89` rule 16** — a synchronous wait in a test that is waiting on a TIMER measures nothing; and
  a stub that never settles makes the file print ALL PASSED and then hang the whole suite.

**If you read only four of them, read these — each cost a release in the `v88` line:**

1. **⚠️ CONTAINMENT IS THE PROXY THAT KEEPS HIDING DEFECTS.** THREE releases in a row shipped a bug
   past a guard that used `includes`: a button whose `onclick` was truncated by mis-escaped quotes
   and could not work at all; a label that rendered its icon twice; and a too-greedy string strip
   that the button's own `title` attribute satisfied. **Assert on the delimited value** — the label
   span, the whole attribute, an equality — never on "the string appears somewhere".
2. **A guard can become an assertion of the WRONG THING without ever going red** — seven times in the
   `v88` line. When a user replaces a ruling, **grep the suite for the ruling's own words before
   writing code**, and re-scope rather than delete.
3. **Mutation-test every guard you write.** When one stays GREEN, that is the finding: ask whether
   the two branches are distinguishable at all, and whether the FIXTURE covers the case (a fixture
   using `"Een … een"` made every token occurrence 0 of its own surface, so a mutation ignoring the
   occurrence index stayed green in TWO files).
4. **Verify at the layer the user touches.** A live check that CALLS a function proves nothing about
   the button wired to it — `v88_ai`'s ▶ table button was verified by calling `_teOpenCuratorTable`
   and shipped inert. Click the button.

**Harness traps that are not about your code:** `getElementById` AUTO-VIVIFIES and caches, so a test
that creates its own element with the same id inspects a DIFFERENT object and fails on a correct
tree. Any backslash or backtick inside a template literal is processed TWICE — a comment containing
backticks terminates the literal, and a regex with escaped slashes can arrive as a line comment.

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map. Read it BEFORE grepping for where anything
lives.

**The shapes this project has settled on, so a new one is not invented:**
- A long model-backed route becomes a job with **`runAsJob(res, meta, producer)`** (server) and
  **`_jobAwait(response)`** (client). Validation stays OUTSIDE the producer; only `running`/`pending`
  may continue polling; add a per-item `CANCELLED` re-throw and a checkpoint wherever there is a loop.
- A card's edit affordances go behind one pencil with **`_cardEditPopHtml`**; the storyline page's
  static header uses **`_slEditMenuSync`**. Row labels come from the buttons' own `title` attributes,
  which is why these cost no `ui.json` keys.
- Per-chapter state that must survive a regeneration belongs in an OVERLAY store keyed on something
  stable (**never** an index — see `analysis-corrections.js`'s header), merged on read, and pruned by
  the chapter-delete route.
