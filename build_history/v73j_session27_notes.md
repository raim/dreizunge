# v73_j — session 27 notes

Baseline at the cut: **161 checks green**, `check-inline` 0 on both builds, `--quick` 140.
At the close: **166 checks green**, `check-inline` 0 on both. `APP_VERSION = v73_j`.

Nine point releases: `v73_b` … `v73_j`. Suite green and `docs/` rebuilt between each.

---

## 0. The session opened on the wrong archive, and it was worth something

The first upload was `dreizunge_v72.zip`: v72 source with three newer files dropped in
(`docs/index.html` built from v73, `lessons.json`, `session_28_prompt.md`). It went red at 159/4.

Before the correct archive arrived, the four failures were diagnosed independently, and three of
them reproduce session 26 §1 exactly — `prov.by` as a migration-shaped assertion, the
`models.threads` verbatim-English batch, and the `smoke-render` lock fixture. Session 26's
conclusions survive independent re-derivation, which is worth more than it sounds for findings that
were originally reached by reasoning about a red suite.

One number that is not in session 26's notes: on the `smoke-render` fixture, **7 of the 22 candidate
storylines** put the picked chapter on a mixed-driven set, where `_firstUnfinishedLessonIdx` returns
a real index and branch 2 legitimately precedes the `_belowThreshold` branch. That assertion was not
a near-miss; it was a coin flip that had been landing right.

**Rule earned:** an archive is not self-describing. `APP_VERSION`, the `docs/` build stamp, the
newest session-notes filename and the file mtimes are four independent claims about which cut you
are holding, and they disagreed. Check them against each other before trusting any of them.

---

## 1. `v73_b` — docs/ staleness guard

`build-static.js` now hashes every baked input and stamps the digests into the artifact as
`APP.buildSources`; `test/unit-static-freshness.test.js` recomputes them and names the file that
moved.

**The gap it closes.** `unit-version-derivation` compared version *strings*. `APP_VERSION` changes
once per release; `index.html` and `lessons.json` change many times inside one. So a mid-session
drift was structurally invisible — and the v73 archive shipped with exactly that,
`docs/index.html` predating `lessons.json` by 70 minutes with the suite green.

It fired on the archive as delivered, before the first rebuild — a guard whose first action was to
catch a live instance of the thing it was written for.

Watched set: `index.html`, `lessons.json`, `ui.json`, `languages.json`, `scripts.json`,
`build-static.js`. The builder watches **itself**: a change to the transform staleness-invalidates
`docs/` exactly as a data change does, and nothing else would notice. `server.js` is deliberately
**out** — only `APP_VERSION` reaches the artifact, `unit-version-derivation` already guards that,
and including it would force a rebuild after every server edit for nothing. That exclusion paid off
twice this session, when comment-only `server.js` edits correctly did not demand a rebuild.

Revert-verified by touching `ui.json` and `lessons.json` together: names both, with both digests, as
a named assertion.

---

## 2. `v73_c` — lib-dom runtime innerHTML parsing

`innerHTML` assignment now parses into real child nodes. Attributes reflect onto the properties the
harness already exposed (`class`→`className`+`classList`, `style="display:none"`→`style.display`,
bare `disabled`→`true`, `data-*`→`dataset`), plus a selector engine (tag, `#id`, `.class`,
`[attr=v]`, descendant/child, `:scope`) and `textContent` as a real accessor.

**Measured before writing it**, because the shape of the parser depended on it: the client emits
**104 bare boolean attributes**, **28 unquoted attribute values**, **203 `data-*`**, and **144
`onclick` handlers whose JavaScript can contain `>`**. The last rules out a regex tokenizer. It is a
character scanner tracking quote state.

### The suite did not go red, and that was the design

The session spec predicted red across the board. It stayed green, by construction:

- `innerHTML` still stores and returns the raw string, so every existing markup-string assertion
  keeps passing untouched. The parsed tree is **additive**, which is what makes the migration
  incremental rather than a flag day.
- `querySelector` keeps the auto-vivifying stub as its **miss** case. Returning `null` would turn
  every gap in this parser into a thrown `TypeError` inside product code — indistinguishable from a
  real defect, and the resulting red would be noise, not findings.
- `querySelectorAll` returns real nodes. It previously returned `[]` **unconditionally**, so it
  could only ever have been asserted on vacuously.

Because green was expected rather than reassuring, the parser was then verified to be doing
something: `comp-lessons`, `comp-progress` and the arc pickers were rendered and read back as nodes.

### One deviation from a browser, deliberate

Markup carrying an id that `getElementById` has already vivified **reuses** that element object and
resets it in place. A browser would create a new node. Reuse preserves the harness's existing
contract — that a test's reference stays live across a re-render — and replacing would silently
orphan every reference taken before the render, which is a worse failure than the one it fixes.

### The payoff: what turned out to be vacuous

`test/unit-arc-options.test.js` carried a header note stating that the read-back path
`readArcTypeChecks → readLessonTypeChecks → .checked` was unreachable headlessly, that it was
"covered structurally in `unit-arc-reinforce-types`", and that it sat on the **owed browser-pass
list**. All three parts were wrong:

- `unit-arc-reinforce-types` asserted `/renderLessonTypeChecks\(c, \{ cls: 'arc-lt-check'/` — that
  the **call exists in the source**. A claim about spelling, not behaviour. Each file pointed at the
  other and neither executed the path, so `readLessonTypeChecks` had **zero** coverage while
  appearing covered from both directions.
- The same file hardcoded `const keep = ['synonyms','math']` with the comment *"stands in for
  readArcTypeChecks"* — the workaround written down explicitly.
- Its `checkedValues` regex required `checked` to follow `value="…"` with exactly one space run.
  Reordering the emitted attributes would have returned an empty list and passed the "default is
  `['review']`" assertion by luck of emission order.

The limit was in the harness, not the feature. **This comes off the owed browser-pass list.**

Both files now drive the real render → read round trip. Revert-verified four ways: changing the
default tick, deleting the `needsStory` filter, drifting the renderer/reader class name
(→ *"renders a real tick-list (0 options)"*), dropping the `value` attribute.

### Still-removable workarounds, left in place

`smoke-render.test.js:559` counts `<input ` occurrences in a markup string for the crossword grid.
`unit-editor-sync.test.js` hand-rolls `{ querySelectorAll: () => editedInputs }` stubs rather than
using the DOM. Both are now convertible. Not touched, to keep `v73_c` to one change.

---

## 3. `v73_d` — the completion card's pass mark (user-reported)

> *"the progress bar for %-solved is green at 77/94 solved, but the percentage requirement bar
> (should be at 80%) is not seen. Also the 'next' button is still grayed out."*

The reporter's own hypothesis — "likely 77/94 is too close to the threshold" — was the one part that
was wrong. The number was a coincidence.

**Cause: three questions sharing one variable.**

```js
const _showMark = !_teacher && !lesson._drill && _threshPct > 0 && _threshPct < 100;
```

`_threshPct` was the binding mark, the topic bar's mark, and "is there a gate at all" (it
initialises to 100 as a neutral value). `v71_s` later made 100% a **real** mark — a story-gated
lesson must be fully solved — so `< 100` began hiding the mark exactly when the requirement was
strictest. And in `rowsHtml`:

```js
const fill = hasMark && p < markPct ? 'var(--red)' : 'var(--green)';
```

with `hasMark` false the bar fell through to **green unconditionally**. Green bar, locked Next.

Split into three: `_threshPct` (binding, for the locked-Next tooltip), `_topicMarkPct` (the chapter
bar, never overwritten by the lesson gate), `_markApplies` (is a gate in force).

**Beyond the report, because the obvious fix would have been dishonest.** Stamping the gate's 100%
onto the topic bar would tell the learner they need 100% *of the chapter*, which is not the rule —
the gate is on one lesson. So the gated lesson gets **its own row** at its own 100% mark, labelled
with the lesson's own title (data, so no `ui.json` key and no translate pass). Also fixed: a 100%
mark sat at `left:100%` and rendered outside the 8px track, so it was unseeable even when drawn.

**A guard that pinned the bug's own spelling.** `unit-coverage-threshold` asserted the literal line
`const _showMark = ... && _threshPct < 100;` under the message *"the mark is shown whenever one
applies, not only once the learner has failed to reach it"*. The message and the assertion
contradicted each other and the assertion won. It could not have caught this. Replaced with
parsed-node assertions on the rendered card — readable only because of `v73_c`.

Writing that replacement hit the **"corpus is not a constant"** trap directly: it hardcoded `80%`,
and the corpus-picked chapter carries its own `coverageTarget` of 50%. Now asks the client via
`_coverageTarget()`.

Revert-verified four ways.

---

## 4. `v73_e` — story vocabulary highlighting (user-reported)

> *"all 'i' are highlighted in each word"*

`_highlightVocabHtml` built `new RegExp('(' + pat + ')', 'gi')` — no boundary of any kind — and
`tp_131653303` carries the vocab entry `"I" = "ich"`. On that chapter's real story: **54 marks
before, 13 after.**

**`\b` would have been the wrong repair twice.** It is ASCII-only, so Cyrillic, Arabic, Hebrew and
Greek highlighting would have stopped silently; and any boundary at all breaks Han/Kana/Thai, where
matching inside an unspaced run is the only available behaviour. Words are split by script: spaced
ones get `(?<![\p{L}\p{N}\p{M}])` … `(?![\p{L}\p{N}\p{M}])`, unspaced ones stay unguarded.

On the design principle: `\p{Script=…}` is Unicode machinery, the same tool `v72_a` adopted for
sentence segmentation, and which scripts run words together is a **typographic** property of the
writing system — how text is compared — not a judgement about whether content is correct. The
codebase already leans on the same fact in `CJK_LANGS` and in this function's own furigana strip.

The new test exists mainly to pin the two things `\b` would have broken, since both are invisible in
a Latin-script test and neither fails loudly.

---

## 5. `v73_f` — grammar article MCQs, and the chapter name (user-reported)

> *"Welches Artikelwort passt zu dream?" answer options: "a, the, an" → both a and the would be
> correct. Is this based on language-specific lists?*

**No — and the truth is worse than a list.** `v71_x` already removed the article table; choices are
corpus-derived. The defect is that the exercise **assumes the article is a property of the noun**.
That holds in German, where der/die/das follows gender; it does not in English, where a/the is a
definiteness decision the sentence makes.

The corpus proves it without anyone writing a rule. Dominant-article share per gender class,
elision collapsed:

| lang | n | raw | collapsed |
|---|---|---|---|
| de | 68 | 100% | **100%** |
| it | 26 | 92% | **100%** |
| fr | 10 | 80% | **100%** |
| he | 8 | 100% | **100%** |
| **en** | 55 | 73% | **73%** |

Bimodal, 27-point gap, nothing inside it — the same shape that set `IDENTICAL_MIN_RATIO` in
`v53_g`, so `ARTICLE_PREDICTABLE_MIN = 0.9` sits **in** the gap rather than being chosen. And
directly: **5 English nouns carry two different articles across lessons** (`dog{a/the}`,
`mouse{a/the}`, `application{an/the}`) — the lessons contradict each other about the answer.

Elision folding is typography, not grammar: an article ending in an apostrophe whose stem prefixes
another article of the same language is that article's elided form. It is what takes Italian from
92% to 100%, and **without it French loses its only article lesson** (confirmed by revert).

Result: **de 9/9, it 3/3, fr 1/1** still build; **en 0/6**; he 0/1 unchanged (single article, no
distractors, as always). The rule generalises without naming anything — es/pt/nl/el follow gender
and keep the exercise the first time anyone generates in them; article-less languages never emit the
field.

### A guard rewritten, flagged rather than buried

`unit-article-choices` asserted *"article MCQs build in at least 19 lessons; the removed table
managed 15"* — the `v71_x` headline win. This change drops it to 13, because **6 of those 19 were
English and unanswerable**. The old assertion was counting broken exercises as a win. Split by
language: full coverage required where the article is predictable, **zero** where it is not. A
weaker number and a stronger claim — but it is a guard that was protecting a real result, so it is
recorded here rather than left in a diff.

### Also in `v73_f`: the chapter names itself

The `%-solved` row read `t('complete.chapter_progress')` — "This chapter" / "Dieses Kapitel". Now
the chapter's own name, truncated at 34 chars because it shares a flex row with the `n/total`
counter. Falls back to the generic string for drills. No new `ui.json` key: the name is data.

---

## 6. `v73_g` — completion-card lesson icon row (user request)

One icon per visible lesson above the play buttons, using `lessonTypeEmoji` from the same registry
the storyline row uses. Clicking calls `startLesson(i)`.

Agreed semantics, recorded because they are decisions rather than consequences:

- **(a)** starting from the row may bypass the mixed lesson; the proceed buttons must not.
  **Verified rather than assumed:** `repeatForCoverage()` targets `_firstCoverageShortLessonIdx()`
  and Next targets `_firstUnfinishedLessonIdx()`; both return the mixed driver on a mixed set. There
  is now an assertion pinning that, so a later change cannot quietly reroute them.
- **(b)** no played-indication. Also the safer choice: a done-marker here would have to answer
  "done?" for a mixed-driven chapter where completion is coverage rather than per-lesson flags —
  the divergence `v69_l` and `v71_w` exist to remove. One rule for completion; this row adds none.
- **(c)** story-gated lessons render greyed, carrying no index and no `onclick`, until the story
  unlocks. An icon launching a locked lesson would be one more dead end on the branch chain that has
  already produced three.
- **(d)** the storyline view's row is untouched and stays non-clickable.

**The counting question needed no code.** A chapter has ONE coverage universe spanning every
question every lesson can produce, so a question reached from an icon lands in the same denominator
it would through mixed. "It should count" was already a property of the model. The invariant is
asserted anyway — rendering the row leaves `topicCoverage().total` unchanged — because an invariant
nobody checks is one a later change breaks silently.

---

## 7. `v73_h` — plural distractors drawn, not manufactured

The plural MCQ padded a short distractor list with `x.plural + 'e'`. That is a German pluralisation
fact (Hund → Hunde) in a language-neutral builder; in English it produced **"bookse"** — a non-word,
rejectable on sight, so the padding made the question *easier* than a real distractor. Same class as
the `ARTICLE_CHOICES` table removed in `v71_x`, one function away, and it survived that pass because
`v71_x` was looking for a **table** and this was an **expression**.

Measured before replacing: the padding fired in **1 of 20** grammar lessons, on **3 questions**, and
in all 3 the corpus already held 3+ real plurals for that language. Replacing it lost nothing.

**A third copy was about to be written.** `_articleStatsFor` and the new `_pluralChoicesFor` walk
the same structure — this lesson, then the open chapter, then the library, same language. Extracted
to `_forEachGrammarItem` and both now use it. This is the session's standing caution applied in the
one direction it permits: removing a duplicate rather than reorganising working code.

### The new assertion caught a pre-existing defect

The uniqueness check failed on **clean** code: `["apps","notifications","users","notifications"]`
and `["Ingenieure","Fachfrauen","Angestellte","Angestellte"]`. `wrongPl` was never deduplicated, and
two different nouns can share a plural — `der/die Angestellte`, two English nouns both pluralising
to "notifications". A repeated option is a broken question, not a hard one. Present since the
builder was written; nothing had ever looked.

---

## 7b. `v73_i` — a round never asks one question twice

Traced from the user's question *"is this a faulty lesson or a code problem?"* about
`dream ← Traum` / `dream ← Träume` in `tp_131653303`. The answer is both, in separable parts, and
the separation is the useful bit.

**The data is wrong.** `Träume` is the plural of `Traum`, emitted as a new noun. Its `gender:"c"` —
common gender, which German does not have — is the tell. `grammarPriorNounsNote` already instructs
the model to normalise to the base singular; prompt instructions are advisory and nothing validated
the output.

**The qid layer was already correct.** `_qidCanonical` keys `mcq_plural` on the target alone, so both
items produce one qid — right, because the question the learner reads is "what is the plural of
*dream*?", genuinely the same question. Counting it once is correct; double credit would not be.

**The gap was between counting and presentation.** The dedup governed the coverage universe, not the
round, so nothing stopped `buildExercises` emitting two exercises that canonicalise identically. The
learner saw the same question twice. Fixed in `buildExercises` — the single funnel every lesson type
passes through, where the withheld filter already lives.

Scope, corrected twice by measurement:

| | |
|---|---|
| duplicate exercises before | **41 across 17 lessons, 8 exercise types** |
| largest type | `syn_select` 14, then `mcq_plural` 9 |
| after | 0 |

The first reading said 97 across 36 lessons. That was wrong: the measuring script keyed
mixed-lesson exercises on the current lesson instead of their `_srcLessonIdx`, inventing duplicates
that were not there. **The measurement had the same bug the product was being checked for**, which
is worth remembering — a harness that reimplements the rule it is testing will agree with a broken
implementation.

**Not a grammar problem, and not only a data problem.** `der Angestellte` / `die Angestellte` are two
real nouns sharing a plural, so "the plural of Angestellte?" is one question however good the model
is. That row also carries a trailing space on its target — the model apparently evading its own
"do not repeat a target" instruction, so even the clean example is contaminated.

**What this does not do**, stated because it was overclaimed in conversation first: it does not
improve future lesson quality. It is downstream hygiene. The duplicate row survives in the editor,
the vocab chips and `_pluralChoicesFor`. Deciding that `Träume` should be `Traum` needs German, which
no guard here can supply — that is QC and user flagging, and the flagging channel currently has zero
data flowing through it (0 corpus items starred).

### Found on the way: the coverage universe is not deterministic

Checking the assumption that dedup would not move coverage totals, 4 of 294 topics changed — two
of them **upward**, which a dedup cannot cause. Running the same code twice produced the same
disagreement, so the dedup was innocent.

**15 of 294 topics (5%) return a different `topicCoverage().total` from run to run**, worst spread 4
questions (2.9%). Builders that sample which items to quiz (`shuffle(...).slice(0, n)`) change which
qids exist, so the denominator a learner is measured against moves. A learner sitting exactly on the
pass mark can cross it, or fall back below it, by reloading — adjacent to the `v73_d` report, though
not its cause. Unfixed and unrecorded before now.

---

## 7c. `v73_j` — QC findings lost to a concurrent edit (user-reported)

> *"is it possible that QC flags are lost, when i edit the storyline while QC is still running?"*

Yes. Diagnosed from the user's console log plus their `lessons.json`, and the two together identify
the mechanism without ambiguity.

**The evidence.** A run logged **9 flags across two chapters; 5 survived.**

| chapter | edited | flags kept |
|---|---|---|
| `Kälte und Paella` | 3 saves **while QC was inside it** | **0 of 4** |
| `Churros und Chaos` | 1 save **just before QC reached it** | **5 of 5** |

And the chapter that lost everything still carried `tokensByType.lesson_qc: 4935`. QC ran, spent the
tokens, and left nothing. **That asymmetry is the fingerprint**: `addTokenUsage(tp, …)` writes to the
TOPIC, which the editor mutates in place, so it survived — while stamps and flags are written to
LESSON and ITEM objects, which `saved.lessons = lessons.map(...)` replaces wholesale.

**The detail that settles it.** Two of Kälte's four flags were raised *after* the edits landed, and
they were lost too. A stale client payload cannot delete a finding that did not exist when it
loaded. Only an orphaned reference explains it — and it explains the all-or-nothing shape as well:
once `lessons` points at the replaced array, everything the rest of that topic writes is lost.

**The fix.** `_runQc` no longer writes through the references it captured. `_liveTopic()` and
`_liveLesson()` resolve by id from `store` at every write, and items are located by (array key,
index) — the editor's merge is index-aligned (`edited.vocab.map((v, j) => mergeFlaggable(orig.vocab[j], v))`),
so id + index is durable where an object reference is not. `upsert(_liveTopic())` closes the same
hole pointing the other way: upserting the CAPTURED topic writes a stale shallow copy back over the
store, reverting the user's concurrent change instead of dropping QC's findings.

Revert-verified three ways, two of them reproducing the reported symptom exactly (**0 of 3**
findings surviving), and the third requiring a second scenario to be non-vacuous — see §8.

### Not fixed: two further mechanisms

1. **A stale editor deletes flags on save.** `mergeFlaggable` treats the client payload as
   authoritative — `if (!('qc' in v)) delete m.qc;` — so any editor opened before QC flagged an item
   deletes that flag when saved, minutes later, with no concurrency involved. Demonstrated with the
   real function. This is deliberate (so a user CLEARING a flag sticks), but absence-means-delete
   cannot distinguish "the user cleared this" from "the client never knew about it". **The same path
   carries `userRating`**, so stars are droppable the same way — which matters, because the example
   pipeline depends on stars and currently has none.
2. **No version check anywhere.** No lock, no etag, no `updatedAt` precondition. The eventual answer
   is for the editor to send the `updatedAt` it loaded and the server to reject a stale base.

### Rule for using it today

**A chapter is at risk only while QC is actually inside it** — the console names the chapter it is
on. Editing a chapter QC has not reached, or has already finished, was always safe. Adding a lesson
is also safe: `topic.lessons = [...old, ...new]` builds a new array but keeps the same lesson
objects, so writes still land.

---

## 8. Vacuous assertions found this session: nine, all one shape

Every one asserted on something that **cannot distinguish the cases**, and every one was found by
running the revert rather than by reading.

1. `unit-arc-options` — the read-back "covered structurally" elsewhere; that elsewhere was a source
   regex. Zero coverage presented as double coverage.
2. `unit-coverage-threshold` — pinned `_threshPct < 100`, i.e. the defect's own spelling, under a
   message asserting the opposite.
3. `unit-vocab-highlight` §5 — "phrases win over their own parts" passed with the sort deleted,
   because the fixture used `il forno a legna` vs `forno`, which start at **different** positions.
   Alternation order never decided anything. Fixed with `forno` vs `forno a legna`.
4. `unit-comp-lesson-icons` §3 — the off-by-one guard (lesson index vs row position) came back clean
   **twice**: first because the fixture's hidden lesson was last, so the two coincided everywhere;
   then because the only lesson after the hidden one was the story-gated one, which is locked,
   carries no index, and is never checked. Needed a fixture with a **startable** lesson after a
   hidden one.
5. `unit-article-choices` §4 — the correct-answer exclusion could not be reached through the corpus,
   because the draw only fires for the handful of lessons with fewer than three plurals of their
   own. Asserted on the helper directly instead of hoping `lessons.json` exercises it.

6. `unit-exercise-qid-unique` §3 — "a mixed round's pooled exercises are not collapsed" compared
   lesson ids inside the qids, which the TEST computes. It could not observe how the BUILDER keyed
   them, so it passed with the builder deliberately mis-keyed. The discriminating property is
   whether an exercise SURVIVED: mis-keying makes the round come back shorter. 16 corpus rounds
   demonstrate it, the worst keeping 28 where a lesson-keyed dedup would keep 23.

7. `unit-qc-concurrent-edit` — "QC upserts the LIVE topic, not the captured one" could not fail,
   because the scenario used the EDITOR save, which mutates the topic in place. With
   `tp === _liveTopic()` the two spellings are identical. Needed a second scenario where the topic
   object is REPLACED (upsert semantics, as save-story and generate do) and a lesson is added
   mid-pass: reverting then reverts the user's added lesson, which is the loss running the other way.

**And one revert that was incoherent rather than vacuous.** Reverting the dedupe alone left
`pool.delete()` on an array — a `TypeError`, not a named assertion. The first sweep reported it as
"no failure" because the grep looked for `AssertionError`. A revert must leave the product in a
*coherent* wrong state, or it verifies nothing. The sweep script now distinguishes
`!!! NO FAILURE` from `!! THREW`.

**The generalisation, since this is the fourth session in a row to produce these.** The shape is
always: the assertion is downstream of the thing under test, *or* the fixture is arranged so the
distinction never arises. Reading cannot find either. The only reliable detector is breaking the
product and demanding the **named** assertion fire.

---

## 9. Documentation and bookkeeping

`build_history/future_development.md` — new. The scan across 128 files for everything wanted and
never built, every entry re-measured against the code. Two entries outrank most of the roadmap
queue: the **empty example pipeline** (`promptExample()` resolves at 4 sites; `examples.json`
absent, 0 corpus items starred, 1 curated example — every generation falls through to the generic
default) and **5 corpus lessons that the app's own rule would reject**, with the general point that
generation-time guards never clean the data that prompted them.

Bookkeeping fixed, each of which would have cost a future session time:

- Deleted `v72b_session26_notes.md` — a superseded draft, byte-identical for §1–§8, carrying the
  *newer* mtime, so `ls -t` and the protocol's own "read the most recent session notes" both pointed
  at the stale copy.
- `roadmap_v73.md` DoD item 6 said "This is the `v72` line". Corrected, plus a note to check that
  paragraph at every base cut — it is the one version-specific line in the block.
- `server.js` ~2197 described the superseded **count** rule as future work ("A RATIO threshold would
  separate them; see roadmap_v54") when the ratio rule shipped in `v53_g` and runs 2,000 lines
  below. Marked as history.
- `INTERNALS.md` "Known violations" listed three entries, **all struck through**, so the section read
  as "none remain" while `CLOSE_LANG_PAIRS` — a live 21-pair hand-authored table that gates whether
  a lesson is kept or rejected — sat outside it. Added as entry 4, with the note that an inventory
  recording only what was found is not an inventory.
- `current_status_claude.md` (self-labelled "not CURRENT", describes v18a, 55 releases stale) moved
  to `build_history/archive/`.
- `INTERNALS.md` said "Last verified against v72" on a v73 tree.

---

## Still open

**Owed by the user (not doable in a container):** the browser pass. Nine releases' worth, minus the
arc read-back, which `v73_c` moved into the headless suite.

**Postponed by agreement:** the **role model / authorization** work. Full plan in `roadmap_v73.md`
under "Authorization and roles". The measurement that motivates it: **40 of 43 non-GET routes have
no auth check**, `GET /api/learners` returns every learner's username, completion counts and hardest
words unauthenticated behind a comment claiming a gate that is not implemented, and teacher mode is
a `localStorage` boolean. The server binds `0.0.0.0`. Nothing is deployed publicly, so this has no
clock — but it precedes scoring, history and dashboards, which all hang off it.

**Reported and not yet addressed:** the duplicate-target defect is live in `tp_131653303`, whose
grammar lesson holds `dream ← Traum` and `dream ← Träume` — two exercises colliding on one qid,
asked twice and counted once. That is open decision 1, now with a named instance.

**Convertible, left alone:** `smoke-render.test.js:559` and `unit-editor-sync.test.js`, both of
which still work around a harness limit that no longer exists.
