# v71_j — crossword clue bar fixed height; new ui.json + lessons.json integrated

Small, self-contained session by design: one UI fix plus two data integrations, chosen to leave the
tree in a clean state for a fresh session on the storyline-result UI arc.

Suite **148**, `--quick` **128**, `check-inline` 0 on both builds, static rebuilt byte-identically,
both report `v71_j`.

## 1. ✅ Crossword clue bar no longer moves the grid

> "In the top row we show the selected down and/or across question. Put these in a fixed height, so
> the crossword doesn't jump when we move to or from a shared down/across field."

The bar shifted the grid **twice over**:

- it was `display:none` when no entry was active, so it left and re-entered the layout entirely;
- it held **one** `<div>` for a normal square and **two** for a square shared by an across and a
  down word, so its height changed again on 1↔2 lines.

Now it stays in the layout permanently at `min-height:3.9em` (two lines at the bar's 1.45 line
height plus padding, via `box-sizing:border-box`), and the empty state renders a muted placeholder
(`crossword.pick_cell`) instead of hiding the element. Three states — no selection, single-owner
square, shared square — all occupy identical space.

**Guarded** in `smoke-render` (live DOM): the bar is never `display:none` in any of the three states,
a shared square shows at least as many clue lines as a single-owner one, and the empty state renders
the placeholder. The reserved height itself is asserted against the markup rather than the live
element, because the stub DOM does not parse an inline `style` attribute from `innerHTML` back onto
`element.style` — a harness limitation, so the height is checked where it is actually declared while
the never-hidden behaviour (the part that moved the grid) is checked live.

**Revert-verified**: restoring `display:none` fails as
`the clue bar reserves a fixed min-height in the markup`.

## 2. ✅ New `ui.json` integrated — 15 languages now complete

The uploaded file brings **+567 translations**. Coverage went from 532/556 keys in most languages to
**581 of 581** in fifteen: ar, de, es, fr, hi, it, ja, ko, nl, pl, pt, ru, sv, tr, zh.

Critically, this includes the **7 strings cleared in v71_d** because their translations embedded the
ungrammatical attributive `{lang}`. All seven are now correctly re-translated in all 15 languages:

- the three exercise questions dropped the language name entirely, as English does
  (`de: "Übersetzen Sie diesen Satz:"`, `ja: "この文を翻訳してください。"`) — no placeholder reintroduced;
- the four that legitimately name a language use a **prepositional or postpositional** form
  (`de: "für {lang}"`, `es: "para {lang}"`, `tr: "{lang} için"`, `hi: "{lang} के लिए"`, `({lang})`),
  which is exactly the shape v71_d's fix was aiming for.

### One guard deliberately relaxed

`unit-lang-placeholder` asserted those 7 keys **stay cleared until re-translated**. That was correct
while the only available translations were the broken ones, but it is now outdated by design — they
have been properly re-translated, which was the whole point. It was rewritten to the durable rule:
*where English dropped `{lang}`, no translation may reintroduce it.* Verified: zero violations.

Section 3's language-neutral staleness check is unchanged and still covers the general case, so
relaxing section 2 did not reduce coverage.

## 3. ✅ New `lessons.json` integrated

81 storylines (was 80), 291 topics (was 283), schemaVersion 30 unchanged. The full suite — including
the corpus-driven tests (`unit-replay-focus`, `unit-round-length`, `smoke-render`) which read this
file as their fixture — passes against it unchanged.

## i18n status after this session

582 English keys. 15 languages at 581 (missing only `crossword.pick_cell`, added this session);
14 languages at 532–533. **715 entries outstanding**, down from 1137.

## Owed / next

Nothing from this session. See the roadmap's fresh-session brief for the storyline-result UI arc.
