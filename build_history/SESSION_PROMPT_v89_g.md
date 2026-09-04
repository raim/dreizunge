# Session prompt — written at the `v89_g` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. The base cut is the bare number and is implicitly `a`, so point releases run
`v89_b`, `v89_c`, … A bump to a new BASE (`v90`) needs its own roadmap, per the protocol.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v89_g`**. `roadmap_v89.md` was cut at
`v89` and is the current roadmap.

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
theirs too).

---

## What the `v88` line was, in one screen

Thirty-nine point releases (`v88_a`…`v88_am`). `roadmap_v88.md` is the record — go there for how any
of it was built. What it closed:

- **The thirteen TODOs** handed over after `v88_a` (items `AM`…`AX`), plus two live bug reports and a
  flake audit.
- **Item `AU`** end to end: job cancel, idle release (30 → 60 min at the user's ruling), and the
  swallowed-cancel audit that found EIGHT sites where a reading had found two.
- **Item `AI`**: a curator can correct CP2's token analysis, the correction survives a re-analysis,
  and a per-chapter table works through the 63 unresolved tokens.
- **Item `Y`**: the storyline header's edit buttons behind one pencil — extended at `v88_am` to the
  library storyline cards and the chapter cards.
- **The chapter-wise progress lock**, removed on both surfaces that carried it.
- **The teacher walkthrough**, then generalised into a student BROWSE mode (▶ plays, → browses).
- **The standing "some LLM jobs have no cancel button" item**: all EIGHT formerly-blocking model
  routes are now listed, cancellable jobs behind one shape — `runAsJob` (server) + `_jobAwait`
  (client).

# WHERE TO START

**NOTHING IS OWED.** Every item the `v88` line was handed shipped, and the two the `v89` line was
handed shipped too. **Ask the user what they want next** — that is the right first move here.

## What the `v89` line has shipped so far

- **`v89_b`** — the progress card swipes left/right, pressing its own `comp-prev`/`comp-next`. Touch
  only, `passive:true`, scoped to `#complete-screen` minus `#comp-nav-modal`. ⚠️ Its
  **capture-phase click swallow** is load-bearing, not defensive: a horizontal touch drag still
  synthesises a `click`, which would otherwise ALSO fire `tapWord` or `_storyTapMaybeAdvance` on top
  of the swipe. `unit-card-swipe-nav.test.js`, twelve mutations all red.
- **`v89_c`** — inflections readout. The lemma question speaks its answer again, in the TARGET
  voice, **reversing `v86_ae`** (the user asked for it back with that ruling's trade-off known — if
  the mispronunciation returns, the lever is the VOICE policy, not that branch). ⚠️ **User ruling:
  the grammar-form label STAYS a source-language explanation.** Measured at the cut: the live corpus
  is genuinely MIXED — nl/de and it/nl chapters carry target-language labels, en/ja, de/en, it/en and
  en/de carry source-language ones — so reading the label with the target voice would fix one half by
  breaking the other. `PROMPTS.inflections` was hardened instead (explicit `NOT in {L}`, a field
  PARTITION, a re-read step) — and **MEASURED against the live model: OLD 0 of 3 runs compliant,
  NEW 1 of 3.** A partial mitigation, NOT a fix; it ships because it strictly improves and costs
  nothing. ⚠️ **The drift is per-RUN and all-or-nothing** (five German labels or five Dutch, never a
  mix). ⚠️ `unit-prompt-strictness`'s new section pins prompt TEXT and **cannot** guard model
  behaviour — the 1-of-3 came from a scratch spike, not the suite. The lever that would settle it is
  in the open list: normalise `formLabel`/`formChoices` after parsing, in `generateInflections`.
- **`v89_d`** — that normalisation pass, built at the user's request. `normaliseInflectionLabels`
  (server.js) runs AFTER `validateInflectionsItems`, sends every `formChoices` string of the lesson
  in ONE request keyed the way `metaTranslation` already keys its own, and re-derives `formLabel`
  from the normalised list at `formCorrectIndex`. Gated on `srcLang !== 'en'` — the same gate the
  meta pass uses, and the one item AJ justifies. Falls back PER ITEM (a missing key, an empty value,
  or two options collapsing onto one phrase), never per lesson. ⚠️ It only fixed NEW lessons
  at the time; `v89_f` backfilled the corpus.
  ⚠️ `explanation`/`title`/`desc` drift the SAME way (measured) and are deliberately NOT in scope:
  `explanation` quotes target-language word forms inside itself, so a translation pass over it can
  corrupt the very forms the exercise teaches.
- **`v89_e`** — the progress card now FOLLOWS THE FINGER and springs back (tier A of the evaluation
  the user asked for before committing to it). `#comp-body` is the element that moves, and that is
  load-bearing: **a transformed ancestor becomes the containing block for its `position:fixed`
  descendants**, and `#comp-nav-modal` is one — moving `#complete-screen` would quietly stop the ☰
  overlay covering the viewport. The axis locks ONCE at 10px and is never revisited; `touchmove` is
  the only non-passive listener and `preventDefault` is reached only on an 'x' lock, so scrolling a
  long card is untouched. ⚠️ **Tiers B and C were rejected on evidence**: the neighbouring chapter's
  text is not in memory (`_backToChapterProgress` fetches it; all 343 `APP.savedList` entries carry
  no `story`), and where forward LEADS lives in `comp-next`'s closure, resolved by `showComplete`'s
  gate chain at render time.
- **`v89_f`** — the BACKFILL, run for real against the corpus: 15 lessons, **28 of 60 items
  rewritten**, the rest already correct. `inflection-labels.js` now owns the RULES (gate, request
  shape, per-item fallback) and BOTH callers use it — server.js's generator and
  `backfill-inflection-labels.js`. ⚠️ The backfill re-reads `lessons.json` at write time and matches
  each repair on CONTENT (topic id → lesson id → the item's own sentence + surfaceForm + original
  choices), **never on an index**: the user's server writes that file while a run spends minutes
  inside model calls. ⚠️ `--write` RE-QUERIES the model, so what lands is not character-identical to
  what the dry run printed. **Known limitation, not fixed:** terminology is consistent WITHIN a
  lesson but not across the corpus — one German lesson says `Präteritum`, another `Vergangenheit`.
- **`v89_g`** — the swipe reaches the ENTRY card too. WHICH cards swipe is a TABLE now
  (`_SWIPE_CARDS`), not a hard-coded id; the entry card has NO back button at all (`prev: null`),
  which needs no special case — it flows into the same "nothing there" answer a hidden or disabled
  arrow already produced. ⚠️ **Two of this cut's assertions had to INVERT**: `unit-card-swipe-nav`
  §4/§16 pinned "the entry card is out of scope", and that was only ever true because the harness has
  no page tree and the fixture left `#sum-sumtext` DETACHED. The replacement out-of-scope surface is
  `#finished-screen`, and it is BUILT into the fixture, so the claim is about the page.

`roadmap_v89.md`'s **"🆕 THE SHORT LIST"** at the top of `# ⚠️ OPEN AT THE v89 CUT` is the reconciled
open list, and it is the one to read: every line in it was cross-checked against `roadmap_v88.md`'s
shipped section at this cut, and **three items the previous prompt still carried as open turned out
to be stale and were dropped**. Do not re-derive it from older prompts.

**The shortest paths to value if the user has no preference:**
- **Item `V`** (multi-image upload) — fully specified, unblocked, no decision needed.
- **The completion card's missing force-regenerate control** — quick, well-precedented.
- **⭐ Finish the flake audit** — `unit-ui-journeys` and `unit-word-progress` are the last two
  UNVERIFIED files. ⚠️ Every "known flake" examined so far has been WRONG: three for three
  (`v87_i` a `Math.random()` in the product, `v88_h` a test driver on a proxy, `v88_ak` a guard
  counting log entries as sweeps). **Instrument the failing assertion; do not re-confirm the label.**
- **Delete the superseded `kind:'sync'` popover path** — `_jobsTracked` and `_jobsInflight` have had
  NO callers since `v88_al` and are marked as such in place. Removing them means re-scoping the tests
  that pin them; deliberately left for its own release.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v89.md` — its **index table** and **⚠️ Session protocol** block first, then
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
node test/run.js                          → expect 339 checks
node test/run.js --quick                  → expect 278
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

Corpus at this cut: **343 topics, 97 storylines, 33 languages, 755 `en` keys** — an inherently live
snapshot; re-measure fresh at commit time. `APP_VERSION = 'v89_g'`.

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is usually the thing
> to fix** — but diagnose which side is wrong first, and remember the user's live server is the most
> common cause of a moved corpus count.

## The habits that cost this project the most

The standing rules live in `roadmap_v89.md`: "Rules earned in session 28…34" plus dedicated blocks
for the `v83`/`v84`/`v85`/`v86` lines and **a new one for the `v88` line**. Read the **"⚠️ How the
rules are NUMBERED"** note before citing one. The `v87` line's block is in `roadmap_v87.md`.

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
