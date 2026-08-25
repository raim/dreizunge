# Session prompt — written at the `v85_m` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v85_m`, `v85_n`, …) unless a future
session has a good reason to switch to `v86_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v85_m`**. This session shipped `PLAN
§2.4` / Track A4 **milestone 3**: chapter formation from extracted comic panels, live-verified
end-to-end (both extraction AND chapter creation) against the real model.

**What just shipped (`v85_m`)**: one uploaded comic page = one chunk = one chapter, fed through the
SAME `/api/generate-book` pipeline PDF/pasted-story uploads already use. `_comicBuildStoryText()`
joins each panel's caption then in-scene text (user's ruling: both, not caption-only) in reading
order; `comicCreateChapter()` builds the request; `_pollComicBookJob()` (a sibling of `_pollBookJob`,
not a reuse — confirmed, the third time this exact server-reuses/client-doesn't pattern has recurred
this line) tracks completion. Server-side, `_runBookJob` gained one line attaching a chunk's
`comicPanels` onto the persisted topic. See `roadmap_v85.md`'s `v85_m` entry and `INTERNALS.md` §6b
for the full mechanism table.

**One operational lesson from this cut's own live verification, worth remembering**: a manual
`PORT=NNNN node server.js` (used for live-model checks throughout this line) uses the DEFAULT
`lessons.json` — unlike the e2e harness's `boot()`, which always isolates to a temp file. This cut's
live check briefly wrote a real test chapter into the user's actual corpus before being caught (via a
before/after topic-id diff) and cleaned up with `DELETE /api/lessons/delete`. **Any future live
verification against real server.js needs an explicit `LESSONS_FILE` env override, or the same
careful before/after diff + cleanup this cut did.** Do not assume a quick manual server run is
data-isolated the way `boot()` is.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v85.md` — its **index table** and **⚠️ Session protocol** block first, then
   the `v85_m` shipped entry, then the whole `PLAN §2.4` sequence (RESULT PART 1/2/3, UI SCOPING) if
   continuing Track A4.
3. `INTERNALS.md` **§6b** — the milestone 3 entry is the newest comic-panel row, right after
   milestone 2's.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 278 checks
node test/run.js --quick                  → expect 242
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Corpus at this cut: **327 topics, 92 storylines, 33 languages, 684 `en` keys** (2 new keys:
`form.comic_create`/`comic_create_failed`). `APP_VERSION = 'v85_m'`.

⚠️ **Check `git status --short lessons.json` at the start of this session.** The user is actively
using this app for real work on their own separate, long-running dev server (found bound to port
3000 across `v85_k`/`v85_l`/`v85_m` — never touched). Two of their own real edits (a QC proposal, a
lesson update) landed in `lessons.json` during this very session, independent of anything this
session did. If it shows modified, that is their own data — not yours to revert, commit, or "fix
around" without asking. `git checkout -- lessons.json` and `git add -A` were BOTH blocked by this
environment's own permission classifier earlier in the `v85` line (destructive/blanket git actions);
use `git show HEAD:lessons.json > /tmp/somewhere.json` (read-only) for a committed-content snapshot,
and stage files explicitly by name rather than `-A`.

⚠️ **A live server verification writes to the REAL `lessons.json` unless isolated.** See the note
above this file's header — always pass `LESSONS_FILE=/tmp/... ` when hand-running `server.js` for a
live check, or be prepared to diff before/after and clean up via `DELETE /api/lessons/delete` the way
this cut did.

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is the thing to
> fix** — unless the failure is the documented `lessons.json` mismatch above.

## The habits that cost this project the most (full incident history: `roadmap_v84.md`'s "Rules
earned in session N…the v84 line" blocks)

1. **Measure before editing.**
2. **Guard at the layer where the claim is observable**, and mutation-test every guard.
3. **For any refactor claiming to preserve behaviour, CAPTURE the old output and DIFF it.**
4. **`buildExercises` is NON-DETERMINISTIC IN CONTENT, not just order** — `v85_m`'s own live check
   hit a real lesson-generation flake (bad skillId) on the first attempt, unrelated to the code being
   verified; an identical retry succeeded. Don't mistake ordinary model non-determinism for a bug in
   new code — but DO verify with a retry, don't just assume "must be a flake" without checking.
5. **Ask before restarting a dev server you did not start, and before deleting data you did not
   create.** (Deleting data you DID accidentally create, to restore a clean state, is the correct
   response, not a violation of this rule — `v85_m`'s own cleanup.)
6. **A live model call needs a live test AND a real human reading the output.**
7. **A fix to one stage's OUTPUT SHAPE can silently break a DOWNSTREAM consumer that assumed the OLD
   shape.**
8. **A per-caller fix does not generalize to other callers of the same primitive.**
9. **A "safe-looking" optimization that reads fresh state can still defeat an existing guarantee.**
10. **When a change is the FIRST of its kind to touch the live app or write to a real corpus, ASK how
    far it should go before building.**
11. **When restructuring markup into new wrapper elements, verify div-balance with a real HTML parser.**
12. **When a plan document's own claim about "reuses existing machinery X" doesn't survive reading X's
    actual code, STOP and ask.** `v85_m` is the THIRD recurrence of the specific split-verdict shape
    (server-side job/poll primitives reuse cleanly; client-side polling wrappers are hardwired to
    their original caller and need a sibling, not a reuse) — `startBackgroundJob` (milestone 2
    scoping), then confirmed again for `_pollBookJob` (milestone 3). Worth treating as a standing
    expectation for this codebase's own architecture, not re-deriving from scratch each time, though
    still worth a quick confirming read before relying on it.
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
22. **A destructive or blanket git action (`git checkout -- <file>`, `git add -A`) can be BLOCKED by
    this environment's own permission classifier** — use the read-only/explicit equivalent instead.
23. **An "index-aligned by construction" claim between a client array and a server response array
    needs a test that actually BREAKS one element and checks the SURVIVORS' indices.**
24. **A prompt validated on ONE real fixture does not transfer its validated behaviour just because
    the prompt was generalized in prose.**
25. **A background process started with a bare shell `&` inside a tool call may or may not survive
    past that tool call's own lifetime** — verify, don't assume.
26. **A test asserting on ASYNC SIDE EFFECTS of a fire-and-forget server route must wait for the
    job's own completion signal before checking those side effects**, not just for the triggering
    request to resolve.
27. **A manual `PORT=NNNN node server.js` live-verification run is NOT data-isolated the way the e2e
    harness's `boot()` is** — it writes to the REAL `lessons.json` by default. `v85_m` caught this via
    a before/after topic-id diff and cleaned up immediately; the safer default going forward is an
    explicit `LESSONS_FILE=/tmp/...` override on any hand-run verification server from now on.

# WHERE TO START

**Track A4 milestone 4** (progress-card integration) is the last milestone in the original plan — see
`roadmap_v85.md`'s "PLAN §2.4 — UI SCOPING" section: a new branch in `_storyBodyHtml` (the ONE shared
story renderer already reaching every progress card/question panel/chain view) keyed on
`d.comicPanels`, rendering each panel's image with its transcribed text, Tier 1 word-highlighting via
the EXISTING `_highlightVocabHtml` machinery on the transcribed text (not per-word image coordinates —
Tier 2, still out of scope, still unmeasured). Comic-sourced chapters only, per the standing ruling
from earlier in this line. No open ruling blocks starting it.

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
  not a real comic page on a real mobile touch device.
- **`v85_k`/`v85_l`/`v85_m`'s extraction+chapter pipeline** — verified end-to-end against REAL comic
  content (German) through the actual production routes, but only ONE real fixture, one language.
  Broader real-world panel variety (messy crops, rotated text, non-German languages, multi-page
  storylines) remains unmeasured.

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map. The comic-panel entries (`v85_j` UI, `v85_k`/
`v85_l` extraction, `v85_m` chapter formation) are consecutive rows — read all three before touching
any part of this subsystem.
