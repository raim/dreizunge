# Session prompt — written at the `v85_j` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v85_j`, `v85_k`, …) unless a future
session has a good reason to switch to `v86_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v85_j`**: `PLAN §13` (the generator-page
redesign) shipped in full at `v85_i`. This session then ran the `PLAN §2.4` "overlay probe" — the
long-deferred measurement step for comic/image ingest (Track A4) — across FOUR probe scripts and two
vision models, then scoped and started building the manual-panel-selection UI it pointed to.

**What just shipped (`v85_j`)**: `PLAN §2.4` / Track A4 **milestone 1** — a client-side-only comic
upload + panel-drawing UI (`#comic-panel` on `#gen-card-2`, canvas-based rectangle drawing, mouse AND
touch, box list with reorder/delete). **No model call anywhere in this release** — text extraction is
milestone 2, deliberately deferred. See `roadmap_v85.md`'s `v85_j` entry (top of `# SHIPPED IN THE
v85 LINE`) for the full write-up, and `INTERNALS.md` §6b for the mechanism table.

**What led here, all recorded in `roadmap_v85.md`'s "PLAN §2.4" sections (RESULT PART 1/2/3, then UI
SCOPING)** — read those before re-deriving any of it:
- Three panel-FINDING strategies (one-shot enumeration, stateless grounding, stateful grounding) were
  tested against `minicpm-v4.5` on a real comic page. ALL THREE FAILED, each a different way
  (confabulation/repetition; inconsistent/duplicate boxes; still inconsistent). This is recorded in
  three probe files under `build_history/`.
- User's own idea in response: take panel ENUMERATION out of the model's job — the user draws the
  panel rectangles by hand — and give the model only TEXT EXTRACTION from an already-known region.
  Measured with a NEW probe (`probe_comic_text_extract_v85_i.js`): promising but incomplete on
  `minicpm-v4.5` (case-restoration fixed with a worked-example prompt; OCR accuracy and word-rejoin
  did not respond to any prompt fix).
- User asked "could we use a more powerful model?" — pulled `qwen2.5vl:7b` (no GPU on this machine,
  so a bigger LOCAL model was not the right lever; a different architecture at the same size class
  was). Re-ran EVERY probe against it: text extraction came back a PERFECT match; one-shot panel
  enumeration — the exact thing that failed on `minicpm-v4.5` — came back CORRECT (right count, right
  order, clean grid); stateful grounding also came back clean; stateless grounding is the one place
  it still fails, the SAME way `minicpm-v4.5` did (a useful negative control).
- Scoped the milestone-1 UI: investigated real code (not assumed) for where a comic path plugs into
  the existing generator wizard and the ONE shared story renderer (`_storyBodyHtml`), confirmed the
  server-side job primitive is generic and reuses cleanly but the CLIENT-side `startBackgroundJob`
  wrapper does not (hardwired to story-generation completion), and confirmed `llm.js` has zero
  `images` support today (every probe script hand-rolled its own HTTP call because of this).
- User: "start." Built and verified milestone 1 (this release).

**Two rulings already made, still binding for milestones 2-4**: uploaded page images are stored
INLINE AS BASE64 in `lessons.json` (no static-asset route exists anywhere in this app; not building
one now); panels are drawn first, ALL extracted in one batch afterward (not one-at-a-time).

**Not yet decided**: which vision model/backend milestone 2 (extraction) targets — `qwen2.5vl:7b` has
the best measured results so far but was never tested against `§2.7`'s HARD fixture (Page A: rotated
text, unframed panels, text outside its panel, ambiguous order), and real per-call latency under
steady (not on/off) load is still unmeasured. Ask before choosing.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v85.md` — its **index table** and **⚠️ Session protocol** block first, then
   the `v85_j` shipped entry, then the whole `PLAN §2.4` sequence (RESULT PART 1/2/3, then UI SCOPING)
   if you're continuing Track A4 — it is long, but every finding in it cost real probe time to get and
   re-deriving any of it would waste more.
3. `INTERNALS.md` **§6b, the feature → function map** — read it BEFORE grepping for where anything
   lives. The `v85_j` milestone-1 entry is the newest row.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 274 checks
node test/run.js --quick                  → expect 240
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Corpus at this cut: **327 topics, 92 storylines, 33 languages, 679 `en` keys** (4 new keys from
`v85_j`'s comic-panel UI strings: `form.use_comic`/`comic_help`/`comic_choose`/`comic_clear`).
`APP_VERSION = 'v85_j'`.

⚠️ **Check `git status --short lessons.json` at the start of this session.** If it shows modified,
that is very likely the user's own real, uncommitted evaluation/play data — not yours to revert,
commit, or "fix around" without asking. It was ALREADY modified throughout the whole `v85_j` session
(one extra topic beyond the committed 327) — the roadmap-version and static-freshness guards will
both show this exact, expected, pre-existing mismatch against the real file on disk. That is not a
regression; do not "fix" it by touching `lessons.json`. **`git checkout -- lessons.json` was BLOCKED
by this environment's own permission classifier when tried this session** (a destructive git action)
— if you need the COMMITTED content for a build step (e.g. rebuilding `docs/index.html` without
baking in the user's private uncommitted data), use `git show HEAD:lessons.json > /tmp/somewhere.json`
(read-only, no working-tree mutation) and point the tool at that path instead — `build-static.js`
already accepts a lessons-file argument (`node build-static.js <path> docs`) for exactly this.

⚠️ **The user's own main dev server (port 3000), if one is running outside this session, was
confirmed EARLIER in the `v85` line to run stale code** — Node loads `server.js` once at process
start, does NOT hot-reload it. This `v85_j` release made NO `server.js` change, so that staleness
risk did not apply this cut — but it WILL matter again the moment milestone 2 adds a server route.
Ask before restarting a server you did not start; prefer a fresh `preview_start` process (this
session verified milestone 1 live that way, successfully, without touching anything the user may have
had running).

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is the thing to
> fix**, not the guard — unless the failure is the documented `lessons.json` mismatch above.

## The habits that cost this project the most (full incident history: `roadmap_v84.md`'s "Rules
earned in session N…the v84 line" blocks)

1. **Measure before editing.**
2. **Guard at the layer where the claim is observable**, and mutation-test every guard.
3. **For any refactor claiming to preserve behaviour, CAPTURE the old output and DIFF it.**
4. **`buildExercises` is NON-DETERMINISTIC IN CONTENT, not just order.**
5. **Ask before restarting a dev server you did not start, and before deleting data you did not
   create.**
6. **A live model call needs a live test AND a real human reading the output.**
7. **A fix to one stage's OUTPUT SHAPE can silently break a DOWNSTREAM consumer that assumed the OLD
   shape** — re-run the full suite for every affected file, not just the one you changed.
8. **A per-caller fix does not generalize to other callers of the same primitive** — grep every call
   site.
9. **A "safe-looking" optimization that reads fresh state can still defeat an existing guarantee
   whose enforcement lived in a step the optimization skips** — mutation-test it against every
   EXISTING guard it touches.
10. **When a change is the FIRST of its kind to touch the live app or write to a real corpus, ASK how
    far it should go before building.**
11. **When restructuring markup into new wrapper elements, verify div-balance with a real HTML parser
    over the changed region**, not by eyeballing indentation.
12. **When a plan document's own claim about "reuses existing machinery X" doesn't survive reading X's
    actual code, STOP and ask.** `v85_j`'s own finding was the SPLIT case: the server-side job
    primitive genuinely does reuse; the client-side `startBackgroundJob` wrapper does not — checked
    both halves separately rather than assuming one verdict covered the whole claim.
13. **A new UI affordance that makes an EXISTING code path more reachable can surface a pre-existing
    bug in that path.**
14. **This harness's `document.getElementById`/`.querySelector` NEVER return null on a miss** — check
    `.tagName`/`.children.length` against the expected real result, not `!!` truthiness.
15. **`vm.runInContext` (`C.run()`) rejects a bare top-level `await`** — wrap in `(async()=>{...})()`,
    await OUTSIDE via `settle()`.
16. **Two code paths that both produce "the same observable zero-calls result" can still differ in
    WHY** — a call-count check alone can't always distinguish a deliberate skip from a guard-less
    crash silently swallowed by a `try/catch`; a second signal may be needed.
17. **`server.js` changes need a FRESH PROCESS to verify live** — the user's own long-running dev
    server does NOT pick them up. Use a real e2e test (`boot()`), not `curl` against port 3000.
18. **Restoring a working file from a LOCAL BACKUP taken for an earlier, unrelated mutation test can
    silently revert LATER, unrelated uncommitted work.** Prefer `git diff`/targeted string replacement
    over "restore from an old snapshot" once several edits have landed since that snapshot was taken.
19. **When ONE value/id needs to reach a completion handler reachable from MULTIPLE entry points,
    thread it through ALL of them explicitly** — found only by reading each entry point in full.
20. **A live model call's OWN token budget can interact with its OWN behaviour in ways a shorter test
    won't show** — `v85_i`-line probe work (comic-panel text extraction) found a model echoing its
    entire prompt back before answering, silently truncating the real answer inside a small
    `num_predict`; only visible by reading the RAW response, not just the parsed result.
21. **A guard's own mutation test can reveal it fires EARLIER/MORE OFTEN than the comment claims** —
    `v85_j`'s `_comicRedraw()` no-context guard was found (by actually removing it and re-running) to
    throw at the FIRST test in the file, not just the one written to isolate the claim; the comment
    was corrected to say so rather than left overstating what one assertion alone proved.
22. **A destructive git action (`git checkout -- <file>`) can be BLOCKED by this environment's own
    permission classifier even when the intent is benign (temporarily viewing committed content)** —
    `git show HEAD:<file> > /tmp/somewhere` is the read-only equivalent; use it instead of assuming
    the working tree can be freely reverted-and-restored mid-session.

# WHERE TO START

**Track A4 milestone 2** (batch text extraction) is the natural next step — the milestone plan is
written up in `roadmap_v85.md`'s "PLAN §2.4 — UI SCOPING" section. It needs, in order: (1) a ruling on
which vision model/backend to target (open — `qwen2.5vl:7b` has the best measured results but untested
on the hard fixture); (2) `opts.images` added to `llm.js`'s `_callOllama`; (3) a new server-side job
type mirroring `_runBookJob`'s shape; (4) a new client-side poller (sibling to, not a reuse of,
`startBackgroundJob`). **Ask the user for the model/backend ruling before writing milestone 2 code** —
it is a real open question, not a continuation of an already-decided design the way milestone 1 was.

**Explicitly out of scope, confirmed with the user across the whole `v85` line — do not reopen without
asking**: the CP1-6 pipeline's cross-chapter arc-sequencing; spell-check-driven auto error-hunt
generation. The browser-reachable single-chapter CP1-4 pipeline (deferred by `PLAN §13`) remains a
separate, not-yet-scoped follow-up — still needs its own background-job design conversation before
starting, per `v85_i`'s own note (unchanged this cut).

## ⚠️ OWED BY THE USER, not doable in a container

- **The whole `v84_g`…`v84_m` speech-recognition arc** — still not live-verified on a real device.
- **Windows Tier 1 install docs (`v84_n`)** — reasoned, not measured.
- **`apply-cp-lessons.js`'s `v83_p` re-verification** — blocked by machine resource contention.
- **The PASS MARK** — needs a browser pass, not code.
- **The whole `v85_c`…`v85_i` wizard shell / attribution wiring** — not checked on a real mobile
  device/viewport, and every network-touching path across the whole line was verified with the
  network layer stubbed rather than a real LLM backend round-trip.
- **`v85_j`'s comic-panel UI** — verified live via a fresh preview server and a synthetic test image,
  but NOT with a real comic page on a real mobile touch device; the touch-event handlers
  (`touchstart`/`touchmove`/`touchend`) are untested outside the unit harness's synthetic dispatch.

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map, including the whole speech-recognition
subsystem, the `PLAN §7.0` pipeline, the `v85_c`→`v85_i` generator-wizard entries, and now the `v85_j`
comic-panel-UI entry — read those before touching any of these areas.
