# Session prompt — written at the `v85_u` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v85_p`, `v85_q`, …) unless a future
session has a good reason to switch to `v86_a` instead.)*

**⚠️ THIS IS THE LAST `v85` SESSION PROMPT.** Per the user's own explicit instruction ("once we are
done with these, let's cut to v86"), `v85_u` closes the `v85` line. The next session should find
`roadmap_v86.md` already cut and `SESSION_PROMPT_v86_a.md` already written — if you are reading THIS
file instead, the cut did not happen; do it before anything else (see `roadmap_v84.md`'s own
`v84`→`v85` cut for the template, and the note at the end of this file).

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v85_u`**. This cut is the user's own
direct follow-up testing after `v85_t`: fix whichever of five new observations relates to C2's
geometry, evaluate and schedule the rest.

**What just shipped (`v85_u`)**:

1. **THE ZOOM/SCALING BUG — FIXED, and it was the actual dominant cause of C2's apparent
   misalignment**, not (only) the model. `#comic-draw-img` is responsive but the canvas overlay was
   only ever sized ONCE, at image load — no resize/zoom listener existed to re-sync it, a gap
   `_comicSetupCanvas()`'s own comment had named and never built. Fixed with a `ResizeObserver`.
2. **A real mobile-photo extraction crash — FIXED.** Neither comic vision call had ever asked Ollama
   for more than its 4096-token default; a photographed page's own vision-token cost can exceed that
   easily. Both calls now request the full configured ceiling.
3. **Progress-card comic panels — INVESTIGATED, confirmed ALREADY BUILT** (traced the full chain,
   `v85_n` did ship this). What's genuinely NOT built is mapping vocab highlighting onto the image
   itself (Tier 2 per-word coordinates) — still explicitly out of scope, still unscoped.
4. **Move comic images out of `lessons.json` — SCHEDULED.** A confirmed, measured violation of an
   EXISTING ruling (`D4`, from the `v80` cut) that the comic feature never implemented. 658KB of
   inline base64 measured right now, across 6 topics.
5. **A vision-role model picker — SCHEDULED.** Most of the server-side plumbing already exists
   (`/api/models` already accepts `vision`); only the client picker + a NEW capability-filter concept
   are missing.
6. **Comic/PDF upload-card UX reorganisation — SCHEDULED, with a recommendation.** Route both through
   the EXISTING `#gen-card-3`/`#gen-card-4` staged wizard the generated-book path already uses,
   instead of each having its own divergent immediate-generate shortcut.

Full diagnosis chains (exact measurements, file/line references, the reasoning behind each
recommendation) are in `roadmap_v85.md`'s `v85_u` entry — read it before re-deriving any of this.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v85.md` — its **index table** and **⚠️ Session protocol** block first, then
   the `v85_u` shipped entry (the LAST entry in this line — everything above it in "SHIPPED IN THE v85
   LINE" is history, not open work).
3. `INTERNALS.md` **§6b** — the comic-panel entries could use TWO new rows now (C1 resize from `v85_t`,
   the resize-sync fix from `v85_u`) — still not added, now two cuts overdue.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 284 checks
node test/run.js --quick                  → expect 246
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Corpus at this cut: **333 topics, 95 storylines, 33 languages, 686 `en` keys** (UNCHANGED from
`v85_t` — no new strings, no corpus edit). `APP_VERSION = 'v85_u'`.

⚠️ **`docs/index.html` is now 9.10MB**, up from ~8.38MB — NOT a mistake, this is item 4's own
measurement made real: ~700KB of inline comic-panel base64 image data baked wholesale, exactly the
consequence the `D4` ruling warned about and the reason item 4 is scheduled. Don't be alarmed by the
size jump; it is diagnostic, not a regression to chase.

⚠️ **Check `git status --short lessons.json` at the start of this session.** The user is actively
using this app for real work on their own separate, long-running dev server (found bound to port 3000
across `v85_k` through `v85_u`, never touched). If `lessons.json` shows modified, that is their own
data — not yours to revert, commit, or "fix around" without asking. `git checkout -- lessons.json`
and `git add -A` were BOTH blocked by this environment's own permission classifier earlier in the
`v85` line; use `git show HEAD:lessons.json > /tmp/somewhere.json` (read-only) and stage files
explicitly by name. **If a release needs `docs/index.html` rebuilt while `lessons.json` is dirty**,
point `build-static.js` at that temp file explicitly (`node build-static.js /tmp/somewhere.json`) —
if it is CLEAN, the plain default is fine and simpler.

⚠️ **This container HAS a live model backend** — `curl -s http://localhost:11434/api/tags` confirmed
Ollama running with `qwen2.5vl:7b` installed, and it was used for real in this line (`v85_t`'s C2
probe). Check what's actually installed (`ollama list`) before assuming a "needs live verification"
item is unreachable — several items in "OWED BY THE USER" below were written before anyone checked.

⚠️ **A manual `PORT=NNNN node server.js` live-verification run is NOT data-isolated by default** —
pass `LESSONS_FILE=/tmp/...`. `v85_m` learned this the hard way; every cut since has done it right.

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is the thing to
> fix** — unless the failure is one of the two documented `lessons.json` items above.

## The habits that cost this project the most (full incident history: `roadmap_v84.md`'s "Rules
earned in session N…the v84 line" blocks, `roadmap_v85.md`'s own "Rules earned in the v85 line" if one
exists by the time you read this — check)

1. **Measure before editing.**
2. **Guard at the layer where the claim is observable**, and mutation-test every guard.
3. **For any refactor claiming to preserve behaviour, CAPTURE the old output and DIFF it.**
4. **`buildExercises` is NON-DETERMINISTIC IN CONTENT, not just order.**
5. **Ask before restarting a dev server you did not start, and before deleting data you did not
   create.**
6. **A live model call needs a live test AND a real human reading the output.**
7. **A fix to one stage's OUTPUT SHAPE can silently break a DOWNSTREAM consumer that assumed the OLD
   shape.**
8. **A per-caller fix does not generalize to other callers of the same primitive** — `v85_u`'s own
   scheduled item 6 is this shape at the ARCHITECTURE level: comic AND PDF both independently rebuilt
   "upload card fires generate immediately" instead of using the wizard's own staged flow.
9. **A "safe-looking" optimization that reads fresh state can still defeat an existing guarantee.**
10. **When a change is the FIRST of its kind to touch the live app or write to a real corpus, ASK how
    far it should go before building.**
11. **When restructuring markup into new wrapper elements, verify div-balance with a real HTML parser.**
12. **When a plan document's own claim about "reuses existing machinery X" doesn't survive reading X's
    actual code, STOP and ask.**
13. **A new UI affordance that makes an EXISTING code path more reachable can surface a pre-existing
    bug in that path.**
14. **This harness's `document.getElementById`/`.querySelector` NEVER return null on a miss.**
15. **`vm.runInContext` (`C.run()`) rejects a bare top-level `await`.**
16. **Two code paths that both produce "the same observable zero-calls result" can still differ in
    WHY.**
17. **`server.js` changes need a FRESH PROCESS to verify live.**
18. **Restoring a working file from a LOCAL BACKUP taken for an earlier, unrelated mutation test can
    silently revert LATER, unrelated uncommitted work** — verify the diff afterward regardless.
19. **When ONE value/id needs to reach a completion handler reachable from MULTIPLE entry points,
    thread it through ALL of them explicitly.**
20. **A live model call's OWN token budget can interact with its OWN behaviour in ways a shorter test
    won't show.**
21. **A guard's own mutation test can reveal it fires EARLIER/MORE OFTEN than the comment claims.**
22. **A destructive or blanket git action (`git checkout -- <file>`, `git add -A`) can be BLOCKED by
    this environment's own permission classifier.**
23. **An "index-aligned by construction" claim between a client array and a server response array
    needs a test that actually BREAKS one element and checks the SURVIVORS' indices.**
24. **A prompt validated on ONE real fixture does not transfer its validated behaviour just because
    the prompt was generalized in prose, OR wired into a new code path.**
25. **A background process started with a bare shell `&` inside a tool call may or may not survive
    past that tool call's own lifetime**, and its stdout is LOST unless explicitly redirected.
26. **A test asserting on ASYNC SIDE EFFECTS of a fire-and-forget server route must wait for the
    job's own completion signal before checking those side effects.**
27. **A manual `PORT=NNNN node server.js` live-verification run is NOT data-isolated the way the e2e
    harness's `boot()` is** — pass an explicit `LESSONS_FILE=/tmp/...` override every time.
28. **A test's own "canned model response" fixture should reflect what the REAL model was actually
    observed to say, not just the idealized instruction-compliant form.**
29. **A test that reads the REAL, LIVE `lessons.json` to pick its own fixtures can go from green to
    red PURELY FROM THE CORPUS GROWING**, with no code change at all.
30. **A real user's bug report after actually using a shipped feature can surface MULTIPLE independent
    findings in one message — separate them, triage which are in-scope-now vs. deferred.**
31. **A crash reproduced only inside a DOM-stub test harness needs the "would this survive in a real
    browser" question answered before it is treated as an app bug.**
32. **A generated build artifact (`docs/index.html`) can be freely rebuilt from safe, COMMITTED
    sources whenever code changes require it, even if the file already shows as modified from
    something else entirely.**
33. **An all-or-nothing validation throw on ONE ITEM inside a MULTI-ITEM generation result discards
    every OTHER item too.**
34. **A render path's own `setTimeout`-based side effect needs its pending timer cancelled at the top
    of the function, unconditionally — not only inside whichever branch scheduled it.**
35. **Before declaring a "needs a live model" item unreachable, actually CHECK what's installed.**
36. **A "redacted equivalent" probe input (a crop, not the pristine original) is still legitimate —
    but state the substitution as a caveat next to the result.**
37. **A hit-tested UI affordance needs an EXPLICIT precedence rule when it can overlap an EXISTING
    interaction on the same surface.**
38. **A user's OWN follow-up report on a just-shipped, measured finding can reveal that a SECOND,
    unrelated, fully-fixable bug was compounding on top of what looked like one root cause** —
    `v85_u`'s zoom-sync fix likely explains more of `v85_t`'s screenshot than the (still real, still
    unfixed) model-accuracy finding does. Don't treat a live-measured finding as the WHOLE story just
    because it was measured rigorously; a rigorous measurement of one contributing factor is not proof
    there is only one.
39. **When a codebase has an EXISTING ruling on a topic (grep the roadmap before assuming a "new"
    problem needs a new decision)** — `v85_u`'s item 4 (comic images in `lessons.json`) is not a new
    design question; it is a `v80`-era ruling (`D4`) that a LATER feature (`v85_j`-`v85_p`) never
    implemented. The fix is "do what was already decided," not "decide again."
40. **Checking whether server-side plumbing for a requested client feature ALREADY EXISTS can shrink
    an apparently-large ask to a small one** — `v85_u`'s item 5 (vision model picker) found the
    server's `/api/models` route already accepts a `vision` field; the client picker was the entire
    gap. Always check both sides before estimating a feature's size.

# WHERE TO START

**If `roadmap_v86.md` does not exist yet, the `v85`→`v86` cut still needs doing** — see
`roadmap_v84.md`'s own `v84`→`v85` cut (its header block, "What was carried, what was not") as the
template. Carry forward: this protocol block structure, the standing RULES, `TRACK T`, THE LARGER
PLAN's still-open items. Do NOT carry the release write-ups themselves (they stay in `roadmap_v85.md`
as history) — the SESSION_PROMPT lineage (this file, renamed to `v86_a`) is what carries the backlog.

**Backlog to carry into `v86_a`'s own prompt** (everything below survives the cut):

- **Items 4/5/6 from `v85_u`** (move comic images out of `lessons.json`; vision-role model picker with
  capability filtering; comic/PDF upload-card UX reorganisation, recommendation already given) — all
  three fully scoped, none built. Read `roadmap_v85.md`'s `v85_u` entry for the concrete starting
  points before beginning any of them.
- **Tier 2 per-word image-coordinate vocab highlighting** — explicitly requested by the user as a
  FUTURE step after item 3's investigation confirmed Tier 1 already ships. Needs its own design pass.
- **Chapter-title post-pass failures** (`v85_r`) — still needs a live-model reproduction with the raw
  response captured, not more source reading.
- **`v85_r`'s article-symmetry fix** — needs live-model regeneration + a probe re-run against
  `build_history/probe_article_symmetry_v80j.js`'s baseline.
- **Live-verify `v85_s`'s speech-race fix, `v85_t`'s resize handles, `v85_u`'s resize-sync fix** on a
  real device — all mechanically proven (mutation-tested), none touched/heard/seen by a human yet.
- **`INTERNALS.md` §6b** needs two new comic-panel rows (C1 resize, resize-sync) — two cuts overdue.

**Explicitly out of scope, confirmed with the user across the whole `v85` line — do not reopen without
asking**: the CP1-6 pipeline's cross-chapter arc-sequencing; spell-check-driven auto error-hunt
generation. The browser-reachable single-chapter CP1-4 pipeline (deferred by `PLAN §13`) remains a
separate, not-yet-scoped follow-up. `vocabTable.system` has no BASE FORM ONLY instruction at all —
not a contradiction, just an absence — left alone.

## ⚠️ OWED BY THE USER, not doable in a container

- **The whole `v84_g`…`v84_m` speech-recognition arc** — still not live-verified on a real device.
- **Windows Tier 1 install docs (`v84_n`)** — reasoned, not measured.
- **`apply-cp-lessons.js`'s `v83_p` re-verification** — blocked by machine resource contention.
- **The PASS MARK** — needs a browser pass, not code.
- **The whole `v85_c`…`v85_i` wizard shell / attribution wiring** — not checked on a real mobile
  device/viewport.
- **`v85_r`'s article-symmetry fix** — this ONE could actually be attempted in-container now that a
  live backend is confirmed — check whether the TEXT model roles are installed, not just vision,
  before assuming this still needs the user.
- **Chapter-title post-pass failures** — needs a live reproduction with the raw model output captured.
- **`v85_s`/`v85_t`/`v85_u`'s own mechanical fixes** — none yet touched/heard/seen on a real device.
- **Items 4/5/6 from `v85_u`** — scoped, need the user's own go-ahead on design choices noted above
  before building (especially item 4's migration of the 6 existing topics' embedded images).

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map. The comic-panel entries (`v85_j` through
`v85_p`) are consecutive rows — read them before touching any part of that subsystem, and add the two
overdue rows (C1 resize, resize-sync) while you're in there.
