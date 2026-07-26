# v70 — session 1 notes

Continues from the v69 line (18 point releases, v69_b → v69_t; full history in
`v69_session1_notes.md`, notes 1–24). Roadmap: `roadmap_v70.md`.

## 0. ✅ v70 — the cut (pure version bump)

Clean cut after the long v69 line, per the user's request to start a fresh session from a true
baseline rather than a repeatedly-patched roadmap.

- **No behavioural change.** Only `APP_VERSION` in `server.js` (`v69_t` → `v70`) and the derived
  static build changed. Suite stayed green throughout: **133 registered steps** (see the correction
  below — this entry originally said 152), `check-inline` 0 on both `index.html` and
  `docs/index.html`. Both builds report `v70`.
- **Fresh roadmap** `roadmap_v70.md` written: carries forward every open item from the v69 roadmap
  (the single outstanding translation key `teacher.render_error`; the browser-verification pass,
  especially the empirical PDF model-cleanup tuning; the TLS banner; word-game lesson types;
  per-learner prefs; the concept graph; the two external/native-review waits), plus a new
  "Lessons the hard way" section distilling what the v69 line paid for (strip scripts before
  structural scans; probe the live element for render/layout bugs; verify LLM output against a
  contract; model every generator in the fake backend; scope assertions to usage not mention;
  one server at a time on the pid-derived port; the two builds diverge). The session protocol block
  is carried forward verbatim, with one addition: render paths must get a `smoke-render` case.
- `roadmap_v69.md` is now a closed archive.

Nothing else was touched. The next entry in this file will be the first real v70 change.

## 0b. ✅ Check-count figure corrected (docs only, v70 session 2)

The v70 cut recorded **152 checks**; this tree runs **133**. Ruled out the alarming reading first:
every one of the 128 `test/*.test.js` files on disk is wired into `run.js`, and `run.js` holds no
dangling reference to a file that isn't there — missing tests would fail loudly, not shrink the
count silently. 133 = 128 test files + 5 static checks (`server.js --check`, `check-inline` ×2,
`ui.json` parses, `lessons.json` parses).

**Where 152 came from is not recoverable from this tree, and the guess doesn't survive contact with
the harness.** `run()` writes exactly one `▶` per step and one `✓` per passing step, so on a green
run the ✓ tally and the registered-step count are the SAME number — measured, both 133. A
"✓ lines vs. steps" accounting difference therefore cannot yield 152. The earlier v69 figures
(141 → 147 → 148 → 150) are left **untouched on purpose**: those trees are archived and neither the
user nor a fresh session can re-derive them, so silently restating them would replace one
unverifiable number with another.

**Root enabler, and the thing to fix if this recurs:** the runner reports no total at all. Its
summary is a bare `ALL CHECKS PASSED`, and the failure branch prints the count of *failures*. Any
figure in these docs is therefore a hand-derivation and will drift again. Quote it reproducibly —
`node test/run.js | grep -c '^✓'` — or make the harness self-reporting (print the step count in the
summary line), which would end the drift permanently. Deliberately NOT done here: it changes test
output and belongs in its own change, not bundled into a docs correction.

Docs only — no code, data, `ui.json` or static-build impact. Suite re-run after the edit: 133 green,
`check-inline` 0 on both builds.

## 0c. ✅ v70 — the runner reports its own check count

The follow-up §0b flagged and deliberately deferred. §0b fixed a wrong number; this removes the
conditions that let a number be wrong.

**The change.** `run()` gained a counter at its single entry point, and both summary exits now go
through one `summaryLine(total, failures)`:
- green: `ALL CHECKS PASSED (134 checks)`
- failing: `FAILED 2 of 134: unit-foo, e2e-bar`

The old failure line was `FAILED (2): …` — a bare parenthesised number that reads like a total but
is the failure count. Both figures are now legible, and `of N` names which is which.

**Why `summaryLine` lives in `test/summary.js`.** A test that exercised the summary by executing
`run.js` would make the suite re-enter itself — that test is one of the runner's own steps. Putting
the logic in a plain module (not `*.test.js`, so the runner does not pick it up as a step) lets
`unit-run-summary` drive it directly. That is the honest scope: the formatting and the wiring are
tested; "the printed total equals the steps executed" is guaranteed by construction — one increment
site, inside the one function every step passes through — and asserted as such rather than
simulated.

**Verified by breaking it, three ways** (scratch copies, working tree untouched):
- a deliberately failing test → `FAILED 1 of 122: unit: word-count tokenizer (item 8)` on `--quick`.
  Note the 122: the total reflects what actually RAN, so `--quick` honestly reports fewer steps.
- reverting the summary to the bare string → `unit-run-summary` fails on the both-exits assertion.
- deleting the `total++` → fails on the single-increment-site assertion.

**Counter declared before `run()`, not after.** It works either way here, since the first call
happens later — but "the call happens later" is precisely the assumption the v68.1 TDZ crash
disproved, so the hazard is removed rather than reasoned around.

Suite: **134** (129 test files + 5 static checks), `check-inline` 0 on both builds. No `ui.json`
keys, no client or data change, so no static rebuild and no version bump (not a release point).
The roadmap's baseline step now says to QUOTE the summary line rather than derive a figure.

## 1. ✅ v70_b — insecure-transport warning (learner accounts over plain HTTP)

**The gap was never the auth.** `learners.js` is solid at rest: scrypt with a per-user salt,
timing-safe comparison, 256-bit session tokens stored only as SHA-256, HttpOnly + SameSite=Lax,
per-username throttling. None of that protects the wire, and the file said so — at lines 14–16, in
a source comment. Nobody provisioning accounts for a class reads `learners.js`.

**What made it live rather than theoretical:** `server.js` binds `0.0.0.0`, so the app is on the
LAN the moment it starts. Over plain HTTP the password crosses in the login body and the session
cookie crosses in the header of *every* subsequent request. The cookie is the worse leak — same
authority as the password, on the wire constantly rather than once, valid for 30 days. The v69
teacher dashboard is what promoted this from latent to urgent: it turned accounts from a shipped
feature into something a teacher actually hands to students.

**Shipped:**
- `isSecureRequest(req)` — direct TLS or a proxy's `X-Forwarded-Proto`. Now the ONE definition,
  used by both the cookie's `Secure` flag and the warning, so the two cannot disagree about what
  counts as encrypted.
- `isLoopbackHost(host)` — `localhost`, `127.0.0.0/8`, `::1` bare and bracketed, with or without a
  port. Loopback is exempt: that traffic never reaches an interface.
- `transportInsecure(req)` = not TLS and not loopback. Exposed per-request on `/api/info`.
- Client banner in the account modal, keyed off that flag, text from `acct.insecure`.
- `warnInsecureTransport()` — console warning, latched once per process, fired from
  `/api/auth/register` and `/api/auth/login`.

**Decisions worth keeping:**
- **Guidance, never a gate.** Registration and sign-in still succeed over plain HTTP; the e2e
  asserts the 200 explicitly. Blocking would break LAN-without-TLS, which is a supported
  deployment — the same reasoning that keeps the `Secure` cookie flag conditional.
- **The warning fires BEFORE authentication,** not after a successful login: a failed attempt put
  the password on the wire too.
- **Latched once per process.** A warning repeated on every request is a warning nobody reads.
- **The banner shows while signed in as well as signed out.** The password is no longer in play,
  but the session cookie still crosses the wire on every request.
- **A missing Host header counts as remote.** We cannot prove such a request is local; a spurious
  warning costs a console line, a missed one costs a password.
- **The warning names a remedy.** X-Forwarded-Proto was already honoured, so putting a TLS
  terminator in front makes the cookie `Secure` automatically — the fix needed no code, only
  telling someone. The console text says so.
- **Tightened while passing through:** the old inline check was
  `String(...).includes('https')`, which accepts a forwarded chain whose *client-facing* hop is
  plain `http` and would have reported a clear-text request secure. The shared helper reads the
  first hop only. Guarded by an explicit `'http, https' → false` case.

**Guards (and each verified to FAIL without its fix, in scratch copies):**
- `unit-tls-transport` — 30 predicate cases including the prefix hole (`127.0.0.1.evil.com` must
  not read as local) and the proxy chain, plus the wiring. Un-anchoring the 127.x regex fails it;
  restoring `.includes('https')` fails it.
- `e2e-tls-warning` — the real server, real Host headers: loopback=false, LAN=true,
  proxied-TLS=false; registration over the LAN succeeds AND warns; the warning names the host and
  the remedy; a second registration does not repeat it.
- `smoke-render` §8 — the modal across four states: insecure/signed-out, secure, insecure/signed-in,
  and **flag absent** (an older server or the static build) which must hide, not false-positive.
  Making the banner ignore the flag fails it.

**How to see it work** (browser-only; the checklist is a closed archive, so it lives here):
1. `node server.js`, open `http://localhost:PORT`, click the 👤 badge → **no banner** (loopback).
2. Open `http://<your-LAN-ip>:PORT` from another device on the network, click 👤 → **amber banner**
   above the sign-in form. Sign in anyway; it works.
3. The server console prints the `⚠️ INSECURE TRANSPORT` block once, naming that host.

**Static build:** the markup is baked in but the flag never appears (no server), so the banner
stays hidden — which is exactly the "flag absent" smoke case. The account badge is hidden there
anyway.

**i18n:** one new key, `acct.insecure`, English only per the standing rule. Debt is now two keys
(`teacher.render_error`, `acct.insecure`) × 29 languages; one `translate-ui.js` run clears both.
`--qc` reports 0 structural defects.

**Noticed, deliberately NOT fixed here:** seven `e2e-*` tests are registered outside the
`if (!quick)` block, so `--quick` spawns servers for them despite the header promising otherwise.
The v70_b e2e was placed correctly inside it. Logged in the roadmap as its own change, so the
resulting count shift stays attributable.

Suite: **136** green (`--quick` 123), `check-inline` 0 on both builds, static rebuilt, both builds
report `v70_b`.

## 2. ✅ --quick actually skips the server-spawning tests (test hygiene)

`run.js`'s header promised `--quick` "skip[s] the e2e (server-spawning) tests". **Six** of them were
registered outside `if (!quick)`, so `--quick` spawned servers anyway. (The roadmap said seven; that
count included the v70_b e2e before it was moved. Corrected.) Moved all six inside:
`e2e-mixed-lesson-edit`, `e2e-rating-edit`, `e2e-pass-mark`, `e2e-text-cleanup`,
`e2e-teacher-dashboard`, `e2e-book-duplicate-titles`.

`--quick` went 123 → **117** steps and now runs in ~10s with no server spawned. Full suite unchanged
at **136** — nothing was dropped, only re-homed.

**Guard: `unit-run-summary` §6**, which asserts no server-spawning test is registered before the
`--quick` block, plus a non-vacuity check that the block still contains some. Detection is by
BEHAVIOUR (does the file require `test/lib.js` and call `boot()` / `startFakeOllama()`?) rather than
by the `e2e-` filename prefix, since a prefix is a convention and conventions drift. Verified to
fail by pushing `e2e-rating-edit` back outside.

**Worth recording — I walked straight into a documented trap.** The first cut of the detector was
`/\bboot\s*\(|startFakeOllama/` against raw file text, and it flagged `unit-qc-skip` and
`unit-qc-correct`, which merely *discuss* server.js's `boot()` in comments. That is the roadmap's
"over-broad source assertions match explanatory COMMENTS" lesson, now recurred a third time in this
line. The fix scopes to usage: require of `./lib.js` as a precondition, then a comment-stripped
search for the call. The lesson stands and evidently needs the emphasis it has.

**Cross-check worth keeping:** with the detector correct, behaviour and naming agree exactly — 19
server-spawning tests, all named `e2e-*`, and no `e2e-*` file that does not spawn one. The
convention is currently honest.

No client, data, `ui.json` or version impact — test harness only. Suite **136** green, `--quick`
**117**, `check-inline` 0 on both builds.

## 3. ✅ Crossword, stage 1 — the layout engine (library only, not yet wired)

**Why staged.** A crossword needs a layout engine, registry wiring, and an interactive render. The
protocol requires a `smoke-render` case for any render path, and registering a lesson type whose
exercise nothing can draw would be worse than not registering it. So stage 1 is the engine alone:
the hard part, pure, and testable without a DOM. The tree stays green and shippable throughout.

**`_crosswordLayout(pairs, seed)` in `index.html`** returns
`{ width, height, entries:[{num,row,col,dir,answer,display,clue,len}], skipped }`.

**Decisions worth keeping:**
- **Deterministic, seeded by lesson id.** `shuffle()` uses `Math.random()`, so a grid built with it
  would re-roll on every render — the puzzle changing under the learner mid-solve, and the qid
  (which keys the solved-bit) changing with it. `_crosswordRng` is a mulberry32 seeded from the id.
- **Placement is the standard rule set:** a word must CROSS an existing word at a matching letter;
  the cells immediately before and after it must be empty; and every new cell's perpendicular
  neighbours must be empty. That last rule is the one people forget — without it two across words
  on neighbouring rows spell unintended vertical pairs.
- **Longest first**, seeded jitter only to break ties: long words offer the most crossings, which
  keeps the grid connected.
- **A retry pass.** A word rejected early was judged against a nearly empty grid, so rejects are
  retried until a full pass places nothing. On the 8-word sample it did not change the outcome —
  those three genuinely cannot be placed under the adjacency rule — but it costs little and helps
  on sets with more shared letters.
- **Words that cannot cross are SKIPPED, not dumped as islands**, and reported in `skipped` so a
  caller can tell the learner which words are not in the puzzle.

**Script limits — a real limitation, not an oversight.** Latin/Cyrillic/Greek (plus combining
marks, so accents survive) only. Han/Kana/Hangul are out because one glyph per cell is not a
puzzle. **Arabic and Hebrew are out of this slice** because letters reshape contextually and the
grid geometry is RTL; that deserves its own change rather than a guess. The practical consequence:
the whole word-game family will be unavailable for those languages until someone decides how it
should look. Recorded in the roadmap.

**Guard: `unit-crossword-layout`** — 6 sections. Grid well-formedness is checked by REBUILDING the
cell map from the returned entries and asserting crossing letters agree, the bounding box is tight,
no word abuts another in its own direction, no cell touches perpendicular without belonging to an
entry in that direction, and every entry crosses at least one other. Plus numbering convention
(shared start cells share a number; 1..n in reading order), determinism, degenerate input
(empty/null/unusable/isolated/duplicate/clue-less), and a **placement floor** — the structural
rules are all satisfied by a grid holding one word, so without a floor a regression that placed
almost nothing would pass silently.

**Sample output** (8 German words, 5 placed, 3 unplaceable):
```
S T E R N .
O . . . . .
N A C H T .
N . . A . .
E . H U N D
. . . S . .
```

**Not done, deliberately:** no `LESSON_TYPE_META` entry, no `renderEx` case, no `_qidCanonical`
case, no `ui.json` keys, no authoring entry point. Stage 2 and 3 are itemised in the roadmap.
**Released as `v70_c`** at the user's request. Note what that version does and does not mean here:
the engine is a tested library with no caller, so `v70_c` carries no user-visible change over
`v70_b` — it marks the cut, not a new behaviour. `index.html` changed, so `docs/index.html` was
rebuilt and both builds report `v70_c`.

Suite **137** green (`--quick` 118), `check-inline` 0 on both builds.

## 4. ✅ v70_d — crossword play mode (stage 2, option C)

Built as a **mode over an existing vocab lesson**, not a lesson type. A 🧩 button on any qualifying
lesson node opens `openCrossword(idx)`; `checkCrossword()` validates; `closeCrossword()` exits.
No `LESSON_TYPE_META` entry, no `editorBranch`, no `_qidCanonical` case, no new qid universe, and
no authoring flow — stage 3 was rendered obsolete rather than built.

**The design in one line:** a crossword is a different WAY TO ANSWER a question the lesson already
asks, so solving an entry credits the lesson's own `mcq_source_target` question for that word.
Coverage moves per word; the denominator does not grow.

**The bug this session nearly shipped, and the lesson in it.** The first credit path found its
target by REBUILDING the lesson (`lessonTypeMeta(L.type).build(...)`) and matching on `ex.target`.
That is wrong: **`build()` samples.** It emits a round, not the full question set, and a different
subset every call — which is precisely why `_lessonQidUniverse` derives the union over up to 120
builds until it stops growing. So the rebuild path credited a random ~half of the words solved, and
which half changed per call.

The fix synthesizes the exercise shape instead and lets `qid()` key it. The canonical form of a
translation question is `(target, source)`, so the synthesized id is byte-identical to the real
question's — the same trick the v69.1 drill credit-back uses, applied across types within one
lesson rather than across lessons. Membership in `_lessonQidUniverse(idx)` is then checked, so a
solved-bit can never be invented for a question the lesson does not ask.

**The guard had to be fixed too, which is the more useful lesson.** The first version of the test
solved ONE entry and asserted it credited something — and the buggy code passed that **two runs in
three**. A flaky guard is worse than none: it would have gone green in CI and failed for a learner.
The deterministic version asserts (a) EVERY word in the lesson is creditable, which the sampling
bug can never satisfy since a build contains only a subset, and (b) repeated calls return the same
answer. Verified: the reverted bug is now caught on 5 runs out of 5, where before it was 1 in 3.

**Crediting is deliberately conservative.** `CROSSWORD_CREDIT_TYPES = ['mcq_source_target']` only.
Producing a written target from a source clue is exactly what that question asks. Audio types are
NOT credited — the learner never heard the word — and over-crediting would let someone pass a mark
without demonstrating what the mark claims.

**Other decisions:**
- Minimum 3 placeable entries, else `openCrossword` declines with a toast rather than opening an
  empty grid.
- Offered only on `standard`/`vocab`/`mixed` lessons that actually have crossable words;
  `_crosswordAvailable()` short-circuits at the threshold rather than laying out a grid per row.
- The button sits OUTSIDE the `_canEdit()` block — this is a learner feature, not a teacher tool —
  with `event.stopPropagation()` so it does not also start the lesson.
- Solved entries lock read-only and turn green; a wrong entry is simply not accepted, with no
  penalty and no state change.

**Test-harness notes for the next session:** the stub DOM does not parse `innerHTML`
(`querySelectorAll` always returns `[]`), so assert against the markup string; `getElementById`
persists stubs, which is what makes the type-and-check path executable. Values returned from
`C.run` belong to another realm, so `deepStrictEqual` against a local `[]` fails on prototype
identity — compare lengths or spread first. Both cost me a debugging cycle here.

**Known consequence of option C:** a crossword is not an assignable unit — it has no lesson node,
no editor presence, no dashboard row. If a teacher needs to assign "the crossword", that is option
B and a real piece of work.

**i18n:** ten new `crossword.*` keys, English only. Debt is now **12 keys × 29 languages = 348
entries**, `--qc` 0 structural defects. This is the largest outstanding item in the tree.

Suite **137** green (`--quick` 118), `check-inline` 0 on both builds, static rebuilt, both builds
report `v70_d`.

## 5. ✅ v70_e — the crossword was unreachable for the people it was built for

**User-caught, and a genuine miss.** v70_d put the 🧩 entry point on the lesson node. I placed it
outside the `_canEdit()` block specifically so learners would see it — but the gate was never the
issue: **learners never open the lesson-set page at all.** `_isLearner()` routing (v60, "skip the
lesson-set page") sends them straight into a lesson and, at the end, to the completion screen. As
shipped, v70_d's crossword could be opened by teachers only. The learner feature was learner-proof.

**Fix:** a `#comp-crossword` button on the completion screen, next to `#comp-drill`, shown whenever
the just-finished lesson can make a puzzle. `openCrosswordFromComplete()` resolves
`APP.cur.lessonIdx` at click time rather than baking an index into markup. The lesson-node button
stays for teachers.

**Offered to everyone, unlike the drill.** `#comp-drill` shows for a teacher OR a below-threshold
learner because it is remediation. A crossword is not remediation — and since it credits the same
`mcq_source_target` coverage, it doubles as another way up for a below-mark learner.

**Guard:** `smoke-render` §9 now asserts a LEARNER (`APP._teacherMode = false`) is offered the
button on the completion screen, and that it hides when the lesson has no crossable words. Verified
to fail by forcing the button hidden — which is exactly the v70_d state.

**Standing lesson, now in the roadmap:** *a learner-facing feature placed on the lesson-set page is
unreachable.* `_canEdit()` is not the gate that matters. Reachability must be checked against
`_isLearner()`. Worth remembering because the mistake was invisible to every automated check — the
button rendered fine, the smoke test passed, and the feature was still dead for students. Only
someone who knows the navigation model could catch it, which is an argument for describing WHERE a
new affordance lives when reporting a change, not just that it exists.

No i18n change (reuses `crossword.play`). Suite **137** green, `check-inline` 0 on both builds,
static rebuilt, both builds report `v70_e`.

## 6. ✅ v70_f — crossword UX: auto-advance, per-letter marking, reveal

Three user-requested changes, one of which exposed a bug worth naming.

**The bug behind request #2.** `_renderCrossword()` rebuilt the grid's markup wholesale, and the
`<input>`s it emitted had no `value` attribute — the typed letters existed only in the DOM. So
pressing **Check** erased everything the learner had entered, including the letters that were
right. The smoke tests passed throughout, because they typed and checked in one step and never
looked at the grid afterwards.

**Fix: the letters now live in session state.** `APP._cw` gained `typed` (per-cell letter) and
`mark` (per-cell verdict), plus `owner` / `sol` / `startNum` maps derived ONCE at open time instead
of being recomputed per render. The render writes `value=` back out, so a rebuild is lossless.

**1. Auto-advance.** `cwInput()` moves focus to the next cell of the current entry. Direction is
tracked in `S.dir` and set by `cwFocus()`: a cell shared by an across and a down entry KEEPS the
current direction if still valid, so typing through a crossing does not silently turn the corner.
Focus calls are `typeof`-guarded — the smoke harness's stub DOM has no `focus()`.

**2. Per-letter marking.** Check now judges every filled cell: green if it matches, red if not, and
nothing is cleared. Retyping a judged cell clears its verdict immediately (via `_paintCell`, which
repaints one cell in place rather than rebuilding — a rebuild would move focus mid-typing). Stale
red on a letter the learner has since changed would be actively misleading.

**3. Solve.** Fills the grid, marks everything green, locks every entry — and **credits nothing**.
`S.revealed` latches, and `checkCrossword()` skips crediting while it is set. Seeing the answer is
not demonstrating it, and coverage feeds the pass mark.

**A vacuous test, caught and fixed.** The first version of the reveal guard asserted that a Check
after Solve credits 0 — which passes trivially, since Solve marks every entry done and Check skips
done entries. Reverting the `!S.revealed` guard did NOT fail it. The real test un-marks one entry,
completes it by hand after the reveal, and asserts it is accepted as solved but credits nothing.
That version fails correctly when the guard is removed. **Worth remembering: an assertion that
passes for a reason other than the one you intended is indistinguishable from a passing test.**

**Stub-DOM note (second time this session):** the stub does not re-create inputs from `innerHTML`,
so its input stubs keep stale values and `_cwSyncFromDom()` overwrites anything written directly to
`S.typed`. Tests must write through `document.getElementById(...).value`, as a browser would.

**Guards:** `smoke-render` §9 now also covers letter persistence across Check, green/red marking in
both state and rendered markup, verdict-clearing on retype, auto-advance at a grid edge (must not
throw without `focus()`), and the reveal latch. Each verified to fail with its fix reverted.

**i18n:** two new keys (`crossword.solve`, `crossword.revealed`). Debt now **14 keys × 29 = 406
entries**, `--qc` 0 structural defects.

**Still not done, and only a browser can judge it:** whether auto-advance feels right at word
boundaries, whether 30px cells work on a phone, and whether the completion screen is now too busy
(Next / Back / drill / crossword).

Suite **137** green (`--quick` 118), `check-inline` 0 on both builds, static rebuilt, both builds
report `v70_f`.

## 7. ✅ v70_g — completion screen: one icon action row

**Layout.** `#comp-actions` is a single flex row holding drill · crossword · primary action, with
`Back to story` left below it as navigation rather than an action. Icons only; each button's former
text became its `title` AND its `aria-label` — an icon with no accessible name is unusable with a
screen reader and unguessable for everyone else. `_compIco(btn, icon, label)` sets all three in one
place so they cannot drift apart.

**Icons:** next `→`, repeat `↻`, drill `🎯`, crossword `🔠`.

**Two icon decisions worth recording:**
- The request suggested a circular arrow for the drill. Repeat and drill would then both be
  circular arrows sitting side by side meaning different things, so the circular arrow went to
  REPEAT (which is literally a replay) and the drill kept `🎯`, its established shipped icon.
- Crossword moved `🧩` → `🔠`. `🧩` is already the `word_forms` lesson type's emoji and `🔡` is
  `intro_script`'s, so the original choice was a collision. `🔠` is a letter grid, as asked, and is
  unused. Changed on the lesson-node button too, so both entry points match.

**Repeat below the pass mark — with one deliberate exception.** The replay branch now renders `↻`
with the `complete.repeat` tooltip. **Below the mark WITH a lesson still to play keeps the arrow**,
because that branch carries real progress: v69.2 fixed three separate user-reported dead ends by
making Next advance within the chapter, and turning it back into a repeat would recreate them. So
"repeat" means *stuck* below the mark — nothing left to play — which is the state the request was
really about. Flagged to the user rather than decided silently.

**No duplicate drill.** When the primary action already IS the drill (the last-resort branch), the
standalone drill button hides. Two identical targets side by side is noise.

**Three existing tests broke, correctly.** `unit-drill`, `unit-learner-nav` and
`unit-coverage-threshold` pin the drill-visibility expression as an exact source string, and it
gained a `!_nextIsDrill &&` term. Updated all three to the new expression with a comment explaining
the added term — the v60.8 gate they exist to protect is unchanged and still pinned.

**Harness improvement: the stub DOM now STORES attributes.** `getAttribute` used to return null and
`setAttribute` was a no-op, which made accessible names structurally untestable — a render could
set an `aria-label` and no test could ever observe it. `unit-report-edits` had already hand-rolled
its own attribute store to work around this, which was the tell. Now `lib-dom` keeps them.

**A conditional guard is barely a guard.** My first version of the repeat assertions was wrapped in
`if (replayTargetExists)` — and in the scenario I wrote, it did not, so reverting the repeat icon
was NOT caught. Rebuilt around a deterministic scenario (single completed lesson, coverage short)
that provably reaches the replay branch, with an explicit assertion that the scenario is what it
claims to be. All three reverts now fail correctly. Same failure mode as the vacuous reveal test in
v70_f, so it is worth stating plainly: **a guard that only sometimes evaluates is a guard that only
sometimes exists.**

**i18n:** one new key (`complete.repeat`). Debt now **15 keys × 29 = 435 entries**, `--qc` 0
structural defects.

**For the browser pass:** whether 56px icon buttons are comfortable on a phone, whether tooltips
are discoverable enough on touch (they are not, on most touch devices — if that matters, the icons
may need visible micro-labels), and whether `↻` reads as "repeat" without explanation.

Suite **137** green (`--quick` 118), `check-inline` 0 on both builds, static rebuilt, both builds
report `v70_g`.

## 8. ✅ v70_h — crossword: varying puzzles, word-pool options, keyboard, auto-check

**Why the fixed layout was wrong (user question, "is it always generated freshly?").** It was
regenerated on every click but seeded by lesson id, so the puzzle was byte-identical every time —
same grid, same words, and the SAME words permanently excluded (`BAUM`/`MAUS` never appeared in
that lesson's puzzle, ever). Since coverage marks are idempotent, a second play credited nothing.
v70_g had just promoted the crossword to one of three ways up to the pass mark, so a stuck learner
clicking 🔠 again got an identical grid they had already solved.

**And the reason for determinism had quietly expired.** The seed was fixed so the puzzle and its
qid would not shift mid-solve — but under option C the crossword mints no qids at all; it credits
the underlying vocab question keyed on `(target, source)`, which is independent of layout. The only
surviving requirement is "do not re-roll while the learner is looking at it", which needs stability
WITHIN an attempt, not across them. Worth noting as a pattern: a constraint inherited from an
earlier design outlived the design.

**Now:** the seed is `lessonId#attempt|src|count|preferWrong`. An attempt is fully deterministic;
`regenerateCrossword()` increments the attempt for a new selection and a new grid.

**Word-pool options** (below the action row, persisted in `APP._cwOpts` across opens):
- **count** — 5 / 8 / 12 / 20, floored at `CROSSWORD_MIN_ENTRIES`.
- **source** — `lesson` · `topic` (this and every earlier visible lesson) · `all` (the learner's
  whole `_learnedLedger` for the language pair, across every storyline).
- **favour words I got wrong** — sorts by the ledger's `wrong` desc, then least-`seen`, then seeded
  jitter. The jitter is load-bearing: without it a stable ledger would return the same top-N every
  time and Regenerate would be a no-op.

Changing an option regenerates immediately rather than applying silently at the next open.

**Crediting widened, honestly.** `_crosswordCreditable` now searches every lesson of the loaded
topic rather than only the one the puzzle was opened from — with `src: topic` the words legitimately
belong to earlier lessons and their coverage should move. Words drawn from the cross-storyline
ledger belong to topics that are not loaded, so they practise without crediting. That is a real
limitation, visible via the credited count rather than hidden.

**Keyboard:** arrows move (and set the typing direction), Backspace clears the current cell or, if
already empty, steps back and clears that one. Without this a grid of one-character inputs is
navigable only by clicking every cell.

**Auto-check** fires from `cwInput` once every cell holds a letter. Safe because Check never clears
anything — an early auto-check only colours what is there.

**Guards** (each verified to fail with its fix reverted): regenerate yields a different puzzle
while a given attempt stays deterministic; the count option caps the grid; the topic pool is a
superset of the lesson pool; the `all` pool reads the ledger; "favour wrong" puts the most-wrong
word first; Backspace clears; arrows do not throw where `focus()` is absent and a vertical arrow
switches direction; filling the last cell auto-solves every entry.

**i18n:** seven new keys. Debt now **22 keys × 29 = 638 entries**, `--qc` 0 structural defects.
This has grown fast across v70_d–h and really should have an offline `translate-ui.js` pass before
much more is added.

**For the browser pass:** whether auto-check feels abrupt (it fires the moment the last letter
lands), whether Regenerate should warn when a puzzle is part-solved, and whether the options row
fits a phone.

Suite **137** green (`--quick` 118), `check-inline` 0 on both builds, static rebuilt, both builds
report `v70_h`.

## 9. ✅ v70_i — crossword: mixed lessons (bug), synonyms and word forms

**The reported disappearance, diagnosed.** "The crossword option vanished after playing via
Repeat." Root cause: a **mixed lesson carries no `vocab` of its own** — its keys are
`id, type, title, icon, desc, perType`; it pools questions from earlier siblings at build time. So
`_crosswordAvailable` found zero words and hid the button. And a mixed-driven learner set resumes
into precisely that lesson, so Repeat led straight to the one place the crossword could never
appear. Not obsolete in v70_g — still present until this fix.

**Fix:** `_crosswordLessonPairs(L, idx)` gives a mixed lesson the union of its earlier, visible,
non-mixed siblings — the same rule `buildMixedExercises` and `_lessonQidUniverse` already use. The
"earlier" part is load-bearing and asserted: a mixed lesson at index 0 pools nothing.

**Widened to two more lesson types** (the same helper, so all three entry points benefit):
- **synonyms** → each `words[]` entry contributes `base ← gloss`, plus every synonym `w ← g`.
- **word_forms** → the correct choice, clued by its own blanked sentence. Malformed items (an
  out-of-range `correctIndex`) are skipped rather than throwing.

**Crediting followed, for word forms only.** `word_form`'s qid canonical is `(sentence, correct)`,
and the crossword clues that entry WITH that sentence — so solving it demonstrates exactly that
question, and it now credits. **Synonyms deliberately do NOT credit:** producing a word from its
gloss is not choosing between synonyms, and `syn_select`'s canonical is `(mode, base)`, a different
question. Practice without credit, consistent with the cross-storyline words.

**A test artifact worth recording, because it will recur.** The word-form crediting assertion
failed while the behaviour was correct: `_lessonQidUniverse` caches on `topic|lessonIdx` and
returns the cached Set *without re-deriving*, so an earlier scenario in the same smoke run had
already cached a universe for index 0 under the fixture's topic name. Swapping a lesson's content
under a fixed topic+index is something only a test does — real usage never does it. Fixed by giving
that scenario its own topic key. **Next time a smoke assertion fails on a universe lookup, suspect
the cache before the code.**

**Guards** (each verified to fail with its fix reverted): the mixed pool and its earlier-only rule,
the completion screen offering a crossword after a mixed lesson, synonym pairs including the
synonyms themselves, word-form pairs and their malformed-item skip, and word_form crediting.

No new i18n keys. Suite **137** green (`--quick` 118), `check-inline` 0 on both builds, static
rebuilt, both builds report `v70_i`.

## 10. ✅ v70_j — thin lessons top up from earlier ones

**From a real console dump**, which settled the question the fixtures could not:
```
0 standard(hidden)  words=8  offered=true
1 ai_error_hunt(hidden) words=0 offered=false
2 standard          words=1  offered=false
```
All three lines were CORRECT — no bug. But line 2 exposed a design gap: L2 is the only visible
lesson, its vocabulary is quizzed WITH the article ("der Hund"), so every entry is a two-word
phrase that cannot go in a grid. The learner therefore had no crossword at all, while eight
crossable words sat one lesson back. The `src: topic` option would have fixed it — but that option
lives inside the dialog they could not open. **An affordance nobody can discover is not an
affordance.**

**Fix:** `_crosswordEffectivePool()` — when a lesson's own crossable words fall below the grid
minimum, top up from this lesson and earlier ones. `_crosswordAvailable()` now asks the effective
pool rather than counting the lesson's own words, so the button appears exactly when a puzzle can
be built. The grid reports `topped: true` and the UI says so, because a learner should know why
words they have not met are in the grid.

**Two rules that keep it from over-reaching:**
- **A lesson must contribute at least ONE word of its own.** Without this, the top-up would offer a
  crossword on error-hunt, grammar and math lessons — anything in a topic with vocabulary
  somewhere. Verified against the reported `ai_error_hunt`, which stays excluded.
- **A word-rich lesson is never topped up**, so puzzles do not silently drift into earlier
  vocabulary the learner did not ask for.

**Availability moved from TYPE-based to CONTENT-based** — the change that made mixed, synonyms and
word-form lessons work in v70_i, now made explicit. One v70_d assertion had to be rewritten: it
fed an `error_hunt` lesson an artificial `vocab` array and asserted the type gate rejected it.
Under the content rule such a lesson would legitimately be offered; real error-hunt lessons carry
no vocabulary and are excluded by content. Updated to the realistic case rather than restoring a
gate the design had moved past.

**A topic is now threaded explicitly** (`_crosswordLessonPairs/Pool/Available(..., d)`) instead of
every path reading `APP.lessonData`. The lesson-set page can render a topic that is not the loaded
one, and the top-up must not consult the wrong topic's lessons.

**Not done — the article question.** Words like "der Hund" could be made crossable by stripping the
article and cluing with the full phrase. Deliberately not built: the answer would stop matching the
lesson's `target`, so crediting would silently break, and the article is part of what the lesson
teaches. If wanted, it needs a provenance field on each pair, not a regex.

**Guards:** the reported topic shape is reproduced verbatim in `smoke-render` §9 — thin visible
lesson, word-rich hidden lesson, error-hunt. Both halves of the rule verified by reverting each.

**i18n:** one new key. Debt now **23 keys × 29 = 667 entries**, `--qc` 0 structural defects.

Suite **137** green (`--quick` 118), `check-inline` 0 on both builds, static rebuilt, both builds
report `v70_j`.
