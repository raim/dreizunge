# Session prompt — written at the `v85_n` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v85_n`, `v85_o`, …) unless a future
session has a good reason to switch to `v86_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v85_n`**. This session shipped `PLAN
§2.4` / Track A4 **milestone 4** — progress-card integration — **completing Track A4's entire
4-milestone plan** (`v85_j` UI → `v85_k`/`v85_l` extraction → `v85_m` chapter formation → `v85_n` this
release). Comic/image ingest is now a real, working, live-verified feature end to end: upload a comic
page → draw panel rectangles → extract text via `qwen2.5vl:7b` → create a chapter → see the panels
(with per-panel highlighted vocabulary) on the progress card, exactly like every other chapter type.

**What just shipped (`v85_n`)**: a new branch in `_storyBodyHtml` (the ONE shared story renderer every
progress card/question panel/chain view/saved-story reader already goes through), keyed on
`d.comicPanels`, rendering each panel's image above its own transcribed text — Tier 1 per `PLAN §2.6`
(reuses the EXISTING word-highlighting machinery, `furiHtml`→`_highlightVocabHtml`→`_storyParasHtml`,
once per panel instead of once for the whole story), NOT per-word image coordinates (Tier 2, still out
of scope, still unmeasured). Comic-sourced chapters ONLY — every other chapter's rendering is
unchanged (confirmed: full suite green throughout). See `roadmap_v85.md`'s `v85_n` entry and
`INTERNALS.md` §6b for the full mechanism table.

**A genuinely new DOM-stub harness limitation was found this cut**, beyond the long-documented
"`querySelector` never returns null on a miss" one: a nested `.querySelector(...).innerHTML` on a
sub-element pulled from an earlier `.querySelectorAll(...)` result does NOT reflect real content on
this harness — `.textContent` and attribute reads on the exact same match work fine, just not
`.innerHTML` two levels deep. Worked around by parsing the raw HTML string directly. Watch for this
in any future test that nests element queries and reads `.innerHTML` off the result.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v85.md` — its **index table** and **⚠️ Session protocol** block first
   (now says `PLAN §2.4` / Track A4 is FULLY SHIPPED), then the `v85_n` shipped entry. The whole
   `PLAN §2.4` sequence (RESULT PART 1/2/3, UI SCOPING) is now historical record — nothing in it is
   open, but the reasoning behind each milestone is still there if a future session touches this area.
3. `INTERNALS.md` **§6b** — four consecutive comic-panel rows now exist (`v85_j` UI, `v85_k`/`v85_l`
   extraction, `v85_m` chapter formation, `v85_n` progress-card integration) — read all four before
   touching any part of this subsystem.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 279 checks
node test/run.js --quick                  → expect 243
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Corpus at this cut: **327 topics, 92 storylines, 33 languages, 684 `en` keys** (unchanged from
`v85_m` — no new UI strings this cut, a rendering-only change). `APP_VERSION = 'v85_n'`.

⚠️ **Check `git status --short lessons.json` at the start of this session.** The user is actively
using this app for real work on their own separate, long-running dev server (found bound to port 3000
across `v85_k` through `v85_n`, never touched). If it shows modified, that is their own data — not
yours to revert, commit, or "fix around" without asking. `git checkout -- lessons.json` and
`git add -A` were BOTH blocked by this environment's own permission classifier earlier in the `v85`
line; use `git show HEAD:lessons.json > /tmp/somewhere.json` (read-only) and stage files explicitly.

⚠️ **A manual `PORT=NNNN node server.js` live-verification run is NOT data-isolated by default** — it
writes to the REAL `lessons.json` unless you pass `LESSONS_FILE=/tmp/...`. `v85_m` learned this the
hard way (briefly wrote a test chapter into the real corpus, caught and cleaned up); `v85_n` did it
right the first time. Always pass an explicit `LESSONS_FILE` override on any hand-run verification
server from now on — do not repeat `v85_m`'s mistake.

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
   create.** (Deleting data you DID accidentally create, to restore a clean state, is correct.)
6. **A live model call needs a live test AND a real human reading the output.**
7. **A fix to one stage's OUTPUT SHAPE can silently break a DOWNSTREAM consumer that assumed the OLD
   shape.**
8. **A per-caller fix does not generalize to other callers of the same primitive.**
9. **A "safe-looking" optimization that reads fresh state can still defeat an existing guarantee.**
10. **When a change is the FIRST of its kind to touch the live app or write to a real corpus, ASK how
    far it should go before building.**
11. **When restructuring markup into new wrapper elements, verify div-balance with a real HTML parser.**
12. **When a plan document's own claim about "reuses existing machinery X" doesn't survive reading X's
    actual code, STOP and ask.** Now a THREE-TIME-CONFIRMED pattern for this codebase specifically:
    server-side job/poll primitives reuse cleanly; client-side polling wrappers are hardwired to their
    original caller and need a sibling. Treat as a standing expectation here, still worth a quick
    confirming read before relying on it.
13. **A new UI affordance that makes an EXISTING code path more reachable can surface a pre-existing
    bug in that path.**
14. **This harness's `document.getElementById`/`.querySelector` NEVER return null on a miss** — check
    `.tagName`/`.children.length`/a raw-string search, not `!!` truthiness. **Deeper variant found at
    `v85_n`**: a nested `.querySelector(...).innerHTML` on a sub-element from an earlier
    `.querySelectorAll(...)` result does not reflect real content EVEN ON A GENUINE MATCH (not just a
    miss) — `.textContent`/attributes on the same match work fine. When a nested query's `.innerHTML`
    looks wrong, parse the raw HTML string instead of trusting the stub DOM a second level deep.
15. **`vm.runInContext` (`C.run()`) rejects a bare top-level `await`.**
16. **Two code paths that both produce "the same observable zero-calls result" can still differ in
    WHY.**
17. **`server.js` changes need a FRESH PROCESS to verify live.**
18. **Restoring a working file from a LOCAL BACKUP taken for an earlier, unrelated mutation test can
    silently revert LATER, unrelated uncommitted work.**
19. **When ONE value/id needs to reach a completion handler reachable from MULTIPLE entry points,
    thread it through ALL of them explicitly.**
20. **A live model call's OWN token budget can interact with its OWN behaviour in ways a shorter test
    won't show.**
21. **A guard's own mutation test can reveal it fires EARLIER/MORE OFTEN than the comment claims.**
22. **A destructive or blanket git action (`git checkout -- <file>`, `git add -A`) can be BLOCKED by
    this environment's own permission classifier** — use the read-only/explicit equivalent instead.
23. **An "index-aligned by construction" claim between a client array and a server response array
    needs a test that actually BREAKS one element and checks the SURVIVORS' indices.**
24. **A prompt validated on ONE real fixture does not transfer its validated behaviour just because
    the prompt was generalized in prose.**
25. **A background process started with a bare shell `&` inside a tool call may or may not survive
    past that tool call's own lifetime** — verify, don't assume.
26. **A test asserting on ASYNC SIDE EFFECTS of a fire-and-forget server route must wait for the
    job's own completion signal before checking those side effects.**
27. **A manual `PORT=NNNN node server.js` live-verification run is NOT data-isolated the way the e2e
    harness's `boot()` is** — pass an explicit `LESSONS_FILE=/tmp/...` override every time.

# WHERE TO START

**`PLAN §2.4` / Track A4's original 4-milestone plan is now FULLY SHIPPED.** Nothing pre-scoped is
queued for this subsystem. Real, unmeasured gaps remain if a future session wants to push further
(none block anything currently working, all are genuine "next" candidates, not bugs):
- Real mobile/touch rendering of the drawing UI AND the new panel-display cards — neither has been
  checked on a real device.
- A comic chapter with many (10+) panels — layout/scroll behaviour at that scale is untested.
- Non-German target languages — the extraction prompt's case-restoration fix is German-only; every
  other language is principle-only and unmeasured (see `_comicExtractPrompt`'s own comment).
- The HARD `§2.7` fixture (Page A: rotated text, unframed panels, text outside its panel, ambiguous
  order) has never been tried with ANY model or strategy — only the easy fixture (Page B) was ever
  measured, throughout the whole `§2.4` line.
- Multi-page comic storylines (continuing a storyline across multiple uploaded pages) — milestone 3
  deliberately scoped to one page = one chapter, no continuation wiring.
- Tier 2 (per-word image coordinates) remains explicitly out of scope, not attempted, flagged from
  the very first `§2.4` analysis as speculative.
**Ask the user which (if any) of these to pursue** — none is an open ruling from a prior session, all
are new scope decisions.

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
- **The WHOLE `PLAN §2.4` / Track A4 feature (`v85_j`-`v85_n`)** — verified end-to-end against REAL
  comic content through the actual production routes, screenshotted, but on ONE real fixture, one
  language, one machine, never a real mobile device. See "WHERE TO START" above for the specific gaps.

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map. The four comic-panel entries (`v85_j`/`v85_k`-
`v85_l`/`v85_m`/`v85_n`) are consecutive rows — read all four before touching any part of this
subsystem.
