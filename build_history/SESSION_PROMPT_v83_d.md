# Session prompt — written at the `v83_d` cut

*(Rename this file for the version the session WRAPS UP WITH. `SESSION_PROMPT_v83_c.md` was the
previous one — superseded by this file and renamed, not kept alongside. Keep using the double-
letter suffix scheme (`v83_e`, `v83_f`, …) unless a future session has a good reason to switch to
`v84_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Fresh session picking up from the **`v83_d`** release —
the entry card gets the SAME nav/bars popup `v83_c` gave the progress card, plus thicker header-row
back/forward arrows. Both are fresh user asks, not PLAN items, on top of `v83_b`'s `PLAN §12`.

**`v83_a`, in brief**: a new BASE LINE, cut from `v82` at the user's own request rather than at a
milestone, to hand off `PLAN §12` to a clean-context session. No code changed at that cut.

**`v83_b`, in brief** (full write-up in `roadmap_v83.md`'s `# SHIPPED IN THE v83 LINE`): `PLAN §12`
(the interactive text-selection tutor) shipped whole. The one ruling it needed — reply in
`APP.uiLang` for the new flow only, or the WHOLE tutor? — was asked directly; the answer was the
whole tutor, wired additively (`srcLang` keeps its own, different retrieval/ledger job). **Live-
verified against a real model**, not just asserted from the prompt text: a throwaway server on a
spare port confirmed a reply requested with `srcLang:'en'`/`uiLang:'fr'` came back entirely in
French.

**`v83_c`, in brief** (full write-up in `roadmap_v83.md`): a fresh mid-session user request, not a
PLAN item — *"move the navigation control icon rows and the progress bars into a popup, reachable
via one button in the header row of the text field, before the text translation buttons. Only the
back/next button should be duplicated ... progress card text fields should ideally always fill the
full available screen."* Scoped to `complete-screen` alone (this project's own "the progress card"),
decided by reading all four card screens' actual markup rather than guessing at "progress cards"
plural — the entry/summary card has almost nothing to hide (one button, always-empty bars) and was
left unchanged. The popup RELOCATES existing elements (same ids, same renderers, nothing
reimplemented); a new `_syncCompHdrNav()` mirrors `comp-prev`/`comp-next`'s FINAL resolved state onto
a header-row duplicate pair rather than re-deriving showComplete's ~7 destination branches. **Two old
test invariants this redesign knowingly supersedes were rewritten to state what actually holds now,
not just loosened** — see the roadmap entry for both. **Live-verified in a real browser**, not just
asserted: header-row order, label mirroring, popup open/close (☰, ×, backdrop, real navigation, the
crossword early-close), and the story panel's measured height against a mobile viewport all checked
against the running app, not just the CSS/JS source.

**`v83_d`, in brief** (full write-up in `roadmap_v83.md`): two immediate follow-ups to `v83_c`. First,
*"navigation and next buttons could also be used on the entry card, incl. the progress bars"* — the
SAME popup pattern, extended to `summary-screen`/`#sum-sumbox`, which has no back button (only NEXT
was duplicated). Rather than copy-pasting the mirror/close logic a second time, both were made
properly SHARED: `_syncCompHdrNav`'s inline mirror closure became a top-level `_mirrorNavBtn(srcId,
dstId)` that both cards' sync functions call, and `show(id)` now calls a new `_closeCardNavPopups()`
that closes both popups (closing whichever was never open is a harmless no-op) instead of the one
direct `closeCompNav()` call it had. The `ui.json` strings are reused verbatim, not duplicated.
Second, *"use thicker arrows for back/forward buttons in the story header"* — a CSS
`-webkit-text-stroke`, not a Unicode glyph swap, specifically so it wouldn't fight `_mirrorNavBtn`'s
own `dst.textContent = src.textContent` line. **A second instance of the SAME test-invariant
supersession `v83_c` hit once already** — `unit-story-summary.test.js`'s own entry-card ordering
sub-assertion broke a second time for the identical reason (its storyboard/actions/bars moved into a
popup too) and was rewritten again, to the same shape as the progress card's own claim.
**Live-verified in a real browser**, via the actual navigation flow (not a synthetic fixture): opened
a real chapter, landed on the entry card naturally, confirmed the popup, the mirrored NEXT button's
real localized label, and all three close paths.

**The throughline worth carrying forward again**: `v83_b` was the third release running where a live
generation against the real model was what actually confirmed a feature works, not source-reading.
`v83_c`/`v83_d` are the same discipline applied to a UI change: exploring the ACTUAL markup before
deciding scope, running the redesign in a real browser tab rather than asserting from CSS alone, and
— new at `v83_d` — noticing that a SECOND request extending the SAME feature is an opportunity to
extract the shared logic properly (`_mirrorNavBtn`, `_closeCardNavPopups`) rather than copy-pasting a
second near-identical implementation.

## Orient yourself

1. **This file**, whole.
2. `build_history/roadmap_v83.md` — its **index table** and the **⚠️ Session protocol** block first,
   then the standing RULES, then `# SHIPPED IN THE v83 LINE` for how `v83_b`/`v83_c`/`v83_d` were
   built. (Nothing is in TRACK T right now — steps 1–4 and `§T7` all shipped in the v81 line.)
3. `INTERNALS.md` — constants, silent-failure modes, invariants, harness limits. **§6b is a
   feature → function map** — read it BEFORE grepping for where anything lives.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 253 checks
node test/run.js --quick                  → expect 226
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Corpus at this cut: **327 topics, 92 storylines, 33 languages, 657 `en` keys** (unchanged from
`v83_c` — this release reused `complete.nav_open`/`complete.nav_title` for the entry card's own
popup rather than minting new keys, so the `en` count did not move).
`APP_VERSION = 'v83_d'`.

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
   problem (rule 35). `v83_c`'s own version: read all four card screens' ACTUAL markup before
   deciding which ones a "progress cards" (plural) request touched — it was one, not four.
2. **Guard at the layer where the claim is observable** (rule 34). A guard that pins SOURCE TEXT for
   a claim about BEHAVIOUR cannot fail — cost multiple releases across the v80/v81 lines. Render and
   inspect, then **MUTATION-TEST**: break the rule and check the guard goes red.
2b. **When a NEW request deliberately supersedes an OLD test invariant, REWRITE the test to state
   what holds NOW, with the supersession explained inline — don't just loosen or delete the
   assertion.** `v83_c` hit this twice (`unit-story-summary.test.js`'s cross-card parity claim,
   `smoke-render.test.js`'s single row-order chain); `v83_d` hit the SAME test a THIRD time
   (`unit-story-summary.test.js`'s entry-card self-order sub-assertion, once the entry card's own
   machinery moved into a popup too) — every one a legitimate PAST design decision a real product
   change now overrides, and every one rewritten to assert the new, narrower claim that actually
   survives, rather than weakened into silence.
2c. **When a second request extends a feature you JUST built, extract the shared logic — don't
   copy-paste a near-identical second implementation.** `v83_d`'s mirror/close-popup logic became
   `_mirrorNavBtn`/`_closeCardNavPopups`, called by both cards, specifically because `v83_c`'s own
   versions were written as if only one card would ever need them.
3. **For any refactor claiming to preserve behaviour, CAPTURE the old output and DIFF it.** "The
   tests still pass" is a weaker claim — a whole suite has been green with a real contamination bug
   in place before, found only by diffing real data.
4. **`buildExercises` is NON-DETERMINISTIC IN CONTENT, not just order** (`v80_t`). Any test that
   samples the corpus must accumulate across builds and be verified over ~15 consecutive runs — and
   accumulating across builds is NOT the same precondition as co-occurring in ONE build. When a
   section needs the run to contain something specific, STEER it there rather than sampling and
   hoping. Run the suite in the staged release directory too, not only the working tree.
5. **A zero-callers finding is not by itself permission to delete** (`v81_q`). Check for a standing
   warning before assuming a measurement is the whole story; ask the user if the two disagree.
6. **Never put emoji in a Python string literal** (rule 25); write them via a `cat` heredoc. And
   check what a mechanical rewrite DID, not just that it ran.
7. **A live model call needs a live test, not a plausible prompt** (`v82_e`, `v82_i`, `v83_b`). The
   first reasonable-looking design was wrong twice already in the `v82` line; `v83_b` is the first
   release where it was RIGHT on the first try, but was still verified live rather than trusted.
8. **Ask before restarting a dev server you did not start, and before deleting data you did not
   create** (`v82_e`, `v82_f`). Check `lessons.json`'s mtime and the server's reported version
   before touching either. `v83_b`/`v83_c`/`v83_d` all needed a live check and solved it by starting
   a THROWAWAY server on a spare port instead of touching the one already running — reusable: neither
   `/api/tutor` nor a plain browser click-through writes `lessons.json`, so a spare-port instance is
   safe for verifying either without any risk to the shared data or another session's process. (One
   snag worth knowing: the default story model is a large MoE model whose warmup can take a while —
   set `OLLAMA_MODEL=qwen2.5:7b` on the throwaway instance for a fast boot when a live model call
   isn't actually what you're checking.)

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
has landed (a fix to `test/lib-dom.js`'s `textContent` getter, likely walking `childNodes` in
document order instead of the `_text`-then-children shape) before touching this yourself.

## 3. BUILDABLE NOW, no ruling needed

- **`PLAN §7.0` CP1, canonical text + report-only analysis records** — the first buildable slice of
  the accepted parallel curriculum pipeline. It defines stable chapter/sentence/span/token IDs and
  provenance, but must not change existing lessons, player, learner progress, or publishing. See the
  durable roadmap diagram and migration sequence in `roadmap_v83.md`'s THE LARGER PLAN section; CP1
  comes before a new generator.
- **`PLAN §C1`'s FIRST gate bug** — *"browsed forward to the story card and back, solved no
  comprehension lesson, yet could proceed."* **⚠️ THREE readings are already DEAD ENDS** — see the
  `v80_b` entry in `roadmap_v80.md` and the `v81_j` addendum in `roadmap_v81.md` before spending time
  on it (story-unlocked-page round trip and cross-chapter browsing, both builds, all clean). **What
  is still unmodelled is the "Back LINK" specifically, distinct from the "← Back" button the third
  reading already covers — get the exact click sequence from the user before trying a fourth
  reading.**
- **The dead-taps HIGHLIGHTING question** — closed to zero for the tap itself (`v81_f`+`v81_h`), but
  a different, still-open decision remains: **should the story panel mark a word at all when its
  ONLY teaching lesson is hidden?** `probe_tap_reachable_v81d.js` measures it. Needs a ruling before
  building either direction.
- **`PLAN §F2`'s second half** — the "answer visible in the stem" detector, measured and deliberately
  left unenforced because prefix-matching is mild morphology. Reported by
  `probe_word_forms_defects_v80g.js`.
- **`PLAN §D4`'s one measured rough edge** — on a completely off-topic writing answer specifically,
  the grading model sometimes folds a content comment into the language-issues list as a fake
  arrow-format "correction" on a sentence with no actual mistake. Harmless to the learner, a real but
  minor prompt-compliance gap. If picked up: reproduce across more than the three verdicts `v82_f`
  tested before deciding whether it is worth a prompt change, and measure against several REAL
  learner answers, not just synthetic ones — the same "one lesson proves nothing" caution `PLAN §F3`
  already carries elsewhere in this document.

## 4. ⚠️ OWED BY THE USER, not doable in a container

- **`PLAN §F3`** — the article prompt fix shipped at `v80_j` and is **UNVERIFIED BY DESIGN**.
  Regenerate MANY lessons, then re-run `probe_article_symmetry_v80j.js` against its baseline: **1.0%
  overall but BIMODAL** (191 chapters at 0%, two at 100%). **One lesson proves nothing.**
- **The translate pass** for the remaining `en`-only keys (2 from `v83_c`, reused not duplicated at
  `v83_d`; 4 from `v83_b`; plus whatever was already outstanding), `translate-ui.js --langnames`, the
  `hr` `ui.json` pass, and a **native-speaker check of the `cyrillic-sr` table**.
- **A device pass on the WHOLE `v81_a`…`v81_ad` UI-redesign arc — never done by the user.** The v80
  line changed every card and question screen; `v81` then split generation off the landing page
  (`§C5`) and built the Settings Card with its floating pills, mute-pill consolidation, and the
  language/speech mismatch pills (`§C4`). Every individual release from `v81_x` onward carries its
  own "verified live" paragraph in `roadmap_v81.md` from an AGENT's browser pass — that is not the
  same thing as the user's own device pass, and none of it has happened yet. Read `roadmap_v81.md`'s
  own release entries (`v81_w` onward especially — the first and biggest real visual changes) for
  exactly what to click through; `build_history/v81i_session38_notes.md` also still applies for what
  should stay locked on the lesson path.
- **Three UI features running now, ALL live-verified by an AGENT only, NONE by the user's own device
  pass**: `PLAN §12`'s selection popover (`v83_b`, positioning, the grammar/meaning buttons,
  coexistence with the per-word tap on a touch device), the progress card's nav/bars popup (`v83_c`,
  the flex-fill story panel on a REAL short story — the agent's checks used real chapters but not a
  systematic range of lengths — and touch ergonomics on a real phone), and the entry card's own copy
  of that popup (`v83_d`, same caveats). All three are worth one combined device pass rather than
  three separate ones, since they share the same popup/header-row interaction pattern.

## 5. NOT yours to start

Import "new" mode is POSTPONED. **Track A's CP1 report-only analysis (`PLAN §7.0`) is authorised;
new input/UI import mode remains postponed.** **Mastery-driven progression (`PLAN §9b/D2`) remains a
user product decision**: B4 runs in shadow mode, but it must accumulate a meaningful disagreement log
before that decision is reconsidered. The learner/teacher rework — `_canEdit()` is done; `Edit /
rename topic` stays visible by user ruling.

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

- `probe_gates_v80c1.js` — the `PLAN §C1` gate probe. Reports, does not assert.
- `probe_gates_v77.js` — re-run **and diff** after any progress-card change. **⚠️ It SELECTS its
  chapters from the corpus, so a data drop moves the selection.** Disambiguate by re-running the
  PREVIOUS client against the CURRENT corpus. Baseline: `v80i_card_gates.txt`. **Note it renders
  the card structurally, not through a browser — it will not see either the `v83_c` or `v83_d`
  popup at all** (the chapter icons/lesson icons/bars it inspects now render inside
  `#comp-nav-modal`/`#sum-nav-modal`, not on either card's main page); re-check whether this probe
  still measures what it claims before relying on it.
- `probe_word_green_impact_v81d.js` — what TRACK T's colouring paints, through `_wordProgress` /
  `_wordState`. `PROBE_CLIENT=` diffs two builds. Use this one for anything about the screen.
- `probe_word_green_v81c.js` — declared probe keys vs the BUILDABLE universe (60.8% at `v81_d`).
- `probe_comp_skip_v81c.js` — drives `showComplete(true)` over every later chapter and CLICKS
  `comp-next`. Re-run after ANY change to the progress card's Next wiring. **Clicks `comp-next`
  directly by id — unaffected by `v83_c`'s relocation into the popup, since the id and its onclick
  are unchanged.**
- `probe_tap_reachable_v81d.js` — highlighted words whose tap resolves to nothing. A related but
  DIFFERENT question from "which free-text selections does the `PLAN §12` popover accept" (that one
  is answered — raw, as-selected, no snapping; see `roadmap_v83.md`'s `v83_b` entry).
- `probe_learner_known_v80l.js` — the older colouring probe. ⚠️ It RE-DERIVES the colouring inline
  rather than calling `_wordProgress`, so it is blind to changes inside the collector.
- `probe_inflection_v80f.js`, `probe_article_symmetry_v80j.js`, `probe_lesson_script_v80h.js`,
  `probe_word_forms_defects_v80g.js`, `probe_forks_v79k.js`, `probe_coverage_v78n.js`.
  **All report; none assert.** The article one is explicitly NOT language-blind — its article lists
  must never migrate into the app.
- `_cardErrors()` — assert it is empty after any card render you add.
- `_storyBodyHtml(d, opts)` — **the ONE story renderer** for question panels and progress cards. Also
  the ONE place `PLAN §12`'s selection hook (`.story-selectable`) is applied — see
  `_storySelInit`/`_storySelMaybeShow` (index.html). Its `#complete-screen` caller now sits inside a
  `flex:1` chain (`v83_c`) so the panel fills available screen height; the other callers are
  unaffected.
- `_wordProgress(d)` / `_wordState(rec)` — **the ONE per-word progress collector.**
- `_storyLockedLesson(L, d)` — the ONE "is this lesson closed" rule.
- `_cardHeader(prefix)` + `.card-screen` — every new card page uses both.
- `scriptPinNote(lang, script, role)` — every prompt emitting target-language text calls it.
- `_tutorGatherContext()` / `_tutorRenderScope()` / `/api/tutor` — the tutor's core machinery.
  `_tutorGatherContext()` sends `uiLang` (reply language) ADDITIVELY alongside the unchanged
  `srcLang` (retrieval content-pairing + ledger lookup) — the two are genuinely different jobs, see
  `roadmap_v83.md`'s `v83_b` entry before touching either.
- `openCompNav()`/`closeCompNav()` (`v83_c`) and `openSumNav()`/`closeSumNav()` (`v83_d`) — one popup
  per card, same open/close shape as `openSettings()`/`closeSettings()` just above them in the file.
  `_closeCardNavPopups()` closes BOTH and is what `show(id)`'s own multi-`try` chain actually calls
  (same choke point PLAN §12's `_storySelHide()` uses); `openCrosswordFromComplete()` calls
  `closeCompNav()` directly and explicitly — the one path that shows another overlay without a
  screen change, and the entry card has no equivalent case.
- `_mirrorNavBtn(srcId, dstId)` (`v83_d`) — the ONE shared rule that mirrors a source nav button's
  FINAL resolved state onto a header-row duplicate. `_syncCompHdrNav()` (end of `showComplete()`)
  and `_syncSumHdrNav()` (end of `showStorySummary()`) both call it — extend a THIRD sync function
  the same way if a third card ever needs this, don't re-derive the mirror rule itself.
- `recordObservation(ex, correct)` / `APP.progress.observations` / `refreshBktShadow(d)` — the
  `PLAN §8/B1–B4` evidence path. See `INTERNALS.md` §6b before extending it: only `check()`-graded
  exercises are logged, only resolved vocabulary IDs feed BKT, and no BKT value may become a reader
  of progression without a separate product ruling; `learners.js`'s `MAX_STATE_BYTES` growth ceiling
  remains unaddressed.
