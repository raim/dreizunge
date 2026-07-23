# QC report — translated `ui.json` (v69_d)

Reviewed the uploaded translation run and repaired **71 entries**. Re-run any time with
`node tools/qc-ui-translations.js <in.json> <out.json>` — the fix tables are explicit and auditable.

## Headline: the run is complete but was NOT clean
- **Completeness: perfect.** 30 languages, 522 keys, **0 missing**, `en` byte-identical to before.
  `translate-ui.js --check` now reports "All translations complete!" (was 1595 missing).
- **Correctness: 71 defects**, of which ~40 would have been visible to users as broken text.

## A. Placeholder damage — 27 entries (functional bugs) ✅ fixed
The model translated the placeholder **names**, so substitution silently failed and the learner
would have seen a literal `{woord}` on screen.

| kind | count | examples |
|---|---|---|
| renamed | 13 | `nl {word}→{woord}`, `fi {title}→{otsikko}`, `pl {solved}→{rozwiązane}`, `uk {word}→{слово}`, `ro {correct}→{corect}`, `hu {title}→{cím}` |
| dropped | 7 | `tr/fi/hu form.translation_label` lost `{lang}`; `el toast.export_ok` hardcoded "one" instead of `{n}` |
| invented | 5 | `ko lesson.words_from` gained `{n}`; `ja/ko qc.story_pending` gained `{n}`; `tr ex.glyph_order.placeholder` gained a trailing `{word}` |
| count mismatch | 2 | `pl ex.mcq_source_target.q` lost `{word}`; `th coverage.solved_of` lost `{total}` |

Renames were repaired **positionally**, keeping the translator's wording. The `{lang}` losses were
repaired as a parenthetical — grammatically safe in every affected language.
**Not touched:** 4 entries where placeholders are merely **reordered** (`{word},{lang}` →
`{lang},{word}` in tr/zh/ko/hu). That is correct for those word orders.

## B. Corruption — 15 entries ✅ fixed
Localised failures, heavily clustered on the "learn the script" keys:
- **Cross-script bleed:** `es form.arc_script_lbl` was **entirely Chinese**; `ro pdf.break_here`
  "✂中断这里"; `ro gen.math_instr_placeholder` mixed Chinese + Indonesian ("opsional");
  `hu static.pill.issue_body` "át拉起拖拽"; `pl mixed.readonly_note` had Cyrillic spliced into
  Polish ("zas**обното собрана автоматy**cznie"); `ca ex.flag_save` was "P挂".
- **Model artifacts:** `sv`/`pl` "almart…", `fr`/`it` "-Taught…" (Italian was left in English),
  `he` "scribe_…".
- **Wrong icon:** `hi form.arc_script_lbl` used 🔒 (lock) instead of 🔡.

## C. Leading-icon drift — 29 entries ✅ fixed
The app uses a leading emoji as each concept's identity (🔡 script, 🔢 math, 🎭 creative). Several
languages swapped or dropped it, so the same lesson type showed a different icon per language
(e.g. 📝 instead of 🔡 in pt/fr/es/it/ru/ko; `ru lesson.type.math` lost 🔢 entirely). Only the
**first** character is normalised; inner emoji are the translator's choice. Variation-selector-only
differences (🗣️ vs 🗣) are ignored — they render identically.

## D. German — the reported pass ✅ fixed
Your example was the tip of a cluster. `form.arc_lbl` was **"🎯 Lerne pro Kapitel ein Lernarc"**:
"Lernarc" is not a German word, *and* the sentence inverted the meaning into an imperative ("learn
an arc") instead of the feature's description. Now **"🎯 Lernbogen pro Kapitel aufbauen"**.

Also repaired:
- `import.choice.merge_hint` — **"Lösungen" (solutions) where the English says "deletes"**. A false
  friend that inverted the meaning of a destructive-import option: the riskiest defect in the file.
  Now "Löschungen".
- `static.pill.issue_body` — "den exportierten **Datei-Datei**" (doubled noun, wrong article).
- `toast.import_merge_confirm` — "dein aktuelles **Inhaltsbleiben**" (run-together non-word), the
  untranslated "Cancel", and a garbled second line.
- `import.choice.body` — "**Dieser** Datei" (wrong gender), malformed compound "Flag/bearbeitungs-Beitrag".
- `qc.editor.flag_save` / `flag_remove` — left as English "Flag" / "Unflag".
- `intro.need_open_set` — the English is two steps ("open a set **first**, **then** add"); the German
  had turned it into a purpose clause.
- **Terminology unified on "Markierung"**: the file used *Flag, Flagge, flaggen, markiert* for one
  concept across neighbouring buttons.

## Reported, NOT auto-fixed (needs a native speaker)
1. **German register is split**: 22 entries use formal *Sie*, 22 use informal *du*. The app's voice
   is *du*; the *Sie* entries cluster in the PDF/upload and dialect screens. Mechanical replacement
   would produce wrong verb forms, so this needs a human pass. My German fixes above all use *du*.
2. **Untranslated leftovers**, worst: `nl` 30, `lb` 28, `da` 26, `ro` 24, `de` 22. Most are
   legitimate loanwords (Markdown, JSON, Backend, Tutor, Horror, Download) — but real misses exist,
   e.g. `ro import.choice.merge` = "Merge", `lb dialog.cancel` = "Cancel", `tr furigana.show` =
   "Show furigana". Worth a targeted second pass with a "do not translate" list for the loanwords.
3. **Suspect phrasing** spotted while reviewing, left alone as it is valid text: `fi` "Yksi lause
   per **seuraus**" ("per consequence" for "per paragraph" — repaired only because that key also
   lost its `{lang}`); `he lesson.type.desc.mixed` contains a stray 😉 mid-sentence.

## Suggestion for the next run
Two prompt constraints would prevent classes A and C outright: *"never translate text inside curly
braces — copy `{word}`, `{lang}`, `{n}` verbatim"* and *"keep any leading emoji exactly as in the
source"*. Class B (cross-script bleed) suggests some batches were contaminated by neighbouring
languages — smaller batches, or one language per request, would likely fix it.
