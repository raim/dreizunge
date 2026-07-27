# v71_c — session notes (typed-answer letter diff)

## 0. ✅ `v71_c` — a wrong typed answer now shows WHERE it went wrong

Picked from the roadmap's own open list while `v71_b` (PDF chapters) was being tested in a browser.
**Chosen specifically because it is disjoint from the PDF pipeline** — nothing here touches
extraction, chunking, `_sentenceUnits` or the upload panel, so a `v71_b` browser test stays valid
and the two changes cannot be confused for one another. (The `_sentenceUnits` Arabic item was
skipped for exactly this reason: the PDF chunker shares it.)

Suite **142** green (was 141), `--quick` **122**, `check-inline` 0 on both builds, static rebuilt
byte-identically, both builds report `v71_c`.

---

## 1. The problem

A wrong typed answer (`listen_type`, `type_plural`, `type_conjugation`) showed only the correct
string — the learner had to spot the difference themselves, which is precisely the skill they do not
yet have. The roadmap has carried this since v70_o with a specific warning attached:

> "It needs proper sequence alignment, not positional comparison: `hause` vs `haus` differs by one
> insertion, not four substitutions."

That warning is the whole design. A positional diff passes a naive "does it mark something" test
while being **actively misleading** — drop the first letter of a word and every later position
misaligns, so the learner is told the entire word is wrong when they made one mistake. Worse than
showing nothing.

## 2. ✅ What it does

`typedDiffHtml(typed, correct)` renders two aligned rows — what was typed, what was wanted — with
differing characters marked and placeholders keeping the columns lined up.

**Levenshtein DP with a backtrace**, producing four ops: `eq`, `sub`, `ins` (typed but not wanted),
`del` (wanted but not typed). O(n·m), which on answer-length strings is nothing. A `_DIFF_MAX` of
400 graphemes refuses pathological input rather than running it.

Three design points that are not obvious and are pinned by tests:

- **Graphemes, not code units.** `é` as `e`+U+0301, emoji, Devanagari clusters must each count as
  ONE character or the marks land in the wrong places. `Intl.Segmenter` where available, code points
  otherwise (still correct for surrogate pairs, which is the common case).
- **Per-character equality uses `normDiacritics` — the same leniency as scoring.** `check()` forgives
  case and accents, so if the diff marked them the learner would be told a character is wrong that
  the app had just accepted. `haus`/`Haus` and `uber`/`über` align as all-equal. Since a diff is only
  ever shown for an answer that already failed the whole-string comparison, nothing is silently
  forgiven by this.
- **The plain correct answer stays the fallback.** Empty input, no target, or an over-long pair
  returns `''` and the caller renders exactly what it rendered before. Nothing regresses; the diff is
  strictly additive.

Not shown in no-keyboard glyph mode (`_glyphOrderActive`) — there is no typed string to compare.

## 3. How to see it work (browser-only)

Start a lesson with audio, reach a **listen & type** exercise (or a plural/conjugation typing one),
and answer with a near miss rather than a wild guess:

| type | expect |
|---|---|
| `hause` for `Haus` | `e` struck through on the typed row, gap on the answer row |
| `aus` for `Haus` | gap on the typed row, `h` highlighted green on the answer row |
| `Fanster` for `Fenster` | only the `a`/`e` column marked, nothing else |
| `haus` for `Haus` | **correct** — no diff, case is forgiven as it always was |

The key thing to look for: a single mistake should mark **one column**, never the tail of the word.

## 4. Tests

`test/unit-typed-diff.test.js` — 10 sections. The assertions are about *which* characters get
marked, not merely that something did, because that is the only phrasing a positional implementation
fails.

**Revert-verified (all failed as named assertions):**

| revert | assertion that caught it |
|---|---|
| alignment → positional comparison | `the rest still line up` |
| `_charEq` → strict equality | `case alone is never marked` |
| graphemes → code units | `a combining accent stays with its letter` |
| diff computed but not rendered | `check(listen_type) shows the letter diff…` |

`smoke-render.test.js` gains **§4b** — the protocol's render-path requirement. It runs the real
`check()` in a live DOM for all three typed types and asserts the diff appears, plus the two
negatives: a **correct** answer shows no diff, and a **multiple-choice** answer still shows the plain
answer. Those negatives are what stop the diff leaking into branches it does not belong in.

## 5. Traps hit

- **I clobbered a section heading with `str_replace`.** Anchoring on `// ── 5.` and not re-emitting
  it left a dangling comment body, which parsed as `SyntaxError: Unexpected identifier 'other'` — a
  syntax error a hundred lines from anything I wrote. When anchoring on a heading, put it back.
- **One of my own assertions was wrong, not the code**: I asserted the escaped output contained
  `&lt;b&gt;` contiguously, but every character is its own `<span>`, so it never is. Corrected to
  assert on the cells. Worth noting because the tempting move — "escaping must be broken" — would
  have damaged working code.

## 6. i18n — 1 new key, `en` only

```
check.you_typed   'You typed'
```

The answer row reuses the existing `check.correct_answer`. **Not** added to any other language.

## 7. Owed

- **Browser pass** on §3. Nothing here has been seen in a browser; the stub DOM does not parse
  `innerHTML`, so the *visual* result — column alignment, strike-through, the monospace row wrapping
  on a long sentence — is unverified. Long sentences in particular: the rows wrap independently, and
  whether the columns still read as columns after a wrap is a real open question.
- **RTL check.** The rows carry `dir="auto"` and the Arabic alignment is unit-tested, but
  right-to-left column order has not been seen rendered.
- Everything still owed from `v71_b` (PDF browser pass, the 🧹 heading-deletion interaction, i18n).
