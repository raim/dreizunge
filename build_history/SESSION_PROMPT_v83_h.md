# Session prompt — written at the `v83_h` cut

*(Rename this file for the version the session WRAPS UP WITH. `SESSION_PROMPT_v83_g.md` was the
previous one — superseded by this file and renamed, not kept alongside. Keep using the double-
letter suffix scheme (`v83_i`, `v83_j`, …) unless a future session has a good reason to switch to
`v84_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Fresh session picking up from the **`v83_h`** release —
`PLAN §7.0` **CP1**: canonical text + analysis records, report-only. The first buildable slice of
Track A's accepted parallel-curriculum direction, and a genuinely different KIND of work from
everything else in this cut (`v83_b`…`v83_g`, all progress-card/question-card UI): two new
standalone files, no client changes, no user-facing surface at all.

**`v83_a`–`v83_g`, condensed** (full write-ups in `roadmap_v83.md`'s `# SHIPPED IN THE v83 LINE` —
read there before touching ANY of this, the summary below is not a replacement): `v83_a` cut this
base line from `v82` to hand off `PLAN §12`. `v83_b` shipped `PLAN §12` (the text-selection tutor)
whole, including a user ruling that moved the tutor's reply language from `srcLang` to `APP.uiLang`
for the whole tutor. `v83_c`–`v83_g` are one continuous arc of user follow-ups on the progress card
and question cards: a nav/progress-bars popup (`v83_c`), extended to the entry card (`v83_d`),
header-row arrows made progressively heavier until they matched a named reference exactly (`v83_e`),
a REVOCATION of the fill-height story panel plus question cards defaulting to collapsed (`v83_f`,
THIRD ruling on that one line — full history recorded in the comment), and the story panel's border
now shifting red→green with comprehension-specific progress, a user ruling between two candidate
"pass marks" (`v83_g`). **Two things worth knowing before assuming a NEW bug report needs a code
fix**: this session diagnosed a "broken" popup string as a long-running un-restarted server process
(`v82_i`, predating this whole line), and a "can't reach it from my phone" report as `localhost`
meaning the phone itself, not a network issue. Both are in `v83_g`'s own write-up.

**`v83_h`, in brief**: *"PLAN §7.0 CP1"* — the user asked for it BY NAME, after the plan's own
migration-sequence text was explained back to them (`§0`'s diagram: text source → canonical text
model → language analysis → curriculum planner → lesson plan → generator/validator → existing
player → observations → skill estimates; CP1 is the FIRST rung). Two new standalone files:
`canonical-text.js` (pure core — `buildCanonicalText(topic)` derives a chapter→sentence→token record
tree with STABLE, position-derived ids and a content hash for staleness detection) and
`build-canonical-text.js` (the CLI, same report-only/`--write` convention as `backfill-script.js`).
**Deliberately does NOT `require` server.js** — server.js binds an HTTP port as a side effect of
being loaded (no `require.main` guard exists), so the small amount of needed tokenisation logic
(`jaTokenize`, `CJK_LANGS`, `isPunct`, sentence-splitting) is COPIED, mirroring the SAME
already-established duplication convention this project uses for `jaTokenize` between server.js and
index.html. **`lessons.json` is never written** — asserted both by pinning the source and by running
the real CLI against the real corpus and diffing the file byte-for-byte, for both the report-only and
`--write` paths. Output goes to a new, separate `canonical-text.json` (24 chapters, the default
representative sample spanning every language in the corpus).

**Two bugs found and fixed WHILE BUILDING, both worth knowing about if you touch either file again**:
1. A self-referential test-guard trap — the claim "does not depend on server.js" is checked by
   scanning `canonical-text.js`'s own source for a literal `require` call naming it, and the file's
   own explanatory COMMENT (written first) happened to spell that exact call as an example of what it
   was NOT doing. Fixed by rewording the comment, the same fix this project's `unit-screen-structure`/
   `unit-card-consistency` tests already document for their own source-scanned patterns — don't spell
   a pattern a nearby test scans for, in prose OR in comments.
2. The ported `jaTokenize`'s Unicode Private Use Area sentinel characters (U+E000/U+E001, which
   protect a kanji+furigana group from being split) silently became empty strings partway through
   authoring the file — a literal invisible character does not reliably survive file edits/tooling
   the way an escape sequence does. Caught only by GENERATING real output (a real furigana-bearing
   sentence) and finding the group split apart, not by a clean diff. Fixed with explicit `\uXXXX`
   escapes throughout. **If you ever write Unicode Private Use Area characters (or any other
   non-printing/control code point) into a source file, use the `\uXXXX` escape form, never a literal
   character** — this is now a measured, not theoretical, failure mode in this toolchain.

## Orient yourself

1. **This file**, whole.
2. `build_history/roadmap_v83.md` — its **index table** and the **⚠️ Session protocol** block first,
   then the standing RULES, then `# SHIPPED IN THE v83 LINE` for how `v83_b`…`v83_h` were built, and
   `PLAN §7.0`'s own migration sequence (§0, "THE LARGER PLAN" section) before touching CP2 or later.
   (Nothing is in TRACK T right now — steps 1–4 and `§T7` all shipped in the v81 line.)
3. `INTERNALS.md` — constants, silent-failure modes, invariants, harness limits. **§6b is a
   feature → function map** — read it BEFORE grepping for where anything lives.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 255 checks
node test/run.js --quick                  → expect 228
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Corpus at this cut: **327 topics, 92 storylines, 33 languages, 657 `en` keys** (unchanged since
`v83_c` — `v83_h` has no user-facing string at all, report-only by design). A NEW file exists
alongside `lessons.json`: **`canonical-text.json`** — CP1's own output store, 24 chapters, 153
sentences, 2266 tokens. It is NOT part of the `lessons.json` schema and nothing reads it yet (CP1 is
report-only); do not wire it into the player without a CP2+ ruling first.
`APP_VERSION = 'v83_h'`.

⚠️ **The user's own main dev server (port 3000) needs a MANUAL restart to see anything past
`v83_f`** — check its reported version against `APP_VERSION` before assuming it's current, and ask
before restarting it (their own terminal, their own call, per `v83_g`'s own exchange on this).

> **These four expectations and the four corpus numbers are GUARDED** by `unit-roadmap-version`
> against the actual suite and against the data files. **If that test fails, the number in THIS file
> is the thing to fix.**

- `unit-static-freshness` red → `node build-static.js`. **Read what it NAMES first.**
- `unit-script-choice` red saying topics are unstamped → `node backfill-script.js --write`.
- **Order matters: backfill FIRST, build-static SECOND.** A fixer is not a diagnosis (rule 23).

## The habits that cost this project the most

*(Full incident history for each numbered rule lives in `roadmap_v82.md`'s "Rules earned in session
N" blocks — this is the short form, not a replacement for reading those before citing one.)*

1. **Measure before editing.** A warning in the notes is a claim about a DESIGN, not about the
   problem (rule 35). `v83_c`'s version: read all four card screens' ACTUAL markup before deciding
   scope. `v83_e`'s: when the user names a REFERENCE, go read what it actually is before picking a
   fix. `v83_h`'s: when PORTING logic from one file to another, GENERATE real output and inspect it —
   a clean diff/copy is not the same claim as "it still does the right thing" (the furigana-sentinel
   bug above was invisible to everything except real output).
2. **Guard at the layer where the claim is observable** (rule 34), and — `v83_h`'s own addition —
   **a guard that SCANS SOURCE TEXT can trip on its own explanatory comment**, not just on the code
   it means to check. Don't spell a source-scanned pattern in prose near the code it checks.
   MUTATION-TEST every guard regardless: break the rule and check the guard goes red.
2b. **When a NEW request deliberately supersedes an OLD test invariant, REWRITE the test to state
   what holds NOW, with the supersession explained inline — don't just loosen or delete the
   assertion.** Hit three times in `v83_c`/`v83_d` alone (`unit-story-summary.test.js`,
   `smoke-render.test.js`'s row-order chain) — every one a legitimate PAST decision a real product
   change now overrides, rewritten to assert the new, narrower claim, not weakened into silence.
2c. **When a second request extends a feature you JUST built, extract the shared logic** (`v83_d`'s
   `_mirrorNavBtn`/`_closeCardNavPopups`) **— don't copy-paste a near-identical second
   implementation.**
3. **For any refactor claiming to preserve behaviour, CAPTURE the old output and DIFF it.** "The
   tests still pass" is a weaker claim — a whole suite has been green with a real contamination bug
   in place before, found only by diffing real data.
4. **`buildExercises` is NON-DETERMINISTIC IN CONTENT, not just order** (`v80_t`). Any test that
   samples the corpus must accumulate across builds and be verified over ~15 consecutive runs.
5. **A zero-callers finding is not by itself permission to delete** (`v81_q`). Check for a standing
   warning before assuming a measurement is the whole story; ask the user if the two disagree.
6. **Never put emoji in a Python string literal** (rule 25); write them via a `cat` heredoc. And
   check what a mechanical rewrite DID, not just that it ran.
7. **A live model call needs a live test, not a plausible prompt** (`v82_e`, `v82_i`, `v83_b`).
8. **Ask before restarting a dev server you did not start, and before deleting data you did not
   create.** Check `lessons.json`'s mtime and the server's reported version before touching either.
   A THROWAWAY server on a spare port is the reusable pattern for any live check that doesn't need
   to touch the shared server. (Snag: the default story model's warmup can take a while — set
   `OLLAMA_MODEL=qwen2.5:7b` on a throwaway instance when a live model call isn't what you're
   actually checking.)
9. **A test file's `--write`/output path must never be the real, COMMITTED artifact** (`v83_h`,
   new) — `build-canonical-text.js` gained a `--out <path>` flag specifically so
   `unit-canonical-text.test.js` could exercise the real CLI without resizing the checked-in
   `canonical-text.json` on every test run. The SAME principle `build-static.js`'s `docs/index.html`
   already follows (regenerated as an explicit release step, never a test side effect) — apply it to
   any FUTURE script that both (a) has a CLI test exercising it for real and (b) writes a committed
   file.

---

# WHERE TO START

## 1. The PASS MARK is still owed, and still by the user

`Churros` is 40 items where it was 83 questions, and an item is solved by ANY correct answer, so 80%
is a materially lower bar. Needs a browser pass, not a code change.

## 2. `test/lib-dom.js`'s `textContent` ordering bug — a fix is IN PROGRESS, elsewhere

Found while building `v83_b`'s own test: trailing text after a child element
(`'x<b>A</b>y'.textContent`) comes back mis-ordered — a pre-existing defect in the shared DOM test
stub. Flagged as a background task at the `v83_b` cut; **the user has since started that task in a
separate session, running independently of this one.** Don't duplicate the work — check whether it
has landed before touching this yourself.

## 3. `PLAN §7.0` CP2 — the natural next slice, if the user wants to continue Track A

CP1 (`v83_h`) is done: stable chapter/sentence/token records + provenance, report-only. CP2 is next
in the migration sequence: *"add lemma/form/phrase/sense/frequency/script proposals and retain the
exact derivation or model evidence. This is language analysis, not client-side morphology; it must
expose uncertainty/review rather than silently guessing."* Unlike CP1, CP2 is model-in-the-loop (a
real LLM call to propose lemmas/senses) — budget for rule 7 (a live model call needs a live test).
Do NOT start it without the user asking for it by name or explicitly agreeing to continue past CP1 —
CP1's own text says each stage is "independently useful," not that CP2 is pre-authorised.

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
- **The translate pass** for the remaining `en`-only keys, `translate-ui.js --langnames`, the `hr`
  `ui.json` pass, and a **native-speaker check of the `cyrillic-sr` table**.
- **A device pass on the WHOLE `v81_a`…`v81_ad` UI-redesign arc — never done by the user.** Read
  `roadmap_v81.md`'s own release entries (`v81_w` onward especially) for exactly what to click
  through.
- **A device pass on the WHOLE `v83_b`…`v83_g` progress-card/question-card arc** — every check so
  far is an AGENT's browser pass, not the user's own. Worth one combined pass since they share the
  same popup/header-row/border-colour interaction surface, on a range of REAL story lengths and a
  real phone, not just the fixtures each agent check happened to use.

## 6. NOT yours to start

Import "new" mode is POSTPONED. **Track A's CP1 report-only analysis (`PLAN §7.0`) is DONE, shipped
this cut; CP2 onward needs the user to say so explicitly (see §3 above) — new input/UI import mode
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
  is the OUTPUT store, entirely separate from `lessons.json`. Do NOT `require` server.js from either
  file (binds a port as a side effect) — copy what you need, matching the existing `jaTokenize`
  duplication convention, and re-verify any copy by GENERATING real output, not just diffing source.
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
