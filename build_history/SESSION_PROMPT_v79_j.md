# Session prompt — written at the `v79_j` cut (end of session 33)

*(Rename this file for the version the session WRAPS UP WITH, per the convention set at the v75 cut.
`SESSION_PROMPT_v79.md` is the previous one, written at the v79 base cut.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Fresh session picking up from the **`v79_j`** cut.

## Orient yourself

Read these four, in order. They are short by design.

1. `build_history/HANDOVER.md` — one page: baseline numbers, what is closed, what is open, and the
   three releases that still need a LIVE pass before their claims are more than wiring.
2. `build_history/roadmap_v79.md` — the **"⚠️ Session protocol — READ FIRST"** block, then
   **"⚠️ OPEN AT THE v79 CUT"**, then the **USER TESTING NOTES** sections (mine, already triaged).
3. `INTERNALS.md` — constants, silent-failure modes, invariants, harness limits. Read this instead
   of grepping the notes for "what is the value of X". **§6b is a feature → function map** —
   read it BEFORE grepping for where anything lives; it exists to save you the search.
4. `build_history/v79_session33_notes.md` — the previous session. Eight point releases, two data
   drops, six new standing rules, and five source pins that broke while their claims stayed true.
   **Read §§8 and 10 in full; the rest is reference — search it, don't read it cold.**

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 213 checks
node test/run.js --quick                  → expect 189
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Confirm all four. **If a count differs, treat it as a finding and diagnose it — do not assume a
stale fixture.** Data files (`lessons.json`, `ui.json`, `learners.json`, `languages.json`) often
change between sessions without that being mentioned; check timestamps against the code first.
Corpus at this cut: **321 topics, 90 storylines, 33 languages, 617 `en` keys**.

- `unit-static-freshness` red → run `node build-static.js`.
- `unit-script-choice` red saying topics are unstamped → run `node backfill-script.js --write`.

**Read rule 23 first: a fixer is not a diagnosis, and running one destroys the evidence that says
whether it was right.** Check corpus counts, file mtimes, and the hash the freshness guard names
before either. **Order matters: backfill FIRST, build-static SECOND.** Both data drops last session
needed build-static alone (`0 outstanding`), and checking that first is what proved it.

A third kind happens too: a test can fail on NEW data and **be wrong itself** — it happened again
last session (`unit-story-unlocked-card` §8 picked an 8-word chapter that one round exhausts, so
"a shorter play solves fewer words" compared 8 with 8). Diagnose before re-pinning.

## Read the rules before writing any probe

**Thirty-four standing rules** now, in `roadmap_v79.md` ("Rules earned in session 28…33"). Each one
cost a wrong finding. The six added last session are the ones I'd re-read first:

- **29 — when a pin breaks, ask whether the CLAIM changed or only the TEXT did.** Five broke last
  session and none had a false claim. Re-anchor at the level the claim lives; don't re-pin to the
  new text, which preserves the brittleness.
- **30 — a COUNT is a proxy and proxies fail on what they should welcome.** "This helper appears
  exactly 3 times" broke on a *correct* new call site.
- **31 — before strengthening an instruction, check whether it is already there and being
  CONTRADICTED.** The word-forms prompt already banned indecidable distractors and recommended them
  three bullets earlier. A worked counter-example beats another sentence of prohibition.
- **32 — a release that says it closed a hole is a claim, not a measurement.** Guard the
  ENUMERATION, not the instances you happened to fix.
- **33 — a green guard near a defect is not evidence about that defect.** Find out what it actually
  compares before trusting it.
- **34 — guard at the layer where the claim is observable, and say plainly what stays unverified.**

Older ones that still cost the most: **a fixer is not a diagnosis (23)**; **a note telling the next
session to check something is not a guard (24)**; **never put emoji in a Python string literal
(25)** — it truncated a roadmap to zero bytes, and the exception arrives AFTER the file is opened,
so a failed write is not a no-op; **`_genMeta` records how every lesson was made, read it before
diagnosing what a lesson contains (28)**; **a probe must CALL the product function**; **a claim is
only measured if the assertion touched the thing being claimed**; **revert-verify every fix and
believe the result**; **`build-static.js` re-implements client functions**.

---

# WHERE TO START

**1. Three releases need a LIVE pass, and only you can do it.** Everything about them is guarded at
the layer a container can reach; none of it proves the model complies.

- **`v79_i`** — regenerate a `word_forms` lesson, then run `build_history/probe_word_forms_v79i.js`
  and diff against the numbers in its header. **The Aug 14 movement (17% → 15%) is NOT a result** —
  that lesson was hand-edited, not regenerated; its `_genMeta.at` is unchanged. The prompt has not
  met a model yet.
- **`v79_f`** — regenerate the conjugation lesson of `tp_17864554460460000107` (Cyrillic chapter,
  all-Latin conjugation) and watch for the new `[script] conjugation prompt pinned to Cyrillic for
  sr` log line. That line exists to separate "the script never arrived" from "the model was told and
  ignored it".
- **`v79_g`** — play a script-primer lesson and listen: the glyph on render, the tapped chip after.

**2. THE TASK FOR THIS SESSION: the forked-storyline display.** Roadmap open block §0 has it in
full. Four parts, all on the storyline screen:

- the forked storyline is shown **completely** — every chapter, not the truncated stub — and all of
  it greyed out as it is today;
- clicking **any** greyed chapter opens that alternative storyline, so the learner can switch
  between forks from either side;
- **shared chapters count the same way for every fork** — a chapter both forks contain must not be
  progress on one and nothing on the other;
- the `⑂A/B/C` marker becomes **nothing** for the currently open storyline and the **storyline
  TITLE** for the others, and the node itself is clickable.

**Where it lives** (verified at the `v79_j` cut; `INTERNALS.md` §6b has the fuller table). All in
`index.html`, all inside `_renderStorylineScreen(chainId, encodedChain, topics)`:

- `_renderChain(topic, prevTopic, isFirst, depth, chainBlocked)` — the recursion that draws the
  chain. Its `kids.length > 1` block is the branch point: the `⑂A/B/C` marker is one line in it
  (`'⑂ ' + String.fromCharCode(65+bi)`), and **the greyed stub is its `else` arm** — note that the
  stub renders only `kids[0]`, which is exactly why a fork shows one chapter instead of all of them.
- `_renderChapterCard(...)` → `savedItemHtml(s, connector, hideStory, hideProv, slChapter)` — one
  chapter's card.
- `_chapterComplete(t)` → global `chapterComplete(t)`, with `lessonCountsFor(d, L)` /
  `countedLessons(d)` deciding which lessons count — this is the progress-attribution path.

**Two things you will hit in the first ten minutes, so know them now.** `byTopic` is keyed by topic
**NAME**, not id, so anything you carry around by id needs converting. And `_rendered` (a `Set`)
guarantees each chapter card is drawn at most once across the whole tree — so "shared chapters count
the same for every fork" is not a rendering tweak, it collides with that guard, and how you resolve
that collision IS the design decision in this task.

**The progress-counting part is the risky half**, because it is shared state between forks rather
than a rendering change: check what the completion helpers and the gate probe say before and after,
not only what the screen looks like. This lands on the surface `probe_gates_v77.js` measures —
**re-run and DIFF it** against `v77_card_gates.md`, per the standing note that running it without
diffing proves nothing (`v76_card_gates.md`'s table is superseded).

**First move: measure, don't edit.** Run `probe_gates_v77.js` for the baseline, and find a real
forked storyline in `lessons.json` (chapters with more than one successor, where the successors sit
in different storylines) and report what the screen and the completion helpers currently do with it.
Then come to me with what you found before changing anything — "shared chapters count the same" is
clear as an intention and ambiguous as an implementation until we both know how a chapter is
attributed to a storyline today. If you run short of room after that, the diagnosis and the baseline
are the parts worth having; they are what would otherwise be redone.

**3. Import "new" mode is POSTPONED** (roadmap §0b) — a possible future feature, not this
session's work. Do not start it without raising it with me first.

**4. The learner/teacher interface: `_canEdit()` is DONE (`v79_j`)** — editing controls key on
teacher mode alone, and `unit-can-edit-teacher-mode` holds the truth table. A larger learner/teacher
rework is still expected; when it comes, note that the roadmap entry UNDERSOLD the original item —
`Edit / rename topic` in the library row is a pure editing control gated directly on `canGenerate`
and was never a `_canEdit()` caller. It stays visible by my ruling ("generation, not editing").
**Do not extend that surface further without raising it with me.**

**5. Still open and needing ME, not you:** the per-text learning scheme is a DISCUSSION whose
prerequisite measurement is already done — do not re-derive it. `roadmap_v79.md` → "THE COVERAGE
MEASUREMENT": a chapter's lessons teach **9.2% of its story's tokens, 8.2% of its distinct words**,
and the **rarest words are the least covered (5.1%)**, the opposite of "start with the hard words".
Session 33 added one number to it: across the whole of `learners.json` only **40 words have ever
been answered wrong** (574 words with any record, 3.0% error rate), so a difficulty policy driven by
learner history starts from almost no signal and must come from corpus statistics first. The two
measurements I'd take next are the **inflection share** (what fraction of uncovered types are
inflections of covered lemmas) and the **learner-known share** (of this chapter's types, how many the
learner already knows from any earlier chapter) — one pass over the same inventory yields both.

**6. Buildable without a ruling, if the fork work finishes early:** **§0h — question navigation**, its own session: `C.cur`,
`check()`, per-run answer state, and `_speakAndAdvance`, which advances in one direction only. §0d
has one open bullet (progress bars, lesson icons and the replay/drill/crossword/next buttons BELOW
the text on all progress cards) — also probe-gates territory.

## Standing tools — use them

**Before grepping for where something lives, check `INTERNALS.md` §6b.** It maps features to
function names (names, not line numbers, so it survives edits). It was written because the single
biggest cost of the previous session was searching, not reading.

- `_cardErrors()` — assert it is empty after any card render you add.
- `probe_gates_v77.js` — re-run **and diff** after any change to the progress cards.
  `v77_card_gates.md` for the table; **`v76_card_gates.md`'s is superseded.**
- `_cardHeader(prefix)` + `.card-screen` — every new card page must use both.
- `_storyWordSources(d)` — the one collector for "what words does this chapter teach".
- `scriptPinNote(lang, script, role)` — **every prompt that emits target-language text calls it**
  (all fourteen, since `v79_f`), and `unit-script-pin-coverage` SWEEPS the source to make sure a new
  one cannot skip it. A new lesson type will fail that test until it is classified. Note also that
  each `sharedGenOpts` construction must carry the chapter `script` — that was the half of the bug
  the prompts alone could not fix.
- `build_history/probe_coverage_v78n.js` / `probe_coverage_bands_v78n.js` — the coverage numbers.
- `build_history/probe_word_forms_v79i.js` — the word-forms decidability floor, with both cuts in
  its header. It is a measuring instrument for a human, **not** a validator: rejecting these
  mechanically would mean the app encoding per-language grammar, which the model owns.

## Not in scope unless I raise it

Everything under "Owed by the user" in the roadmap's open block — the `cyrillic-sr` sounds column
for the `latin` table (a language judgement whose ABSENCE enforces the `v75_g` ruling pinned in
`unit-intro-script`; a column was authored at the v79 cut and reverted), the "how the game works"
copy, and the prompt changes that need a live model. Also the learner/teacher rework in §3 above.
