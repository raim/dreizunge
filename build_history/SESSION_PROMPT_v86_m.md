# Session prompt — written at the `v86_m` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v86_d`, `v86_e`, …) unless a future
session has a good reason to switch to `v87_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v86_m`**. The user said "continue
dreizunge — start from build_history/SESSION_PROMPT_v86_l.md" right after `v86_l` shipped; with no
specific item named, I picked item AB's "unrelated context" half — the most concretely-scoped open
item that needed no user ruling, only the standing live-model check.

**What just shipped (`v86_m`)**:

**Item AB (the "unrelated context" half) — tutor's recency-fallback context retrieval now gated on
conversation history.** `tutorRetrieveContext` (server.js) falls back to "grab up to 4 topics by
recency, regardless of relevance" whenever the learner's question tokenizes to nothing meaningful —
by design, so a genuinely topic-less OPENING question still gets some grounding. That same fallback
was also firing on a short mid-conversation continuation ("finish that sentence please"), which needs
no NEW grounding since the real context is the conversation history already sent separately — exactly
the shape of the user's own report (4 unrelated topics named as retrieved context on a stuck reply).
Fixed with a new `hasHistory` option (`/api/tutor` passes `history.length > 0`); the fallback is now
skipped outright when the question is topic-less AND history already exists. Live-verified against
the real `qwen3.6:35b-a3b` model on a real corpus topic pair (fr←de): the opening-question case still
grounds correctly (a reply that genuinely referenced the retrieved story); the continuation case now
sends no context at all (prompt tokens 1282→667) and the reply stayed coherent, grounded purely in
history. Full diagnosis, the exact live-check transcript, and the test/mutation-test details are in
`roadmap_v86.md`'s `v86_m` entry.

**Also this cut**: `docs/index.html` rebuilt (`node build-static.js`) — it had gone stale relative to
the prior `c8fa64d` "adding recent lesson work" commit (lessons.json changed, docs was never rebuilt
after); unrelated to the AB fix but cheap and safe to clear since `lessons.json` was clean. `INTERNALS.md`'s
tutor row updated in place with the new `hasHistory` behaviour.

**A new, unrelated finding, flagged not fixed**: `unit-article-choices.test.js` (reads the live
`lessons.json` directly) now fails REPRODUCIBLY — same result across 3 consecutive runs, not corpus
noise — with "every it article lesson still builds an MCQ (3 built, 1 did not)". One `it`-language
article lesson somewhere in the live corpus can't derive a full 3-way MCQ. Not investigated this cut;
worth a look next session, starting from `unit-article-choices.test.js` itself to find which lesson.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v86.md` — its **index table** and **⚠️ Session protocol** block first, then
   the full "OPEN AT THE v86 CUT" section (item AB's "unrelated context" half now shipped; its "stuck
   mid-sentence" half is UNCHANGED and still open, needs live reproduction — everything else — items
   A, B, C, D, E, G, item F's own "add explanations" half, item AD (source-language furigana), the rest
   of the `v86_h` batch, and item AE (still open, needs the user to hit it again with diagnostic
   logging in place) — is unchanged and still open).
3. `INTERNALS.md` **§6b** is current through `v86_g` for the comic-panel subsystem specifically; the
   tutor row (updated `v86_m`) and other small fixes since are documented inline in their own existing
   sections as each shipped, rather than batched into a catch-up pass — keep doing it that way as you
   go, it's cheaper than letting it accumulate.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 287 checks
node test/run.js --quick                  → expect 248
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

⚠️ **One kind of "expected" failure can show up in a full run, NOT a regression, and it is now
REPRODUCIBLE rather than intermittent**: `unit-article-choices`, which reads the LIVE `lessons.json`
directly — confirmed failing the same way across 3 consecutive runs at this cut (see "A new, unrelated
finding" above). `docs/index.html` freshness was ALSO in this bucket at the `v86_l` cut but is fixed
now — a fresh `unit-static-freshness` red would mean `lessons.json` changed again since this rebuild
(check `git status --short lessons.json` and `git show HEAD:lessons.json` before assuming a
regression, same as always).

Corpus at this cut: **336 topics, 97 storylines, 33 languages, 692 `en` keys** — an inherently live
snapshot for the topic/storyline counts; re-measure fresh if `unit-roadmap-version` disagrees. `en`
keys unchanged from `v86_l` (no new user-facing strings this cut). `APP_VERSION = 'v86_m'`.

⚠️ **A live-model-check requirement can be satisfied by starting `server.js` yourself and hitting the
real route directly** — no server was already running at the `v86_m` cut (confirmed via `ps`/`ss`
before starting one), so this cut started its own on a scratch port, drove `/api/tutor` with `curl`
against real corpus data, read the server's own console log to confirm the RETRIEVAL side (the `ctx:`
suffix, present/absent), and read the JSON reply to confirm the MODEL side — then stopped the server
itself afterward, since it was the one that started it. A server already running (the user's own dev
session) must never be restarted or reused this way without asking first — same as always.

⚠️ **A guard that pins the EXACT ARGUMENTS of a function call breaks on any legitimate signature
change to that call** — confirmed again this cut: adding `hasHistory` to the `tutorRetrieveContext({…})`
call broke `unit-tutor-selection.test.js`'s own pinned regex (which expected the call to end
`srcLang })`). Fixed by widening the regex to match the new shape and adding an explicit assertion for
the new argument — not by loosening what the guard actually claims.

⚠️ **Check `git status --short lessons.json` at the start of this session.** The user is actively
using this app for real work on their own separate, long-running dev server — confirmed actively
testing across many consecutive cuts this session already. If `lessons.json` shows modified, that is
their own data — not yours to revert, commit, or "fix around" without asking. `git checkout --
lessons.json` and `git add -A` were BOTH blocked by this environment's own permission classifier
earlier in this project's history (`git mv` is NOT blocked — used cleanly this cut for the session-
prompt rename); use `git show HEAD:lessons.json > /tmp/somewhere.json` (read-only) and stage files
explicitly by name. If a release needs `docs/index.html` rebuilt while `lessons.json` is dirty, point
`build-static.js` at that temp file explicitly — if it's CLEAN, the plain default is fine (this cut's
own rebuild used the plain default, confirmed clean first).

⚠️ **This container HAS a live model backend** — check `ollama list`/`curl localhost:11434/api/tags`
fresh each session. Confirmed again this cut: `qwen3.6:35b-a3b` (the default tutor/story/lesson model),
plus several vision and translation models, all installed. Item P and item AB's own "stuck
mid-sentence" half both still need a live-model check/reproduction before any code ships there. Item AD
(source-language furigana) will need one too once built.

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is the thing to
> fix**, not the guard.

## The habits that cost this project the most (full incident history: `roadmap_v85.md`'s "Rules
earned in session N…the v85 line" blocks — now 46 standing rules)

1. **Measure before editing** — grep every reference to a control's underlying state before touching
   the control's own presentation, so a shape change doesn't accidentally also change the state model.
2. **Reuse a control's own existing per-language update function for new i18n needs, rather than a
   second mechanism.**
3. **Guard at the layer where the claim is observable** — re-read what each existing test is actually
   CLAIMING before deciding whether a shape change needs a rewrite or just an id/argument update.
4. **A guard that pins the EXACT ARGUMENTS/CONDITION of a call breaks on any legitimate change** — keep
   updating pinned tests to match real behaviour changes, not just extending them (confirmed again
   this cut — new emphasis).
5. **A test that reads the LIVE corpus directly (not an isolated fixture) can fail from the user's own
   real-time usage alone — but re-run it a few times before assuming that's the explanation.** This
   cut's `unit-article-choices` failure reproduced identically 3/3 times: a real, reproducible corpus
   defect, not noise — the two are distinguishable by just re-running.
6. **For any refactor claiming to preserve behaviour, CAPTURE the old output and DIFF it.**
7. **A live model call needs a live test AND a real human reading the output** — when no human is
   available mid-session, start the server yourself (if none is already running), drive the real
   route, and read BOTH the server log (retrieval/routing side) and the model's own reply (quality
   side) before calling a fix verified.
8. **Ask before restarting a dev server you did not start, and before deleting data you did not
   create** — but a GENERATED build artifact (`docs/index.html`) can be freely rebuilt from safe,
   committed sources even when it independently shows as modified. READING `lessons.json`/
   `learners.json` for diagnosis is always fine; writing to either is the restricted action.
9. **"A per-caller fix does not generalize" cuts both ways — proactively check SIBLING callers of a
   fixed primitive, don't wait for a second bug report to find them.**
10. **When a change is the FIRST of its kind to touch the live app or write to a real corpus, ASK how
    far it should go before building.**
11. **A silent `.filter()`/discard in any path whose OUTPUT the user can observe needs a toast on
    partial loss, not just total loss — and now ALSO a console log.**
12. **Before refactoring any function, check whether anything actually exercises IT — or only its
    callers with it mocked out.**
13. **A feature added to ONE `init()` needs an explicit decision about every OTHER `init()`-shaped
    entry point this codebase maintains separately.**

# WHERE TO START

**Item AE (mobile-backgrounding) is still open** — blocked on the user hitting it again with the
`v86_j` diagnostic logging in place; do not attempt a fix without that console evidence in hand.

**The new `unit-article-choices` reproducible red** is worth a look before anything else purely
scoped-new this cut — it's cheap to diagnose (the test itself names the failure mode) and it's now a
genuine, confirmed-reproducible defect rather than noise.

Otherwise, a reasonable ordering, not a ruling:
- **Item AB's "stuck mid-sentence" half** remains open — needs live reproduction (the `v86_h` ask-time
  logging now supports catching it when it next happens).
- **Item AD (source-language furigana)** is scoped (needs a live-model check, and the toggle-sharing
  design question settled — one furigana setting for both directions, or two independent ones).
- **Item R** (unfinished-project persistence) is the remaining client-facing half of the "don't lose
  generation work" story item S already closed the server-side half of.
- **Item P** both needs a live-model check before any code ships.
- **Item C (comic/PDF upload-card UX)** still needs the user's own confirmation of the recommendation.
- **Item A (move comic images out of `lessons.json`)** is architecturally load-bearing, but the
  migration of the 6 existing topics needs the user's own go-ahead first.
- **Item D (Tier 2 image-coordinate highlighting)** is buildable now that Tier 1 genuinely works.
- **Items B, E, G** are each independently startable.
- **Item F's "add explanations" half** remains open and unscoped in detail.

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map — current through `v86_g` for the comic-panel
subsystem; other sections are kept current inline as each cut touches them.
