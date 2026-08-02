# Roadmap — v73

The v72 line is closed. Its full history, including every measurement, is in
`build_history/roadmap_v72.md` and `build_history/v72f_session26_notes.md`; this file carries
forward only what is still live.

## Baseline at the cut

`node test/run.js` → **161 checks** · `node test/run.js --quick` → **140**
`node test/check-inline.js` → 0 on `index.html` AND `docs/index.html`
`APP_VERSION` = `v73` · `docs/` rebuilt and matching · `ui.json` byte-identical to the user's own
copy (nothing has been deleted from it).

## Shipped in the v72 line (summary; details in each session's notes)

`v72` diacritic QC — deterministic scan generates candidates, the model decides ·
`v72_a` sentence segmentation via `Intl.Segmenter`, client and server splitters merged ·
`v72_b` length-based sub-split for over-long units, plus the CJK `sep` fix ·
`v72_c` clause detection for the synonym clamp switched to Unicode ·
`v72_d` synonyms generation SEES the story and quotes its own context sentence, verified verbatim ·
`v72_e` synonyms prompt made strict — fewer certain entries beat more shaky ones; antonym-only
words are kept ·
`v72_f` `num_ctx` sized on all five full-story generators; comprehension gets the chain from every
call path; generation flows documented ·
`v73` antonyms held to a looser standard than synonyms (user-reported: too few antonyms).

## Shipped in the v73 line (session 27)

`v73_b` **docs/ staleness guard.** `build-static.js` fingerprints every baked input and stamps the
digests into the artifact as `APP.buildSources`; `unit-static-freshness` recomputes them and names
the file that moved. Closes a real gap: `unit-version-derivation` compared version *strings*, and
`APP_VERSION` changes once per release while `index.html` and `lessons.json` change many times
inside one — so a mid-session drift was invisible. The v73 archive shipped with exactly that
(`docs/` 70 minutes behind `lessons.json`, suite green). `build-static.js` watches itself; `server.js`
is deliberately excluded. ·
`v73_c` **`lib-dom` runtime `innerHTML` parsing.** Assignment now parses into real nodes;
`querySelectorAll` returns them (it returned `[]` unconditionally, so it could only ever have been
asserted on vacuously). The raw string is still stored and returned, so every existing markup
assertion keeps passing — additive, not a flag day. Retired the "read-back needs a browser" claim in
`unit-arc-options`, which was false in all three of its parts. ·
`v73_d` **completion-card pass mark** (user-reported: green %-solved bar above a locked Next).
`_threshPct` was answering three questions; split into binding / topic / applies. The gated lesson
now gets its own row at its own 100% mark rather than stamping 100 onto the chapter bar. ·
`v73_e` **story highlighting word boundaries** (user-reported: every `i` highlighted, from a vocab
entry `"I"`). Unicode lookarounds for spaced scripts, unguarded for Han/Kana/Thai. 54 marks → 13 on
the reported chapter. ·
`v73_f` **article MCQs built only where answerable** (user-reported: `a / the / an` for `dream`) plus
the chapter naming itself on the progress row. de 9/9, it 3/3, fr 1/1 keep the exercise; en 0/6. ·
`v73_g` **completion-card lesson icon row** (user request). ·
`v73_h` **plural distractors drawn from the corpus**, replacing `x.plural + 'e'` — a German
pluralisation fact producing "bookse" in English. Caught a pre-existing duplicate-option defect.

`v73_i` **a round never asks one question twice.** Two exercises canonicalising to the same qid are
one question; `buildExercises` now drops the repeat. 41 duplicates across 17 lessons and 8 exercise
types, → 0. Downstream hygiene, not a quality fix — the duplicate DATA survives and still needs QC.

`v73_j` **QC findings survive a chapter edited mid-pass** (user-reported: 9 flags logged, 5 kept).
`_runQc` re-resolves topic/lesson by id and items by (key, index) instead of writing through
references the editor replaces. Two related mechanisms remain open — see the session notes §7c.

`v73_k` **a lesson type nothing checks is no longer stamped QC-clean** — `comprehension` carries
`questions`, fell to the generic vocab/sentences scan, and was stamped clean unexamined; the stamp
then made every later bulk run skip it. Plus three items recovered from the v71 → v72 roadmap
boundary (see RECOVERED below).

Suite 161 → 166. Full detail in `build_history/v73k_session27_notes.md`.

**Found and NOT fixed:** `topicCoverage().total` is nondeterministic — 15 of 294 topics return a
different denominator run to run (worst spread 4 questions, 2.9%), because builders sample which
items to quiz. A learner on the pass mark can cross it by reloading. Filed here rather than fixed:
it needs a decision about whether the universe should be seeded per topic, and that is a change to
the coverage model rather than a bug fix.

## Session 27 — status

Parts 1 and 2 of the planned session are **done or reordered by agreement**:

1. ✅ **`lib-dom` innerHTML parsing** (`v73_c`).
2. 🔄 **Cleanup / refactoring / documentation** — partly done. The five bookkeeping items in
   `future_development.md` §5 are fixed. The seven evidence-backed items from `HANDOVER.md` are
   still open and still correctly scoped.
3. ✅ **`build_history/future_development.md`** written — the backlog scan the roadmaps never had.
4. ⏸️ **Role model / authorization — POSTPONED BY THE USER**, plan recorded below. Superseded in
   priority by user-reported bugs found while playing lessons (§3–§7 of the session notes). Moved aside for
   user-reported bugs found while playing lessons, which is the right trade: nothing is deployed
   publicly, so this has no clock, while play-found bugs are the one class this suite cannot
   produce.

## Authorization and roles — the plan (not started)

**Why this is a design decision and not a cleanup item.** Roles, scoring and learner dashboards all
hang off it, so building them first means building them twice. Measured on `v73_c`:

| | |
|---|---|
| non-GET routes | 43 |
| of those, with any auth check | **3** (`/api/auth/password`, `/api/learner/state`, and login/register by nature) |
| `GET /api/learners` — every learner's username, completion counts, hardest words | **no gate at all** |
| teacher mode | `localStorage.getItem('dz_teacher_mode') === '1'` |
| server bind | `0.0.0.0` |

So the app has **authentication without authorization**. `learners.js` (`v65`) is genuinely good —
scrypt, timing-safe comparison, hashed session tokens, per-username throttling — and the gap is not
a missing subsystem but a missing *role field and gate*. `platform_plan.md` estimates its Phase 1 at
weeks of work while most of it already shipped; that estimate should not be trusted as written.

**Note the comment on `/api/learners`**: it claims the route "Requires teacher capability, which on
this server means a live backend (the same gate the editing UI uses)". No such gate is implemented.
A comment asserting a control that does not exist is worse than no comment.

**The plan, in order:**

1. **Decide the taxonomy first, on paper.** Proposed: `student` · `teacher` · `admin`, stored on the
   learner record, defaulting to `student`, with the first-created account becoming `admin`. Resist
   a capability matrix at this stage — three roles cover teacher-vs-student, which is what was
   asked for.
2. **Separate the two axes that `_canEdit()` currently conflates.** `_canEdit()` returns
   `APP.info?.canGenerate || APP._teacherMode` — i.e. *"is a backend available"* OR *"has this
   browser ticked a box"*. Capability and authority are different questions and must not share a
   function. `_isLearner()` is already the mode axis (v71 reachability rule) and is the model to
   follow.
3. **Server-side gate, deny by default.** One `requireRole(req, 'teacher')` helper, applied
   route-by-route with an explicit table in `INTERNALS.md`. Deny-by-default matters more than the
   table: a route added later must fail closed. Guard it with a test that enumerates the routes and
   fails when a new non-GET route appears without a decision recorded — otherwise this decays
   exactly as `/api/learners` did.
4. **Keep the client flag as a VIEW toggle only.** A teacher may want to see the learner view. After
   step 3 that is harmless, because the server no longer trusts it. Say so in the code, or someone
   will "fix" the localStorage flag later thinking it is the control.
5. **The static build has no server to ask.** `docs/index.html` teacher mode is, and must remain,
   an honour-system UI toggle — there are no credentials in the static bundle and there must never
   be (`learners.js`' opening comment is explicit that `build-static.js` must never read it). So the
   role model is a LIVE-only concept, and the static build's teacher mode keeps its current
   meaning. This asymmetry needs documenting, not eliminating.
6. **Only then** the learner-facing pieces: scoring, history, and the two dashboards. `summarize()`
   in `learners.js` already produces most of the teacher view (`chaptersCompleted` vs
   `chaptersStarted` — honestly named since `v69_n` — `wordsLearned`, `hardestWords`).

**Before any public deployment, independent of roles:** TLS termination in front of the server. The
`warnInsecureTransport` banner already says this and already honours `X-Forwarded-Proto`, so the
session cookie gains `Secure` with no code change.

## The original session spec — two parts, in this order

Full spec in `build_history/HANDOVER.md` under "Starting the next session". Summary:

1. **`lib-dom` runtime `innerHTML` parsing.** The fake DOM stores `innerHTML` as a string and never
   parses it, so `getElementById` returns empty stubs and 128 render sites cannot be read back.
   Expect the suite to go RED across the board before it goes green; every failure is a finding, and
   some will be tests that were passing vacuously.
2. **Cleanup / refactoring / documentation.** Seven evidence-backed items, each naming the defect
   that produced it. Do `lib-dom` first — several cleanup candidates are tests that pin source text
   *precisely because* they cannot read the DOM back.

> **The caution that matters most for part 2:** in this codebase "refactoring" has one recurring
> failure mode — a second copy of a rule that then drifts. Session 26 alone found two such pairs
> (the client/server sentence splitters; the synonyms prompt floor vs the server's filter) that had
> agreed with each other by coincidence for releases, so nothing ever failed. **Prefer removing a
> second copy over reorganising code that works.**

## Open — the queue

### Owed by the user (nothing here is doable in a dev container)

See the table in `HANDOVER.md` — it is the authoritative list and has grown across nine releases.
The two most informative right now:

- **Live synonyms run** (`v72_d`, `v72_e`, `v73`). Partially done: the user reports the new synonyms
  "look good so far", which is what prompted the `v73` antonym change. Still to confirm: the log
  lines `Synonyms context: N quoted, M rejected` and `N antonym-only`, and whether antonym counts
  recover after `v73`.
- **Browser passes on `v71_i`–`v73`** — nine releases deep.

### Open decisions blocking work

1. **Duplicate targets** (`v71_r`) — **evidence re-measured in session 26; the original data is
   gone.** The "six grammar lessons" this was written about are no longer in the corpus. What is
   live is **2 synonyms lessons with a repeated `base`**, both Arabic. Same defect class — two
   exercises collide on one qid, so the round asks the word twice while coverage counts it once —
   but rule on the CURRENT shape. Dedupe or repair?
2. **Crossword translation highlight**: `word_forms` items have no translation field.

*(Rulings from the v72 line, kept because each closes an item that would otherwise be re-opened:
the design principle's boundary — Unicode machinery, not hand-authored tables, session 25;
`el/storyboard.title` stays "Storyboard" as a loanword, session 26; grammar and conjugation stay
story-free, session 26.)*

### Ready to implement, no decision needed

- **Arabic presentation forms** — measured in session 26 (`v72f_session26_notes.md` §7), **not
  urgent**, and explicitly **NOT a blanket NFKC**: measured across the corpus, NFKC changes 158
  strings and corrupts several — `sˤ` → `sʕ` in `letters[].ipa` is a different phoneme, `① ② ③` →
  `1 2 3` destroys a lesson whose glyphs are the content, and Japanese full-width `！` is flattened
  to ASCII. **0 of 4670** typed-answer targets are affected, so no learner is ever marked wrong. The
  one live effect: `verbatimStorySentence` can never accept a model quote for those three topics, so
  the `v72_d` feature silently no-ops there. If actioned: fold **only** the two presentation-form
  blocks, **at comparison time**, never rewriting stored text — or better, fix `_cleanPdfText` so
  new imports never store them.
- **Clamp the synonym context SERVER-side** — `findContextSentence` returns an uncapped sentence;
  the client clamps for display (`v70_n`) so nothing is broken, but stored data stays bloated.
  Cheaper than it was — `_sentenceSplit` is genuinely shared now, with a parity test to copy. One
  wrinkle: a stored fragment loses the `frag` flag, which exists only client-side, so decide whether
  stored fragments carry ellipses or the honesty marker is lost.
- **`_SENT_END_RE`** (`index.html` ~4044, 4062, 4156, 4210) — the last hand-authored punctuation
  list in the segmentation area. It answers a *different* question from splitting ("does this string
  END like a sentence?", for the paragraph-wrap repair and title heuristics), which is why it was
  left alone through `v72_a`–`v72_c`. Fair game now; part of the cleanup pass.

### RECOVERED — dropped at the v71 → v72 boundary (restored in `v73_k`)

An entire `[OPEN — cosmetics deferred in v71_q]` block of three items vanished when `roadmap_v72.md`
was cut from `roadmap_v71.md`. None appears in `roadmap_v72`, `roadmap_v73`, `HANDOVER.md` — or in
`future_development.md`, whose scan grepped for unchecked checkboxes and read the topical idea docs
but did not walk `[OPEN — …]` blocks inside superseded roadmaps. All three re-verified as still open
on `v73_k`.

**Check `[OPEN`/`[QUEUE` blocks at every base-version cut.** That is where items are lost — not in
the idea documents, which nobody deletes.

1. **Global QC: a checkbox menu of what to QC**, including re-checking already-QCed items. Needs a
   scope picker and changes to how QC jobs batch — the same treatment the lesson-type picker got in
   `v71_p`, not a quick pass. **Merge with the user's session-27 request** (below): make the book's
   automatic QC opt-in from the same menu that selects lesson types, and run it after the storyboard
   post-pass rather than before. Note that reverses the `v68.1` ordering decision ("a slow board must
   never delay content flags") — which is defensible once QC is opt-in, but should be reversed
   knowingly. `renderLessonTypeChecks` is the menu, and `v73_c` made its render → read round trip
   provable headlessly, so the client half is now testable.
2. **Crossword: show the correct word's translation highlighted instead of the empty underline.**
   Needs a decision first. Clues come from three shapes — vocabulary (`target ← source`), synonyms
   (`base ← gloss`), and word_forms, where the clue IS a blanked sentence and the "empty underline"
   lives. A word_forms item stores only the sentence and its choices, **no translation**, so there is
   nothing to put in the gap. Either restrict this to vocabulary/synonym entries, or give word_forms
   clues a translation field.
3. **Live mode with teacher mode OFF must hide every editing control**, as static mode does. The
   learner should be able to continue the story, download and share a link — nothing else. Verified
   still open: `_canEdit()` is `!!(APP.info?.canGenerate || APP._teacherMode)`, so a learner on a
   live backend sees editing controls with teacher mode off. **This is the same `_canEdit()`
   conflation the authorization plan above calls out in step 2** — capability (is a backend
   available?) OR authority (has this browser ticked a box?) in one function. Do them together.

### Backlog — see `future_development.md`

`build_history/future_development.md` (new, session 27) is the scan of everything wanted across 128
files in `build_history/` and never built, each entry re-measured against the code. Two items in it
outrank most of this queue on current evidence:

- **The example pipeline is complete in code and empty in data.** `promptExample()` resolves at 4
  generation sites; `examples.json` absent, **0** corpus items starred, **1** curated per-language
  example (`wordForms.de`). Every generation in every language falls through to the generic default.
  Needs curation, not code, and sits upstream of every lesson the app produces.
- **5 lessons in the shipped corpus would be rejected by the app's own rule** (≥3 identical
  source/target items AND ≥60% of the lesson) — including the two `dreizunge_lessons_assessment.md`
  named as total model failures. The guard runs at generation time only, so it never cleaned what
  prompted it. **General case: every generation-time guard in this codebase leaves an unmeasured
  residue** (diacritics, article symmetry, identical-ratio).

### Larger, not started
- **Concept graph / dependency-aware curriculum.** Deliberately untouched until the small queue is
  clear. Large authoring project; do not start it opportunistically.
- **Word games beyond the crossword.** Reuse the crossword's conventions (deterministic seeding per
  attempt, credit only what the exercise genuinely demonstrates, content-based availability) rather
  than re-inventing them.

### i18n
**0 entries missing** — the pass landed between v72 and v72_b and filled all 30 languages to 596
keys. `ui.json` is byte-identical to the file the user supplied; **nothing was deleted.**

**8 entries are PARKED pending the user's own QC**, listed as `PENDING_QC` in
`test/unit-ui-verbatim-en.test.js`: `models.threads` in **ar, he, hi, ko, uk, zh, th, el** — one
key, eight languages. All came back verbatim English. They are held rather than deleted at
the user's request, and the guard compares against that list **exactly in both directions** — a new
fallback fails, and a parked entry that has since been translated also fails so the list is forced
to shrink. Do not treat `PENDING_QC` as an exemption list; it is a to-do list with a deadline
enforced by the suite.

`el/storyboard.title` is **no longer one of them** — decision 4 was ruled in session 26: keep
"Storyboard" as a loanword. It has moved to `APPROVED_LOANWORDS`, so the v71_k → reinstate loop is
closed. That leaves **8** parked entries, all of them `models.threads`.

**Validate a returning `ui.json` before merging** — per-language key counts, whether any `en` key
vanished, **and run `node test/run.js`**: the returning file carried 9 untranslated entries that
only `unit-ui-verbatim-en` caught.

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
   implicitly `a`, so the sequence is `v73` → `v73_b` → `v73_c` → … — the same convention the v69,
   v70, v71 and v72 lines ran. **This is the `v73` line.** Roadmaps are per BASE version, so point
   releases do not each get one — this file stays current through the whole v73 line.
   (Corrected in `v73_c`: this paragraph still said "This is the `v72` line" and documented the
   `v72` sequence, carried forward from `roadmap_v72.md` without being updated at the base cut.
   Check it at every base cut — it is the one paragraph in this block that is version-specific.)
7. **Roadmap** — mark shipped items ✅, carry every open TODO/idea forward, and at a version bump
   write the next `build_history/roadmap_v{N+1}.md` (carrying this protocol block forward).
8. **Session notes** — write/update `build_history/v{ver}_session{n}_notes.md`.
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
