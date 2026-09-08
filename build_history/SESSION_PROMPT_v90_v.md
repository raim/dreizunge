# Session prompt — written at the `v90_v` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. The base cut is the bare number and is implicitly `a`, so point releases run
`v89_b`, `v89_c`, … A bump to a new BASE (`v90`) needs its own roadmap, per the protocol.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v90_v`**. `roadmap_v90.md` was cut at
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

**NOTHING IS OWED.** The URL scrape — the one thing that was teed up and costed — **shipped at
`v90_m`**. **Ask the user what they want next** — that is the right first move here.

✅ **SCRAPE A STORY FROM A URL IS BUILT** (`v90_m`), scoped to the schema.org Article subtree, with
`news-article.js` + `POST /api/fetch-url` + `fetchStoryFromUrl()` + `e2e-fetch-url` (7 sections).
**TWO `ui.json` keys**, granted against an estimate of 3–4. Read its roadmap entry before touching
it — ⚠️ **it corrected the roadmap's own prescribed defence**: the `tagesschau.de` 404 page carries a
`NewsArticle` with a REAL 133-word `articleBody` (a German error message), so the "test for
`articleBody`, not for a block" rule that section prescribed **passes on it**. Two gates are needed
(HTTP status 2xx *and* a non-empty body) and neither is sufficient alone.

⚠️ **THE PAYWALL CHECK WAS ASKED FOR, BUILT AND WITHDRAWN ON THE MEASUREMENT** — do not re-derive it.
Both plausible signals are WRONG on this project's own test case (the Corriere article, known
complete): the prose ratio's full-article band is 0.555–1.003 with Corriere itself at the 0.555
floor, and `isAccessibleForFree` is declared `"False"` — the STRING, not a boolean — on that complete
article. The roadmap entry has the numbers and the reasoning. What ships instead is the word count on
the status line, and the review card, which has no false positives.

🟢 **THREE THINGS THE URL WORK LEFT, NONE OWED, ALL COSTED IN ITS ROADMAP ENTRY:**
- **Wikipedia is refused, correctly** — it serves `@type: Article` with `articleBody: ""` (measured on
  `en.` and `de.`). Its own REST API returns clean article text and would be a separate, easy source.
- **SSRF is stated, not solved.** The route makes the SERVER fetch a caller-supplied URL. Fine on a
  localhost personal tool; it belongs in **TIER 0** of *"PUTTING THIS ON THE INTERNET"* and needs a
  scheme/host allow-list — **re-checked after every redirect hop** — before any exposure.
- **The generic (non-JSON-LD) extractor is still unbuilt and still a different project** — the
  Readability problem, several hundred lines, and this repo has no HTML parser.

⚠️ **THE USER WAS TRANSLATING `ui.json` BY HAND ACROSS THE WHOLE v90 LINE SO FAR** and will commit it themselves.
Do not touch that file until `git log ui.json` shows their commit, and do not trust any translated
count in this document until then. ⚠️ **At the `v90_m` cut the file was CLEAN in `git status`** (no
in-flight hand translation to clobber), which is the check to repeat before adding a key — not the
`git log` date alone. **`v90_m` added exactly two `en` keys, `form.fetch_url` and `pdf.no_article`,
`en` only**; they are the two awaiting hand translation.

⚠️ **AND `docs/index.html` BAKES `lessons.json`, WHICH THE USER'S SERVER REWRITES CONSTANTLY.** At
the `v90_m` cut `unit-static-freshness` was RED on session entry for exactly this — `docs/` had been
built from a `lessons.json`/`canonical-analysis.json` snapshot the live server had since moved past.
**It is not a finding**, and the fix is one command; expect to run it again right before committing,
because the corpus can move during a 9-minute suite run:

```
node build-static.js && node test/run.js --quick
```

✅ **THE `⚠ Ollama unreachable` FLAPPING IS SOLVED — it was never the wlan** (`v90_l`). The user's
own book-job log carried the answer: `ECONNREFUSED ::1:11434`, refused in 1-5ms. `::1` is IPv6
loopback, Ollama binds `127.0.0.1` only, and the app's default was the NAME `http://localhost:11434`
— so any call whose resolution landed on `::1` was refused instantly, and which candidate the
resolver returns first is exactly what changes when an interface goes up or down. The default is now
the IPv4 literal, and a loopback NAME pins `family: 4`. **If it ever recurs, check the error CODE
and its TIMING first**: `ECONNREFUSED` in single-digit milliseconds is a local refusal and the wlan
is innocent; a real network fault gives `ETIMEDOUT`/`EHOSTUNREACH` and takes seconds.

✅ **BOTH THINGS THAT LOG SHOWED AND `v90_l` DID NOT FIX ARE NOW CLOSED (`v90_n`) — one was real,
one dissolved on measurement. Do not re-derive either.**
- **The retry WAS real, and worse than described.** Not "immediate": attempts begin at **2ms, 807ms,
  1611ms, giving up after 1615ms**. The conclusion held anyway — 1.6s does not outlast an interface
  stall. Now exponential AND split hard-vs-soft (`pingFailureIsHard`, the same predicate
  `_scheduleBackendRecheck` uses): a refused connection waits **5s then 15s (a 20s window)**, a bad
  generation still **800ms then 2.4s**. ⚠️ Fell out of it: **`withRetry` was RETRYING CANCELS** —
  1606ms of sleeping after the user pressed stop, and the error stopped `=== CANCELLED`.
- **The warm-up is NOT expensive — measured at 565/565/602ms**, three runs, *while a 3-chapter book
  job was running*. `llm.js` sends `keep_alive: -1`, so `ollama ps` shows the model pinned
  `UNTIL: Forever`, so OLLAMA never evicts them; the "warm-up" finds the model loaded and is a
  1-token round trip. **No code change.** ⚠️⚠️ **`v90_n` originally wrote "never evicted" and that
  was FALSE — corrected at `v90_o`.** The APP evicts them itself: item AU's idle release (`v88_l`)
  unloads after 60 idle minutes, and the user's own log ends `Idle 60m — releasing models from
  VRAM` / `Released 4 model(s)`. So 565ms is the cost on a LOADED model; a warm-up after an idle
  release really does pay the 22GB reload. Conclusion unchanged (that reload is necessary work),
  but the generalisation was wrong.

✅ **THE SUITE AUDIT IS COMPLETE — FIVE PASSES, AND NOTHING IS OWED FROM IT.**

- `v90_b` — 17 mutations of app behaviour; 9 survived the whole suite; 7 guard files repaired. Two
  guards were asserting against their own re-implementation.
- `v90_c` — the seven it left over; **four were false positives.**
- `v90_d` — the same-answer blind spot: `tools/branch-mutation.js`, 86 functions / 1000 mutants,
  46% caught, 14 zeros.
- `v90_e` — three of those were caught elsewhere, five repaired, four set aside.
- `v90_f` — the four: `startLesson` 10/10, `goLessonSet` 8/10, `doDialectImport` 20/28,
  `renderEx` 19/28. Driven through `loadClient`, not lifted.

**Ask the user what they want next.** If they want more of this, re-run the probe rather than
working from any list in these documents:

```
node tools/branch-mutation.js --discover --out /tmp/res.json --max 10
```

⚠️ **FOUR THINGS THE AUDIT LEARNED THE HARD WAY**, in the order they bit:

1. **A missed extraction-helper name INFLATES the zeros.** `v90_d` scored `qcProse` 0/16 because the
   probe knew `ext`/`extract` but not `lift`. Check `discover()`'s pattern before trusting a zero.
2. **Do not guess which other test covers a function.** `v90_d` wrote that `renderEx`/`startLesson`/
   `goLessonSet` were "almost certainly" covered by `smoke-render`. It caught none of them.
3. **Judge the survivor list, do not count it.** Equivalent mutants are real and unkillable — a
   mutually-masking pair of defensive guards, a `typeof x === 'function'`, and especially
   ⚠️ **`if (el)` guards under `lib-dom`, whose `getElementById` AUTO-VIVIFIES a miss**, so the
   element is never null in that harness.
4. **Run the probe on a COPY** (`MUT_ROOT`), and when escalating a mutant to the suite, rebuild
   `docs/` first or subtract `unit-static-freshness` — every `index.html` mutant reddens it for the
   byte change, not the defect.

⚠️ **A RESTORE STEP MUST NEVER BE A VCS COMMAND.** At `v90_g` a mutation helper written inline used
`git checkout -- index.html` to put the file back between mutations. That restores from the INDEX,
so it discarded every unstaged change in the working tree — four completed UI tasks, in one command.
The work was rebuilt from the transcript, but the rule is cheap to keep: copy the bytes first and
copy them back, the way `mut.sh` and `tools/branch-mutation.js` already do. A VCS restore cannot tell
the mutation from the work.

⚠️ **THE USER TRANSLATES `ui.json` BY HAND.** Ask for an explicit key budget before adding any `en`
key, and say what each one buys. `v90_g` was granted three of a proposed four and shipped the other
four requests at zero — the two relocation mechanisms (`_editMenuSync`'s registry and
`_cardEditPopHtml`) take each row's label from the button's own `title`, so moving a control into a
menu costs nothing. Reach for those before asking.

⚠️ **IF `unit-translation-stamp` IS RED, THE USER HAS NOT RESTARTED THEIR SERVER YET.** `v90_g`'s
`/api/save-translation` stamped `origin: 'user-provided'` without setting `userTranslation`, breaking
the corpus invariant that the field must exist. `v90_h` fixed the route and added a boot heal for the
rows already written that way — it runs when the server starts. One chapter
(`tp_17886338472190000441`) was affected. Their `lessons.json` is uncommitted working data; do not
write to it to "fix" this.

⚠️ **A TOOLTIP THAT MOVES INTO AN EDIT MENU BECOMES VISIBLE TEXT.** `_editMenuSync` and
`_cardEditPopHtml` take each row's label from the button's own `title` — that is what makes a
relocation cost zero keys, and it is also why a hardcoded English `title` that was invisible as a
tooltip becomes an English label in every language. Before moving a control into a menu, check that
its title comes from `t()`. Four did not at `v90_g` and were given existing keys at
`v90_h`; the fifth — the 🔍 story-QC button — had no existing fit and got the one granted key at
`v90_i` (`qc.story_btn`, named for its sibling `qc.summary_btn`). `unit-storyline-edit-menu` §7 now
walks `_EDIT_MENUS['ls-story'].rows` and fails if a row has no `t()`-backed title listed, so a sixth
button cannot repeat this.

✅ **THE i18n AUDIT IS RE-DERIVED AND ITS NUMBERS ARE NOW DEFENSIBLE** (`v90_k`, full method in the
roadmap): **86 distinct CERTAIN findings** — 35 markup title/placeholder attributes `applyUIStrings`
never writes, 10 literals passed to `showToast`/`confirm`/`alert`, 10 markup text nodes nothing ever
addresses, 31 literal attributes on elements with no id — **plus 60 undecided** (markup text with
some writer; a hand-check of 27 found about half genuinely localized). The earlier "143" mixed
fallbacks and already-localized elements into the same list.

⚠️ **Before spending keys, re-measure the class you are about to touch.** The client localizes
through at least four idioms, and a regex mis-classifies in both directions. The measurable oracle:
`getElementById` AUTO-VIVIFIES, so an element the harness returns starts blank — run
`applyUIStrings()` and a value present means it wrote there. Scripts are in the `v90_k` scratch work
and the method is in its roadmap entry.

⚠️ **`build-static.js` RE-IMPLEMENTS CLIENT FUNCTIONS, AND THAT HAS NOW COST THREE RELEASES.**
`v90_j` is the latest: the whole library sort was dead in `docs/` because its handlers lived above
`@static-exclude-start` and the static `loadSavedList` had its own ordering. When a client behaviour
must exist in both builds, MOVE it below `@static-exclude-end` and call it from both — do not teach
the copy. And guard it against `docs/index.html`, not against `index.html`: every check that missed
this one was driving the source.

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
node test/run.js                          → expect 374 checks
node test/run.js --quick                  → expect 308
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

Corpus at this cut: **361 topics, 100 storylines, 33 languages, 746 `en` keys** — an inherently live
snapshot; re-measure fresh at commit time. `APP_VERSION = 'v90_v'`.

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
