# Session prompt — written at the `v85_r` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v85_p`, `v85_q`, …) unless a future
session has a good reason to switch to `v86_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v85_r`**. This cut is the
model-reliability round deferred at `v85_p` ("ok, go"): two of the three deferred issues are
diagnosed and FIXED; the third is investigated and left open, honestly, because code reading found no
further defect. **No `index.html` changes** — `server.js`, `prompts.json`, and tests only.

**What just shipped (`v85_r`)**:

1. **Vocab article-pairing inconsistency — FIXED.** `PLAN §F3`'s `v80_j` fix only ever covered
   `prompts.json`'s `vocab.system`. `vocabFromText.system` — used whenever a story arrives WITH a
   parallel translation (pasted story+translation, PDF uploads, AND every comic-panel chapter since
   `v85_j`) — carried the IDENTICAL self-contradiction, untouched, for five releases. Fixed the same
   way `v80_j` did (remove the per-side article clause, add the overrides-dictionary-convention
   explanation + worked example). `unit-prompt-article-rule.test.js` generalised to cover both prompt
   keys, mutation-tested. **Not yet live-verified** — same honesty `v80_j` itself stated: needs
   regeneration across many lessons against a live model, then a re-run of
   `build_history/probe_article_symmetry_v80j.js`.
2. **Skill-ID generation flakiness — FIXED.** `resolveVocabularySkillTags` threw and discarded the
   WHOLE lesson (8 vocab + 5 sentences + a real LLM call) when even ONE item's `skillId` was missing
   or malformed — a very plausible mechanism for "3 failed attempts, 462s" (`withRetry` gives 3
   attempts; one bad item on every attempt exhausts them all). Now degrades the same way an
   unregistered-but-well-formed proposal already did: `skillId: null`, `skillProposal.status` records
   `'missing'` or `'malformed: <reason>'`, the other items resolve normally. Mutation-tested (reverted
   the fix, confirmed the new e2e case fails with the exact old error, restored, confirmed it passes
   and needs only ONE model call). This one is mechanical (a JS exception path), so it needed no live
   model to validate.
3. **Chapter-title post-pass failures — INVESTIGATED, NOT FIXED.** Already substantially hardened
   (3 attempts, 4-rung parsing ladder, whole-chain context from an earlier release's fix, a generous
   token budget checked against `callLLM`'s real signature). No new static defect found. **Needs a
   live-model reproduction** — this is the standing rule in its purest form: nothing left here is
   diagnosable from source alone.

Full diagnosis chains (what was read, what was measured, what each fix actually changed) are in
`roadmap_v85.md`'s `v85_r` entry — read it before re-deriving any of this from scratch.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v85.md` — its **index table** and **⚠️ Session protocol** block first, then
   the `v85_r` shipped entry.
3. `INTERNALS.md` **§6b** — unaffected by this cut (no `index.html` changes); the six comic-panel rows
   (`v85_j` through `v85_p`) still stand for that subsystem.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 283 checks
node test/run.js --quick                  → expect 245
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Corpus at this cut: **327 topics, 92 storylines, 33 languages, 686 `en` keys** (UNCHANGED from
`v85_q` — this cut touched `server.js`/`prompts.json`/tests only, no new strings, no corpus edit).
`APP_VERSION = 'v85_r'`.

⚠️ **TWO known failures in the baseline** (unchanged from `v85_q`): both `run.js` and `run.js --quick`
show `unit: current roadmap names the current line` and `unit: docs/ built from current sources`,
both because the WORKING-TREE `lessons.json` has grown past what's committed — the user's own live
testing (see the warning right below). Both are DATA-DRIFT failures, not code bugs, and will keep
failing between releases as the user's own corpus grows.

⚠️ **Check `git status --short lessons.json` at the start of this session.** The user is actively
using this app for real work on their own separate, long-running dev server (found bound to port 3000
across `v85_k` through `v85_r`, never touched). If `lessons.json` shows modified, that is their own
data — not yours to revert, commit, or "fix around" without asking. `git checkout -- lessons.json`
and `git add -A` were BOTH blocked by this environment's own permission classifier earlier in the
`v85` line; use `git show HEAD:lessons.json > /tmp/somewhere.json` (read-only) and stage files
explicitly by name. **If a release needs `docs/index.html` rebuilt while `lessons.json` is dirty**,
point `build-static.js` at that temp file explicitly (`node build-static.js /tmp/somewhere.json`) —
`v85_q` and `v85_r` both did this, never reading the working-tree file for the build.

⚠️ **A manual `PORT=NNNN node server.js` live-verification run is NOT data-isolated by default** —
pass `LESSONS_FILE=/tmp/...`. `v85_m` learned this the hard way; every cut since has done it right.

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is the thing to
> fix** — unless the failure is one of the two documented `lessons.json` items above.

## The habits that cost this project the most (full incident history: `roadmap_v84.md`'s "Rules
earned in session N…the v84 line" blocks)

1. **Measure before editing.**
2. **Guard at the layer where the claim is observable**, and mutation-test every guard.
3. **For any refactor claiming to preserve behaviour, CAPTURE the old output and DIFF it.**
4. **`buildExercises` is NON-DETERMINISTIC IN CONTENT, not just order.**
5. **Ask before restarting a dev server you did not start, and before deleting data you did not
   create.**
6. **A live model call needs a live test AND a real human reading the output** — `v85_p`'s whole cut
   is the strongest version of this rule yet, and `v85_r`'s item 3 (chapter-title) is its cleanest
   NEGATIVE instance: sometimes the honest output of "measure before editing" is that there is nothing
   left to edit without a live reproduction, and the right move is to say so, not to guess a fix.
7. **A fix to one stage's OUTPUT SHAPE can silently break a DOWNSTREAM consumer that assumed the OLD
   shape** — `v85_p`'s own storyboard fix broke `e2e-book-formats.test.js`'s stale assertion of the
   OLD unconditional behaviour; found only by re-running the FULL suite after the fix, not by
   reasoning about the change in isolation.
8. **A per-caller fix does not generalize to other callers of the same primitive** — the storyboard
   opt-in flag needed threading through THREE independent callers (comic, PDF, wizard) at `v85_p`;
   `v85_r`'s article-symmetry fix is the SAME shape one level down — `v80_j` fixed `vocab.system` and
   never checked whether "generate vocab" had a second prompt-level caller. It did
   (`vocabFromText.system`), untouched for five releases. **When a guard checks ONE known-good
   instance of a pattern, ask whether the pattern has other instances the guard doesn't reach.**
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
    silently revert LATER, unrelated uncommitted work** — safe only when the backup was taken
    immediately before the ONE mutation being reverted; verify the diff afterward regardless. `v85_r`
    did this twice more (the article-rule mutation test, the skill-tag mutation test), correctly both
    times, diffing after each restore.
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
32. **Rebuilding a generated artifact (`docs/index.html`) while `lessons.json` is dirty with the
    user's own live data needs the BUILD SCRIPT pointed at the COMMITTED file, not the working tree
    one.**
33. **An all-or-nothing validation throw on ONE ITEM inside a MULTI-ITEM generation result discards
    every OTHER item too** — `v85_r`'s skill-ID fix generalises `resolveVocabularySkillTags`'s own
    existing "pending, not fatal" policy (already applied to well-formed-but-unregistered proposals)
    to missing/malformed ones too, rather than inventing a new policy. When a module already has a
    graceful-degradation path for one failure shape, check whether a SIBLING failure shape is wrongly
    routed to a harder one instead of asking whether a new path is needed.

# WHERE TO START

**Chapter-title post-pass failures are still open** (`v85_r` item 3) — genuinely needs a live-model
reproduction, not more code reading. If the user hits this again in real usage, capture the actual
raw model response (not just "it failed") before touching `generateChapterMeta` again — the parsing
ladder is already thorough, so a repeat failure is more likely a NEW shape this session hasn't seen,
and guessing at another rung without the raw text risks the same "another prohibition" trap `PLAN §F3`
already named once.

**Live-verify `v85_r`'s article-symmetry fix and skill-ID fix in real usage** when the user next
generates lessons for real — particularly anything routing through `vocabFromText` (comic panels, PDF
uploads, pasted story+translation), since that path's article-symmetry prompt has NEVER been
regenerated against a live model with the fix in place.

Nothing else is pre-scoped. Other real, unmeasured gaps carried from `v85_q`: mobile/touch rendering
for the comic drawing UI and panel-display cards; non-German target languages for the case-restoration
fix (German-only); the HARD `§2.7` fixture (Page A) never tried with any model/strategy; Tier 2
(per-word image coordinates) still explicitly out of scope.

**Explicitly out of scope, confirmed with the user across the whole `v85` line — do not reopen without
asking**: the CP1-6 pipeline's cross-chapter arc-sequencing; spell-check-driven auto error-hunt
generation. The browser-reachable single-chapter CP1-4 pipeline (deferred by `PLAN §13`) remains a
separate, not-yet-scoped follow-up. A separate, NOT-yet-reported gap noticed in passing at `v85_r`:
`vocabTable.system` (the markdown-table format for non-JSON models) has no BASE FORM ONLY instruction
at all — not a contradiction, just an absence — left alone rather than folded into this cut's fix.

## ⚠️ OWED BY THE USER, not doable in a container

- **The whole `v84_g`…`v84_m` speech-recognition arc** — still not live-verified on a real device.
- **Windows Tier 1 install docs (`v84_n`)** — reasoned, not measured.
- **`apply-cp-lessons.js`'s `v83_p` re-verification** — blocked by machine resource contention.
- **The PASS MARK** — needs a browser pass, not code.
- **The whole `v85_c`…`v85_i` wizard shell / attribution wiring** — not checked on a real mobile
  device/viewport.
- **`v85_r`'s own two fixes** — mechanically sound (mutation-tested), but the article-symmetry one
  specifically needs live-model regeneration + a probe re-run to know whether the model actually
  obeys the fixed prompt. The skill-ID one is mechanical and doesn't need this.
- **Chapter-title post-pass failures (`v85_r` item 3)** — needs a live reproduction with the raw model
  output captured, not more source reading.

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map. The six comic-panel entries (`v85_j` through
`v85_p`) are consecutive rows — read all six before touching any part of that subsystem.
