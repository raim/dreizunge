# v66 — five requested items (generation fixes, i18n hygiene, threshold move, storyboard panel)

## 1. Storyboard panel on the completion card ✅
`_renderCompStoryboard()` extracts the panel(s) belonging to the CURRENT chapter out of the
storyline's storyboard and renders them above the progress bars. It reuses v57's `_sbPanelChapter`
mapping, so the panel shown here can never disagree with the one the full board links to. Rather
than shrinking the whole board to illegibility, it builds a fresh SVG cropped to the panel's
bounding box (carrying `<defs>` over so gradients still resolve). Hidden for drills and when the
storyline has no board; a malformed board degrades silently rather than breaking the card.

## 2. ui.json: English placeholders removed ✅
Removed **1508** entries (52 keys × 29 languages) that were English text mirrored into other
languages. `translate-ui.js` now sees them as *missing* and will translate them locally, which is
what you asked for.

Two deliberate carve-outs: entries were removed **only where the value still equalled the English**,
so anything already translated survived — that protected your own `storyboard.locked_resume`
translations. And 25 entries remain identical to English because they legitimately are: emoji-only
strings (`⚑ {n}`, `🔊 1, 2, 3`), technical terms (IPA, JSON, Markdown, Storyboard, Backend) and
words identical in German (Name, Test, Horror, Download). Those are pre-existing, not mine.

## 3. Coverage threshold moved to the storyline page ✅
Removed from the model menu (it is a pedagogical setting about learners, not a model setting) and
added to the storyline screen header as `#sl-threshold`, shown only in teacher mode. The endpoint,
persistence and precedence rules are unchanged — only the control moved. A note beside it says it
applies to all chapters, since it remains a global setting.

## 4. Story translations — clarification + the missing toggle ✅

**What the translation is used for (three things, all live):**
1. **Lesson generation context** — the lesson prompt receives the story *and* its translation, which
   produces more accurate vocabulary pairs and glosses than making the model translate on the fly.
2. **The read-story translation toggle** (v60.6) — 🌐 in the completion card and the landing-page
   story panels.
3. **Future dialect lessons** built from story+translation — the substrate is deliberately kept.

**Why the toggle looked missing:** it is present and working, but auto-translation was gated on
`OLLAMA_TRANSLATION_MODEL !== OLLAMA_MODEL`. Your single-model runs therefore produced no
translations at all — only **2 of 267** topics had one — so the toggle correctly hid itself almost
everywhere. Fixed: translation now runs whenever a story exists and no user translation was
supplied, exactly as you asked ("always use it in bulk generation"). The translation call also
gained `think:false` (it is mechanical work) so pointing the translation role at a reasoning model
can't produce the empty-response failure.

Note the cost, since it is now unconditional: in your log the translation took **156 s against 49 s**
for the story itself. Bulk generation will be noticeably slower. If that becomes painful, the clean
next step is an explicit "translate stories" switch rather than reinstating the model-difference
heuristic, which silently did the wrong thing.

## 5. Generation failures — two distinct root causes ✅

**(a) Title / summary post-passes failed even with thinking OFF.** `generateChapterMeta`,
`generateStorylineTitle` and `generateStorylineSummary` call `_callLLM` directly with budgets of
**240 / 80 / 400** tokens and never received the v60.5 `think:false` treatment (which I applied only
to story, topic-info and meta-translation). On a reasoning model those budgets vanish entirely into
`<think>`, leaving nothing after the block is stripped. All three now pass `think:false`.

**(b) Story generation failed WITH thinking on.** `thinkOpts` multiplied the base budget by 2.5, but
a 50-word story's base is ~475 tokens → ~1187 with thinking, which is less than a 35B reasoning
model routinely spends *before writing a word*. Added an absolute floor, `THINK_MIN_TOKENS = 3000`:
the budget is now `max(floor, base × 2.5)`, so a short requested output can no longer starve
reasoning. A long story still gets the multiplier (4096 → 10240).

The general lesson, now encoded in tests: **reasoning has a fixed cost that does not scale down with
the requested output length**, so any call with a small budget either disables thinking or gets a
floor.

## Tests

Suite **116 green**. New/updated: the three post-pass calls each pinned to `think:false` by exact
call text; the thinking floor pinned behaviourally (475 → 3000, 4096 → 10240); the always-translate
decision pinned (scoped to the decision, since the same model comparison legitimately appears in
VRAM release and a startup log); the storyboard-panel renderer (same mapping as the board, cropped
viewBox, silent degradation); the threshold's new home on the storyline screen and its absence from
the model menu. `e2e-models` was updated — it asserted the OLD "no translation without a distinct
model" behaviour, which is exactly what you asked me to change.
