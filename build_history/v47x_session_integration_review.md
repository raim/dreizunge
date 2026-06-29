# v47.x session — integration self-review + verification script

Goal: before tagging v48, audit the seams where this batch's features interact (unit tests cover
pieces in isolation; bugs hide between them) and produce a fast manual-verification script.

## Seam bugs found & fixed (all had passing unit tests — these are interaction gaps)

1. **Flagged-only QC skipped word_forms / synonyms.** `_qcLessonUserFlagged` only scanned
   vocab/sentences/grammar via the legacy global flag registry; per-item `userFlag` on `items`
   (word_forms) and `words` (synonyms) was ignored, so a flagged item of those types was skipped
   in flagged-only QC. → now checks per-item `userFlag` across vocab/sentences/grammar/conjugations/
   items/words, with the legacy registry as fallback. (server.js `_qcLessonUserFlagged`)

2. **`extend` on a set with no prior chapters wrongly scoped.** `introLetterScope('extend')` on a
   standalone set returned `scoped:true` over that set's own letters (no prior → everything counts
   as "new"). reinforce already fell back to full alphabet; extend now does too — both require
   prior chapters. (index.html `introLetterScope`) NOTE: the *arc-generation* path
   (`introExtendLetters`/`buildArcIntroLessons`, chapter 1, priorRef=null) intentionally still seeds
   the alphabet from chapter 1 — that's the chaptered context, different from a manual standalone add.

3. **Lesson flag/star badge ignored intro_script letters.** The path-node badge counted
   vocab/sentences/items/words but not `letters`, so flagging/starring a letter didn't surface on
   the lesson. → added `letters`. (index.html `lessonFlagCount`/`lessonStarCount`)

4. **Flag-merge import dropped letter flags/edits.** The Merge import mapped
   vocab/sentences/words/items/grammar/conjugations through `mergeFlaggable` but not `letters`, so a
   static-build user's letter flags/ratings/edits were lost on merge. → added `letters`. Also added
   items/words/letters to the import `qcFlags` summary count. (server.js merge import)

## Seams checked and found SOUND (no change)
- Muted + RTL + re-derived intro lesson: no-voice drops listen items at build; voice-but-muted
  keeps them and tLMcq shows the pron-based fallback (ex.pron present). Mid-lesson mute re-renders
  via renderEx, not a rebuild — items stay, rendering flips. ✓
- Editor letter delete/edit → re-derive: editing sets `delete ls.exercises`; play always re-derives
  from `lesson.letters` with full-alphabet distractor pool, so even a down-to-3-letter edited set
  builds valid MCQs and an edited translit propagates. ✓
- QC dispatch vs intro_script: skipped by type (curated data, human-QC). ✓
- Arc intro lesson exercises vs client re-derive: client ignores baked exercises and re-derives
  identically (parity-tested). ✓

## Guards added
- unit-intro-script: standalone reinforce AND extend → full alphabet (seam 2).
- unit-qc-dispatch: `_qcLessonUserFlagged` detects per-item flags on items/words (seam 1).

## Deliverable
- `build_history/V47-VERIFICATION.md` — deduplicated, priority-ordered manual run (B vs O backend
  tagged), grouped by fixture so each is built once. Supersedes scattered §29–34 for the actual pass.

## Still owed before v48 tag
- The browser + Ollama pass itself (V47-VERIFICATION.md). QC prompts will likely need tuning.
- APP_VERSION bump to v48 + roadmap roll-forward + i18n for the v47.x en-only keys.
