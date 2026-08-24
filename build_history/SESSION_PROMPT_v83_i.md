# Session prompt — written at the `v83_i` cut

*(Rename this file for the version the session WRAPS UP WITH. `SESSION_PROMPT_v83_h.md` was the
previous one — superseded by this file and renamed, not kept alongside. Keep using the double-
letter suffix scheme (`v83_j`, `v83_k`, …) unless a future session has a good reason to switch to
`v84_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Fresh session picking up from the **`v83_i`** release —
`PLAN §7.0` **CP2**: analysis report (lemma/form/phrase/sense/frequency/script proposals),
report-only, model-in-the-loop. Second buildable slice of Track A's accepted parallel-curriculum
direction; sits ON TOP of `v83_h`'s CP1 output.

**`v83_a`–`v83_h`, condensed** (full write-ups in `roadmap_v83.md`'s `# SHIPPED IN THE v83 LINE` —
read there before touching ANY of this): `v83_a` cut this base line from `v82` to hand off `PLAN
§12`. `v83_b` shipped `PLAN §12` (the text-selection tutor) whole, including a user ruling that moved
the tutor's reply language from `srcLang` to `APP.uiLang` for the whole tutor. `v83_c`–`v83_g` are one
continuous arc of user follow-ups on the progress card and question cards: a nav/progress-bars popup
(`v83_c`), extended to the entry card (`v83_d`), header-row arrows made progressively heavier until
they matched a named reference exactly (`v83_e`), a REVOCATION of the fill-height story panel plus
question cards defaulting to collapsed (`v83_f`, THIRD ruling on that one line), and the story panel's
border shifting red→green with comprehension-specific progress (`v83_g`). `v83_h` shipped `PLAN §7.0`
CP1 — two new standalone files (`canonical-text.js`/`build-canonical-text.js`): stable
chapter→sentence→token records + provenance, over a 24-chapter representative sample,
`canonical-text.json`, never touching `lessons.json`. **Two things worth knowing before assuming a
NEW bug report needs a code fix**: this line diagnosed a "broken" popup string as a long-running
un-restarted server process (`v82_i`, predating this whole line), and a "can't reach it from my
phone" report as `localhost` meaning the phone itself, not a network issue. Both are in `v83_g`'s own
write-up.

**`v83_i`, in brief**: *"PLAN §7.0 CP2"* — the user asked for it BY NAME immediately after CP1
shipped. One new standalone file, **model-in-the-loop this time** (CP1 was not): `canonical-
analysis.js` → `analyzeSentence(model, sentenceRec, opts)` makes ONE real LLM call per CP1 sentence
record, proposing lemma/form/sense per token plus multiword `phrases`. **The uncertainty contract is
the whole point of this stage**: a token the model's reply never mentions becomes
`confidence:'unresolved'` — provably distinct from the model answering `'low'` — never dropped, never
fabricated, and this is exercised through a REAL HTTP call to a new `test/fake-ollama.js` branch
(`careful linguistic analyst`), not a hand-written string (rule 7). `frequency` and `script` need NO
model call — both are deterministic (`computeFrequency`, `scriptsForLangCP2`, the latter reading
`scripts.json` directly, the same file server.js's own `scriptsForLang` reads). The model call itself
goes through `llm.js` — the SAME standalone module `server.js` already requires — so CP2 needed no
new HTTP client and no `server.js` dependency (which would bind a port). The CLI,
`build-canonical-analysis.js`, reads CP1's own `canonical-text.json` as input (never `lessons.json`
directly — CP2 sits on top of CP1's own sentence/token boundaries), report-only by default,
`--write`/`--out`/`--in` same convention as `v83_h`'s CLI, default `--limit` 2 chapters (model calls
are slow; CP1's were not).

**One safety lesson from this release, worth knowing before you next mutation-test a `--write`
CLI**: the mutation-test for "never writes into `canonical-text.json`" was hand-edited directly into
the CLI rather than routed through `--out`/`--in`, so it wrote straight into the REAL, COMMITTED
`canonical-text.json` on disk. Caught immediately (`git status`/`git diff --stat`, restored with `git
checkout --`), but it should not have been possible to get that far. **Point BOTH `--in` and `--out`
at scratch copies before mutating a `--write` CLI**, don't trust the mutation to respect the redirect
flags on its own.

## Orient yourself

1. **This file**, whole.
2. `build_history/roadmap_v83.md` — its **index table** and the **⚠️ Session protocol** block first,
   then the standing RULES, then `# SHIPPED IN THE v83 LINE` for how `v83_b`…`v83_i` were built, and
   `PLAN §7.0`'s own migration sequence (§0, "THE LARGER PLAN" section) before touching CP3 or later.
   (Nothing is in TRACK T right now — steps 1–4 and `§T7` all shipped in the v81 line.)
3. `INTERNALS.md` — constants, silent-failure modes, invariants, harness limits. **§6b is a
   feature → function map** — read it BEFORE grepping for where anything lives.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 256 checks
node test/run.js --quick                  → expect 228
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Corpus at this cut: **327 topics, 92 storylines, 33 languages, 657 `en` keys** (unchanged since
`v83_c` — this release has no user-facing string at all, report-only by design). Two NEW files exist
alongside `lessons.json`, both report-only stores, neither part of the `lessons.json` schema:
**`canonical-text.json`** (CP1, `v83_h`) — 24 chapters, 153 sentences, 2266 tokens; **CP2's own
output store is NOT committed by default** — `build-canonical-analysis.js` writes
`canonical-analysis.json` only when explicitly run with `--write` (model calls are slow, so this
release did not commit a default sample the way CP1 did). Nothing reads either store yet; do not wire
either into the player without a CP3+ ruling first.
`APP_VERSION = 'v83_i'`.

⚠️ **The user's own main dev server (port 3000) needs a MANUAL restart to see anything past
`v83_f`** — check its reported version against `APP_VERSION` before assuming it's current, and ask
before restarting it (their own terminal, their own call, per `v83_g`'s own exchange on this).

⚠️ **`ui.json` may be mid-translation in the user's OWN terminal, independent of this session.** At
the `v83_h`/`v83_i` cut a live `translate-ui.js --threads 5` process was found running in a separate
terminal (`ps aux`, not this session's doing), adding real translations for the many `en`-only keys
this v83 line accumulated. `ui.json` was deliberately left OUT of both the `v83_h` and `v83_i`
commits so this release does not race that work. **Check `ps aux | grep translate-ui` and `git status
--short ui.json` before assuming an uncommitted `ui.json` diff is stray or yours to revert** — it may
be the user's own in-progress work.

> **These four expectations and the four corpus numbers are GUARDED** by `unit-roadmap-version`
> against the actual suite and against the data files. **If that test fails, the number in THIS file
> is the thing to fix.**

- `unit-static-freshness` red → `node build-static.js`. **Read what it NAMES first.** If it names
  `ui.json` and the user has a live translation pass running (see above), build against the
  COMMITTED `ui.json` (`git show HEAD:ui.json` to a scratch copy, or a careful stash/restore dance),
  not the live working-tree file — don't let a release's `docs/index.html` embed unreviewed,
  uncommitted content.
- `unit-script-choice` red saying topics are unstamped → `node backfill-script.js --write`.
- **Order matters: backfill FIRST, build-static SECOND.** A fixer is not a diagnosis (rule 23).

## The habits that cost this project the most

*(Full incident history for each numbered rule lives in `roadmap_v82.md`'s "Rules earned in session
N" blocks — this is the short form, not a replacement for reading those before citing one.)*

1. **Measure before editing.** A warning in the notes is a claim about a DESIGN, not about the
   problem (rule 35). `v83_h`'s version: when PORTING logic from one file to another, GENERATE real
   output and inspect it — a clean diff/copy is not the same claim as "it still does the right
   thing" (a furigana-sentinel bug was invisible to everything except real output).
2. **Guard at the layer where the claim is observable** (rule 34), and **a guard that SCANS SOURCE
   TEXT can trip on its own explanatory comment**, not just on the code it means to check. Don't
   spell a source-scanned pattern in prose near the code it checks. MUTATION-TEST every guard
   regardless: break the rule and check the guard goes red.
2b. **When a NEW request deliberately supersedes an OLD test invariant, REWRITE the test to state
   what holds NOW, with the supersession explained inline** — don't just loosen or delete the
   assertion.
2c. **When a second request extends a feature you JUST built, extract the shared logic** — don't
   copy-paste a near-identical second implementation.
3. **For any refactor claiming to preserve behaviour, CAPTURE the old output and DIFF it.** "The
   tests still pass" is a weaker claim — a whole suite has been green with a real contamination bug
   in place before, found only by diffing real data.
4. **`buildExercises` is NON-DETERMINISTIC IN CONTENT, not just order** (`v80_t`). Any test that
   samples the corpus must accumulate across builds and be verified over ~15 consecutive runs.
5. **A zero-callers finding is not by itself permission to delete** (`v81_q`). Check for a standing
   warning before assuming a measurement is the whole story; ask the user if the two disagree.
6. **Never put emoji in a Python string literal** (rule 25); write them via a `cat` heredoc. And
   check what a mechanical rewrite DID, not just that it ran.
7. **A live model call needs a live test, not a plausible prompt** (`v82_e`, `v82_i`, `v83_b`,
   `v83_i`). `v83_i`'s version: `canonical-analysis.js`'s core uncertainty claim (a token the model
   never answers for is `'unresolved'`, distinct from `'low'`) was proven over a REAL HTTP round trip
   to a scripted fake backend, not just by unit-testing the parser against a string literal.
8. **Ask before restarting a dev server you did not start, and before deleting data you did not
   create.** Check `lessons.json`'s mtime and the server's reported version before touching either.
   A THROWAWAY server on a spare port is the reusable pattern for any live check that doesn't need
   to touch the shared server.
9. **A test file's `--write`/output path must never be the real, COMMITTED artifact** (`v83_h`) —
   `build-canonical-text.js`/`build-canonical-analysis.js` both gained a `--out <path>` flag
   specifically so their test suites could exercise the real CLI without resizing a checked-in
   artifact on every run. Apply it to any FUTURE script that both (a) has a CLI test exercising it
   for real and (b) writes a committed file.
10. **Mutation-testing a `--write` CLI must redirect BOTH input and output to scratch copies BEFORE
   mutating** (`v83_i`, new) — a hand-edited mutation that bypasses `--out`/`--in` can write straight
   into a real, committed file. `v83_i`'s own mutation test did exactly this (into
   `canonical-text.json`), caught only by `git status` after the fact and restored with `git checkout
   --`. Point the redirect flags at `fs.mkdtempSync` scratch paths FIRST, don't trust the mutation to
   respect them on its own.

---

# WHERE TO START

## 1. The PASS MARK is still owed, and still by the user

`Churros` is 40 items where it was 83 questions, and an item is solved by ANY correct answer, so 80%
is a materially lower bar. Needs a browser pass, not a code change.

## 2. `test/lib-dom.js`'s `textContent` ordering bug — a fix is IN PROGRESS, elsewhere

Found while building `v83_b`'s own test: trailing text after a child element
(`'x<b>A</b>y'.textContent`) comes back mis-ordered — a pre-existing defect in the shared DOM test
stub. **The user has since started that task in a separate session, running independently of this
one.** Don't duplicate the work — check whether it has landed before touching this yourself.

## 3. `PLAN §7.0` CP3 — the natural next slice, if the user wants to continue Track A

CP1 (`v83_h`) and CP2 (`v83_i`) are done: stable records + provenance, then lemma/form/phrase/
sense/frequency/script proposals, both report-only. CP3 is next in the migration sequence: *"proposed
curriculum plan. Emit concepts, reasons, prerequisites, ordering, and suitable existing exercise
families for a text/chapter/learner. Compare it with current generated lessons on a small
representative set; still emit no new lessons."* This is a PLANNING layer over CP2's proposals, not a
new model-call shape — CP3's own comparison-with-current-lessons framing needs the existing
`lessons.json` generation logic read carefully first. Do NOT start it without the user asking for it
by name — each migration stage being "independently useful" is not the same claim as "the next one is
pre-authorised."

## 4. BUILDABLE NOW, no ruling needed

- **`PLAN §C1`'s FIRST gate bug** — *"browsed forward to the story card and back, solved no
  comprehension lesson, yet could proceed."* **⚠️ THREE readings are already DEAD ENDS** — see the
  `v80_b` entry in `roadmap_v80.md` and the `v81_j` addendum in `roadmap_v81.md` before spending time
  on it. **What is still unmodelled is the "Back LINK" specifically** — get the exact click sequence
  from the user before trying a fourth reading.
- **The dead-taps HIGHLIGHTING question** — closed to zero for the tap itself (`v81_f`+`v81_h`), but
  a different, still-open decision remains: **should the story panel mark a word at all when its
  ONLY teaching lesson is hidden?** `probe_tap_reachable_v81d.js` measures it. Needs a ruling before
  building either direction.
- **`PLAN §F2`'s second half** — the "answer visible in the stem" detector, measured and deliberately
  left unenforced because prefix-matching is mild morphology. Reported by
  `probe_word_forms_defects_v80g.js`.
- **`PLAN §D4`'s one measured rough edge** — a minor, low-priority prompt-compliance gap in
  `writing`'s content-vs-language-issue grading. See `roadmap_v82.md`'s `v82_f` entry.

## 5. ⚠️ OWED BY THE USER, not doable in a container

- **`PLAN §F3`** — the article prompt fix shipped at `v80_j` and is **UNVERIFIED BY DESIGN**.
  Regenerate MANY lessons, then re-run `probe_article_symmetry_v80j.js` against its baseline: **1.0%
  overall but BIMODAL** (191 chapters at 0%, two at 100%). **One lesson proves nothing.**
- **The translate pass** for the remaining `en`-only keys — **IN PROGRESS**, a live `translate-ui.js
  --threads 5` process was seen running in the user's own terminal at this cut (see the ⚠️ note
  above). Also owed: `translate-ui.js --langnames`, the `hr` `ui.json` pass, and a native-speaker
  check of the `cyrillic-sr` table.
- **A device pass on the WHOLE `v81_a`…`v81_ad` UI-redesign arc — never done by the user.** Read
  `roadmap_v81.md`'s own release entries (`v81_w` onward especially) for exactly what to click
  through.
- **A device pass on the WHOLE `v83_b`…`v83_g` progress-card/question-card arc** — every check so
  far is an AGENT's browser pass, not the user's own. Worth one combined pass since they share the
  same popup/header-row/border-colour interaction surface, on a range of REAL story lengths and a
  real phone, not just the fixtures each agent check happened to use.

## 6. NOT yours to start

Import "new" mode is POSTPONED. **Track A's CP1/CP2 report-only work (`PLAN §7.0`) is DONE, shipped
this line; CP3 onward needs the user to say so explicitly (see §3 above) — new input/UI import mode
remains postponed regardless.** **Mastery-driven progression (`PLAN §9b/D2`) remains a user product
decision**: B4 runs in shadow mode, but it must accumulate a meaningful disagreement log before that
decision is reconsidered. The learner/teacher rework — `_canEdit()` is done; `Edit / rename topic`
stays visible by user ruling.

**⚠️ THE TRACK T COLOURING NUMBERS MOVED AT `v81_d`** — the denominator used to count questions no
round can build. GREEN 18.6% → **27.8%**, PARTIAL 19.5% → **11.8%**, mean questions per word 2.20 →
**1.79**. **No ruling is reversed; none may be re-opened without re-measuring** via
`probe_word_green_impact_v81d.js` (NOT `probe_learner_known_v80l.js`, which re-derives the colouring
inline and cannot see inside `_wordProgress`).

**Do not re-derive the per-text learning scheme measurements.** A chapter's lessons teach **9.2% of
its story's tokens, 8.2% of its distinct words**, rarest words least covered (**5.1%**). Inflection
share measured at `v80_f`: **47.3% of taught words are findable in the story, 36.4% ABSENT in any
form**, and a matcher is worth ~10 points, not fifty — **the ceiling is a GENERATION problem.**

## Standing tools — use them

**Before grepping for where something lives, check `INTERNALS.md` §6b** — it is the permanent,
actively-maintained function map. This prompt only keeps the probe scripts, since those are quick
reference and not duplicated in INTERNALS.md.

- **`canonical-text.js` / `build-canonical-text.js`** (`v83_h`, `PLAN §7.0` CP1) — `buildCanonicalText(topic)`
  is the pure core; the CLI wraps it with the report-only/`--write` convention. `canonical-text.json`
  is the OUTPUT store, entirely separate from `lessons.json`.
- **`canonical-analysis.js` / `build-canonical-analysis.js`** (`v83_i`, `PLAN §7.0` CP2) —
  `analyzeSentence`/`analyzeChapter` are the model-in-the-loop core; the CLI reads CP1's
  `canonical-text.json` as INPUT and writes its own separate `canonical-analysis.json`. Model calls
  go through `llm.js` (shared with server.js, safe to require). `computeFrequency`/
  `scriptsForLangCP2` need no model call. Do NOT `require` server.js from either CP1 or CP2 file
  (binds a port as a side effect).
- `probe_gates_v80c1.js` — the `PLAN §C1` gate probe. Reports, does not assert.
- `probe_gates_v77.js` — re-run **and diff** after any progress-card change. **⚠️ It SELECTS its
  chapters from the corpus, so a data drop moves the selection.** Baseline: `v80i_card_gates.txt`.
  **It renders the card structurally, not through a browser — it will not see the `v83_c`/`v83_d`
  popups at all**; re-check whether it still measures what it claims.
- `probe_word_green_impact_v81d.js` — what TRACK T's colouring paints, through `_wordProgress` /
  `_wordState`. `PROBE_CLIENT=` diffs two builds.
- `probe_word_green_v81c.js` — declared probe keys vs the BUILDABLE universe (60.8% at `v81_d`).
- `probe_comp_skip_v81c.js` — drives `showComplete(true)` over every later chapter and CLICKS
  `comp-next`. Unaffected by `v83_c`'s popup relocation (same id, same onclick).
- `probe_tap_reachable_v81d.js` — highlighted words whose tap resolves to nothing.
- `probe_learner_known_v80l.js` — the older colouring probe. ⚠️ RE-DERIVES the colouring inline.
- `probe_inflection_v80f.js`, `probe_article_symmetry_v80j.js`, `probe_lesson_script_v80h.js`,
  `probe_word_forms_defects_v80g.js`, `probe_forks_v79k.js`, `probe_coverage_v78n.js`.
  **All report; none assert.** The article one is explicitly NOT language-blind.
- `_cardErrors()` — assert it is empty after any card render you add.
- `_storyBodyHtml(d, opts)` — **the ONE story renderer**. `PLAN §12`'s selection hook
  (`.story-selectable`) is applied here. Fill-height chain REVOKED at `v83_f` — natural sizing now.
- `_exStoryPanelHtml(ex)` — question/exercise screens' own panel (`#ex-story-panel`). Collapsed by
  default since `v83_f` (THIRD ruling on this line — read its own comment).
- `_sumCoverageFrac(rows)` / `_redGreenHex(frac)` (`v83_g`) — the progress card's border colour,
  comprehension-specific progress, NOT the general pass mark. Fed by `_postRows`.
- `_tutorGatherContext()` / `/api/tutor` — `uiLang` (reply language) ADDITIVE alongside `srcLang`
  (retrieval/ledger, unchanged) — see `v83_b`'s entry before touching either.
- `openCompNav()`/`closeCompNav()`/`openSumNav()`/`closeSumNav()`/`_closeCardNavPopups()` (`v83_c`/
  `v83_d`) — one popup per card; `_closeCardNavPopups()` is what `show(id)` actually calls.
- `_mirrorNavBtn(srcId, dstId)` (`v83_d`, glyph-mirroring dropped `v83_e`) — mirrors FUNCTIONAL state
  only; the header-row glyph is fixed markup (`➜`, matching `.lang-pair-arrow`) since `v83_e`.
- `recordObservation(ex, correct)` / `APP.progress.observations` / `refreshBktShadow(d)` — the
  `PLAN §8/B1–B4` evidence path. See `INTERNALS.md` §6b before extending it.
