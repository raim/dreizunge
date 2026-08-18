# Session prompt — written at the `v80` cut (end of session 34)

*(Rename this file for the version the session WRAPS UP WITH, per the convention set at the v75 cut.
`SESSION_PROMPT_v79_j.md` was the previous one — it is superseded by this file and was renamed, not
kept alongside.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Fresh session picking up from the **`v80`** cut.

## Orient yourself

Read these FIVE, in order. They are short by design.

1. `build_history/HANDOVER.md` — one page: baseline numbers, what session 34 shipped, the four
   RULINGS it landed, the two bugs it diagnosed, and what still needs a device pass.
2. `build_history/implementation_plan.md` — the larger plan, evaluated. **§10 names the next three
   sessions.** Then `build_history/roadmap_v80.md` — the **"⚠️ Session protocol — READ FIRST"**
   block, its **RESTORED** open sections (un-reconciled by design — reconciling them is task one),
   and §2y/§2z for the rulings. Then
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
Corpus at this cut: **324 topics, 91 storylines, 33 languages, 617 `en` keys**.

- `unit-static-freshness` red → run `node build-static.js`. **Read what it NAMES first:** it prints
  which source file drifted. If it names `index.html` alone and you have not touched it, that is a
  finding, not a rebuild.
- `unit-script-choice` red saying topics are unstamped → run `node backfill-script.js --write`.

**Read rule 23 first: a fixer is not a diagnosis, and running one destroys the evidence that says
whether it was right.** Check corpus counts, file mtimes, and the hash the freshness guard names
before either. **Order matters: backfill FIRST, build-static SECOND.**

A test can also fail on NEW data and **be wrong itself**. Diagnose before re-pinning.

## Read the rules before writing any probe

**Standing rules numbered to 35** now, in `roadmap_v80.md` ("Rules earned in session 28…34"). Read
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

*Rewritten clean at the `v80` cut. The previous version had accumulated three items numbered "0",
its sub-items in reverse order, and two entries that were already closed — the exact rot this
project's protocol warns about. Everything below was checked against the tree, not carried forward.*

## 1. Read the plan first — `build_history/implementation_plan.md`

The user's **larger plan (PDF focus)** is evaluated there against these roadmaps: ingest, pedagogy,
surface clean-up, lesson types, QC, export, sorted into five tracks at very different scales.
**Its §10 names the next three sessions.** Do not plan a session without reading it.

## 2. FOUR BUGS ARE ALREADY DIAGNOSED — do not re-derive them

- **§9c — the storyline title is never generated for a new book.** `server.js:5207`/`5215` seed
  `title: chain[0]` before the `v78_r` "only when there is none" guard looks, so the
  `generateStorylineTitle` branch is unreachable. **Do not weaken the guard** (it is a user ruling);
  mark the placeholder instead (`titleAuto: true`). Checked: `summary` is NOT seeded — title-only.
- **§F3 — the article asymmetry.** The `vocab` prompt contradicts itself: `BASE FORM ONLY … (with
  the usual article where the language uses one)` is PER-SIDE, `ARTICLE SYMMETRY` is CROSS-SIDE, and
  the first wins. **§F3c measured it as a COIN FLIP** — 7/8 asymmetric in one chapter, 0/8 in the
  next, same model, four minutes apart. **So one lesson can never validate a fix.** Remove the
  contradicting clause and add a worked counter-example (rule 31); do not add another prohibition.
- **§C1 — two progress-card gate bugs** the user hit: browsing forward and back skipped
  comprehension lessons, and replay reached comprehension before the story unlocked. Both smell like
  a gate computed from render state rather than lesson state. **Measure before editing.**
- **`unit-story-unlocked-page` §6 does not discriminate under revert** — carried since `v77_p`.
  Needs no ruling. A guard that cannot fail is worse than no guard.

## 3. FOUR RULINGS LANDED at the v80 cut — `roadmap_v80.md` §2y and §2z

Language x lesson-type applicability is **model-declared and cached with provenance**; the
observations log is keyed by a **stable local id an account can adopt** (so `implementation_plan.md`
§8/B1 is startable NOW); uploaded images are **stored server-side as FILES, never in `lessons.json`**;
and the duplicate storyline title was **resolved by the user renaming one** — the fork-marker guard
is now preventive, not corrective.

## 4. THE LIVE-PASS RESULTS ARE IN — do not re-test these

- **`v79_f` CONFIRMED.** The regenerated conjugation lesson carries 307 Cyrillic characters against
  0 in the old one. **But `tp_17864554460460000107` now has TWO conjugation lessons** — the broken
  all-Latin one and the correct one — and probably wants one. Ask before deleting a lesson.
- **`v79_i` worked, and the probe cannot show it.** Per lesson the regenerated `word_forms` went
  from 5 items all two-choice to 6 items with 1; the corpus-wide 15% is flat because
  un-regenerated lessons dominate the denominator. **Do not read the headline as a null result
  (rule 30).** The probe header still needs updating to say so.
- **`v79_k` CONFIRMED** by the user (fork display works).

## 5. STILL WANTING A DEVICE PASS — the user's, not yours

- **`v79_n`** — set a storyline speech locale in teacher mode, confirm chapters inherit it, override
  one chapter, and check a locale the phone lacks (marked ⚠) still speaks in the right LANGUAGE.
- **`v79_l`/`v79_m`** — on the Android that read English as Nigerian: pick a variant, press Test,
  then **start a lesson and listen**. If it still reverts, the suspect is the OS ignoring `u.voice`.
- **`v79_p`/`v79_q`** — on the STATIC build: change the target language and confirm the sound-test
  row follows, and that an RTL target language flips the word bank.
- **`v79_g`** — play a script-primer lesson: the glyph on render, the tapped chip after.

## 6. TASK ONE: CONSOLIDATE THE DOCUMENTS — four files become two

**Do this first, in one session, and do not split it.** Right now the same facts live in up to four
places and the durable one is the least complete — the two v80 diagnoses landed in HANDOVER, this
prompt and the plan, and were **missing from `roadmap_v80.md`** until they were noticed. That is the
whole argument.

**Target state — TWO documents:**

- **`roadmap_v80.md`** — durable. Protocol, standing rules, shipped table, open items, rulings,
  diagnoses. Per base version. Searched, never read cold.
- **ONE per-cut document** — this prompt, having absorbed `HANDOVER.md`. It is what the user pastes
  to start a session and the only thing that describes "now". `HANDOVER.md` and
  `SESSION_PROMPT_*.md` are the same document today and that duplication is what rotted: this
  prompt went stale in four ways in one session while the roadmap stayed correct, because it was
  restating handover content instead of owning anything.

**The work, in order:**

1. **Reconcile the two RESTORED sections** at the top of `roadmap_v80.md`'s open block against
   `implementation_plan.md`. Strike what the plan supersedes **WITH A POINTER**; keep what is still
   open. **Never delete a bullet silently** — that is how the reason for a decision is lost.
2. **Fold `implementation_plan.md` INTO the roadmap and delete it.** It is a one-off evaluation, not
   a per-cut document; its §10 and its diagnoses are roadmap material. Keeping it alive creates a
   second home for open items, which is how they went missing in the first place. Do this in the
   same pass as step 1 — both need the same 400 lines read, and reading them twice is the cost.
3. **Merge `HANDOVER.md` into this prompt and delete it.** Nothing in `test/` or any script
   references it (checked at the v80 cut) — only three prose mentions, in the roadmap and here.
4. **Extend `unit-roadmap-version` to guard the NUMBERS.** The prompt's `expect NNN checks` must
   match the actual suite, and its corpus counts must match `lessons.json`. Three of the four stale
   things this session were exactly these, and all were machine-checkable. **This is the step that
   makes the consolidation honest**, because prose work cannot be revert-verified the way code can —
   without it, this session ends with a green suite, a lot of churn, and no evidence it went well.

**Do not skip step 4 for time.** A consolidation with no guard is a note telling the next session
the documents are consistent, and rule 24 says a note is not a guard.

## 6b. THEN, buildable with no ruling needed

**In the folded plan's order:** `unit-story-unlocked-page` §6, the guard that does not discriminate
under revert. Then **§C1's two progress-card gate bugs**, measured before edited, with the
single-chapter 100% bar and the header-bar off-by-one folded in — they may share a root cause in
`_slProgressStats`. Then either **§8/B1 the observations log** (the only item whose value DECAYS
while it waits — the existing `{seen, wrong}` counters cannot be replayed) or **the D1 applicability
cache**.

**Small, independent, for a session that finishes early:** the fork-marker fallback (§9b/D8),
**§F2** the malformed word-forms detector — `"...across the path.___"` with answer `cast`, broken as
STRUCTURE so it needs no language knowledge, the cheapest real win in the plan — and **Track E**,
printable export.

**§0h — question navigation** also remains buildable and wants its own session: `C.cur`, `check()`,
per-run answer state, and `_speakAndAdvance`, which advances one way only.

## 7. NOT yours to start

**Import "new" mode is POSTPONED** (roadmap §0b). **Track A (ingest)** and **Track B beyond B1** need
the user. **Mastery-driven progression (§9b/D2) must NOT be decided** until §8/B4 has run BKT in
shadow mode and produced a disagreement log. The **learner/teacher rework** — `_canEdit()` is done
(`v79_j`); `Edit / rename topic` stays visible by user ruling; do not extend that surface.

**Still needing the USER, not you:** the per-text learning scheme is a DISCUSSION whose prerequisite
measurement is already done — **do not re-derive it.** A chapter's lessons teach **9.2% of its
story's tokens, 8.2% of its distinct words**, and the **rarest words are the least covered (5.1%)**.
Across all of `learners.json` only **40 words have ever been answered wrong** (574 with any record,
3.0%), so a difficulty policy must come from corpus statistics first. The two measurements to take
next are the **inflection share** and the **learner-known share** — one pass yields both.

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
Also the learner/teacher rework in §7 above.
