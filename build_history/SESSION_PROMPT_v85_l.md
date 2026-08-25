# Session prompt — written at the `v85_l` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v85_l`, `v85_m`, …) unless a future
session has a good reason to switch to `v86_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v85_l`**. This session resolved the
one open question `v85_k` left before starting Track A4 milestone 3: does the generalized comic-panel
extraction prompt's case-restoration actually work on REAL comic art, not just the synthetic panel
`v85_k`'s own live check used?

**Answer: no, not without the worked example** — and this cut fixed it. Re-ran the exact `v85_k`
prompt against the SAME real comic panel this session's probes used (known ground truth): case-
restoration still didn't fire, disproving "maybe synthetic text just doesn't read as comic lettering."
Restored the German-specific worked example, but CONDITIONALLY (`lang === 'de'` only — the one
language with real evidence; every other language stays principle-only, explicitly unmeasured). Re-ran
the same panel through the fixed prompt: **exact match to ground truth on both fields**, through the
actual production route, not a probe re-implementation. See `roadmap_v85.md`'s `v85_l` entry and
`INTERNALS.md` §6b's `_comicExtractPrompt` row for the full three-round history.

A real bug was also found (and fixed) in the TEST written to guard this — the first version raced the
extraction job's own async execution, reading the request log before the job necessarily finished;
fixed by waiting for job completion first. See `test/e2e-comic-extract.test.js` §5.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v85.md` — its **index table** and **⚠️ Session protocol** block first, then
   the `v85_l` shipped entry, then the whole `PLAN §2.4` sequence (RESULT PART 1/2/3, UI SCOPING) if
   you're continuing Track A4.
3. `INTERNALS.md` **§6b** — the `_comicExtractPrompt` row now carries the full three-round
   verification history; read it before touching that function again.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 276 checks
node test/run.js --quick                  → expect 241
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Corpus at this cut: **327 topics, 92 storylines, 33 languages, 682 `en` keys** (unchanged from
`v85_k` — no new UI strings this cut, prompt-only fix). `APP_VERSION = 'v85_l'`.

⚠️ **Check `git status --short lessons.json` at the start of this session.** The user was committing
their OWN real content in parallel during the `v85_j`/`v85_k`/`v85_l` arc (two of their own commits —
`7eca263`, `de12b4a` — landed cleanly between `v85_j` and `v85_k`) — this repo is actively used by the
user for real work, not just a sandbox. If `lessons.json`/`contrib.md` show modified, that is their
own data; not yours to revert, commit, or "fix around" without asking. `git checkout -- lessons.json`
was BLOCKED by this environment's own permission classifier when tried earlier in the `v85` line — use
`git show HEAD:lessons.json > /tmp/somewhere.json` (read-only) instead if you need committed content
for a build step.

⚠️ **A real, separate dev server has been found bound to port 3000 across `v85_k` AND `v85_l`** — very
likely the user's own, actively in use. Never touch it. This session's own live-model verification used
`PORT=3457 node server.js &` (with `disown`, and `lsof -i :3457 -t | xargs kill` to clean up) — do the
same if you need a live server yourself.

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
6. **A live model call needs a live test AND a real human reading the output.** `v85_l`'s whole cut is
   this rule in action twice over — the synthetic-panel result from `v85_k` looked like it might be an
   artifact of the test image, and only a REAL-panel re-run (not more reasoning about the synthetic
   result) settled it.
7. **A fix to one stage's OUTPUT SHAPE can silently break a DOWNSTREAM consumer that assumed the OLD
   shape** — re-run the full suite for every affected file.
8. **A per-caller fix does not generalize to other callers of the same primitive** — grep every call
   site.
9. **A "safe-looking" optimization that reads fresh state can still defeat an existing guarantee
   whose enforcement lived in a step the optimization skips** — mutation-test it.
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
    silently revert LATER, unrelated uncommitted work.**
19. **When ONE value/id needs to reach a completion handler reachable from MULTIPLE entry points,
    thread it through ALL of them explicitly.**
20. **A live model call's OWN token budget can interact with its OWN behaviour in ways a shorter test
    won't show.**
21. **A guard's own mutation test can reveal it fires EARLIER/MORE OFTEN than the comment claims.**
22. **A destructive git action (`git checkout -- <file>`) can be BLOCKED by this environment's own
    permission classifier** — `git show HEAD:<file> > /tmp/somewhere` is the read-only equivalent.
    `git add -A` was ALSO blocked at the `v85_k` cut for the same reason (broad/blanket staging) — list
    files explicitly instead.
23. **An "index-aligned by construction" claim between a client array and a server response array
    needs a test that actually BREAKS one element and checks the SURVIVORS' indices.**
24. **A prompt validated on ONE real fixture (one language, one worked example) does not transfer its
    validated behaviour just because the prompt was generalized in prose** — confirmed twice now
    (`v85_k`'s synthetic-panel finding, `v85_l`'s real-panel re-confirmation of the same gap). The
    fix was re-adding the SPECIFIC thing that was removed, gated to the ONE case with evidence, not a
    fresh guess at a better general instruction.
25. **A background process started with a bare shell `&` inside a tool call may or may not survive
    past that tool call's own lifetime** — worked both times this line used it (confirmed via a
    follow-up curl each time), but verify, don't assume.
26. **A test asserting on ASYNC SIDE EFFECTS of a fire-and-forget server route (a job that starts
    running only after the HTTP response already went out) must wait for the job's own completion
    signal before checking those side effects** — reading a log/state snapshot right after the
    triggering request resolves can race the actual work, producing a failure for the WRONG reason
    (stale data) that looks like a bug in the thing under test. `v85_l`'s own new test hit this on the
    first try, live, in the same session that wrote it.

# WHERE TO START

**Track A4 milestone 3** (chapter formation from extracted panels) — the milestone plan is in
`roadmap_v85.md`'s "PLAN §2.4 — UI SCOPING" section. No open ruling blocks starting it: concatenate
panel texts in reading order into the ordinary `d.story` field (backward-compatible with every
existing text consumer), store `d.comicPanels` (box, text, kind, image) alongside for milestone 4,
feed into the SAME chaptering/lesson-type pipeline PDF/pasted-story uploads already use.

One thing still worth knowing before extending extraction to a NEW language: the case-restoration fix
this cut shipped is German-only. If a session works with a comic in another target language, its own
principle-only prompt behaviour is UNMEASURED — worth a quick live check (same pattern as this cut)
before trusting it, rather than assuming the German result generalizes.

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
  but NOT with a real comic page on a real mobile touch device.
- **`v85_k`/`v85_l`'s extraction pipeline** — now verified against REAL comic content (German) through
  the actual production route, but only on ONE real fixture. Broader real-world panel variety (messy
  crops, rotated text, non-German languages) remains unmeasured.

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map. The `_comicExtractPrompt` row carries the full
three-round verification history for the case-restoration fix — read it before touching that function.
