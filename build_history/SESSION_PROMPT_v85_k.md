# Session prompt — written at the `v85_k` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v85_k`, `v85_l`, …) unless a future
session has a good reason to switch to `v86_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v85_k`**. This session (continuing
from `v85_j`'s milestone-1 UI) built and shipped `PLAN §2.4` / Track A4 **milestone 2**: the full
batch text-extraction pipeline, wired to `qwen2.5vl:7b` per the user's own explicit choice, and
**live-verified against the real model**, not just the fake test backend.

**What just shipped (`v85_k`)**: client-side box cropping (`<canvas>`, full resolution), one batch
`POST /api/comic-extract` per "Extract text" click, a new server-side job (`_runComicExtractJob`, one
`qwen2.5vl:7b` call per panel, sequential, tolerant of a single panel's failure without losing the
rest of the batch), a new client-side poller (`_startComicExtractJob` — a structural SIBLING of
`startBackgroundJob`, not a reuse — confirmed at milestone-1 scoping time), results merged back into
the panel list with a text preview. `llm.js` gained `opts.images`; `server.js` gained a full
runtime-mutable `OLLAMA_VISION_MODEL` role. See `roadmap_v85.md`'s `v85_k` entry (top of `# SHIPPED IN
THE v85 LINE`) for the full write-up, and `INTERNALS.md` §6b for the mechanism table.

**Two things worth knowing before touching this area again:**

1. **A real bug was caught by the e2e test, not assumed away**: the route handler originally
   FILTERED empty/invalid image entries out of the incoming array before the job saw them, silently
   desyncing the client's index-aligned panel list from the server's response the moment any panel
   failed. Fixed (normalize, don't filter — reject only a wholly-empty batch). The lesson: an
   index-alignment guarantee documented in a comment is not verified by that comment; only a test
   that actually breaks a panel and checks the SURVIVING indices proves it.

2. **The extraction prompt was generalized for all 33 target languages**, not copied verbatim from
   this session's German-only probes. Case-restoration is phrased so the MODEL decides whether it
   applies (many target scripts have no case distinction), and German's own capitalization rule is
   named as an EXAMPLE, not asserted universally. The probe's literal worked example — the single
   most effective fix for German case-restoration — was deliberately dropped from the generalized
   prompt (risk of biasing other languages toward German's pattern). **Live-verified finding**: on a
   synthetic (non-comic-styled) test panel, case-restoration did NOT fire with the real model. Not
   yet re-verified against a REAL comic panel with this exact prompt — the probes' validated result
   used a different (German-specific, worked-example) prompt than what shipped. **Worth a follow-up
   real-panel measurement before trusting this in production** — see `_comicExtractPrompt`'s own
   comment in `server.js`.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v85.md` — its **index table** and **⚠️ Session protocol** block first, then
   the `v85_k` shipped entry, then the whole `PLAN §2.4` sequence (RESULT PART 1/2/3, UI SCOPING) if
   you're continuing Track A4.
3. `INTERNALS.md` **§6b, the feature → function map** — read it BEFORE grepping for where anything
   lives. The `v85_k` milestone-2 entry is the newest row, right after milestone 1's.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 276 checks
node test/run.js --quick                  → expect 241
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Corpus at this cut: **327 topics, 92 storylines, 33 languages, 682 `en` keys** (3 new keys from
`v85_k`: `form.comic_extract`/`comic_extracting`/`comic_extract_failed`). `APP_VERSION = 'v85_k'`.

⚠️ **Check `git status --short lessons.json` at the start of this session.** If it shows modified,
that is very likely the user's own real, uncommitted evaluation/play data — not yours to revert,
commit, or "fix around" without asking. It was modified for MOST of the `v85_j`/`v85_k` session (one
extra topic beyond the committed 327) but came back clean on its own partway through `v85_k` — almost
certainly the user's own separate activity on their own real dev server (see below), not anything this
session did. If you need the COMMITTED content for a build step without touching the real file, use
`git show HEAD:lessons.json > /tmp/somewhere.json` (read-only) and point the tool at that path —
`git checkout -- lessons.json` was BLOCKED by this environment's own permission classifier when tried
in the `v85_j` session (a destructive git action).

⚠️ **A real, separate dev server was found already bound to port 3000 during this session** (`v85_k`'s
live-model verification) — very likely the user's own, actively in use (their `lessons.json` went from
328→327 topics mid-session, consistent with them using the app directly). It was NOT touched. This
session's own server-side verification ran on `PORT=3457` instead (`PORT=3457 node server.js &`,
killed via `lsof -i :3457 -t | xargs kill` when done) — do the same if you need a live server AND port
3000 is already occupied by something that isn't a `preview_start`-managed process. Never assume a
bound port 3000 is stale/dead without checking; this cut's own `/api/info` call proved it was live and
running current code.

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is the thing to
> fix** — unless the failure is the documented `lessons.json` mismatch above.

## The habits that cost this project the most (full incident history: `roadmap_v84.md`'s "Rules
earned in session N…the v84 line" blocks)

1. **Measure before editing.**
2. **Guard at the layer where the claim is observable**, and mutation-test every guard.
3. **For any refactor claiming to preserve behaviour, CAPTURE the old output and DIFF it.**
4. **`buildExercises` is NON-DETERMINISTIC IN CONTENT, not just order.**
5. **Ask before restarting a dev server you did not start, and before deleting data you did not
   create.**
6. **A live model call needs a live test AND a real human reading the output.** `v85_k` did exactly
   this — and the live test surfaced a real finding (case-restoration not firing) a fake-backend test
   never could have.
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
    actual code, STOP and ask.**
13. **A new UI affordance that makes an EXISTING code path more reachable can surface a pre-existing
    bug in that path.**
14. **This harness's `document.getElementById`/`.querySelector` NEVER return null on a miss** — check
    `.tagName`/`.children.length`, not `!!` truthiness.
15. **`vm.runInContext` (`C.run()`) rejects a bare top-level `await`** — wrap in `(async()=>{...})()`,
    await OUTSIDE via `settle()`.
16. **Two code paths that both produce "the same observable zero-calls result" can still differ in
    WHY** — a second signal may be needed.
17. **`server.js` changes need a FRESH PROCESS to verify live** — the user's own long-running dev
    server does NOT pick them up. Use a real e2e test (`boot()`), not `curl` against port 3000.
18. **Restoring a working file from a LOCAL BACKUP taken for an earlier, unrelated mutation test can
    silently revert LATER, unrelated uncommitted work.**
19. **When ONE value/id needs to reach a completion handler reachable from MULTIPLE entry points,
    thread it through ALL of them explicitly.**
20. **A live model call's OWN token budget can interact with its OWN behaviour in ways a shorter test
    won't show** — a model echoing its prompt back before answering, silently truncating the real
    answer inside a small `num_predict`.
21. **A guard's own mutation test can reveal it fires EARLIER/MORE OFTEN than the comment claims** —
    correct the comment to say so rather than leaving it overstating what one assertion alone proved.
22. **A destructive git action (`git checkout -- <file>`) can be BLOCKED by this environment's own
    permission classifier even when the intent is benign** — `git show HEAD:<file> > /tmp/somewhere`
    is the read-only equivalent.
23. **An "index-aligned by construction" claim between a client array and a server response array
    needs a test that actually BREAKS one element and checks the SURVIVORS' indices** — `v85_k`'s
    route handler silently filtered instead of normalizing, which a happy-path test (all panels
    succeed) could never have caught; only a deliberate partial-failure test found it.
24. **A prompt validated on ONE real fixture (one language, one worked example) does not transfer its
    validated behaviour just because the prompt was generalized in prose** — `v85_k`'s live check
    found case-restoration silently not firing once the German-specific worked example was removed
    for multilingual use; the generalization needs its OWN measurement, not an assumption of parity.
25. **A background process started with a bare shell `&` inside a tool call may or may not survive
    past that tool call's own lifetime** — `v85_k`'s port-3457 verification server happened to survive
    (confirmed by a follow-up curl), but this is not guaranteed; prefer the harness's own
    `run_in_background` where the tool supports it, and always verify a `&`-backgrounded process is
    still alive before relying on it for a multi-step verification.

# WHERE TO START

**Track A4 milestone 3** (chapter formation from extracted panels) is next per the milestone plan in
`roadmap_v85.md`'s "PLAN §2.4 — UI SCOPING" section: concatenate panel texts in reading order into the
ordinary `d.story` field (backward-compatible with every existing text consumer), store
`d.comicPanels` (box, text, kind, image) alongside for milestone 4, feed into the SAME
chaptering/lesson-type pipeline PDF/pasted-story uploads already use. No open ruling blocks starting
it. Two things worth doing FIRST, though, given `v85_k`'s own live-verification finding:
(a) a real-panel re-measurement of the generalized extraction prompt (does case-restoration actually
fire on real comic art, not just synthetic text?) — cheap, and directly informs whether milestone 3's
output will need per-language QC before shipping; (b) consider whether `_comicExtractPrompt` needs a
German-specific (or more broadly, per-language) worked-example variant rather than one fully generic
prompt, if (a) comes back negative on real content too. **Ask the user before deciding which, if
either, to do before milestone 3 itself** — this is new judgement, not a continuation of an
already-ruled-on plan.

**Explicitly out of scope, confirmed with the user across the whole `v85` line — do not reopen without
asking**: the CP1-6 pipeline's cross-chapter arc-sequencing; spell-check-driven auto error-hunt
generation. The browser-reachable single-chapter CP1-4 pipeline (deferred by `PLAN §13`) remains a
separate, not-yet-scoped follow-up.

## ⚠️ OWED BY THE USER, not doable in a container

- **The whole `v84_g`…`v84_m` speech-recognition arc** — still not live-verified on a real device.
- **Windows Tier 1 install docs (`v84_n`)** — reasoned, not measured.
- **`apply-cp-lessons.js`'s `v83_p` re-verification** — blocked by machine resource contention.
- **The PASS MARK** — needs a browser pass, not code.
- **The whole `v85_c`…`v85_i` wizard shell / attribution wiring** — not checked on a real mobile
  device/viewport.
- **`v85_j`'s comic-panel UI** — verified live via a fresh preview server and a synthetic test image,
  but NOT with a real comic page on a real mobile touch device; the touch-event handlers are untested
  outside the unit harness's synthetic dispatch.
- **`v85_k`'s extraction pipeline against REAL comic content** — live-verified end-to-end with a
  synthetic panel only (CORS blocked fetching the session's own real comic fixture from within the
  browser page). The whole pipeline works; extraction QUALITY on real panel art with the generalized
  prompt is unmeasured. See the "WHERE TO START" note above.

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map, including the whole speech-recognition
subsystem, the `PLAN §7.0` pipeline, the `v85_c`→`v85_i` generator-wizard entries, and now BOTH
`v85_j` (panel-drawing UI) and `v85_k` (extraction) comic-panel entries — read those before touching
any of these areas.
