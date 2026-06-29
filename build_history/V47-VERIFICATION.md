# v47.x verification run — fast path

A deduplicated, ordered pass over everything this batch added (LIVE-TEST §29–34). Organized by
**setup** so you build each fixture once and check several things against it, and by **priority**
(P0 = could be broken/embarrassing, P1 = important, P2 = polish). Tick as you go; anything that
fails, note the section + browser/OS.

Two backends matter here:
- **Browser-only** (B): rendering, RTL, TTS, editor — any modern browser, no Ollama.
- **Ollama** (O): generation + QC — needs the local model running.

---

## Setup A — import the Arabic sample (covers the most, fastest)
Import `dreizunge_yusuf-and-the-lost-cat_…json` (en→Arabic, UI stays English).

**P0 — direction is content-driven, not language-driven** (B)
- [ ] Interface chrome (nav, buttons, badges) stays **LTR**; Arabic story/vocab render **RTL**.
- [ ] In an MCQ where the **prompt is English and choices are Arabic**: prompt left-aligned,
      Arabic choices right-aligned, same card.
- [ ] Word-order exercise: Arabic tokens flow **right-to-left** (first word on the right).
- [ ] Storyline **summary (English) left-aligned** while the **story (Arabic) right-aligned** —
      check in-lesson story tab, per-chapter expander, "read the full story", and the summary strip.
- [ ] Edit the story / summary / a type-in answer and type Arabic → caret & text go **RTL**;
      type English → LTR. (Glyph fields in the script editor are the exception — read-only.)

**P1 — mute / voice fallbacks** (B)
- [ ] Mute (any 🔊), start a lesson with listen questions: `listen_mcq` → read-the-target MCQ;
      `listen_type` → translate-by-typing. Scoring still works.
- [ ] Toggle mute **mid-question** on a listen item → it swaps variant live (before answering).
- [ ] Every question card has a mute button in the bottom row, synced with the others.

**P2 — UI chrome** (B)
- [ ] Import dialog earlier offered **Merge / Replace / Cancel** (if you re-import): Merge =
      flags only, Replace = overwrite, Cancel/Esc = abort.

---

## Setup B — add a script lesson to the Arabic set ("➕ Add lesson → 🔡 Learn the script")

**P0 — the script lesson is correct & not a giveaway** (B)
- [ ] **No answer-revealing question.** sound→glyph shows the *romanization* ("gh (ghayn)") and
      you pick the letter — it must NOT show the glyph + a "tap to listen" block. glyph→sound shows
      the letter, choices are romanizations. Neither MCQ has a listen block.
- [ ] **Listen item hides the glyph** (you rely on audio to pick the letter).
- [ ] **No Arabic voice installed → no "tap to listen" questions at all** (only the two MCQ
      directions). You should NOT need to mute to avoid them.
- [ ] **Length scales with difficulty**: ≈8 / 12 / 16 letters (not the whole 28). Distractors
      still include letters from across the whole alphabet.

**P1 — editing** (B)
- [ ] ✏️ editor lists each **letter** with **read-only glyph** + editable **Name / Sound / IPA**,
      plus ↑↓ reorder, 🗑 delete, ⚑ flag, ⭐ star. Edit a Sound / reorder / delete → save → replay:
      the quiz reflects it. "⚑ only" filter shows just flagged letters. The lesson's flag/star
      **badge** in the path counts letter flags/stars.

**P2 — other scripts** (B): repeat the P0 "not a giveaway" + length checks for **en→el (Greek,
case pairs Α α)**, **en→ko (Hangul)**, **en→he (Hebrew, RTL)**. en→th must NOT offer the option.
*(Korean/Hangul still wants a native check — see roadmap.)*

---

## Setup C — Japanese (en→ja) script lessons

**P1 — two scripts, content-aware** (B)
- [ ] Adding the script lesson to a set with **only hiragana** content → **only a Hiragana** lesson.
      A set containing a katakana word (e.g. ボール) → **both** Hiragana and Katakana. Empty set → both.
- [ ] The two lessons read **"🔡 Hiragana"** and **"🔡 Katakana"** in the chapter view (not two
      identical "Learn the script" rows).

---

## Setup D — multi-chapter story, en→Arabic, arc ON  (O — needs Ollama)

**P0 — arc-integrated script primers**
- [ ] Under the arc toggle a **"🔡 Teach the script per chapter"** checkbox appears (only for a
      differing-script target + >1 chapter), default checked.
- [ ] With it on, **each chapter has a 🔡 script lesson prepended** (plays FIRST, before vocab).
- [ ] **extend per chapter**: chapter 1 seeds the alphabet so far; each later chapter's primer
      covers **only letters new to that chapter** (no repeats of earlier letters). Count respects
      difficulty.
- [ ] A chapter introducing **<4 new letters** gets **no** primer (not an empty one).
- [ ] Uncheck the box (or en→Latin target) → **no** script lessons.

**P1 — reinforce/extend selector** (B, on a story-continued chapter)
- [ ] The 🔁reinforce/➕extend selector shows for `intro_script` (and vocab formats) on a
      **continued** chapter, is **hidden for Math** and for non-continued sets, and toggles live on
      format change. reinforce → earlier-chapter letters ("· review"); extend → new-this-chapter
      ("· new letters"); first chapter / standalone → full alphabet.

---

## Setup E — QC over synonyms + word_forms  (O — needs Ollama)

Make/import a topic with a **word_forms** and a **synonyms** lesson, then run the ⚙ QC action.

**P1 — dispatch + notes**
- [ ] **word_forms**: a wrong marked-correct option / a distractor that also fits / mismatched
      translation / bad explanation → a 🟧 QC note (read-only, ✕ to dismiss); clean items get none.
- [ ] **synonyms**: wrong gloss / a non-synonym / bad antonym / wrong homophone → a QC note.
- [ ] **intro_script** lessons are NOT flagged by QC.
- [ ] Re-running QC on a corrected item clears its note. The lesson flag **badge** counts QC notes
      on items/words.
- [ ] **Flagged-only** QC: ⚑-flag one word_forms item, run flagged-only QC → that lesson IS
      checked (regression: it used to be skipped because only vocab/sentences were scanned).
- [ ] Sanity: vocab/sentences QC still works as before (one-click "fix" suggestion).

> Expect to **tune the QC prompts** — smaller models are unreliable on "is this distractor also
> correct?" and on synonym/antonym judgments. If too many false positives, make the prompts more
> conservative (only flag clear errors).

---

## Furigana (en→ja, optional)  (B + O)
- [ ] Paste a JA story with furigana as `<ruby>…<rt>…</rt></ruby>` and as `漢字[かな]` → both import;
      readings show above kanji; katakana readings kept; TTS speaks the base text, not the brackets.

---

## Before tagging v48
- [ ] Headless still green: `node test/run.js` + `node test/check-inline.js` (0).
- [ ] Bump `APP_VERSION` to v48 in `server.js`; re-run `build-static.js`.
- [ ] Translate the v47.x English-only keys (see session notes) and roll the roadmap forward.
