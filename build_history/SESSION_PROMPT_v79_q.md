# Session prompt — written at the `v79_q` cut (end of session 34)

*(Rename this file for the version the session WRAPS UP WITH, per the convention set at the v75 cut.
`SESSION_PROMPT_v79_j.md` was the previous one — it is superseded by this file and was renamed, not
kept alongside.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Fresh session picking up from the **`v79_q`** cut.

## Orient yourself

Read these four, in order. They are short by design.

1. `build_history/HANDOVER.md` — one page: baseline numbers, what session 34 shipped, the **one
   ruling owed by the user**, and the four things that still need a LIVE pass.
2. `build_history/roadmap_v79.md` — the **"⚠️ Session protocol — READ FIRST"** block, then
   **"⚠️ OPEN AT THE v79 CUT"** (its §0 is now mostly shipped — read what is STILL OPEN there),
   then the **USER TESTING NOTES** sections.
3. `INTERNALS.md` — constants, silent-failure modes, invariants, harness limits. **§6b is a
   feature → function map** — read it BEFORE grepping for where anything lives. Its fork rows were
   rewritten at this cut, including a correction to a row that was wrong.
4. `build_history/v79_session33_notes.md` — session 33. Search it, don't read it cold.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 218 checks
node test/run.js --quick                  → expect 194
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Confirm all four. **If a count differs, treat it as a finding and diagnose it — do not assume a
stale fixture.** Data files (`lessons.json`, `ui.json`, `learners.json`, `languages.json`) often
change between sessions without that being mentioned; check timestamps against the code first.
Corpus at this cut: **321 topics, 90 storylines, 33 languages, 617 `en` keys**.

- `unit-static-freshness` red → run `node build-static.js`. **Read what it NAMES first:** it prints
  which source file drifted. If it names `index.html` alone and you have not touched it, that is a
  finding, not a rebuild.
- `unit-script-choice` red saying topics are unstamped → run `node backfill-script.js --write`.

**Read rule 23 first: a fixer is not a diagnosis, and running one destroys the evidence that says
whether it was right.** Check corpus counts, file mtimes, and the hash the freshness guard names
before either. **Order matters: backfill FIRST, build-static SECOND.**

A test can also fail on NEW data and **be wrong itself**. Diagnose before re-pinning.

## Read the rules before writing any probe

**Standing rules numbered to 35** now, in `roadmap_v79.md` ("Rules earned in session 28…34"). Read
its **"⚠️ How the rules are NUMBERED"** note first — two blocks restart at `1.`, so rules 10–14
live in the session-29 blocks and a grep for `^10\.` finds nothing. **Do not renumber them**; every
citation across the docs and several tests is by number. Each rule cost a wrong finding. The ones
that would have saved session 34 the most time:

- **35 (new) — a warning carried in the notes is a claim about a DESIGN, not about the problem.**
  Three documents warned that "shared chapters count the same for every fork" would collide with the
  `_rendered` guard and that the progress half was the risky one. Measured first: progress needed
  **no change at all** (it is keyed by topic name, so it was already storyline-agnostic), and the
  collision belonged to a design the user then rejected. **Measure the warned-about thing before
  planning around it.**
- **29 — when a pin breaks, ask whether the CLAIM changed or only the TEXT did.**
- **30 — a COUNT is a proxy and proxies fail on what they should welcome.**
- **32 — a release that says it closed a hole is a claim, not a measurement.** Guard the
  ENUMERATION. `unit-fork-display` sweeps the corpus for forks rather than pinning the two that
  were looked at — copy that shape.
- **33 — a green guard near a defect is not evidence about that defect.**
- **34 — guard at the layer where the claim is observable, and say plainly what stays unverified.**

Older ones that still cost the most: **a fixer is not a diagnosis (23)**; **a note telling the next
session to check something is not a guard (24)**; **never put emoji in a Python string literal
(25)** — write emoji-bearing blocks via a `cat` heredoc and splice the file in; **`_genMeta` records
how every lesson was made (28)**; **a probe must CALL the product function**; **revert-verify every
fix and believe the result**; **`build-static.js` re-implements client functions**.

---

# WHERE TO START

**0. TWO RULINGS ARE OWED BEFORE ANY OF THE BELOW, and one known-bad guard is the best
buildable item.**

**(a) A guard that does not discriminate, carried since `v77_p`.** `unit-story-unlocked-page` §6
records that the "Next opens UNPLAYED work before a coverage replay" claim **does not fail when the
fix is reverted**. It is the oldest outstanding instance of "a claim is only measured if the
assertion touched the thing being claimed", it needs no ruling, and it is the item I would take
first — a guard that cannot fail is worse than no guard, because it is read as protection.

**(b) The single-chapter progress bar.** `_slProgressStats` adds one for the in-progress chapter,
so **every one-chapter storyline reads 1/1 and a 100% bar before anything is played**
(`sl_1041030875` does today). Measured at the `v79_k` cut. Changing a headline number wants a
ruling — ask.

**1. THE RULING I OWE YOU, and the natural first item: the ASYMMETRIC fork.** Roadmap §0 has it in
full. `v79_k` shipped the forked-storyline display for forks where both storylines list the shared
chapter. Where they do not, the intent is still unmet and it is a **data** question:

> `sl_1041030875` ("Dough of the Ancients") lists exactly ONE chapter, "Grandpas Dough Talk", which
> continues from "pizza dough" — a chapter that storyline does not contain. So that deck has no
> fork parent to branch from: no shared prefix on screen, no fork marker, and playing "pizza dough"
> moves `sl_182891979` from 0/2 to 1/2 while `sl_1041030875` stays at 0/1.

**Ask me which:** add the shared ancestors to the storyline's `chapters[]`, or have the display
reach back across `continuedFromId` without touching the data. **Do not pick one unasked** — the
first changes user data and the second changes what a storyline means.

**2. Five things need a LIVE pass, and only I can do them.**

- **`v79_n`** — set a storyline speech locale in teacher mode, confirm chapters inherit it,
  override one chapter, and check that a locale your phone lacks (marked ⚠) still speaks in the
  right LANGUAGE rather than going silent.
- **`v79_m` + `v79_l`** — on the Android that reads English as Nigerian: pick a variant from the new selector
  beside the speech-test button on the main page, press Test, then **start a lesson and listen**.
  The lesson is the step that used to lose the choice. If it still reverts, the suspect is the OS
  ignoring `u.voice`, not the app forgetting.

- **`v79_k`** — one click. Open `sl_1191899409` "Dolomites Disaster", **tap the greyed branch**: it
  must open the other storyline (not the chapter card under your finger), and **Back must return to
  the fork you came from**. The guard asserts the wrapper carries `_openStorylineById` and the
  inner cards are `pointer-events:none`; which element wins a real click, no container can see.
- **`v79_i`** — regenerate a `word_forms` lesson, then run `build_history/probe_word_forms_v79i.js`
  and diff against its header. **The Aug 14 movement (17% → 15%) is NOT a result** — that lesson
  was hand-edited, not regenerated. The prompt has not met a model yet.
- **`v79_f`** — regenerate the conjugation lesson of `tp_17864554460460000107` and watch for the
  `[script] conjugation prompt pinned to Cyrillic for sr` log line.
- **`v79_g`** — play a script-primer lesson and listen: the glyph on render, the tapped chip after.

**3. Buildable without a ruling.** **§0h — question navigation**, which wants its own session:
`C.cur`, `check()`, per-run answer state, and `_speakAndAdvance`, which advances one way only. §0d
has one open bullet (progress bars, lesson icons and the replay/drill/crossword/next buttons BELOW
the text on all progress cards) — probe-gates territory, so **re-run AND diff `probe_gates_v77.js`**.

**One small thing found while measuring session 34, not fixed because it wants a ruling:**
`_slProgressStats` adds one for the in-progress chapter, so **every single-chapter storyline reads
1/1 and a 100% bar before anything is played.** That is `v77_p`'s rule meeting a one-chapter deck.

**4. Import "new" mode is POSTPONED** (roadmap §0b) — do not start it without raising it with me.

**5. Still open and needing ME, not you:** the per-text learning scheme is a DISCUSSION whose
prerequisite measurement is already done — **do not re-derive it.** A chapter's lessons teach
**9.2% of its story's tokens, 8.2% of its distinct words**, and the **rarest words are the least
covered (5.1%)**. Across the whole of `learners.json` only **40 words have ever been answered
wrong** (574 with any record, 3.0%), so a difficulty policy from learner history starts from almost
no signal and must come from corpus statistics first. The two measurements I'd take next are the
**inflection share** and the **learner-known share** — one pass over the same inventory yields both.

**6. The learner/teacher interface: `_canEdit()` is DONE (`v79_j`).** A larger rework is still
expected. `Edit / rename topic` stays visible by my ruling ("generation, not editing").
**Do not extend that surface further without raising it with me.**

## Standing tools — use them

**Before grepping for where something lives, check `INTERNALS.md` §6b.**

- `build_history/probe_forks_v79k.js` — **new.** Enumerates every fork under the client's own
  parent rule and reports what the screen and the completion helpers do with each. Run it before
  touching anything fork-shaped. Note it reports one corpus artefact: `tp_17825433860400000751`
  "Kalila and Dimna" names ITSELF as `continuedFromId` — inert in the client, but it makes a naive
  successor scan report a phantom 9-way fork.
- `_cardErrors()` — assert it is empty after any card render you add.
- `probe_gates_v77.js` — re-run **and diff** after any change to the progress cards.
  **⚠️ It SELECTS its two chapters from the corpus, so a data drop moves the selection and a raw
  diff against `v77_card_gates.md` will show differences that are not drift.** The table's own
  differences at this cut are explained: `v77_l` retired `v74_l`'s hide-list and `v77_p` removed the
  story preview. **`v76_card_gates.md`'s table is superseded.**
- `_cardHeader(prefix)` + `.card-screen` — every new card page must use both.
- `_storyWordSources(d)` — the one collector for "what words does this chapter teach".
- `scriptPinNote(lang, script, role)` — every prompt emitting target-language text calls it (all
  fourteen), swept by `unit-script-pin-coverage`. Each `sharedGenOpts` must carry the chapter
  `script`.
- `build_history/probe_coverage_v78n.js` / `probe_coverage_bands_v78n.js` — the coverage numbers.
- `build_history/probe_word_forms_v79i.js` — the word-forms decidability floor. A measuring
  instrument for a human, **not** a validator.

## Not in scope unless I raise it

Everything under "Owed by the user" in the roadmap's open block — the `cyrillic-sr` sounds column
for the `latin` table (a language judgement whose ABSENCE enforces the `v75_g` ruling pinned in
`unit-intro-script`), the "how the game works" copy, and the prompt changes that need a live model.
Also the learner/teacher rework in §6 above.
