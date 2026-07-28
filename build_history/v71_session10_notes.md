# v71_k — session 10 notes

Shipped: the **storyline-result UI arc** (the fresh-session brief), plus an `ui.json` translation
drop and a sweep of untranslated English fallbacks.

Suite **150** (was 148 at `v71_j`), `check-inline` 0 on both builds.

---

## 1. The returning `ui.json` (data drop, validated not merged blind)

A newer `ui.json` was already sitting in the tree at session start — mtime three hours after the
`v71_j` build, and its contents differed from what `docs/index.html` had baked. Validated per
protocol §3 before keeping it:

| Check | Result |
|---|---|
| Languages | 30 → 30, none added or dropped |
| `en` keys vanished | **0** (the `crossword.done` trap from `v71_e`) |
| `en` values changed | 0 |
| Placeholder integrity | 0 mismatches across all 29 languages |
| Total entries | 16,745 → 17,190 (**+445**) |

`uk cs vi id ro th lb sw` went 532 → 582 (complete), `el` to 562, and the 15 already-complete
languages picked up `crossword.pick_cell`. **24 of 29 languages now complete.**

## 2. Verbatim-English fallbacks removed (18 entries, 8 languages)

A translation that is byte-identical to its English source is an untranslated fallback, and
`translate-ui.js` cannot see it — the script fills keys that are MISSING, so a key
present-but-English is never revisited. Deleted so the next pass refills them:

- `crossword.title` in `vi`, `th`, `sw` (user-reported)
- `hi` ×5 (four toasts + `qc.editor.flag_cancel`), `el` ×3 (`app.backend`, `qc.editor.flag_save`,
  `storyboard.title`), `ja` ×2 (`prov.by`, `prov.from`), `th` ×2, `ru` ×1, `zh` ×1, `he` ×1

Each was checked against its sibling languages before deleting, not assumed. The decisive cases
were the ones that looked like loanwords: `ru` wrote `"Бэкенд:"` and `ja` `"バックエンド:"` for
`app.backend`, so `th`/`el` keeping Latin `"Backend:"` was neglect rather than a style choice.

Outstanding translations: 273 → **288** (the deletions add to the queue).

### Still owed to the next translate pass
- **`complete.story_complete` = "Story complete!"** — the one new key this release adds, `en` only.
- The 18 deleted entries above.
- **Nine Latin-script leftovers awaiting a speaker's call** (a rule cannot tell these from
  cognates): `fi` — `lesson.export_title`, `lesson.export_storyline_title`, `lesson.gen_title`,
  `lesson.generating_title`; `lb` — the four `lesson.type.desc.*` strings; `pl` — `ex.syn.hint`.
- **`hi/qc.editor.flag_save` is `"-flag"`** — a mangled half-translation. Not English, so no
  verbatim rule will ever catch it; needs hand-deletion.

New guard `unit-ui-verbatim-en`: no language may hold the English crossword strings verbatim (keys
derived from `en`, not hardcoded), and no non-Latin-script language may hold ANY Latin-alphabet
English string verbatim. Seven prose-free keys are exempt (`⬇ JSON (.json)`, `IPA`, `URL / DOI`,
`"{pronoun}" + {verb} = ?`) and the exemption list is itself policed — if one of those keys ever
gains running text it drops out of the exemption instead of hiding a fallback under it.

---

## 3. Result cards show the FULL storyboard, framed by chapter state

**The reported bug.** `_renderCompStoryboard` cropped the board to *this chapter's*
`<g data-chapter>` group and returned early when the chapter had no group. Panels and chapters are
rarely 1:1, so that early return was reachable with ordinary data — it hit **two** storylines in the
user's own `lessons.json`, not the one recorded in the brief:

- `sl_1725748570` "Evolution der Theorie" — 8 chapters, panels tagged 1,3,4,6,7 → chapters **2, 5, 8**
  rendered nothing at all
- `sl_795546417` "Fungal Frenzy" — 8 chapters, panels tagged 1,2,2,4,5 → chapters **6, 7, 8** likewise

**The fix.** The whole board is rendered and each panel framed: green when every chapter in that
panel's span is finished, blue when the span holds the chapter just played, unframed otherwise.
There is no "this chapter has no panel" branch left to dead-end in.

It is also the *smaller* card. Every one of the 22 boards is a single horizontal strip
(`viewBox` height 194, width 740–1104, **2–5 panels, never more**), so the full board renders at
roughly a third the height of one panel blown up to card width.

**Panel spans.** `_sbPanelChapter` already maps every panel to exactly one chapter in both
directions. `_sbPanelSpans` groups panels by DISTINCT chapter and runs each group's span to just
before the next distinct chapter (the last to the end of the story). Panels sharing a chapter are
the same story moment, so they share a span and change state together.

> The obvious rule — "this panel covers up to the next PANEL's chapter" — is wrong. As soon as two
> panels resolve to one chapter it yields a backwards range (`[1, 0]`), and a panel with a backwards
> range can never turn green. That happens on **7 of the 22 boards**, including Fungal Frenzy, which
> has FEWER panels than chapters — so it is not a quirk of short stories.

Blue outranks green, so replaying a finished chapter still shows where the learner is.

**A correction worth recording:** the `Math.max(d, …)` in `_sbPanelSpans` was originally described
as what prevents inversion. The revert check disproved that — the test passed with it removed,
because grouping by distinct chapter already guarantees `next - 1 >= d`. The clamp guards only
unclamped input (a chapter number above `chapterCount`), the comment now says so, and a test covers
that path so it is not untested defensive code.

## 4. The storyline header on result cards, and Back removed

Result cards now open with the storyline screen's own header line, same markup and classes: 🌍 to
the main page, the storyline title back to its page. Hidden for a drill, whose topic is synthetic.

With the header carrying the route back, **`comp-back` ("← Back to story") is removed** — markup and
wiring. `compBackToStory()` itself stays: the header title calls it, and so does `afterComplete()`.
The header title is keyboard-reachable (`role="button"`, `tabindex`, Enter/Space), which the
`<button>` had given for free.

## 5. The final card

Finishing the last chapter of a storyline is the end of the story, not another chapter completion.
The card now reads **"Story complete!"**. Completion is read through `chapterComplete`, the same
canonical reader the panel frames and the storyline page's read-full-story lock use, so all three
agree. A drill or a solo chapter never qualifies.

---

## How to see it work (browser-only — nothing here is exercisable headlessly)

1. Open **Evolution der Theorie** (8 chapters) and finish **chapter 2**. Before: the result card
   showed no image at all. Now: the full 5-panel strip, with panel 1 framed **blue** (it covers
   chapters 1–2) and nothing green until chapter 1 *and* 2 are both done.
2. Keep going. Panels turn **green** one at a time, and only when every chapter in their span is
   finished — panel 5 covers chapters 7–8, so it stays unframed after chapter 7 alone.
3. Open **Yusuf and the Lost Cat** (1 chapter, 3 panels) and finish it. All three panels go green
   at once — correct, but a visibly different rhythm from the 8-chapter boards.
4. On any result card, check the header: the globe returns to the main page, the storyline title
   to its page. There is no "← Back to story" button any more.
5. Finish the last chapter of any storyline → the card title reads **"Story complete!"**.
6. Start a **drill** and finish it: no header (its topic is synthetic), and it lands on the real
   chapter card as `v71_h` established.

**Still owed from earlier releases:** browser passes on `v71_i` (round length / mixed cap) and
`v71_j` (crossword clue bar). Both touch this same screen, so they are worth verifying in the same
sitting.

---

## Tests

| Guard | What it pins |
|---|---|
| `unit-storyboard-frames` (new) | span shapes on the real boards; no-backwards-span property across 9 panel/chapter ratios; frame precedence; no-blank-chapter end to end on all 5 reported boards; monotonic greening |
| `unit-ui-verbatim-en` (new) | no verbatim-English fallbacks; exemption list policed |
| `smoke-render` (extended) | the card is RENDERED and inspected: box visible, 5 panels, defs carried, exact stroke per panel across 4 states, malformed board hides the slot; header shown/hidden; "Story complete!" only when the story really is |
| `unit-learner-nav` §4c | re-pointed from the crop contract to the framing contract |
| `unit-learner-nav`, `unit-drill`, `unit-card-consistency` | re-pointed from `comp-back` to `comp-hdr` |

**`test/lib-dom.js` grew a minimal XML parser and `importNode`.** Without a `DOMParser` the
storyboard render threw on line one and its own `catch` swallowed it — a smoke test would have
passed while executing nothing. Scope is deliberately tiny: elements, attributes, self-closing
tags, comments, and the two selector shapes SVG render paths use (`svg`, `:scope > rect`).

Every guard was revert-verified:

- restoring the v65.1 crop → `chapter 2 has no panel of its own, yet the storyboard is still shown`
- the ungrouped span rule → `4 panels / 2 chapters: panels pair up, and no span runs backwards`
- removing the span clamp → the unclamped-input case fails
- the pre-sweep `ui.json` → names all 15 fallbacks
- prose planted in an exempt key → `exempt key export.html now contains running text`
- renaming `comp-hdr` in the markup → `comp-hdr really exists in the markup`

That last one matters: the stub DOM auto-vivifies any id, so `state()` can never return MISSING and
a row entry naming a deleted element would pass forever. The source check is what keeps the
always-present-row guard honest.
