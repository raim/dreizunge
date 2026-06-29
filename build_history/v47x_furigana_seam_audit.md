# Furigana seam audit (v47.x)

Audited how furigana (bracket notation 漢字[かな] persisted in target/correct fields, rendered by
furiHtml/applyFurigana, stripped for TTS by stripFuri) interacts with the features added this
batch: the no-keyboard glyph splitter, content-aware RTL, the script lessons, and the new QC
checkers.

## Bug found & fixed
1. **Furigana × no-keyboard glyph ordering (real bug).** `glyphTokens(ex.correct)` ran on the raw
   stored target, so a Japanese word like `猫[ねこ]が好[す]き` produced tiles
   `["猫","[","ね","こ","]","が","好","[","す","]","き"]` — the learner would have to order literal
   `[`/`]` characters, and the reading kana (ねこ/す) showed as tiles, revealing the pronunciation.
   **Fix:** `tGlyphOrder` now tokenizes `stripFuri(ex.correct)` (→ `猫が好き` → tiles `猫/が/好/き`)
   and stores `ex._glyphTarget`; `check()` compares the assembly against that stripped base. Guarded
   in `unit-no-keyboard`.

## Minor inconsistencies fixed
2. **Synonym QC didn't strip furigana.** `qcCheckSynonymSet` sent `entry.base`/`gloss`/synonym `w`
   values to the LLM with brackets intact (`猫[ねこ]`), while `qcCheckCloze` already stripped via
   `_qcStripFuri`. Made the synonym checker strip too, for clean prompts. (Server.)
3. **Glyph-order source prompt used escHtml, not furiHtml.** If the *source* language were
   Japanese-with-furigana (rare, only via `userStoryLang`), the prompt word would show literal
   brackets. Switched to `furiHtml(ex.source)` to match every other typing renderer.

## Seams checked and found SOUND (no change)
- **Furigana × script lessons:** intro_script glyphs are single kana / Greek / etc. with no
  brackets, so furiHtml/applyFurigana pass them through untouched. Verified あ, ガ, "Α α" → unchanged.
- **Furigana × content-aware RTL:** furigana only applies to JA (LTR); `dir="auto"` on JA content
  resolves LTR; ruby markup unaffected. (RTL languages have no furigana.)
- **Furigana × cloze QC:** `qcCheckCloze` already strips the sentence via `_qcStripFuri`. ✓
- **rubyToBracket at import** still runs only at paste time on user story/translation inputs; the
  new features consume the already-bracketed stored form, which strip/render handle. ✓

## Net
One real bug (JA no-keyboard ordering) + two consistency fixes. All have headless guards or were
verified by extraction test. Browser check: a JA lesson in no-keyboard mode should show clean
kanji/kana tiles (LIVE-TEST §35 updated).
