# Roadmap — v75 line

Current cut: **`v75`**. Baseline `node test/run.js` **170**, `--quick` **149**, `check-inline` 0 on
both builds. Read `build_history/HANDOVER.md` first, then this file, then `INTERNALS.md`, then
`build_history/v74b_session28_notes.md` (session 28 — long, and the findings matter more than the
diffs).

---

## Shipped in the v74 line (session 28) — nineteen point releases

The headline: **the v74 roadmap's prime suspect was wrong.** Nothing from session 27 was reverted.
`v73_g`'s icon row does navigate, `v73_i`'s keying is sound, `v73_d` is not the cause of the red bar.
The reported "user progress broken" had an older and much larger cause.

| release | what |
|---|---|
| `v74_b` | ONE lesson-phase classification. 29 chapters had gated the story behind an error hunt — which renders a corrupted copy of that story. |
| `v74_c` | **Coverage counts SOURCE ITEMS, not generated questions.** The qid universe was cached under an AUDIO key while the solved store was one flat map, so a learner who played muted and then unmuted read `64/83` with Next locked and no way back. **284 of 298 topics affected → 0.** Also closes the sampling nondeterminism — **and the wrinkle logged as a follow-up in `v69_session1_notes.md` and carried unfixed through five roadmap boundaries**: *"`_qidUniverseCache` is keyed on (topic, lessonIdx, teacher) but the mix now also depends on mute state… toggling mute mid-chapter can shift the coverage denominator."* That note described the exact defect the user reported. |
| `v74_d` | Math counts — 225 authored exercises across 25 chapters. |
| `v74_e` | Hidden lessons never count for anything (guard, no behaviour change). |
| `v74_f` | The completion card routes the learner to the error hunt (guard). |
| `v74_g` | Counters (b) and (c): chapter bar in LESSONS on both chapter shapes; %-solved over the story-unlock universe. |
| `v74_i` | Live-mode storyline progress. The list projection shipped no `lessons[]`, so `countedLessons` was 0 and `chapterComplete` was false for every inactive chapter — header `0/0`, no bars, wrong completion title. |
| `v74_j` | TTS voice ranking: locale before quality. `en-GB` was read by `en-NG`; `pt-PT` by `pt-BR`. |
| `v74_k` | The storyline locks use the shared completion rule (instances 4 and 5 of the raw-lessons pattern). |
| `v74_l` | Section 3 — the story-unlocked card. |
| `v74_m` | ONE story paragraph formatter, applied to the completion card. |
| `v74_n` | Two highlight tiers; the two story panels agree. |
| `v74_o` | The last completion card is not a dead end (instance 6). |
| `v74_p` | The vocabulary panel shows the CHAPTER, not the round. |
| `v74_q` | The comprehension reason is shown, not spoken. |
| `v74_r` | The mixed round is a TOGGLE, not a lesson type. |

**Sections 1, 3 and 4 of `roadmap_v74.md` are COMPLETE.** Counter (a) was CLOSED as chapters by user
ruling (an underlying-lesson count would need a new server projection field for a row that is
suppressed on the completion card anyway).

### The ruled lesson-flow definition (user, session 28) — now implemented

| phase | types | role |
|---|---|---|
| **prep** | `standard`, `word_forms`, `synonyms`, `grammar`, `conjugation`, `math`, `intro_script` | vocabulary work toward the story |
| — | `mixed` | **not a lesson** — an alternative way to PLAY the prep lessons |
| **story** | — | read and understand |
| **post** | `comprehension`, `error_hunt`, `ai_error_hunt` | gate the next chapter |

Gate 1 (story): prep coverage ≥ pass mark. Gate 2 (next chapter): comprehension all-correct-once,
error hunts merely played; **optional to EXIST** — no post lesson means no gate 2 (243 of 298
chapters). `lessonPhase()` is the single classification; `_STORY_GATED_TYPES` and `_NEVER_POOLED`
derive from it.

---

## THIS SESSION — the queue, in order

### 1. The pass mark — needs the USER, not code

`Churros und Chaos` is **40 items** where it was **83 questions**, and an item is solved by ANY
correct answer, so 80% is a materially lower bar than before `v74_c`. Deliberately not guessed at:
the current mark's meaning was set by play, and a rescale without play would be a guess dressed as a
decision. **Blocked on a browser pass.**

### 2. Allow sentence ordering at difficulty 1 (user, at the v75 cut)

**Measured, agreed, not started.** Two thirds of the corpus never shows a sentence-ordering
exercise:

```
chapters containing sentences        : 287
  ordering suppressed (all diff <= 1): 192
  ordering available                 :  95
```

`Churros und Chaos` has `topic.difficulty = 1` and neither sentence-bearing lesson overrides it, so
both inherit 1. The sentences and their `words[]` arrays are intact (10 of 10) and `mkOrder` is still
called unconditionally — the exercises are **built and then filtered out**, in
`buildStandardExercises`:

```js
const _diff = (lesson && lesson.difficulty) || (d && d.difficulty) || 2;
if (_diff <= 1) {
  _exs = _exs.filter(e => e.type !== 'order' && !((_muted || _noAudio) && e.type === 'listen_type'));
}
```

**This reverses a considered decision, not an oversight.** `v69_session1_notes.md:141` records the
user's own instruction of 2026-07-14 — *"In beginner mode, don't add lessons that require already
knowing the word — only ones where you pick a word from 4 options"* — and the specific reasoning for
`order`: *"Its shuffled word bank LOOKS like options, but assembling a sentence is production and
needs word order a beginner hasn't met."* The user has since decided the word bank is scaffolding
enough. Say so in the notes rather than presenting it as a fix.

**The change is denominator-neutral, which it would NOT have been before `v74_c`:**

```
Churros, story-unlock universe
  difficulty 1 (suppressed) : items=37  questions=80
  difficulty 2 (allowed)    : items=37  questions=90
  ITEM denominator moves by  0   <- what the pass mark measures
  question count moves by  +10   <- what it would have moved pre-v74_c
```

A sentence is already an item, reachable via `read_translate`; ordering is another way to ask about
the same item. Under the old question-keyed model this change would have raised the bar on 192
chapters as a side effect.

**What to touch:** drop the `e.type !== 'order' &&` clause, keep the `listen_type` half — that one
has separate and still-sound reasoning (muted `listen_type` silently becomes recall-production, the
"listening OFF" clause). `unit-beginner-types` pins the current behaviour in three places (lines 62,
74, 87) and its header comment carries the rationale, so **rewrite rather than delete**: it should
end up asserting that ordering is KEPT at difficulty 1 while `listen_type` still drops when muted.
Line 32 pins an exact round composition of 12 including `2 order` — that count changes.

**Verify it in play, not only in the suite:** ordering is a render path (`renderEx` case `'order'`,
`index.html` ~14091), and a beginner round has never drawn one, so extend `smoke-render` and say in
the notes what to click.

### 3. Highlighting — measured, NOT shipped, and the old plan is WRONG

`roadmap_v74.md` §2 said the article set "is already derived — `_articleStatsFor` collects exactly
this". **It does not.** That function reads `x.article` from GRAMMAR items via `_forEachGrammarItem`;
`Churros und Chaos` has no grammar lesson, so it returns `{choices:[], predictable:false,
sampleSize:0}` — empty on the very chapter the complaint came from.

Reproduced (16 vocab, 1150-char story): **2 exact, 8 recovered by stripping the leading token,
3 stem-only, 3 genuinely absent.**

A corpus-derived replacement, statistics rather than language knowledge — a true article appears
often as the FIRST token of a multi-token vocab entry and almost never as a standalone entry:

```
es  ["el:25","la:19"]      it  ["il:38","la:30"]
de  ["sich:6"]   <- German vocab stores no articles; nothing to fix
fr / nl  []      <- too little data to clear the threshold
```

End-to-end across 284 chapters with a story and vocab: **3233 → 3278 marks (+1% overall)**, but
`Churros` 2 → 10 and `Barbera` 4 → 10. **Narrow corpus-wide, decisive where it bites** — size it by
the per-chapter effect, not the aggregate. The filter (`count>=3`, `standalone*4<leading`,
`len<=4`) is a first cut and wants its threshold justified by measurement in its own release.

**Do NOT revert the word boundaries** — `v73_e` traded the every-`i` bug for 2 real marks.

Tier 2 (corpus inflections from `word_forms` / `grammar.plural`) is untouched and would address the
3 stem-only cases.

### 4. Browsing completion cards (user request, session 28)

Explicit back/next to walk the completion cards of already-played lessons, so a learner can revisit
and replay. **Interacts with two things session 28 just settled:** `v74_l` strips the story-unlocked
card back to Next only, and `v74_o` makes "nothing left to do" mean "return to the storyline". This
turns that terminal state into a waypoint — revisit both branches together rather than layering a
third navigation rule on top.

### 5. `_sbChapterTarget` — the seventh and last known raw-lessons instance

`index.html` ~8065. Not fixed in session 28 because its test extracts it in isolation and calls it
with synthetic progress maps, so switching to `chapterComplete` (which reads `APP.progress` and the
v69_l stamp) needs that harness reworked first.

### 6. The storyline-page TTS selector

`dreizunge_v39_summary.md:331` records `_buildGlobalTtsSelectors()` building selectors "in all footer
rows (lesson-set, **storyline** screens)". Today `const ids = ['ls']`, the `-sl` elements are absent
from the markup, but the function's own existence check still looks for `tts-lang-select-sl`.
**No note anywhere in build_history explains the removal** — the dangling reference suggests an
incomplete removal rather than a decision. The user wants to choose between English variants for
readout; `v74_j` makes that safe (the menu now preselects what would actually be spoken).

Also dead: `#tts-row` / `buildTtsSelector()`, permanently `display:none` with the comment "replaced
by global TTS selectors in footers", still rebuilt on every lesson-set entry.

---

## RECOVERED — carried since v71, still not done

These were lost once at the v71→v72 roadmap boundary and recovered in `v73_k`. **Do not let them
drop again.**

- **Global QC**: a checkbox menu of what to QC, merged with the user's request to make the book's
  automatic QC opt-in from the lesson-type menu and run it AFTER the storyboard pass. **Note this
  reverses the `v68.1` ordering decision.**
- **Crossword**: show the correct word's translation instead of the empty underline. **Needs a
  decision first** — `word_forms` items have no translation.
- **Live mode with teacher mode OFF must hide every editing control.** Same `_canEdit()` conflation
  as the authorization plan. (`v74_h` deliberately did NOT reuse `hideProv` as a screen proxy for
  exactly this reason — see the session notes.)

---

## Owed by the USER — not doable in a container

- **A browser pass.** Nineteen releases deep. `v74_c` changed what coverage MEANS, `v74_i` was the
  only `server.js` change of the session (live mode is the half that cannot be exercised headlessly,
  only simulated), and `v74_j` / `v74_n` are visual.
- **The comprehension QC checker** — needs a new prompt and a live model. Correctly queued, not
  started in a container.
- **The translate pass.** Changed in English and DROPPED from the other 29 languages for refill:
  `complete.story_unlocked`, `ex.badge.comprehension`. New and English-only:
  `complete.words_solved`, `form.finish_mixed`. `t()` falls back through English, so nothing is
  broken meanwhile. **`v71_q`: never assert a dropped key absent.**

---

## Rules earned in session 28 — read these before writing a probe

1. **A probe must call the product function, never a re-typed copy** — and least of all one lifted
   from a test stub. Two false findings came from re-implementing `lessonCountsFor` and the
   read-full-story lock instead of invoking them. One reported a hole that did not exist; the other
   reported a fix as not working when it already was.
2. **A claim about behaviour is only measured if the assertion touched the thing being claimed.**
   `setComplete=false` is not evidence about a button. Three inference-not-measurement errors this
   session: math's generator, the `lessonCountsFor` stub, and the error-hunt "lock".
3. **A non-vacuity check must be evaluated on the data the assertion actually runs against**, not on
   the data it was derived from. Two guards passed under their own reverts because the fixture had
   been projected before the assertion saw it.
4. **A guard that reads its own explanatory comment is a guard that lies.** A negative match on
   `white-space:nowrap` found the comment naming what had been replaced.
5. **A headless harness that builds `APP.savedList` from whole topics is testing STATIC mode**,
   whatever else it thinks it is testing. That blind spot hid `v74_i` from 167 green checks — every
   existing test ran in the static shape, and the live shape existed only in a browser.
6. **Where the environment admits only one writer, unexplained state is yours.** Mid-session a
   version bump and three edits landed without the definition-of-done being run, so the tree drifted
   past the artifact the user held; the changes were then not recognised as mine. The suite-docs-
   package cycle exists to make that drift impossible. Follow it per change.

---

## ⚠️ Session protocol — READ FIRST, applies to every change

This block is the standing "definition of done." A fresh session is expected to follow it without
being re-told; several of these were missed in past sessions (LIVE-TEST updates, i18n listing,
version bump) and only caught because the user noticed. Treat it as a checklist.

**How to start a session:** read `build_history/HANDOVER.md` first (one page: baseline numbers,
what is owed by the USER, open decisions), then THIS file (the highest-numbered
`build_history/roadmap_v*.md` is the current one), then `INTERNALS.md`, then the most recent
`build_history/v*_session*_notes.md`. Establish the green baseline (`node test/run.js` +
`node test/check-inline.js`) before touching anything.

**Working rules (per change):**
- One change at a time. Pure refactors stay byte-identical. After each change: full suite green
  (`node test/run.js`) and `check-inline` at 0. Re-run before moving on.
- **A carried-forward open item must be cross-checked against the SHIPPED list in the same file
  before it is carried again.** Added session 26: the "Drill result card" item was carried through
  four releases while `roadmap_v71.md` recorded it as shipped in `v71_h` on line 227 — the open
  entry sat 264 lines below the entry that closed it. Deferring an item is not evidence that it is
  still open.
- Add or update a **unit test** for any new behavior. When adding a lesson type, exercise type,
  generator, or registry entry, update the matching registry test (`unit-*-registry`).

**Definition of Done — before calling any change finished, check ALL that apply:**
1. **Tests** — suite green + `check-inline` 0; new/changed behavior has a guarding test. For render
   paths (anything drawn in the client), add/extend a `smoke-render` case — source assertions cannot
   see runtime scope, TDZ, or layout.
2. **Browser-only behavior → session notes** *(the former LIVE-TEST-CHECKLIST.md is a closed
   archive — do NOT add sections to it)*. If the change is browser-only or Ollama-only (UI, RTL,
   TTS, rendering, anything not exercisable headlessly), the session notes MUST contain a short
   "how to see it work" description — what to click and what to expect — so the user can verify it
   in normal use.
3. **i18n** — new user-facing strings go in `ui.json` **`en` only** (never add English text to other
   languages — the user's `translate-ui.js` fills *missing* keys and can't detect English
   fallbacks). List every new key in the session notes + roadmap so the offline translate pass is
   run. Changed English values won't be re-translated automatically (script keys off *missing*, not
   *changed*) — call those out explicitly or hand-edit if language-neutral.
   **(v71) When a translated `ui.json` comes BACK, validate before merging:** per-language key
   counts, and whether any `en` key vanished. A returning file may predate recent releases.
   **A test asserting a key is "en-only" is correct while the key is new and wrong once it has been
   translated** — assert instead that no language holds the English string verbatim.
4. **Static build** — if client (`index.html`) or baked data (`lessons.json`, `languages.json`,
   `scripts.json`, `ui.json`) changed, re-run `node build-static.js` so `docs/index.html` is current.
5. **Data parity** — if a generator exists on both server and client (math, intro_script, furigana
   tokenizer), keep them identical and assert parity in a test.

**Definition of Done — at a release / packaging point:**
6. **Version** — bump `APP_VERSION` in `server.js` if it's a new release. NOTE (v49): the static
   build DERIVES the version from `server.js`'s `APP_VERSION` at build time (see
   `unit-version-derivation`), so a single bump in `server.js` + a `build-static.js` re-run is
   enough — no more hand-editing `build-static.js`.
   **Point releases use an alphabetic suffix** (user, v70): the base cut is the bare number and is
   implicitly `a`, so the sequence is `v75` → `v75_b` → `v75_c` → … — the same convention the v69–v74
   lines ran. **This is the `v75` line.** Roadmaps are per BASE version, so point
   releases do not each get one — this file stays current through the whole v75 line.
   (This paragraph is the one version-specific line in the block and has been carried forward stale
   twice — `roadmap_v73.md` shipped saying "This is the `v72` line". **Check it at every base cut.**)
7. **Roadmap** — mark shipped items ✅, carry every open TODO/idea forward, and at a version bump
   write the next `build_history/roadmap_v{N+1}.md` (carrying this protocol block forward).
8. **Session notes** — write/update `build_history/v{ver}_session{n}_notes.md`.
   **(v75) Prompt files are named for the version the session WRAPS UP WITH**, not the one it starts
   from: the prompt that opened the session ending in `v75` is `build_history/v75_prompt.md`. The old
   `session_{n}_prompt.md` names were renamed to match (`session_28_prompt.md` → `v74_prompt.md`,
   `session_29_prompt.md` → `v75_prompt.md`) — the session numbering had drifted from the version
   numbering and only one of the two is meaningful later.
9. **Package** — sync the release dir, regenerate `docs/`, zip, and call out which deliverables are
   still owed (browser pass, i18n, native-speaker content checks).

**(v71) Test-quality rules — added because five guards failed in one session, in five distinct ways:**
- **Verify every guard by reverting its fix and watching it fail.** Four of the five were caught
  this way; the one that was not is the one that reached a release.
- **A vacuous guard passes for the wrong reason.** (v70_f: "a Check after reveal credits nothing"
  passed trivially, because reveal marks every entry done and Check skips done entries.)
- **A conditional guard only sometimes exists.** (v70_g: repeat assertions wrapped in
  `if (replayTargetExists)`, which in that scenario did not.)
- **A guard should fail as a named assertion, not a `TypeError`.** (v70_l: reverting the highlight
  threw inside the sandbox — a far weaker signal for whoever hits it.)
- **Test the caller, not just the helper.** (v70_m: five assertions on `_synContext`, none on
  `tSynSelect` — reverting the render passed them all.)
- **Test against the data that prompted the report.** (v70_n: the synonym trim was green and did
  nothing, because the fixture was a multi-sentence paragraph — the shape the fix handled, not the
  135-word single sentence the user was complaining about.)

**(v71) Reachability rule:** a learner-facing feature placed on the lesson-set page is unreachable —
learners skip that screen entirely (v60 learner nav). `_canEdit()` is NOT the gate that matters;
check against `_isLearner()`. When reporting a new affordance, say WHERE it lives in the navigation,
not just that it exists.

**(v71) Known harness traps** (each cost a debugging cycle):
- The stub DOM does **not** parse `innerHTML` — `querySelectorAll` returns `[]`. Assert against the
  markup string; `getElementById` persists stubs, which is what makes interaction testable.
- Values returned from `C.run` belong to another realm, so `deepStrictEqual` against a local `[]`
  fails on prototype identity. Compare lengths or spread first.
- `_lessonQidUniverse` caches on `topic|lessonIdx` and returns the cached Set **without
  re-deriving**. Swapping a lesson's content under a fixed topic+index is something only a test
  does — give such scenarios their own topic key.
- `build()` **samples**: it emits a round, not the full question set, and a different subset per
  call. Never derive a question's identity by rebuilding; synthesize the exercise shape and let
  `qid()` key it.
- Fixture data is **not** a constant. A scenario that leans on "the first topic in `lessons.json`"
  will break when the bundled data is replaced.
- **`APP.cur` has a DEFAULT (`lessonIdx: 0`, index.html:1651) that sections silently depend on.**
  `_exFlagTarget` resolves a flagged item through `APP.cur?.lessonIdx`, and `assembleCoverageRound`
  keys the solved-set through the same fallback. So a section that needs a real lesson index must
  **mutate and restore the field** (`APP.cur.lessonIdx = i` … `= 0`), never replace or `delete` the
  object — doing either broke an unrelated later section in v71_r. Mutating also mirrors real play,
  where `openLesson` sets `C.lessonIdx = idx` immediately before `buildExercises(idx)`.

**(session 23) DESIGN PRINCIPLE — no language knowledge in the code.** The code must not encode
facts about particular human languages: article lists, gender rules, pronoun sets, inflection,
"which languages use articles", sentence-final punctuation. Producing correct language content is
the MODEL's job — instruct it in the prompt instead. A per-language table is written by whoever is
editing the code, is wrong in ways invisible until a native speaker looks, and fails silently for
any language missing from it.
*Not* covered: mechanical/typographic facts that decide how text is HANDLED rather than whether it
is CORRECT — Unicode normalisation, script/RTL detection, diacritic folding for comparison.
The test: **does this decide whether content is right, or only how it is displayed/compared?**
Known violations inventoried in `INTERNALS.md` → "Design principle"; the worst
(`normalizeVocabArticles`) actively degrades real data.

**(v71_w) Rules:**
- **A progress FRACTION and a FINISHED signal are different questions.** "How much have you played"
  may stay a raw count; anything asserting completeness — a colour, a lock, a tick, a connector line
  — must read the shared rule. The storyline page got this wrong for two releases in both
  directions at once, and nothing failed because the two rules agreed on the bundled data.
- **A source-pin regex that falls outside its own slice window is a vacuous pass.** A 4,000-char
  slice of `_renderChapterCard` stopped before the line being pinned. Check the pin actually sees
  what it claims to.

**(v71_u) Rules:**
- **Wiring changes need a RUN, not source assertions.** When one side sends and the other consumes,
  assertions on each half prove nothing about the join: in `v71_u` the server could ignore
  `arcTypes` entirely and the whole 156-check suite stayed green. If a change is "A now passes X to
  B", the test must observe B's OUTPUT.
- **A standard/vocab lesson has NO `type` field** — it is the default shape. `l.type === 'standard'`
  is never true, and an assertion written that way is vacuous (this bit inside the very test written
  to catch a vacuous pass). Use `(l.type || 'standard')`.
- **A test that re-implements the code it tests cannot fail when that code is deleted.**
  `unit-arc-options` kept passing after its feature was removed. If a test builds its own copy of a
  block to run it, it is testing the copy.
- **New lesson types need a `fake-ollama` branch**, or an e2e will skip them silently — the arc loop
  correctly refuses to abandon a run for one bad type, so the omission is invisible. Order matters:
  place a new matcher before any looser one that could swallow it (`correctIndex` is shared by
  comprehension and word_forms).

**(v71_t) Rules:**
- **Ollama truncates an over-long prompt SILENTLY.** `num_ctx` defaults to ~4096 and there is no
  error when the prompt exceeds it. Any change that makes a prompt bigger must size the context
  window in the same commit, or the extra text is discarded invisibly and the change looks like it
  worked. A deliberate trim in our code always beats letting the backend cut blindly.
- **`callLLMLesson` spreads the caller's opts AFTER its think policy**, so a caller passing
  `timeoutMs` or `tokens` OVERRIDES the ×3 / ×2.5 that reasoning mode applies. Check you are not
  lowering them — "raise the timeout" is easy to write as a reduction.

**(v71_s) Rules:**
- **A review render is not a play.** `showComplete(true)` repoints `APP.cur` at the LAST counted
  lesson so the vocab recap resolves, so anything that JUDGES the learner — records a done-flag,
  locks Next, counts an exposure — must be behind `!C._review`, or it judges a lesson nobody just
  played. Third time this shape has bitten (v71_n, v71_s twice).
- **A withheld done-flag makes `_firstUnfinishedLessonIdx` keep returning that lesson.** Any rule
  that refuses to mark a lesson done must also stop Next pointing back at it, or the forward button
  silently means "replay this" and steps over the v71_d lock.
- **When a builder or gate is narrowed by lesson type, narrow the COVERAGE UNIVERSE to match.** A
  denominator that counts questions the round will never ask can never be satisfied.

**(v71_r) Diagnosis rules:**
- **A red baseline is a finding until proven otherwise.** When only the DATA files are newer than
  the code, the obvious read is "stale fixture" — but check whether the guard is *right* first.
  In v71_r the fixture had indeed moved AND the property it asserted was false, hiding a live
  defect. Fixing the fixture alone would have shipped the bug.
- **A failure appearing *after* you fix another one may not be new — it may be running for the
  first time.** An earlier `assert` aborts the file, so everything below it is unexecuted. Verify by
  patching the PRISTINE tree to skip the original failure and watching the later section pass,
  before assuming your change caused it.
- **Guard a guard against going vacuous on new data.** If a section only means something when the
  corpus contains a case (here: a lesson exceeding its builder's cap), assert that such a case was
  actually found. Without it the section silently becomes a no-op — which is precisely how §8
  passed while grammar sampled at random.

(If you add a new standing rule, append it here so the next session inherits it.)
