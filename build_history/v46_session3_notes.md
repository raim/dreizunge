# v46 session 3 — Major A (per-target-language prompt examples): A1 + de seed

Started Major A after completing Major B. A is a *feature*, not a pure refactor: A1 is the
safe, byte-identical groundwork; A2 deliberately changes the `de` prompt only.

## A1 — the `{EXAMPLE}` mechanism (byte-identical, shipped)
- `prompts.json` `wordForms.system` now ends with an `{EXAMPLE}` token; the old English
  GOOD/BAD worked example moved verbatim into `wordForms.examples.default`. No other prompt
  touched (surgical raw-text edit, not a reflow of the file).
- server.js: new `promptExample(P, lang)` helper next to `fillPrompt` returns
  `examples[lang] || examples.default || ''`. `generateWordForms` assembles the system as
  `fillPrompt(system, { L, S, EXAMPLE: fillPrompt(promptExample(PROMPTS.wordForms, lang), {L,S}) })`
  — the example's own `{L}`/`{S}` are filled, so the result is **byte-identical** to the old
  inline prompt whenever the target has no seed (proven for 4 language pairs both at the JSON
  level and at server-assembly level).
- Additive & backward-compatible: a prompt with no `examples` block, or a target with no
  entry, falls back cleanly.

## A2 — `de` seed (changes the German prompt only)
- Added `wordForms.examples.de`: a GOOD item (noun plural `Katze`/`Katzen` forced by the
  plural verb `schliefen` — the unambiguous, canonical pattern) + a BAD item
  (`schüttelt`/`schüttelte` tense ambiguity) + the BAD-translation warning, mirroring the
  default's structure so the model has a familiar shape.
- Per the roadmap's 2-D-matrix rule, only the `{L}` (German) half is localized; the `{S}`
  half uses **English as a single representative** (translation + explanation in English),
  exactly as the default hardcodes one representative pair.
- Effect is targeted: only the `de` wordForms prompt changes; every other target is still
  byte-identical to before (verified).

## A1b — `{EXAMPLE}` mechanism extended to synonyms / grammar / conjugation (byte-identical)
- `synonyms` and `grammar` each had a discrete `Example (...)` block between Schema and
  Rules; moved verbatim into `<prompt>.examples.default`, replaced in `system` by
  `{EXAMPLE}`. `conjugation` had **no** discrete example (only inline `e.g.` paradigms in the
  rules), so it gets an `{EXAMPLE}` slot with `default: ""` inserted before `Rules:` —
  byte-identical-empty now, seedable later.
- Wiring: `sysGrammar` / `sysConjugation` and the `generateSynonyms` prompts.json path now
  pass `EXAMPLE: fillPrompt(promptExample(P, lang), {L,S})`, same shape as wordForms.
- Proven byte-identical (server-assembly level) for all three across 4 language pairs — no
  behavior change until a seed is added. `e2e-synonyms` (real server) stays green.
- `prompts.json` was normalized to `json.dumps(indent=2)` (it already round-tripped except
  for the earlier wordForms one-liner), so all four `examples` blocks are consistently
  pretty-printed; the only semantic changes vs the pristine file are these four prompts.
- No seeds added for synonyms/grammar/conjugation yet — expanding is now purely *adding seed
  strings* per (prompt, language), no code. Gate that behind the `de` wordForms live
  measurement.

- Asserts the `{EXAMPLE}` seam + `examples.default`, the `promptExample` fallback chain, and
  the server wiring.
- **Validator gate:** for *every* entry in `wordForms.examples`, the test extracts the GOOD
  item JSON and runs it through the real `validateWordFormsItems` — so a structurally
  malformed seed fails the suite. Currently 2 examples (default, de) both pass.
- This checks **form, not native correctness** — see caveat below.

## A1c — simplified example format + the rating→examples harvest loop
- **Format simplified to "good items."** The `{EXAMPLE}` block is now a short preamble +
  one or more schema-shaped item JSONs; the GOOD/BAD prose framing was dropped (the
  constraints it taught already live in each prompt's rules). All four curated defaults and
  the `de` seed were reshaped (GOOD item extracted verbatim, BAD dropped). Watch-item for the
  live measurement: weak models lose the concrete *anti*-example, so check ambiguity output
  didn't regress.
- **`harvest-examples.js`** (new, zero-dep CLI, sibling of `report-edits.js`): walks
  `lessons.json` for `item.userRating` items in the four in-scope lesson types, strips each to
  its schema fields, applies a light structural check (skips obvious breakage; ⭐ is the human
  quality signal), and writes `examples.json` keyed by prompt type + `"<L>__<S>"` pair, each
  value a "good items" block. Re-runnable/deterministic from lessons.json. Does NOT import
  server.js. Guarded by `unit-harvest-examples` (incl. running harvested wordForms items back
  through the real `validateWordFormsItems`).
- **Overlay + pair-aware resolver.** `loadPrompts()` overlays `examples.json` (env-overridable
  `EXAMPLES_FILE`, hot-reloaded) onto the curated `prompts.json` examples via `Object.assign`.
  `promptExample(P, lang, srcLang)` now resolves exact pair (`de__en`) → per-language (`de`) →
  `default` → `''`; `srcLang` is threaded through all four generators. Key property: a
  harvested example is only ever served back to its own pair, so its baked-in `{S}` content is
  always correct — the cross-`{S}` reuse trap is avoided by construction.
- **Layering:** `prompts.json` = shipped/curated (`default` + hand seeds like `de`);
  `examples.json` = per-deployment harvest output (regenerated each run). Clean separation.
- Verified end-to-end via a CLI smoke (synthetic rated lessons → correct `de__en` blocks,
  un-rated excluded, no `userRating` leakage) + the unit tests above.

## ⚠️ Owed: human review of the `de` seed (LIVE-TEST-CHECKLIST)
The validator only proves the German example is *structurally* valid. Its
native/pedagogical quality (natural phrasing, the plural-forcing being airtight, the
tense-ambiguity being a fair "BAD") needs a human/native pass before being trusted. The
risk is bounded — it only affects `de` wordForms generation and is one editable string — but
a wrong example is worse than the clean English default, so review before relying on it.

## Does A change LLM-call performance? (asked this session)
No direct per-call speedup: same model, sampling, call count, and decode cap. A1 is
byte-identical → zero change. From A2, the only direct effect is a small prompt-token delta
(a German example replaces the English one; non-Latin seeds would shift tokens more). The
intended win is **output quality** for weak models on morphology-heavy targets — a
*hypothesis* needing live measurement. If it lands, it reduces malformed items → fewer
salvage retries (generators loop up to 3×) → fewer total calls per lesson, i.e. faster/
cheaper *end-to-end* via quality, measurable through E0 `_genMeta`. A *wrong* example would
do the opposite, which is why seeds are validator-gated and hand-reviewed.

## Verification (headless)
`node --check server.js` · `node test/run.js` → ALL CHECKS PASSED (45 test files).
A2's quality and the weak-model measurement (phase 3) are live-only — headless can't judge
either.

## Next
- Human-review the `de` seed; add a non-Latin seed (`ru`/`ja`).
- Live-measure on the small model (weak-model wordForms) whether the seed reduces rejects.
- Then extend `{EXAMPLE}` to `conjugation`/`grammar`/`synonyms` (same mechanism).
