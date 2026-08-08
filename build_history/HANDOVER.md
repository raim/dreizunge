# HANDOVER — v76_i

One page. Read `build_history/roadmap_v76.md` next for the queue and the session protocol, then
`INTERNALS.md`, then `build_history/v76_session30_notes.md` for what session 30 found.

## Green baseline

| command | expected |
|---|---|
| `node test/run.js` | **180 checks, ALL PASSED** |
| `node test/run.js --quick` | 156 |
| `node test/check-inline.js` | 0 failures |
| `node test/check-inline.js docs/index.html` | 0 failures |

`APP_VERSION = 'v76_i'`. Establish this before changing anything.

**These numbers are the ones to trust.** Session 30's prompt said to expect 170/149 and to treat any
other number as a finding; 170/149 were the numbers session 29 *opened* on, before it added six
checks. **If a prompt and this file disagree, measure — and check timestamps first.** The data files
(`lessons.json`, `ui.json`, `learners.json`) travel separately from the code and routinely arrive
newer.

**If `unit-script-choice` fails saying topics are unstamped, run `node backfill-script.js --write`.**
A newly generated Serbian chapter arrives without its `script` stamp; the guard is doing its job.

**If `unit-static-freshness` fails, run `node build-static.js`.** It hashes every baked input and
stamps the digests into `docs/index.html`. **A failure here is the guard working.**

## What session 30 settled

Opened RED (2 of 176). **Neither failure was a product defect, and one of them WAS the user's
reported bug.** Three releases, `v76_d` -> `v76_f`.

- **`v76_d`** (test-only, no version bump) — two guards had pinned the shape of the corpus rather
  than their claim. `unit-coverage-threshold` compared a progress-row label against the raw title
  while the card truncates at 40 chars; `unit-live-static-progress-parity` asserted `total 🔒 === 1`,
  which encoded a *two*-chapter storyline where the chain is now six. **The product was right in
  both cases** — chapter 2 does open; chapters 3–6 are locked because *their* predecessors are.
- **`v76_e`** — the reported storyline bug. `loadSavedList` projected each chain through the
  **language-filtered** id index, and the renderer recovers the storyline by an exact full-length
  positional match, which a truncated chain can never satisfy — so it fell through to a synthetic
  `'c'+hash` id with no storyline behind it. Reproduced the user's exact `c1935658823`. Fix: **a
  storyline is one unit — the filter decides WHETHER it is shown, never WHICH of its chapters are.**
- **`v76_f`** — `--langnames` wrote `languages.json` once, after the loop, so an interrupted run
  discarded everything. Now flushed after every batch, as `translateLang` in the same file has
  always done.

## Standing rules worth re-reading (14 now, in `roadmap_v76.md`)

1. **A probe must call the product function, never a re-typed copy.**
2. **A claim is only measured if the assertion touched the thing being claimed.**
3. **A non-vacuity check must run on the data the assertion actually runs against.**
4. **A headless harness building `APP.savedList` from whole topics is testing STATIC mode.**
5. **(new, 12)** A test that hard-codes a COUNT of a repeated element pins the fixture, not the claim.
6. **(new, 13)** A guard whose scenario matches nothing may never reach the branch it tests —
   `loadSavedList` returns early on an empty list, and a negative assertion passed under its revert.
7. **(new, 14)** **Identity must be CARRIED through a projection, never recovered by hashing it.**
   Third instance (`v75_f`, `v76_e`). If a list is filtered and then matched back against its source
   by length or position, the filter and the match are the same bug waiting.

## Next session — in this order

**THE PROGRESS-CARD REWORK IS STILL THE NEXT SESSION.** It was not started: session 30 spent itself
on the red baseline and the two user reports. Read `build_history/roadmap_v76.md` §0 (the whole
rework), then `build_history/v76_card_gates.md` (the MEASURED as-is truth table — 32 rows, both gate
families, plus a preserved probe to re-run and diff).

**Do not start §0c (the card sequence) until the three rulings in §0a are answered.** Two of them
supersede decisions that are currently shipped and tested (`v74_l`, `v74_o`).

**Do §0b first regardless:** make the 7 swallowing `catch(_) {}` blocks in `showComplete` visible,
and settle the coverage key-space question (86 seeded solved keys, 0 counted, total 31 — the branch
that gates story unlock for every mixed-driven chapter). Both are small and de-risk everything after.

## Owed by the user, not doable in a container

- **A browser pass**, now including `v76_e` — see "how to see it work" in the session-30 notes.
- **Confirm the `v76_e` product judgement**: filtering the library to one language now shows a
  mixed-language storyline **whole**, including its chapters in other languages. The alternative
  leaves *"the lessons in a different language didn't show up"* unfixed. Say if you want it reversed.
- **The three §0a rulings** blocking the card rework.
- **The Android English voice.** `v74_j` fixed only the case where the exact locale is PRESENT; with
  no `en-GB` installed the ranker falls through to quality alone and a NETWORK `en-NG`/`en-IN` beats
  the LOCAL `en-US`. The obvious fix is barred by the design principle — choose between
  `voice.default`, `navigator.language`, or shipping §6's selector so you pick once.
- **The pass mark.** `Churros` is 40 items where it was 83 questions, and an item is solved by ANY
  correct answer, so 80% is a materially lower bar. Needs a browser pass, not a code change.
- **`translate-ui.js --langnames`** — 151 `languages.json` name cells still empty (`sr`/`hr`, and 31
  for `lb`). It now saves as it goes, so an interrupted run keeps its progress.
- **`sr`/`hr`**: the `ui.json` pass, the 28 non-English `names` entries, and a **native-speaker check
  of the `cyrillic-sr` table** — it was authored in-container, the exact case the design principle
  warns about.
- **The translate pass** for `complete.words_solved` and `form.finish_mixed` (`en`-only). `t()` falls
  back through English meanwhile. **`v71_q`: never assert a dropped key absent.**
- **The comprehension QC checker** — needs a new prompt and a live model.

**New `ui.json` key in session 30: `form.script_pick` = "Script…" (`en` only).** Add it to the
translate pass. `t()` falls back through English meanwhile.

## Known, not fixed

- **`_tryOpenStorylineByChainId`'s legacy fallback** rebuilds chains through `makeParentResolver`,
  which is **same-language guarded**, so an old bookmark carrying a pre-`v76_e` synthetic `c…` id
  cannot be resolved for a mixed-language chain. No new `c…` ids are produced after `v76_e`.
- **`_sbChapterTarget`** (`index.html` ~8065) — the last known instance of the raw-lessons pattern.
- **The storyline-page TTS selector** — `ids = ['ls']`, the `-sl` elements are gone, but the
  function's existence check still looks for `tts-lang-select-sl`. Also dead: `#tts-row` /
  `buildTtsSelector()`, permanently `display:none`, still rebuilt on every lesson-set entry.
- **The two language menus should eventually be GENERATED from `languages.json`** — they are
  deliberately ordered differently, so generating would silently reorder a user-visible menu.
  `unit-lang-menu-coverage` makes the duplication safe meanwhile.
- **The import dedup's title-based tie-break** still decides which copy of a duplicated chain
  survives on a non-content signal (`v75_f`). No longer reachable from the import path.
