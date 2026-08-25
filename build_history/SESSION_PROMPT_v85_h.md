# Session prompt — written at the `v85_h` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v85_b`, `v85_c`, …) unless a future
session has a good reason to switch to `v86_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v85_h`** — `v85_a` was a fresh cut for
the generator-page redesign (`PLAN §13`); `v85_b` shipped two small unrelated fixes; `v85_c`–`v85_g`
shipped `PLAN §13` milestones 1–4 in full. **`v85_h` shipped milestone 5's FIRST item** — the
`doDialectImport()` language-pair bug (it was hardcoded to German on BOTH client and server, not just
the client — see `roadmap_v85.md`'s `v85_h` entry for the full investigation). **Milestone 5's SECOND
item — attribution fields for generation-time text sources — is investigated but NOT built**; it
turned out to have real scope questions (which completion path(s) to wire it onto) that weren't
resolved before this cut ended. See "WHERE TO START" below.

⚠️ **Also recorded at `v85_h`, worth internalizing before touching `server.js` again**: the user's own
long-running dev server (port 3000) was confirmed, via `/api/info`, to still be running **`v85_b`'s**
code throughout this entire session — Node loads route-handling code once at process start, unlike
`index.html` (served fresh via `fs.readFileSync` per request). Every "verified live" claim in
`v85_c`–`v85_g` was genuinely live because it touched ONLY `index.html`; `v85_h` was this line's FIRST
`server.js` change, and a `curl`-based live check against the port-3000 server gave a FALSE NEGATIVE
(looked unfixed) purely because the server hadn't restarted — not because the fix was wrong. The real
verification came from `test/e2e-dialect-import.test.js`, which spawns its OWN fresh `node server.js`
process per run. **For any future `server.js` change: verify via a fresh-process e2e test, not a curl
against the user's own dev server, unless the user has restarted it (ask first, per the standing
rule).**

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v85.md` — its **index table** and **⚠️ Session protocol** block first, then
   the `v85_h` shipped entry (top of `# SHIPPED IN THE v85 LINE`) for the dialect fix and the
   fresh-process-verification lesson, then `PLAN §13` itself (search for it — near the end, under
   "THE LARGER PLAN") for the full generator-page redesign assessment.
3. `INTERNALS.md` **§6b, the feature → function map** — read it BEFORE grepping for where anything
   lives (carries the wizard-shell entries for `v85_c` through `v85_g`; `v85_h`'s own dialect fix is a
   small enough change it was not given its own §6b row — grep `doDialectImport`/`sanitizeTopicSource`
   directly if needed).
4. `roadmap_v84.md`'s own `# SHIPPED IN THE v84 LINE` if you need to know HOW something already
   working was built — not copied here, go there directly.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 272 checks
node test/run.js --quick                  → expect 238
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Corpus at this cut: **327 topics, 92 storylines, 33 languages, 675 `en` keys** (unchanged from
`v85_g` — the dialect fix needed no new UI strings). `APP_VERSION = 'v85_h'`.

⚠️ **Check `git status --short lessons.json` at the start of this session.** If it shows modified,
that is very likely the user's own real, uncommitted evaluation/play data — not yours to revert,
commit, or "fix around" without asking. Back it up, `git checkout --` it for any build/test work,
restore it after.

⚠️ **The user's own main dev server (port 3000) needs a MANUAL restart to see anything past the
version it was last started with** — confirmed STILL on `v85_b` as of this cut (see the warning
above). Ask before restarting it. **`ui.json`'s own `fs.watch` hot-reload was ALSO observed not to
pick up an edit live** (`v85_e`/`v85_g`) — a separate, narrower staleness than the server-code issue
above (that one DOES have a watcher, it just didn't fire). `index.html` remains unaffected either way
(served via `fs.readFileSync` per request).

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is the thing to
> fix**, not the guard.

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
   site. `v85_h`'s own dialect bug was exactly this shape (client AND server both hardcoded the SAME
   value independently) — a per-caller fix would have missed half of it.
9. **A "safe-looking" optimization that reads fresh state can still defeat an existing guarantee
   whose enforcement lived in a step the optimization skips** — mutation-test it against every
   EXISTING guard it touches.
10. **When a change is the FIRST of its kind to touch the live app or write to a real corpus, ASK how
    far it should go before building.**
11. **When restructuring markup into new wrapper elements, verify div-balance with a real HTML parser
    over the changed region**, not by eyeballing indentation.
12. **When a plan document's own claim about "reuses existing machinery X" doesn't survive reading X's
    actual code, STOP and ask** — this line's own recurring finding (`v85_d`, `v85_f`); `v85_g` is the
    counter-example (the claim held up cleanly). Read the machinery first regardless.
13. **A new UI affordance that makes an EXISTING code path more reachable can surface a pre-existing
    bug in that path** (`v85_e`).
14. **This harness's `document.getElementById`/`.querySelector` NEVER return null on a miss** — check
    `.tagName`/`.children.length` against the expected real result, not `!!` truthiness.
15. **`vm.runInContext` (`C.run()`) rejects a bare top-level `await`** — wrap in `(async()=>{...})()`,
    await OUTSIDE via `settle()`.
16. **Two code paths that both produce "the same observable zero-calls result" can still differ in
    WHY** — a fetch-call-count check alone can't always distinguish a deliberate skip from a
    guard-less crash silently swallowed by a `try/catch`; a second signal may be needed.
17. **THE ONE THIS CUT ADDS: `server.js` changes need a FRESH PROCESS to verify live — the user's own
    long-running dev server does NOT pick them up, unlike `index.html`.** A `curl` against port 3000
    testing a server-side fix can give a false negative that looks exactly like "the fix didn't work."
    Use `test/lib.js`'s `boot()` (spawns a fresh `node server.js`) via a real e2e test instead — it's
    both the correct verification AND avoids the restart-permission question entirely.
18. **Restoring a working file from a LOCAL BACKUP taken for an earlier, unrelated mutation test can
    silently revert LATER, unrelated uncommitted work** — `v85_h`'s own near-miss (caught via
    `git diff --stat` before it went anywhere) is the concrete example. Prefer `git diff`/targeted
    string replacement over "restore from a snapshot I took a while ago" once several edits have
    landed since that snapshot was taken.

# WHERE TO START

## `PLAN §13` milestone 5, item 2 — attribution fields for generation-time text sources

**Investigated this cut, not built — the scope turned out to be a real fork, not a quick wire-up.**
The schema (`topic.source = {author, licence, url, note}`, sanitized by `sanitizeTopicSource()`) and
endpoint (`POST /api/topic-source`, needs an EXISTING topic `id`) both already exist and work — proven
by `openProvEdit()`/`saveProvEdit()`, the post-hoc editor on the progress card (`#prov-stats`). The
gap is genuinely "wire it into generation time," but "generation time" turns out to mean at least
THREE distinct, only-loosely-related completion paths in `doGenerate()`/`pdfGenerateAll()`:

1. **Single pasted story** (`useStory`, no upload) — the plain `/api/generate` branch, completing via
   either an immediate `resp.cached` hit or the async `startBackgroundJob(resp.jobId, topic)` path
   (NOT traced this cut — read it before assuming its completion shape matches the multi-chapter
   book's).
2. **PDF/file upload** (`_uploadMode` + `_pdfChunks`) — an ENTIRELY SEPARATE function,
   `pdfGenerateAll()` (not read this cut at all), which the SAME `#user-story-panel` checkbox
   (`use-story-cb`) can also lead to, producing potentially MULTIPLE chapters from one uploaded
   document's chunks.
3. **Default LLM-topic-driven generation** (no pasted/uploaded source) — attribution arguably doesn't
   even apply here (the model authored the text, there's no external source to credit) — likely
   OUT of scope for this item regardless of how 1/2 resolve.

Before writing any code: **read `startBackgroundJob`'s own completion handling AND `pdfGenerateAll()`
in full** — same discipline every `PLAN §13` milestone this line has used. Then decide (ask if
genuinely unclear, same pattern `v85_d`'s shortcut and `v85_f`'s per-chapter override both used):
should this item cover ONLY the single-pasted-story path (smallest, cleanest — one topic, one
attribution, one `/api/topic-source` call once its id is known), extend to the PDF/upload path too
(potentially several chapters sharing ONE attribution — a small loop, similar shape to `v85_g`'s own
`_applyPostGenFeatures`), or something narrower still. **Do not assume "small" from the roadmap's own
one-line description without reading all three paths first** — this cut's own attempt at that is
exactly what surfaced the fork.

Once this item ships, **`PLAN §13` is FULLY DONE** — update the roadmap's own index-table language to
say so.

**Explicitly out of scope, confirmed with the user across this whole line — do not reopen without
asking**: comic/image import; the CP1-6 pipeline's cross-chapter arc-sequencing; spell-check-driven
auto error-hunt generation. The browser-reachable single-chapter CP1-4 pipeline IS in scope, but
sequenced AFTER `PLAN §13` milestones 1–5 ship.

## ⚠️ OWED BY THE USER, not doable in a container

- **The whole `v84_g`…`v84_m` speech-recognition arc** — still not live-verified on a real device.
- **Windows Tier 1 install docs (`v84_n`)** — reasoned, not measured.
- **`apply-cp-lessons.js`'s `v83_p` re-verification** — blocked by machine resource contention.
- **The PASS MARK** — needs a browser pass, not code.
- **The whole `v85_c`…`v85_g` wizard shell** — not checked on a real mobile device/viewport.
- **A real end-to-end run of `v85_e`/`v85_f`/`v85_g`'s own features against a live LLM backend** — all
  verified with the network layer stubbed.
- **`v85_h`'s dialect fix, against the user's OWN real dev server** — verified via a fresh e2e-spawned
  process, not the user's long-running one (see the warning above for why not).

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map, including the whole speech-recognition
subsystem, the `PLAN §7.0` pipeline, and the `v85_c`→`v85_g` generator-wizard entries — read those
entries before touching any of these areas.
