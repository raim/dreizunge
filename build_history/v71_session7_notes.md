# v71_h — completion-card cleanup: remove card D, consistent button row

Two user-requested card changes, both driven by the earlier card-inventory review. Suite **147**
(was 146), `--quick` **127**, `check-inline` 0 on both builds, static rebuilt byte-identically,
both report `v71_h`.

## Background: the card inventory

The previous exchange mapped every distinct completion-card state by EXECUTING `showComplete` in a
live DOM (not reading source). Seven card shapes emerged. Two findings drove this session:

- **Card D (drill result) was a hollow waystation.** After a drill, the learner landed on a stripped
  card — no progress bars, no storyboard, no Back — whose only job was a Next that returned to the
  real chapter. An extra tap through a near-empty card.
- **The button row jumped between cards.** Repeat / Drill / Crossword each had an independent
  `display:none` visibility rule, so the row's contents (and positions) changed card to card. The
  user asked for one consistent row: same buttons everywhere, greyed when unavailable.

## 1. Card D removed

A finished drill now returns to the LAUNCHING chapter's real card instead of its own.

**The trace that made it safe.** A drill can finish through exactly ONE exit: `renderEx` running out
of questions (the other two `showComplete()` callers are error-hunt paths a `standard`-typed drill
never reaches). So the fix is at that single choke point: `endDrill()` BEFORE `showComplete`, so the
real topic is restored and the true chapter card renders.

**The subtlety.** After `endDrill()`, `APP.lessonData` is the real topic but `APP.cur.lessonIdx` is
still the drill's index (0). `showComplete` resolves `lesson = APP.lessonData.lessons[C.lessonIdx]`,
which would now point at the WRONG real lesson (or out of range). Fixed by rendering in REVIEW mode
(`showComplete(true)`), which rebuilds `APP.cur` from the real topic's last counted lesson — exactly
the resolution we want. The below-threshold gate does not exclude review mode, so a drill that
leaves coverage short correctly returns to the "Keep going!" card; one that pushes the learner over
returns to "complete".

The drilled mistakes are credited during play (`markSolved`), so the real card reflects the raised
coverage immediately. A drill's score was always shown DURING the round, never on this card, so
nothing is lost. A one-line `drill.done` toast preserves the "you finished the drill" beat.

**The now-unreachable `if (lesson._drill)` branch in `showComplete` was KEPT** as a defensive
fallback, clearly marked. It was the fix for three user-reported dead ends (v66.1, v69.2); deleting
it risks reopening one if some future path reaches the card with a drill still active. A few dead
lines are cheaper than that risk.

## 2. Consistent button row

Every completion card now shows the same five buttons — Next / Repeat / Drill / Crossword / Back —
each greyed (present but `disabled`, with an explanatory tooltip) when it cannot act. New helper
`_compBtnState(btn, available, reason)` replaces the `display:none` toggles. Next is greyed on
complete/review cards rather than removed.

Rendered result across the states, from the live DOM:

```
mid-chapter     →:LIVE  ↻:LIVE  🎯:grey  🔠:LIVE  ←:LIVE
below, no drill →:grey  ↻:LIVE  🎯:grey  🔠:LIVE  ←:LIVE
below + drill   →:grey  ↻:LIVE  🎯:LIVE  🔠:LIVE  ←:LIVE
complete        →:grey  ↻:LIVE  🎯:grey  🔠:LIVE  ←:LIVE
review          →:grey  ↻:LIVE  🎯:grey  🔠:LIVE  ←:LIVE
```

Only the title and which buttons are LIVE change; the row itself is fixed. Greyed buttons reuse the
`.comp-ico.locked` visual (opacity .4, greyscale, no hover lift) via a sibling `.disabled` class.

## Tests

Four existing suites encoded the old `display:none` contract and were updated to the greyed one:
`unit-drill`, `unit-learner-nav`, `unit-coverage-threshold`, `smoke-render`. The **v69.2 dead-end
guard in smoke-render was STRENGTHENED**, not just adjusted: "at least one route up" now means
present AND enabled (a greyed button is not a route), and the no-duplicate-icon rule now compares
only LIVE buttons.

New `unit-card-consistency.test.js` (live DOM, 5 sections) covers both changes:
- card D removed: a finished drill restores the real topic, shows progress bars + Back, no errors;
- a below-mark drill returns to the below-mark card, not "complete";
- all five buttons present (LIVE or GREY, never HIDDEN) on every card state;
- greyed states mean what they should (drill grey without mistakes, Next grey on a finished solo);
- greyed buttons are disabled and cannot be activated.

**Revert-verified**, both failing as named assertions:
| revert | caught by |
|---|---|
| don't endDrill before showComplete (card D returns) | `a finished drill restores the real topic` |
| hide crossword instead of greying | `crossword is greyed (never hidden) when the lesson has no crossable words` |

A note on the second: my FIRST version of the consistency test had a hole — every card in the main
check happened to have crossword available, so a hide-regression slipped through. The revert-test
caught that the guard wasn't biting, and I added an explicit no-crossword card. This is exactly why
reverts are run: a green test is not a guarding test until you have watched it fail.

## i18n — 4 new `en`-only keys

```
drill.done            'Drill complete — back to your progress'
drill.none            'No mistakes to drill yet'
complete.repeat_none  'Nothing left to replay here'
crossword.none        'Not enough words for a crossword'
```

None added to any other language.

## Owed

- **Browser pass — genuinely wanted here.** This is the most fragile branch chain in the app
  (three prior dead ends), and greyed states + the drill→real-card transition are exactly what only
  fully proves out in a browser. Headless evidence is strong but not a substitute.
- Everything still owed from v71_b–v71_g (PDF chapters, typed diff, replay focus, the stale
  `showComplete` "rounds re-sample" comment, vocab duplication, i18n backlog).
