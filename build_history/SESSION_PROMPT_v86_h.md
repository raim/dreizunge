# Session prompt — written at the `v86_h` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v86_d`, `v86_e`, …) unless a future
session has a good reason to switch to `v87_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v86_h`**. While the user live-verified
the `v86_d`–`v86_g` round on their device, this cut caught up `INTERNALS.md` (doc-only, `be31e4d`) and
triaged a 16-item real-usage batch: 4 items built, 13 scoped into the roadmap as items P through AC.

**What just shipped (`v86_h`)**:

1. **`INTERNALS.md` §6b caught up** — seven cuts of comic-panel rows (`v85_t` through `v86_g`),
   doc-only, its own commit before any code change this cut.
2. **Item Q — comprehension questions must be independently answerable.** A prompt-only fix (one new
   rule in `comprehension.system`) — not live-verified, but low-risk enough to build anyway (states
   something the prompt structure already assumed).
3. **Tutor logs on ASK now, not just on a completed reply** — a stuck/broken reply used to leave no
   trace at all.
4. **QC: a 'rewrite' verdict can now be accepted, not just discarded** — only 'corrupt' (genuine model
   corruption) is hard-blocked now; a large change-ratio alone (which a short text trips easily even
   for a valid small edit) no longer forces "discard or nothing."
5. **Static build: tap-to-advance on plain story text was silently dead there** — `_storyTapInit()`
   was never wired into `build-static.js`'s own `init()` replacement, even though the function itself
   was present and correct in the static bundle.

**13 items scoped into `roadmap_v86.md` as items P through AC** (not built this cut) — see the "A NEW
BATCH" section: item P (inflection MCQ distractors, needs live-model work), R/S (intermediate
"unfinished" project persistence + incremental lesson saves — a real, related pair worth building
together), T (needs reproduction), U (a jobs/unfinished-projects popover), V (multi-image comic
upload), W (a "text explorer" grammar-hover mode — the user's own words: "THIS WILL BE A REALLY NICE
FEATURE"), X (alternative-correct-answer strategies — four options recorded verbatim from the user),
Y (storyline-card popover redesign), Z (word-tap question routing), AA (teacher/student dropdown —
genuinely close to easy, a good first pick for a future session), AB (tutor context-retrieval
root-caused this cut, "stuck mid-sentence" needs live reproduction), AC (chapter-icon/thumbnail
fallback hierarchy). Item F (article-symmetry) also gained a NEW live recurrence + a new
"add explanations" ask this cut — read its extended write-up, not just the original `v85_r` scoping.

Full diagnosis (the QC verdict/rejected distinction, the tutor retrieval root-cause, the static-init
gap) is in `roadmap_v86.md`'s `v86_h` entry.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v86.md` — its **index table** and **⚠️ Session protocol** block first, then
   the **"OPEN AT THE v86 CUT"** section IN FULL (items A–G still open from the original cut; H and Q
   both shipped now; the NEW "A NEW BATCH" section holds P, R–Z, AA–AC — 13 fresh items, none built
   yet), then the `v86_g`/`v86_h` shipped entries.
3. `INTERNALS.md` **§6b** is now CURRENT through `v86_g` — keep it that way going forward (add a row
   the same cut you name a function you had to hunt for, per its own closing note).

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 286 checks
node test/run.js --quick                  → expect 247
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

⚠️ **`unit-static-freshness` may show ONE EXPECTED failure if `lessons.json` is dirty** (the user's own
live testing) at whatever moment you run this — `docs/index.html` gets rebuilt from the last COMMITTED
`lessons.json`, never a dirty working copy, per the standing rule. Check `git status --short
lessons.json` first; if clean, the baseline really is 0 failures.

Corpus at this cut: **334 topics, 96 storylines, 33 languages, 690 `en` keys** — unchanged from `v86_g`
(one existing string, `qc.rewrite_warn`, was REWORDED this cut, not added — key count unchanged). Note
topics/storylines are inherently a live snapshot (see `v86_g`'s own note) — re-measure if
`unit-roadmap-version` disagrees, don't assume the number here is still current. `APP_VERSION = 'v86_h'`.

⚠️ **A prompt can ALREADY state a rule and still not be reliably followed by the model** — item P's
own finding: `inflections.system` already asks for same-DIMENSION distractors, in plain language, and
the model still mixes dimensions sometimes. Before assuming a prompt needs a NEW rule, check whether
the rule is already there and the gap is COMPLIANCE, not coverage — those need different fixes (a
contrastive few-shot example vs. a new sentence), and only a live-model test tells them apart.

⚠️ **A verdict/severity classifier can conflate two genuinely different signals under one boolean.**
`classifyStoryQc`'s `rejected` field used to mean "corrupt OR just a big edit" — two things with very
different appropriate RESPONSES (never acceptable vs. "let a human decide after reviewing the diff").
Splitting them (`verdict === 'corrupt'` vs. checking `verdict` more specifically) unblocked a real,
correct use case. When a boolean gate feels too strict for a case you can point to, check whether it's
actually conflating two verdicts that deserve different treatment.

⚠️ **A feature added to the REGULAR `init()` needs an explicit decision about the STATIC build's own
`init()` replacement — silence there means "never added," not "same behaviour."** `_storyTapInit()`
sat correctly defined in the static bundle for a whole session's worth of cuts, silently never called.
`build-static.js`'s own `init()` is a SEPARATE, hand-maintained function, not a diff against the
regular one — anything added to the regular `init()` (inside or outside the `@static-exclude` region)
needs its own explicit "does static need this too?" check, not an assumption either way.

⚠️ **Reading a user's LIVE data file to diagnose a bug is fine; writing to it is not** — item AB's own
`tutorThread` read (learners.json) is the latest instance of this already-standing rule (see `v86_g`'s
own note). Also worth remembering for NEXT time: `tutorThread` stores only `{role, text}`, no
timestamp or scope — a stuck/broken exchange genuinely cannot be correlated after the fact from stored
data alone. This cut's own ask-time tutor logging directly closes that gap going forward.

⚠️ **Two DIFFERENT tests have now flaked transiently across this line's own baseline runs**
(`unit-observations-log.test.js`, `unit-dreizunge-launcher.test.js`) — both confirmed to pass cleanly
standalone every time, both unrelated to anything touched. If either shows up red in a full-suite run,
re-run standalone before assuming a regression.

⚠️ **This container HAS a live model backend** — `qwen2.5vl:7b` via Ollama for vision, and text-role
models for everything else. Check `ollama list`/`curl localhost:11434/api/tags` fresh each session.
Item P specifically needs a live model + a real human reading several generated items before any
prompt change ships; item AB's own retrieval-fallback fix needs the same before shipping.

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is the thing to
> fix**, not the guard.

## The habits that cost this project the most (full incident history: `roadmap_v85.md`'s "Rules
earned in session N…the v85 line" blocks — now 46 standing rules)

1. **Measure before editing** — item P's own finding (a prompt rule already exists, compliance is the
   gap) came from actually reading `inflections.system` before assuming a rule was missing.
2. **A fix that adds a NEW, REPEATING call path to a function needs that function checked for hidden
   "runs once" assumptions.**
3. **Guard at the layer where the claim is observable** — read the ACTUAL stored data for a reported
   real case when a client-side theory alone can't settle the question.
4. **A guard that pins the EXACT ARGUMENTS/CONDITION of a call breaks on any legitimate change** — the
   QC accept-gate tests were UPDATED to the new condition, not just left red or deleted.
5. **A test fixture drawn from the real corpus can silently become a different STRUCTURAL kind of
   fixture as the corpus grows**, not just drift on a count.
6. **For any refactor claiming to preserve behaviour, CAPTURE the old output and DIFF it.**
7. **A live model call needs a live test AND a real human reading the output** — item P and item AB's
   own retrieval fix both explicitly need this before shipping; item Q's prompt fix was built ANYWAY
   despite not being live-verified, because the risk profile is genuinely different (see its own note).
8. **Ask before restarting a dev server you did not start, and before deleting data you did not
   create** — but a GENERATED build artifact (`docs/index.html`) can be freely rebuilt from safe,
   committed sources even when it independently shows as modified. READING `lessons.json`/
   `learners.json` for diagnosis is always fine; writing to either is the restricted action.
9. **A per-caller fix does not generalize to other callers of the same primitive** — the QC accept-gate
   relaxation was applied to BOTH `/api/story-qc/accept` and `/api/summary-qc/accept` in the same cut,
   specifically because both were found to share the exact same gate — checked, not assumed.
10. **When a change is the FIRST of its kind to touch the live app or write to a real corpus, ASK how
    far it should go before building.**
11. **A silent `.filter()`/discard in any path whose OUTPUT the user can observe needs a toast on
    partial loss, not just total loss.**
12. **Before refactoring any function, check whether anything actually exercises IT — or only its
    callers with it mocked out.**
13. **A feature added to ONE `init()` needs an explicit check against every OTHER `init()`-shaped
    entry point this codebase maintains separately (the static build's own) — new this cut.**

# WHERE TO START

**Original items A–G from `roadmap_v86.md`'s "OPEN AT THE v86 CUT" section are still open** (H and Q
both shipped now). **13 fresh items from this cut's own batch (P, R–Z, AA–AC) are all open too** — see
the "A NEW BATCH" section for the full write-up of each.

A reasonable ordering, not a ruling:
- **Live-verify the WHOLE `v86_d`–`v86_h` round on a real device** — this was already in progress as
  of this cut (the user testing while this session worked); check in on what came back before building
  more on top of the comic subsystem specifically.
- **Item AA (teacher/student dropdown)** is genuinely close to easy — a good first pick if you want a
  quick, self-contained win from the new batch.
- **Items R and S** (unfinished-project persistence, incremental lesson saves) are worth designing
  TOGETHER — they may share one underlying "write progressively" mechanism.
- **Item P** and **item AB's own retrieval fix** both need a live-model check before any code ships.
- **Item C (comic/PDF upload-card UX)** still needs the user's own confirmation of the recommendation.
- **Item A (move comic images out of `lessons.json`)** is architecturally load-bearing, but the
  migration of the 6 existing topics needs the user's own go-ahead first — and item AC (thumbnail
  hierarchy) is worth sequencing AFTER it, not before.
- **Item D (Tier 2 image-coordinate highlighting)** is buildable now that Tier 1 genuinely works.
- **Items B, E, F, G** are each independently startable (F gained new scope this cut — read its
  extended write-up).

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map — now current through `v86_g`.
