# Session prompt — written at the `v80_d` cut (end of session 35)

*(Rename this file for the version the session WRAPS UP WITH, per the convention set at the v75 cut.
`SESSION_PROMPT_v80.md` was the previous one — superseded by this file and renamed, not kept
alongside.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Fresh session picking up from the **`v80_d`** cut.

> **⚠️ THE DOCUMENT SET CHANGED AT THIS CUT — there are now TWO, not four.**
>
> - **`build_history/roadmap_v80.md`** — durable. Protocol, standing rules, shipped table, open
>   items, rulings, diagnoses, and (folded in at this cut) **THE LARGER PLAN**. Searched, never read
>   cold.
> - **this prompt** — the only document that describes "now". It absorbed `HANDOVER.md`.
>
> **`HANDOVER.md` and `implementation_plan.md` NO LONGER EXIST.** Both were folded in and deleted at
> the `v80_d` cut, because the same facts living in four places is what rotted: the two `v80`
> diagnoses landed in three of them and were missing from the durable one. **Do not recreate
> either.** Anything that cited `implementation_plan.md §X` now reads `PLAN §X` and lives in the
> roadmap's folded section; anything that cited `HANDOVER.md` is here.

## Orient yourself

Read these THREE, in order. They are short by design.

1. **This file**, whole. It is the baseline, what session 35 shipped, and what is open.
2. `build_history/roadmap_v80.md` — **its protocol block now carries a four-row INDEX of the file's
   own shape; read that first.** Finished releases live in **`# SHIPPED IN THE v80 LINE`** at the
   FOOT of the file (moved there at `v80_k`) — history, not work. Then the
   **"⚠️ Session protocol — READ FIRST"** block, then
   **"SESSION 35 — the reconciliation pass"** (the `v80_b`/`v80_c` write-ups and the reconciliation
   of the two restored sections), then **`PLAN §10`** in the folded plan, which names the next
   sessions, then the **USER TESTING NOTES** sections.
3. `INTERNALS.md` — constants, silent-failure modes, invariants, harness limits. **§6b is a
   feature → function map** — read it BEFORE grepping for where anything lives.

`build_history/v79_session33_notes.md` and the other session notes are history. Search them, never
read them cold.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 223 checks
node test/run.js --quick                  → expect 199
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Confirm all four. **If a count differs, treat it as a finding and diagnose it — do not assume a
stale fixture.** Data files (`lessons.json`, `ui.json`, `learners.json`, `languages.json`) often
change between sessions without that being mentioned; check timestamps against the code first.

Corpus at this cut: **324 topics, 91 storylines, 33 languages, 617 `en` keys**.
`APP_VERSION = 'v80_m'`.

> **These four expectations and the four corpus numbers are GUARDED**, by
> `unit-roadmap-version`, against the actual suite and against `lessons.json`. They cannot go stale
> silently any more. **If that test fails, the number in THIS file is the thing to fix** — it is
> reporting that the prompt disagrees with the tree, which is the failure this project hit in three
> of the four stale items at the `v80` cut.

- `unit-static-freshness` red → run `node build-static.js`. **Read what it NAMES first:** it prints
  which source file drifted. If it names `index.html` alone and you have not touched it, that is a
  finding, not a rebuild.
- `unit-script-choice` red saying topics are unstamped → run `node backfill-script.js --write`.

**Read rule 23 first: a fixer is not a diagnosis, and running one destroys the evidence that says
whether it was right.** Check corpus counts, file mtimes, and the hash the freshness guard names
before either. **Order matters: backfill FIRST, build-static SECOND.** Diff the baked corpus against
disk before rebuilding, so a rebuild cannot lose user content.

A test can also fail on NEW data and **be wrong itself**. Diagnose before re-pinning.

## ⚠️ Writing docs: NEVER put emoji in a Python string literal

Session 32 truncated a roadmap **to zero bytes** that way; the exception arrives AFTER the file is
opened, so a failed write is not a no-op. Write emoji-bearing blocks via a `cat` heredoc to a temp
file and splice that file in.

**And session 35's own version of the same lesson:** a blanket `str.replace` across four documents,
rewriting one file name to a phrase, silently mangled six sentences including a heading — *"folded
in from the folded THE LARGER PLAN section"*. It was caught by grepping for the replacement
afterwards. **Check what a mechanical rewrite DID, not just that it ran.**

## Read the rules before writing any probe

**Standing rules numbered to 35**, in `roadmap_v80.md` ("Rules earned in session 28…34"). Read its
**"⚠️ How the rules are NUMBERED"** note first — two blocks restart at `1.`, so rules 10–14 live in
the session-29 blocks and a grep for `^10\.` finds nothing. **Do not renumber them**; every citation
across the docs and several tests is by number. The ones that would have saved session 35 the most
time:

- **35 — a warning carried in the notes is a claim about a DESIGN, not about the problem.**
- **33 — a green guard near a defect is not evidence about that defect.** Session 35's whole
  §6 rewrite is this rule paid off.
- **32 — a release that says it closed a hole is a claim, not a measurement.** Guard the
  ENUMERATION, and sweep the corpus rather than pinning the chapters you looked at.
- **30 — a COUNT is a proxy and proxies fail on what they should welcome.**
- **29 — when a pin breaks, ask whether the CLAIM changed or only the TEXT did.**
- **24 — a note telling the next session to check something is not a guard.**
- **23 — a fixer is not a diagnosis.**
- **25 — never put emoji in a Python string literal.**

---

# WHERE TO START

## 1. WHAT SESSION 35 SHIPPED — do not re-derive any of it

**`v80_b` — Replay no longer opens a story-gated lesson while the story is locked.** `PLAN §C1`'s
SECOND bug. `_firstUnfinishedLessonIdx` had applied a story-lock filter since `v71_s`;
`_firstCoverageShortLessonIdx` — which the Replay button reaches through `repeatForCoverage`, and
which the below-mark Next branch falls back to — **never did**. One shared rule now
(`_storyLockedLesson`). **Measured 27 of 94 partly-played chapters before, 0 after**, revert-verified.

**`v80_c` — `unit-story-unlocked-page` §6 discriminates.** It had asserted the product against the
same product function. It now fails under revert, reproducing the user's original report (Next
replays lesson 0 instead of opening the comprehension questions).

**`v80_d` — the document consolidation** (this file, and the roadmap's folded plan).

## 2. ⚠️ TWO THINGS ARE CLOSED THAT LOOK OPEN ELSEWHERE — do not chase them

**`_firstUnfinishedLessonIdx` returning -1 with a lesson still unplayed was a MISATTRIBUTION.**
Carried since `v77_s` as an open defect with `if (setComplete(d)) return -1;` as prime suspect, and
struck in place in `INTERNALS.md` §2. Measured across every state built in session 35: the helper
returned the correct index every time. What goes to -1 is `showComplete`'s **local**
`nextLessonIdx`, set on purpose by the `v71_s` line. **`v77_s` did not cure it; it was never
broken.**

**`PLAN §C1`'s FIRST bug is NOT reproduced, and TWO readings of it are dead ends.** *"I browsed
forward to the story card and back, solved no comprehension lesson, yet could proceed to the next
chapter."* Reading 1 — `index.html`'s `nextLessonIdx = -1` line looked stranded because `v77_o`
deleted the greying its comment relies on; measured, the below-mark branch catches it correctly.
Reading 2 — the done-flag `_record` guard reads the ITEM universe while `v71_s`'s rule is stated in
QUESTIONS, and 36 of 102 gated lessons have an empty item universe; **that reproduction is an
ARTEFACT**, because every empty-universe gated lesson is an `error_hunt` and `C.isErrorHunt`
excludes error hunts from that block entirely. The fix was written, corpus-measured and **REVERTED**.
**What has NOT been modelled is the user's actual sequence — *browsing* to the story card and back,
rather than playing a lesson. Start there.**

## 3. BUILDABLE NOW, no ruling needed

**In `PLAN §10`'s order:** the rest of **`PLAN §C1`** — the first gate bug (above), plus the
**single-chapter 100% bar** and the **header-bar off-by-one**, which may share a root cause in
`_slProgressStats`. Then either **`PLAN §8/B1` the observations log** (the only item whose value
DECAYS while it waits — the existing `{seen, wrong}` counters cannot be replayed) or **the
`PLAN §D1` applicability cache**.

**Small, independent, for a session that finishes early:** the fork-marker fallback
(`PLAN §9b/D8`), **`PLAN §F2`** the malformed word-forms detector — `"...across the path.___"` with
answer `cast`, broken as STRUCTURE so it needs no language knowledge, the cheapest real win in the
plan — and **Track E** (`PLAN §4`), printable export.

**§0h — question navigation** also remains buildable and wants its own session: `C.cur`, `check()`,
per-run answer state, and `_speakAndAdvance`, which advances one way only.

## 4. FOUR RULINGS LANDED at the v80 cut — `roadmap_v80.md` §2y and §2z

Language x lesson-type applicability is **model-declared and cached with provenance**; the
observations log is keyed by a **stable local id an account can adopt** (so `PLAN §8/B1` is
startable NOW); uploaded images are **stored server-side as FILES, never in `lessons.json`**; and
the duplicate storyline title was **resolved by the user renaming one** — the fork-marker guard is
now preventive, not corrective.

## 5. ✅ THE §C2/§0c REVERSAL IS RULED AND SHIPPED — `v80_e`

**User ruling: MERGE.** The entry card is generalised to every chapter and the
next-chapter-unlocked card is deleted. One starter card per chapter, one set of ids. Details in the
roadmap's `v80_e` entry; the gate is `_enterViaSummaryCard` and the guard is
`unit-next-chapter-entry`.

**Still open in `PLAN §C2`** (the other five bullets, untouched): the third progress bar on the
entry card, the chapter title in the bottom row, "text comprehension" labelling, the summary
uncollapsed by default, and the entry-card remodel for chapters >= 2 — **which the merge has now
largely done**, since those chapters use the entry card.

## 6. STILL WANTING A DEVICE PASS — the user's, not mine

- **`v79_n`** — set a storyline speech locale in teacher mode, confirm chapters inherit it, override
  one chapter, and check a locale the phone lacks (marked ⚠) still speaks in the right LANGUAGE.
- **`v79_l`/`v79_m`** — on the Android that read English as Nigerian: pick a variant, press Test,
  then **start a lesson and listen**. If it still reverts, the suspect is the OS ignoring `u.voice`.
- **`v79_p`/`v79_q`** — on the STATIC build: change the target language and confirm the sound-test
  row follows, and that an RTL target language flips the word bank.
- **`v79_g`** — play a script-primer lesson: the glyph on render, the tapped chip after.
- **`v80_b`** — the point of the fix: with the story still LOCKED, press Replay and confirm it does
  not open the comprehension questions.

## 7. LIVE-PASS RESULTS ALREADY IN — do not re-test these

- **`v79_f` CONFIRMED.** The regenerated conjugation lesson carries 307 Cyrillic characters against
  0 in the old one. **But `tp_17864554460460000107` now has TWO conjugation lessons** — the broken
  all-Latin one and the correct one — and probably wants one. Ask before deleting a lesson.
- **`v79_i` worked, and the probe cannot show it.** Per lesson the regenerated `word_forms` went
  from 5 items all two-choice to 6 items with 1; the corpus-wide 15% is flat because
  un-regenerated lessons dominate the denominator. **Do not read the headline as a null result
  (rule 30).** The probe header still needs updating to say so.
- **`v79_k` CONFIRMED** by the user (fork display works).

## 8. NOT yours to start

**Import "new" mode is POSTPONED** (roadmap §0b). **Track A (ingest, `PLAN §7`)** and **Track B
beyond B1** need the user. **Mastery-driven progression (`PLAN §9b/D2`) must NOT be decided** until
`PLAN §8/B4` has run BKT in shadow mode and produced a disagreement log. The **learner/teacher
rework** — `_canEdit()` is done (`v79_j`); `Edit / rename topic` stays visible by user ruling; do
not extend that surface.

**⚠️ TRACK T's `§T5.1` is ANSWERED and `§T5.4` is the question that replaced it.** Green = ALL is
fine (mean 1.70 questions per word; 53.6% carry one). What needs a RULING is that the screen would be
**84% red**, and over half of worked chapters would show no green at all — an accurate report of
unfinished work, but not the "progress is obvious" the design assumes. **Do not build the colouring
until that is settled.**

**⚠️ `PLAN §F3`'s prompt fix SHIPPED at `v80_j` and is UNVERIFIED BY DESIGN.** The contradiction is
gone from `prompts.json` and guarded, but whether the MODEL now obeys needs regeneration across MANY
lessons and a re-run of `probe_article_symmetry_v80j.js` against its 1.0%/bimodal baseline. **A
single regenerated lesson proves nothing** — `tp_17869977371640000022` went 7-of-8 to 0-of-8 at the
`v80_i` drop, BEFORE the fix shipped. That is the coin, not the cure.

**⚠️ The INFLECTION SHARE is now MEASURED — do not re-derive it** (`v80_f`, roadmap). Of the words a
chapter teaches, **47.3% are findable in its story today, 36.4% are ABSENT in any form**, and a
matcher is worth about ten points (→56.9%), not fifty. **The ceiling is a GENERATION problem**, so
the text-focus design's first lever is prompt-side mapping, not a lemmatiser. The **learner-known
share** remains untaken.

**Still needing the USER, not you:** the per-text learning scheme is a DISCUSSION whose prerequisite
measurement is already done — **do not re-derive it.** A chapter's lessons teach **9.2% of its
story's tokens, 8.2% of its distinct words**, and the **rarest words are the least covered (5.1%)**.
Across all of `learners.json` only **40 words have ever been answered wrong** (574 with any record,
3.0%), so a difficulty policy must come from corpus statistics first. The two measurements to take
next are the **inflection share** and the **learner-known share** — one pass yields both.

## 9. OWED BY THE USER — not doable in a container

- **The pass mark.** `Churros` is 40 items where it was 83 questions, and an item is solved by ANY
  correct answer, so 80% is a materially lower bar. Needs a browser pass, not a code change.
  **This is the item `§0i` cited as "BLOCKED on §1" — a citation that dangled into `roadmap_v75.md`
  until session 35 fixed it. It is still owed.**
- **The `sr`/`hr` follow-ups:** the `ui.json` pass for `hr` (0 keys; `sr` is done at 612), the 28
  non-English `names` entries in `languages.json`, and a **native-speaker check of the
  `cyrillic-sr` table** — authored in-container, the exact case the design principle warns about.
- **A `cyrillic-sr` sounds column for the `latin` letter table** — a language judgement whose
  ABSENCE currently enforces the `v75_g` ruling pinned in `unit-intro-script`.
- **`translate-ui.js --langnames`** — `languages.json` name cells still empty; last run reported
  119 missing of 1024. `v78_c` fixed the crash that ended that run, and it saves per batch.
- **The translate pass** for the `en`-only keys listed in the roadmap's "Owed by the USER" block.
  `t()` falls back through English meanwhile. **`v71_q`: never assert a dropped key absent.**
- **The comprehension QC checker**, and **§0g's model-prompt change** — both need a live model.
- **The "how the game works" copy.**

## Standing tools — use them

**Before grepping for where something lives, check `INTERNALS.md` §6b.**

- `build_history/probe_gates_v80c1.js` — **new (session 35).** The `PLAN §C1` gate probe. Reports,
  does not assert. Run it before touching any gate.
- `build_history/probe_forks_v79k.js` — enumerates every fork under the client's own parent rule.
  Note it reports one corpus artefact: `tp_17825433860400000751` "Kalila and Dimna" names ITSELF as
  `continuedFromId` — inert in the client, but it makes a naive successor scan report a phantom
  9-way fork.
- `_cardErrors()` — assert it is empty after any card render you add.
- `probe_gates_v77.js` — re-run **and diff** after any change to the progress cards.
  **⚠️ It SELECTS its two chapters from the corpus, so a data drop moves the selection and a raw
  diff will show differences that are not drift.** `v80i_card_gates.txt` is the current baseline;
  `v80e_card_gates.txt`, `v80_card_gates.txt` and `v76_card_gates.md` are superseded.
  **This has now looked like a regression at TWO consecutive cuts and been data both times.** The
  disambiguation takes one command — check it before believing any gate diff.
  **Worked example from session 35, because the warning is easy to wave through:** the raw diff
  after `v80_e` showed one column flip from `YES` to `grey` across all 16 rows of the first block —
  which looks exactly like a regression. It was not. `v80_card_gates.txt` had been generated on the
  OLDER 321/90 corpus, so the probe now picks a different chapter. **The way to tell is to re-run
  the probe against the PREVIOUS client on the CURRENT corpus** and diff that: like-for-like, the
  32 rows were identical. Do that before believing a gate diff.
- `_cardHeader(prefix)` + `.card-screen` — every new card page must use both.
- `_storyWordSources(d)` — the one collector for "what words does this chapter teach".
- `_storyLockedLesson(L, d)` — **new (`v80_b`).** The ONE rule for "is this lesson closed because the
  story is locked". Both resume scans call it. If you add a third, call it too.
- `scriptPinNote(lang, script, role)` — every prompt emitting target-language text calls it (all
  fourteen), swept by `unit-script-pin-coverage`. Each `sharedGenOpts` must carry the chapter
  `script`.
- `build_history/probe_learner_known_v80l.js` — **new.** What TRACK T's red/green would actually
  paint, over real `learners.json` history. **84.1% RED, 8.7% green, half of worked chapters showing
  no green at all** — pinned in `v80l_learner_known.txt`. Reports.
- `build_history/probe_article_symmetry_v80j.js` — **new.** Vocab article symmetry, pinned in
  `v80j_article_symmetry.txt`. **The before-number for `PLAN §F3`: 31 of 3069 countable pairs (1.0%),
  but BIMODAL — 191 chapters at 0%, two at 100%.** Explicitly NOT language-blind; its article lists
  must never migrate into the code. Reports.
- `build_history/probe_lesson_script_v80h.js` — **new.** Lessons carrying none of their chapter's
  script. **2 of 95 at this cut** (was reported as 7 at `v80_h`; four were comprehension lessons and
  were NEVER defects — see `v80_m`). Reports.
- `build_history/probe_word_forms_defects_v80g.js` — **new.** Structurally malformed word_forms
  items. 8 of 345 at this cut. Reports.
- `build_history/probe_inflection_v80f.js` — **new.** The inflection share, output pinned in
  `v80f_inflection.txt`. A measuring instrument for a human, **not** a validator: its middle bands
  are edit distance and shared stems, which are not morphology. **Read the bands, never one number.**
- `build_history/probe_coverage_v78n.js` / `probe_coverage_bands_v78n.js` — the coverage numbers.
- `build_history/probe_word_forms_v79i.js` — the word-forms decidability floor. A measuring
  instrument for a human, **not** a validator.
