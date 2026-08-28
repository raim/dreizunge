# Session prompt — written at the `v86_n` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v86_d`, `v86_e`, …) unless a future
session has a good reason to switch to `v87_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v86_n`**. The user asked what to work
on toward "text analysis and annotation and alternative display of grammar annotation in the progress
card" — this turned out to be item W ("text explorer" mode), which turned out to overlap heavily with
`PLAN §7.0`'s own half-implemented CP1–6 curriculum pipeline (a question the user asked directly: "not
overlap with the other plan?"). That reconciliation, and one small piece of groundwork toward it, is
what shipped this cut.

**What just shipped this cut (two commits, `fb63755` doc-only + `v86_n`)**:

1. **`roadmap: item W reconciled with PLAN §7.0 CP5, scoped not built`** (doc-only, no `APP_VERSION`
   bump) — item W ("text explorer" mode: hover/click any word for its grammatical analysis,
   independent of playing lessons) and `PLAN §7.0` CP5 ("let the progress card read analysis and skill
   data") are the SAME feature, arrived at independently from the UI side and the pipeline side, never
   cross-referenced until now. Full module-by-module finding (what CP1/CP2/CP3 actually are today, what
   already works, what the real remaining gap is) is in item W's own roadmap section and in the
   `PLAN §7.0` CP5 bullet's forward-pointer — **read both before doing anything with item W**, they are
   the single source of truth for this reconciliation, not this prompt.
2. **`v86_n` — a new `OLLAMA_ANALYSIS_MODEL` role**, groundwork only (step 1 of item W's own 4-step
   recommended path) — same runtime-switchable pattern every other model role uses, but **nothing
   calls it yet**. Steps 2–4 (the real build: a background job to run CP1+CP2 for a chapter on demand
   + a per-topic cache, a GET endpoint mirroring the existing `cp5ShadowFor()` pattern, then the client
   "text explorer" UI) were deliberately NOT started this cut — see "WHERE TO START" below for why.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v86.md` — its **index table** and **⚠️ Session protocol** block first, then
   **item W's own section** (the full CP1/CP2/CP3 integration-gap analysis and the 4-step recommended
   path — this is the thing to read before touching item W at all), then the rest of the "OPEN AT THE
   v86 CUT" section, unchanged from `v86_m` otherwise.
3. `INTERNALS.md` **§6b** is current through `v86_g` for the comic-panel subsystem specifically; the
   model-roles table gained a new `OLLAMA_ANALYSIS_MODEL` row this cut (right after
   `OLLAMA_VISION_MODEL`'s own) — other sections are kept current inline as each cut touches them.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 287 checks
node test/run.js --quick                  → expect 248
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

⚠️ **One kind of "expected" failure can show up in a full run, NOT a regression, and it is
REPRODUCIBLE (not intermittent), inherited unchanged from `v86_m`**: `unit-article-choices`, which
reads the LIVE `lessons.json` directly — one `it`-language article lesson somewhere in the live corpus
can't build a full 3-way MCQ. Confirmed failing the same way across multiple runs at the `v86_m` cut;
not investigated further this cut (this cut's own work was entirely item-W scoping + the model-role
addition, unrelated). Still worth a look — see "WHERE TO START" below.

Corpus at this cut: **336 topics, 97 storylines, 33 languages, 692 `en` keys** — an inherently live
snapshot for the topic/storyline counts; re-measure fresh if `unit-roadmap-version` disagrees. `en`
keys unchanged from `v86_m` (no user-facing change this cut at all — the new model role has no UI). No
new topics/storylines from this session's own work; `lessons.json` was never touched (confirmed clean
via `git status --short lessons.json` throughout). `APP_VERSION = 'v86_n'`.

⚠️ **A CP1/CP2 module check found real, checkable facts, not just design opinions — reuse them, don't
re-derive them.** Both `canonical-text.js` (CP1) and `canonical-analysis.js` (CP2) are safe to
`require()` directly from `server.js` (the "standalone on purpose" file-header comments only forbid
the OTHER direction — CP1/CP2 must never require `server.js`, since loading it binds an HTTP port as a
side effect). CP2 already depends on `llm.js`, which `server.js` already requires (line 14, aliased
`_rawCallLLM` etc.) — no new dependency risk. CP1 has already been run at corpus scale once
(`canonical-text.json`, 24 chapters, committed since `v83_h`) but `server.js` has never read it. CP2's
own output (`canonical-analysis.json`) has never been generated at corpus scale — only one real chapter
has ever been analysed and its quality measured (`v83_n`→`v83_p`: production model 0/8 words wrong,
cheap dev-default model 2/8 wrong). **CP2 is slow**: one model call per sentence, sequential — "one
4-sentence chapter took 12+ minutes even on a warm model" in a real test this session found on record.
Any browser-reachable CP2 call MUST be a background job with a per-chapter cache, never synchronous.

⚠️ **This container HAS a live model backend** — check `ollama list`/`curl localhost:11434/api/tags`
fresh each session. Confirmed again this cut: `qwen3.6:35b-a3b` (the default text-role model, now also
the new `analysis` role's own default), plus vision and translation models, all installed. Item AB's
own "stuck mid-sentence" half, item P, and item AD (source-language furigana) all still need a
live-model check/reproduction before any code ships there.

⚠️ **Check `git status --short lessons.json` at the start of this session.** The user is actively
using this app for real work on their own separate, long-running dev server. If `lessons.json` shows
modified, that is their own data — not yours to revert, commit, or "fix around" without asking.
`git checkout -- lessons.json` and `git add -A` were BOTH blocked by this environment's own permission
classifier earlier in this project's history (`git mv` is NOT blocked — used cleanly again this cut);
use `git show HEAD:lessons.json > /tmp/somewhere.json` (read-only) and stage files explicitly by name.
`docs/index.html` bakes in `APP_VERSION` at build time — bumping the version WITHOUT rebuilding docs
makes `unit-version-derivation` go red (this exact ordering mistake was made and caught mid-session at
BOTH the `v86_m` and `v86_n` cuts this session — rebuild `node build-static.js` AFTER, not before, the
`APP_VERSION` edit, or just always rebuild last, right before the final green-suite check).

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is the thing to
> fix**, not the guard.

## The habits that cost this project the most (full incident history: `roadmap_v85.md`'s "Rules
earned in session N…the v85 line" blocks — now 46 standing rules)

1. **Measure before editing** — grep every reference to a control's underlying state before touching
   the control's own presentation, so a shape change doesn't accidentally also change the state model.
2. **Guard at the layer where the claim is observable** — re-read what each existing test is actually
   CLAIMING before deciding whether a shape change needs a rewrite or just an id/argument update.
3. **A guard that pins the EXACT ARGUMENTS/CONDITION of a call breaks on any legitimate change** — keep
   updating pinned tests to match real behaviour changes, not just extending them.
4. **A test that reads the LIVE corpus directly can fail from the user's own real-time usage alone —
   but re-run it a few times before assuming that's the explanation.** A reproducible failure across
   several runs is a real defect, not noise; the two are distinguishable by just re-running.
5. **For any refactor claiming to preserve behaviour, CAPTURE the old output and DIFF it.**
6. **A live model call needs a live test AND a real human reading the output** — when no human is
   available mid-session, start the server yourself (if none is already running), drive the real
   route, and read BOTH the server log and the model's own reply before calling a fix verified.
7. **Ask before restarting a dev server you did not start, and before deleting data you did not
   create** — but a GENERATED build artifact (`docs/index.html`) can be freely rebuilt from safe,
   committed sources even when it independently shows as modified.
8. **When two roadmap items describe the same underlying capability from two different angles (a UI
   ask vs. a pipeline spec), check for overlap BEFORE scoping either one in isolation** — new this
   cut, earned by item W/CP5 sitting unreconciled across two separate write-ups for multiple releases.
9. **A track explicitly tagged "(multi-session)" in the roadmap is a standing judgment call already
   made — don't override it with same-session optimism without a real reason.** Also new this cut:
   used to decide item W's steps 2–4 belong in a fresh session, not this one.
10. **Small, mechanical, independently-testable groundwork (a new config role with no caller yet) is a
    reasonable thing to land in an otherwise-investigation-heavy session** — it doesn't commit to the
    larger build, is fully reversible, and gives the next session real infrastructure to call into
    instead of a hardcoded string. Don't confuse "this is groundwork for a multi-session feature" with
    "nothing in this session should touch the code at all."

# WHERE TO START

**Item W, steps 2–4** (the actual CP1/CP2 browser integration: background job + cache, GET endpoint,
client UI) is the natural next thing given the user's own stated direction — but per rule 9 above,
this is explicitly "(multi-session)" work and deserves a session with a full, unhurried budget,
especially since CP2's own live-verification step alone costs real wall-clock minutes per chapter, not
tokens. Read item W's own roadmap section in full before starting; it has the concrete 4-step order.

**Item AE (mobile-backgrounding) is still open** — blocked on the user hitting it again with the
`v86_j` diagnostic logging in place; do not attempt a fix without that console evidence in hand.

**The `unit-article-choices` reproducible red** (inherited from `v86_m`, still not investigated) is
worth a look before or alongside item W's steps 2-4 — it's cheap to diagnose (the test itself names the
failure mode) and it's a genuine, confirmed-reproducible defect, not noise.

Otherwise, a reasonable ordering, not a ruling, unchanged from `v86_m`:
- **Item AB's "stuck mid-sentence" half** remains open — needs live reproduction.
- **Item AD (source-language furigana)** is scoped (needs a live-model check, and a toggle-sharing
  design question settled).
- **Item R** (unfinished-project persistence) is the remaining client-facing half of item S.
- **Item P** needs a live-model check before any code ships.
- **Item C (comic/PDF upload-card UX)** still needs the user's own confirmation of the recommendation.
- **Item A (move comic images out of `lessons.json`)** needs the user's own go-ahead before touching
  the 6 existing topics.
- **Item D (Tier 2 image-coordinate highlighting)** is buildable now that Tier 1 genuinely works.
- **Items B, E, G** are each independently startable.
- **Item F's "add explanations" half** remains open and unscoped in detail.

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map — current through `v86_g` for the comic-panel
subsystem; other sections are kept current inline as each cut touches them.
