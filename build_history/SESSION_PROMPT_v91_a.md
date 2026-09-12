# Session prompt — written at the `v91_a` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. The base cut is the bare number and is implicitly `a`, so point releases run
`v89_b`, `v89_c`, … A bump to a new BASE (`v90`) needs its own roadmap, per the protocol.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v91_a`**. `roadmap_v91.md` was cut at
`v91` — as a RECONCILIATION, see below — and is the current roadmap. **`roadmap_v90.md` is kept as
the record for the whole `v90` line** (`v90`…`v90_aa`, twenty-seven point releases): go there for how
anything in it was built, or why a guard is shaped the way it is.

**IMPORTANT — the user is translating `ui.json` locally by hand.** Before adding or editing ANY `en`
key, tell them explicitly and let them pause first. Every cut in the `v87` and `v88` lines asked
first and was given an explicit budget, often smaller than proposed. **Ask again fresh THIS
session** — and try ZERO first: whole stretches of the `v88` line (`v88_ab`, `v88_ad`, `v88_af`,
`v88_ag`, `v88_ai`, `v88_al`, `v88_am`) shipped real features with no new keys at all, by reusing
strings the app already had. **`v90_z` was granted a budget of FOUR and spent ONE**, by proposing
that one key on its own with what it bought, and reusing existing strings for the other three fixes.

⚠️ **THE CHECK BEFORE WRITING THE FILE IS `git status --short ui.json`, NOT the `git log` date.**
A CLEAN status means there is no in-flight hand translation to clobber; a dirty one means STOP and
ask. (It was clean at the `v90_m` and `v90_z` cuts, and both wrote safely.) Add to **`en` only** —
the translated blocks word these differently, so a replace that matches more than once is a bug, not
a convenience.

⚠️⚠️ **BEFORE SPENDING A KEY ON A "NEW" FEATURE, CHECK WHETHER THE FEATURE ALREADY EXISTS.** Twice
in the `v90_z` session a request for a new mechanism turned out to be a request for an existing one
that was merely unreachable — see WHERE TO START below. Zero keys were needed for either.

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

## What the `v90` line was, in one screen

**Twenty-seven point releases** (`v90`…`v90_aa`). ⚠️ **`roadmap_v90.md` is the record for that line**
— go there for how any of it was built. `roadmap_v91.md` (the current one) carries the protocol, the
open items and the RULES, but none of that history. What it closed:

- **A five-pass mutation audit of the SUITE itself** (`v90_b`…`v90_f`), including
  `tools/branch-mutation.js`. Nothing is owed from it.
- **The `⚠ Ollama unreachable` flapping** — IPv6 loopback, never the wlan (`v90_l`), plus the two
  loose ends that left (`v90_n`).
- **The i18n audit re-derived**: 86 CERTAIN findings, not the earlier 143 (`v90_k`).
- **ONE INPUT FIELD for the generation wizard** and the whole bottom-bar rework (`v90_s`…`v90_y`,
  `v90_aa`).
- **Scraping a story straight from a URL**, including Wikipedia through its own API
  (`v90_m`, `v90_q`, `v90_r`).
- **The four user-reported issues it was handed** (`v90_z`) — all-null text analysis, the tutor's two
  silent drops, phrase-level analysis display, and the vocabulary article asymmetry — ⚠️ **one of
  which was reported closed and then WITHDRAWN at `v90_aa`; see below.**

⚠️⚠️ **THE v91 CUT WAS MADE AS A RECONCILIATION, AND IT FOUND REAL DRIFT.** Two whole sections (325
lines) had been carried through the entire `v90` line as *"SPEC ONLY, NO CODE"* and *"MEASURED, NOT
BUILT"* — both had shipped inside that same line. Carried items **`V`** and **`E`** both read "still
open" while `roadmap_v89.md` recorded them shipped. And the protocol's own item 7 had said "this is
that roadmap for `v88`" for three release lines. **Grep each open section's heading, and each carried
item's letter, against the shipped lists at every cut** — that is `v90` rule 8.

# WHERE TO START

✅ **THE VOCABULARY ARTICLE CHECK IS BUILT AND SHIPPED (`v91_a`).** It is propose-only, it flags 8 of
8 on the chapter the shipped QC passed clean with 0 of 4 false findings, and the ⚓ button sits beside
🔍 on each vocabulary lesson. Full write-up in `roadmap_v91.md`'s `v91_a` entry.

⚠️ **WHAT IS STILL OWED IS THE BACKLOG, NOT THE CHECK**: **126 asymmetric pairs across 21 chapters**
already in the corpus. No code fixes those — the pass has to be run and the proposals accepted.
Re-derive with `node build_history/probe_article_symmetry_v80j.js`. And separately, only **51 of 660**
vocab lessons have ever had ANY QC run at all.

⚠️⚠️ **THE METHOD LESSON, worth more than the feature** — `v90` rules 1 and 2, and this session
proved both twice over:
- **`v90_z` used a measurement to argue AGAINST building this, and the measurement was a
  correlation.** The confirming experiment was named in its own write-up and never run. The user's
  live test refuted it in a day. **Run the falsifying experiment FIRST.**
- **"It exists" is not "it works."** `qcCheckPair`'s article rule existed for releases and measured
  **0 of 8**.
- ⚠️ **And the one from building it: THE SUB-SKILLS WERE NEVER THE PROBLEM.** The model detects an
  article 9/9 and produces the right one 6/6 — but asked to do both at once it scored 4/7, and asked
  for two verdicts in one reply the two answers CORRELATED. **Decompose before rewording**; six
  shapes were measured before one worked.

**Everything else genuinely open is small, and all of it is listed in `roadmap_v91.md`'s SHORT LIST.**
The four worth knowing at a glance:

1. **⚠️ `.bmodels-pop` carries a latent STACKING bug** (`v90_aa`) — it lives inside `#bottom-bar`,
   which is a stacking context, so it can never out-rank the body-level `#tutor-widget`. Same bug
   that moved `#jobs-pop` out of `#jobs-fab`. **Needs a live check with both panels open.**
2. **⚠️ A NEW i18n CLASS: a PRESENT key written TOO EARLY.** The account badge rendered the literal
   `acct.signin` — the key has always existed; it was written before `loadUIStrings()` resolved.
   **`v90_k`'s audit can never find this class: it looks for ABSENT keys.** One instance fixed, the
   class not swept.
3. **⚠️ ELEVEN `en` keys await hand translation** — ten measured at the `v91` cut plus
   `qc.btn.articles`, which `v91_a` spent (granted, proposed on its own). Absent from every one of
   the 32 translated languages: `pdf.no_article`, `form.gen_input_lbl`, `form.gen_scan`,
   `form.gen_drop_one`, `form.fetch_url`, `qc.story_btn`, `text_explorer.phrase`,
   `translation.opt_edit`, `translation.opt_regen`, `toast.translation_saved`, `qc.btn.articles`. ⚠️ `v90_aa` said
   "three" because it counted only the keys it had ADDED — a different question from what is still
   untranslated. **Re-derive, never carry the number** (the command is in the SHORT LIST).
   ⚠️ Otherwise the backlog is in far better shape than the `v90` line claimed: 28 languages are
   exactly these 10 short, `tr`/`hi`/`hr` 11, `ko` 20 — against a carried claim of "59… 75–110".
4. **`translate-select`** is deliberately outside the wizard's input field (it takes no input text).
   Confirm or move it.

⚠️ **THE FOUR-LEVEL ANALYSIS BROWSING IDEA IS A ROADMAP ITEM, NOT STARTED** — the user's own framing:
paragraph → sentence → phrase → word. `v90_z` shipped only the one-token fix, deliberately, and the
phrase rung now exists and is proven.

---

⚠️⚠️ **THE METHOD LESSON FROM THE v90 LINE, worth more than any of its fixes** (`v90` rules 1 and 2,
in `roadmap_v91.md`): **when a measurement is used to talk someone OUT of building something, run the
experiment that would falsify it FIRST** — especially when you have already written down what that
experiment is. And: **"it exists" is not "it works"**, and only the second licenses a decision. Both
halves cost a release in the same session.


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
2. `build_history/roadmap_v91.md` — its **index table** and **⚠️ Session protocol** block first, then
   **"🥇 OWED RIGHT NOW"** and **"🆕 THE SHORT LIST"**, then the standing RULES (which now include a
   block for the `v90` line).
3. **The older roadmaps are each kept as the record for their own line** and are NOT superseded:
   `roadmap_v90.md` (`v90`…`v90_aa`), `roadmap_v89.md` (`v89`…`v89_an`), `roadmap_v88.md`
   (`v88_a`…`v88_am`) — which also holds **TRACK T** and **THE LARGER PLAN**, cited throughout as
   `PLAN §X` — and `roadmap_v87.md`, which holds the `v87` line's own rules block.
4. `INTERNALS.md` **§6b, the feature → function map** — read it BEFORE grepping for where anything
   lives. Current through `v90_aa` (the wizard router, the bottom bar, `news-article.js`, CP2's
   output budget, the tutor's silent drops, phrase display, and the bar's panel anchoring).

## Establish a green baseline before changing anything

**⚠️ Run `node build-static.js` at EVERY release, even a server-only one.** `APP_VERSION` lives in
`server.js` and is BAKED into `docs/index.html`, so "no client change → no rebuild" is wrong and cost
a red suite at `v88_g`. `unit-static-freshness` will NOT catch it (it compares the eight baked
inputs, and `server.js` is not among them); `unit-version-derivation` is the one that does.

```
node test/run.js                          → expect 383 checks
node test/run.js --quick                  → expect 315
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

Corpus at this cut: **363 topics, 101 storylines, 33 languages, 748 `en` keys** — an inherently live
snapshot; re-measure fresh at commit time. `APP_VERSION = 'v91_a'`.

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is usually the thing
> to fix** — but diagnose which side is wrong first, and remember the user's live server is the most
> common cause of a moved corpus count.

## The habits that cost this project the most

The standing rules live in `roadmap_v91.md`: "Rules earned in session 28…34" plus dedicated blocks
for the `v83`/`v84`/`v85`/`v86`/`v88` lines, **SEVENTEEN from the `v89` line** (eleven from its first
half, six more numbered 12–17 from its second), and **NINE from the `v90` line**. Read the
**"⚠️ How the rules are NUMBERED"** note before citing one. The `v87` line's block is in
`roadmap_v87.md`.

⚠️ **The `v90` block's first two are the ones this project keeps re-learning**: run the falsifying
experiment BEFORE using a measurement to argue against building something, and **"it exists" is not
"it works"**.

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
