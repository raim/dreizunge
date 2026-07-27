# v71_b — session notes

## 0. ✅ `v71_b` — PDF chapters from the document's own structure

One request, two features, and three defects found on the way — all driven by a real PDF the user
supplied (Corriere / Telmo Pievani, *Evoluzione*, 3pp Italian).

> **The request.** "The text in this PDF is nicely structured, we could automatically detect
> paragraphs to be converted to chapters, initially overruling the pdf block word size setting.
> Split by recognized paragraph could be a button and should be the default first way to handle
> pdfs." Plus: "offer an option via LLM, where the LLM decides chapters, similar to the current PDF
> cleaning option. Cleaning could be an optional prompt added to the main prompt."

Suite **141** green (was 138), `check-inline` 0 on both builds, static rebuilt, both report `v71_b`.

---

## 1. The measurement that decided the design

Before writing anything, the PDF's line geometry was measured rather than guessed:

```
14.50pt   gap between wrapped lines inside a paragraph   (the body leading)
27.25pt   gap between paragraphs
32.10pt   gap before a section heading
```

Paragraph structure is **exactly** recoverable — and `_extractPdfText` was discarding all of it,
grouping items by Y and joining every line with `\n`. The whole 15-paragraph article reached the
splitter as **one** paragraph. That single fact explains the reported symptom and two others found
alongside it.

Baseline reproduction, run against the real file before any change:

| symptom | cause |
|---|---|
| 15 paragraphs → **1** blank-line break | geometry discarded at extraction |
| titles like `"sa, senza aggiornamenti, revisioni ed…"` | `_autoTitle`'s 8–80 char window slid past a long first sentence |
| `"Selezione naturale"` silently deleted | cleanup rule 3 drops unpunctuated lines < 20 letters (it is 17) |

---

## 2. ✅ Paragraph structure from geometry — `_linesToParagraphs`

`_extractPdfText` now keeps each line's `y` and left edge and derives real paragraph breaks.

- **Modal line gap = the body leading**, because most lines are ordinary wraps. A break must clear
  it proportionally (`_PARA_GAP_FACTOR` 1.35) *and* by ≥2pt, so a tiny footnote leading cannot make
  noise look like a paragraph. Being a ratio against the document's own leading, it is font-size
  independent.
- **Two layouts, two signals.** Spacing (articles, this PDF) and indent (most printed novels).
  Indent is consulted **only when spacing found nothing**, so a spaced document cannot be
  double-split by a centred line or a hanging quote.
- **Lines within a paragraph are joined unconditionally**, which is strictly better than the
  lowercase-start heuristic downstream: that one fails on every wrap before a capitalised word.
  `"Con i"` / `"Neanderthal, i nostri cugini…"` was not being joined; now it is, because the
  paragraph is *known* rather than inferred.
- Hyphens at a wrap: soft hyphenation closes up (`Zusammen-|setzung`), a compound broken at its own
  hyphen keeps it (`Nord-|Süd-Gefälle`). Neither gains a space.

Result: 41+34 lines → **9+8 paragraphs**, matching the page exactly.

**Fixture:** `test/fixtures/pdf-lines-corriere.json` — the article's real line geometry (12K), not a
synthetic stand-in. The v70_n lesson applied: the thresholds are calibrated against the data that
prompted the request.

## 3. ✅ Chapter per paragraph — `_splitIntoParagraphChunks`

Built **on top of `_sentenceUnits`** rather than splitting on `\n\n`, so the v70_k false-boundary
repair is inherited: `"…la frequenza di speciazioni"` ⏎⏎ `"geografiche rapide…"` is one paragraph
again before anything is counted. Duplicating that logic would have created the second definition
the roadmap warns about.

Two shaping rules, both there to prevent degenerate chapters:

- **A heading is not a chapter** — it titles the one that follows, and its text is *kept in the
  body as well*. Nothing is destroyed by a heuristic, so a misfire costs a title, never content.
- **A block below `_PARA_CHUNK_MIN_WORDS` (40) absorbs the next.** Dialogue-heavy fiction is mostly
  3-word paragraphs; one chapter each would be useless. A stub tail (date line, rights notice)
  joins the last chapter rather than becoming one.

The size slider is deliberately **not** consulted — this mode is the document's structure, which is
what "overruling the pdf block word size setting" asks for.

On the user's article: **15 paragraphs → 8 chapters, 61–157 words**, titled *Evoluzione*,
*Selezione naturale*, *La teoria darwiniana si aggiorna*, *Per approfondire* where the document
supplies a heading.

## 4. ✅ A pre-existing corruption, found by a word-parity assertion

Asserting "every word of the document ends up in a chapter" failed at 937 ≠ 934 — and the cause was
**not** the new code. Shipped v71's `_sentenceUnits` cut at every period, and `_unitsToText`
rejoined the pieces with a space:

```
500.000 anni fa  ->  500. 000 anni fa      (the user's article says 500.000)
S.J. Gould       ->  S. J. Gould
um 15.30 Uhr     ->  um 15. 30 Uhr
```

This has affected **every length-split chapter since the splitter was written** — corrupted text fed
straight into lesson generation. A terminator now only ends a sentence when whitespace follows it.

Written as a **scan, not a lookahead**, and that detail matters: `(?=\s|$)` bolted onto the old
pattern makes the whole alternative fail at a glued period, and the engine then resumes *past* it,
silently dropping `500.` from the output. Walking the terminators keeps every character accounted
for. Known limitation, unchanged and commented: an abbreviation followed by a space (`N. Eldredge`,
`z. B.`) still reads as a sentence end — it costs a split point, never text.

## 5. ✅ `_autoTitle` no longer returns a mid-sentence fragment

The old second branch was `text.match(/[^.!?]{8,80}[.!?]/)` — a window of 8–80 characters ending at
a period. When the opening sentence is *longer* than 80 characters the window cannot start at the
beginning, so the engine slid it forward and returned the sentence's tail. Every chapter of the
article was titled that way. Titles are now always a prefix of their chapter, shortened at a word
boundary with `…`. Guarded by asserting exactly that property across all 8 chapters.

## 6. ✅ The split-mode control (browser-only — how to see it work)

The per-page checkbox is replaced by a segmented control in the upload panel, wired at eight call
sites.

**How to see it:** tick 📄 **PDF**, tap 📎 **Upload a document**, choose a PDF. The panel now shows
a **Chapters:** row with four buttons:

| button | behaviour |
|---|---|
| **¶ By paragraph** | the document's own paragraphs (**the default**) |
| **↔ By length** | the previous behaviour, driven by the size slider |
| **📄 By page** | one chapter per page — offered only when the source has pages |
| **✨ By topic (model)** | asks the model to group the paragraphs (needs a backend) |

Expect: on a normally-structured PDF the panel opens **already split by paragraph**, and the
story-length slider is **hidden** — it reappears only under **↔ By length**, because paragraph and
page splitting take their boundaries from the document and a size control there would be a lie.
**¶** is disabled (greyed) when the text yields fewer than 3 paragraphs — a scanned or
single-block PDF falls back to **↔** rather than handing back one enormous chapter.

Guarded with a **live-DOM test** through `lib-dom`, not source assertions: the control is a render
path and eight call sites moved. It executes `_resplitUpload`, `_updateUploadSliderVis`,
`_renderSplitModes` and `setSplitMode` and asserts para=8 / len=4 chapters, the slider following
the mode, the active button marked, and unavailable modes disabled.

## 7. ✅ LLM-decided chapters — a deliberately stronger contract

`/api/split-chapters` + `PROMPTS.chapterSplit` + `llmSplitChapters()` in the client.

**The model never returns text.** It receives numbered paragraph previews (30 words each) and
answers with `{"chapters":[{"start":n,"title":"…"}], "drop":[n,…]}` — numbers and titles only. The
server reassembles chapters from the paragraphs the *client sent*.

This is on purpose a different contract from `textCleanup`, and the difference is worth keeping in
mind for future model passes:

| | textCleanup (v69_m) | chapterSplit (v71_b) |
|---|---|---|
| model returns | the text | paragraph numbers |
| corruption is | **detected** afterwards (`cleanTextChanges` proves a subsequence) | **impossible to express** |
| a bad answer costs | a retry, or heavy deletion flagged for review | a poor grouping, nothing more |

The unit test pins that property directly: for several deliberately awkward answers (duplicate
starts, bogus late cuts), the words that come out are the words that went in, in order.

**Cleaning folded into the same prompt**, as requested: with the ✨ mode selected, a *"Also drop ads
& boilerplate"* checkbox appears. It swaps `keepClause` for `dropClause`, letting the model list
paragraph numbers to discard. Without it, discarding is rejected by the validator rather than
silently tolerated. Validation happens before tokens are spent (≥2 paragraphs, ≤400) and a failed
pass falls back to the deterministic paragraph split with a toast — the panel is never left empty.

Results are cached against **the exact text they were computed from** (`_llmChunksFor`), so toggling
🧹 cleanup invalidates them automatically. A stale grouping can never be shown for a document it was
not derived from, and re-running — which costs tokens — stays an explicit act rather than a side
effect of ticking a checkbox.

**How to see it:** upload a PDF with Ollama running, tap **✨ By topic (model)**. Expect a toast
naming the chapter count, and console lines announcing the pass before it starts and the token spend
after. Tick *Also drop ads & boilerplate* and re-tap ✨ to see furniture paragraphs discarded.

---

## Test-quality notes (the standing v71 rules, applied)

- **Every guard was verified by reverting its fix**: gap detection, indent fallback, dehyphenation,
  the glued-period scan, the title prefix rule, paragraph-mode dispatch, slider visibility, the
  chapter range end, the increasing-starts validation, and the drop list. All failed as **named
  assertions**, none as a `TypeError`.
- **One vacuous guard was caught and fixed before it landed** — a hyphen assertion written as
  `x === false || true`, which is always true. It also exposed a real behaviour question
  (`Nord-|Süd`), so the fix improved the code as well as the test.
- **Test the caller, not just the helper**: the mode control is asserted through the live DOM, not
  by regexing `index.html`.

## Three harness traps hit (worth inheriting)

1. **Tests lift functions by name.** Adding `_sentenceSplit`, `_TITLE_MAX`, `splitWords`/`wordCount`
   to `index.html` broke `unit-pdf-chunking` and `unit-pdf-selection` with `ReferenceError`, not an
   assertion — the sandbox simply lacked the new symbol. When a client function gains a dependency,
   every harness that extracts it needs the dependency too.
2. **`unit-word-count` is a hygiene guard, and it works.** It forbids the inlined
   `s.split(/\s+/).filter(Boolean).length` from reappearing, because item 8 centralised tokenising
   into `wordCount()`. New code reintroduced it verbatim and was correctly rejected. The convention
   already in the file is `const wc = wordCount;` — four other sites use it.
3. **`C.run` values are cross-realm.** Lengths were compared via `[...arr].length` rather than
   `deepStrictEqual` against a local array, per the known trap.

## i18n — 12 new keys, `en` only

Listed for the offline translate pass. **None were added to any other language.**

```
pdf.split_mode_lbl      pdf.split_by_para     pdf.split_by_len       pdf.split_by_page
pdf.split_unavailable   pdf.split_by_llm      pdf.llmsplit_drop_lbl  pdf.llmsplit_running
pdf.llmsplit_done       pdf.llmsplit_dropped  pdf.llmsplit_failed    pdf.llmsplit_too_short
```

`form.split_per_page` is now unused by the client (the checkbox it labelled is gone). Left in
`ui.json` rather than deleted — it is already translated into six languages, and removing a
translated key to save nothing is the wrong trade.

## Owed at handoff

- **Browser pass** on everything in §6 and §7 — the mode control, the ¶ default, and the ✨ pass
  against a real model. Nothing here has been seen in a browser.
- **Empirical question for the ✨ pass**: are the model's groupings actually *better* than the
  deterministic paragraph split on this article? The fake model cannot answer that. If they are not,
  the honest outcome is to keep ✨ as an option and leave ¶ the default, which is how it ships.
- **Known interaction, deliberately not fixed.** Deterministic 🧹 cleanup drops
  `"Selezione naturale"` (17 letters, under its 20-letter floor), so heading-derived titles survive
  only with cleanup **off** — which is not the PDF default. With cleanup on, titles fall back to the
  now-repaired `_autoTitle`, which is decent. Weakening a deliberate cleanup rule late in a long
  session was the riskier move; it wants its own change. See the roadmap.
- **i18n second pass** — the 12 keys above, plus the 558 already outstanding.
