# Session 29 — `v75` → `v75_h`

Opened from `build_history/v76_prompt.md`. Four point releases: `v75_b`, `v75_c`, `v75_d`
(`v75_c` and `v75_d` are the two behaviour changes; `v75_b` restored the baseline).

**The baseline was RED — 2 of 170 — and neither failure was a stale fixture.** Both were real, from
two unrelated causes. Diagnosing them took the first half of the session and is the more useful half
of these notes.

---

## The red baseline, part 1 — `ui.json` predated the code (`v75_b`)

`unit-story-unlocked-card` failed with `actual: 'complete.words_solved'` — `t()` returning the key,
i.e. the key does not exist.

Measured: **`complete.words_solved` and `form.finish_mixed` were absent from all 30 languages,
including `en`.** The `HANDOVER.md` describes them as "new and English-only", so the expectation was
that `en` had them and the other 29 did not. Neither did.

The file's own timestamps say why. `ui.json` is dated **Aug 4**; `index.html` is **Aug 7**. This is
the returning-translation hazard the protocol already names — *"a returning file may predate recent
releases"* — and it is exactly what happened. The pass the `v75` handover asked for **did run and
did work**: `complete.story_unlocked` and `ex.badge.comprehension` are now filled in all 30
languages. The returned file simply predates the two keys that were added after it was sent out.

Validation of the returned file, per the protocol (`per-language key counts, and whether any en key
vanished`): clean. 596 keys × 30 languages, **0 missing, 0 extra** in every language. Nothing was
lost in translation; the file was just older than the code.

### A third key that had never existed at all

Sweeping every literal `t('…')` call in the client against `ui.json` turned up one more:
**`common.cancel`**, at `index.html:7831`, written as

```js
close.title = t('common.cancel') || 'Cancel';
```

That key has never existed in any release. The `|| 'Cancel'` **looks** like a safety net and is
dead: `t()` returns the KEY when it misses, and a key is a truthy string. So the modal's close
button has been showing the literal tooltip `common.cancel` in every language. Repaired by pointing
it at `dialog.cancel`, which is the same word and is already translated into all 30 languages — no
new key, so nothing added to the translate queue.

### Why all three got through: nothing swept the surface

`complete.words_solved` was caught only because `unit-story-unlocked-card` happens to pin that one
label's English text. `form.finish_mixed` had no assertion behind it at all, and `common.cancel`
never did. **No test compared the keys the client asks for against the keys that exist.**

`test/unit-ui-key-exists.test.js` (new, registered in `run.js`) now does. It is deliberately a
SURFACE check — the absence of one is what let these through:

- every complete literal `t('a.b')` / `t("a.b")` call in `index.html` and `lesson-editor.html`
  must resolve in `ui.json` `en`. **491 keys checked.**
- `en` only. Other languages are ALLOWED to be missing keys — that is the normal state between a
  release and the offline pass, and `t()` falls back through English by design (`v71_q`: never
  assert a dropped key absent).
- concatenated keys (`t('gen.vocab_mode_' + mode)`, `t('prov.' + src)`) are out of scope by
  construction: their full spelling is not knowable from source, and matching them reports a bare
  prefix as missing.
- a non-vacuity floor on the sweep itself (`found.size > 300`), because if the call pattern ever
  stops matching — a rename, a minifier, a quoting change — the sweep would pass over an empty set.
- the dead-fallback SHAPE `t('x') || 'literal'` is banned outright. Pinned as a shape, **not** as
  `common.cancel`: pinning that key would pin the defect's own spelling and pass the moment someone
  makes the same mistake with a different one.

Revert-verified three ways, each firing its own named assertion: drop a key from `en` → the sweep
names it and the file it came from; reinstate a `|| 'fallback'` → the shape assertion; break the
`t(` call pattern → *"found 23 literal t() keys; well under the ~490 the client carries"*.

**One thing worth recording as a rule.** The first version of the repair comment read
`// v75_b: was t('common.cancel') — a key that has never existed…`, and the new sweep failed on it,
because the comment IS a matching call site. That is `roadmap_v75.md` rule 4 (*"a guard that reads
its own explanatory comment is a guard that lies"*) arriving from the other direction: here the
comment made a correct guard fail. Same underlying fact — a source-scanning guard cannot tell code
from prose about code — so **a comment near a scanned pattern must not spell the pattern**.

---

## The red baseline, part 2 — corpus drift collided two deliberate rules (`v75_c`)

`smoke-render` failed at *"a LEARNER is offered the crossword on the completion screen"*:
`comp-crossword` was `display:none`.

The first read is that the swallowing `try { … } catch(_) {}` around that whole button block had
thrown. It had not. **The product was right and the test was wrong**, in a way that needed the
running code to see:

| element | display | |
|---|---|---|
| `comp-drill` | `none` | |
| `comp-repeat` | `''` | |
| `comp-crossword` | `none` | |

Not a throw — a throw would have left all three untouched, and `comp-repeat` is rendered between
the other two. That pattern is `v74_l`'s hide-list exactly: on a genuine story unlock, for a
non-teacher, hide `comp-drill` / `comp-crossword` / `comp-back`, and keep `comp-repeat` while
coverage remains. Probed: `storyUnlocked(APP.lessonData) === true`.

**Why it became true.** The corpus moved (297 topics now; the roadmap's measurements say 298), and
the default fixture and the §3 lock fixture converged on the **same chapter** —
`tp_17857073976600000006`, "Wiener Kälte und Barcelona". The lock probe marks every lesson of its
fixture complete, keyed by **topic NAME**, and `seed()` preserves `APP.progress` rather than
resetting it. So the completion leaked forward; rendering the card marked the last remaining lesson
done; the chapter completed; `v74_l` correctly went quiet.

Repaired by clearing the leaked progress for that topic and **asserting the precondition**, so the
section cannot silently become a test of `v74_l`'s hide rule — which `unit-story-unlocked-card`
already owns — instead of the learner entry point it was written for.

**The first version of that precondition passed under its own revert.** It asserted
`storyUnlocked === false` *before* `showComplete()`. But rendering the card is what marks the lesson
done, so the state that decides `v74_l`'s branch is the state the render **leaves**, not the one it
finds — before the render the assertion was true either way, and removing the fix failed the
crossword assertion rather than the precondition. Moved to after `showComplete()`, where reverting
the fix now names the actual reason. Generalises: **when a guard asserts the precondition of a
render, assert it against the state the render produces.**

Also revert-verified against the product (`_compBtnState(_cw, …)` → unconditional hide) — fires.

---

## Sentence ordering at difficulty 1 (`v75_d`) — a reversed decision, not a fix

Roadmap §2, and the user's ruling at the `v75` cut. Dropped the `e.type !== 'order' &&` clause from
`buildStandardExercises`; **kept the `listen_type` half**, whose reasoning is separate and still
sound (a muted `listen_type` silently becomes recall-production).

**This reverses a considered decision.** `v69_session1_notes.md:141` records the user's instruction
of 2026-07-14 and the specific reasoning for `order`: *"Its shuffled word bank LOOKS like options,
but assembling a sentence is production and needs word order a beginner hasn't met."* The user has
since decided the word bank is scaffolding enough. The old reasoning is preserved in the code
comment and the test header rather than deleted, so the reversal stays legible.

Measured by a probe **calling the product builder** (`buildStandardExercises` under the product's
own `_derivingUniverse` flag) and the product's own `topicCoverage(true)`, before and after:

```
                                         before      after
chapters containing sentences               281        281
  ordering suppressed (all diff <= 1)       191        191   <- shape of the corpus, unchanged
buildable `order` questions                 675       1710   <- +1035
ITEM denominator (sum over those chapters)  8332       8332   <- unchanged

Churros und Chaos      diff=1   order 0 -> 6    items 35 -> 35
Barbera und Geschichten diff=1  order 0 -> 6    items 36 -> 36
Wiener Kälte…          diff=1   order 0 -> 3    items 13 -> 13
```

**Denominator-neutral, and only because of `v74_c`.** A sentence is already an ITEM, reachable via
`read_translate`; ordering is another way to ask about that same item. Under the old question-keyed
model this change would have raised the bar on 191 chapters as a side effect. The pass mark is
untouched.

`unit-beginner-types` rewritten rather than deleted (three assertions inverted, header rationale
rewritten to record the reversal), plus a new §2b: the beginner mix and the difficulty-2 mix built
from the same fixture must now be **identical** when audio is on, with a non-vacuity check that the
fixture really produces `order` at both difficulties so the comparison is not a no-op.

**The render path is now executed for the first time.** `smoke-render`'s renderEx section went from
5 exercise types to **6** — `order` appears — because the fixture chapter is difficulty 1 and could
never previously produce one. That coverage was incidental, so it is now pinned: if the fixture has
a standard lesson with multi-word sentences, `order` must be among the rendered types. Conditional
on the fixture's shape rather than flat, so a future corpus without multi-word sentences fails
honestly instead of spuriously.

Revert-verified: reinstating `e.type !== 'order' &&` fires the named assertion in **both**
`unit-beginner-types` and `smoke-render`.

### How to see it work in a browser

Open any beginner chapter — `Churros und Chaos` and `Barbera und Geschichten` are both
`difficulty = 1` — and play a standard lesson. Sentence-ordering questions (tap the word chips to
assemble the sentence, in the shuffled word bank) now appear in the round; before `v75_d` they never
did on these chapters. Six per chapter are buildable in the two named above. **Check RTL too** if
you have an Arabic or Hebrew chapter at difficulty 1 — `unit-order-rtl` covers the chip direction
but only headlessly.

---

## Baseline now

| command | before | after |
|---|---|---|
| `node test/run.js` | **FAILED 2 of 170** | **ALL PASSED (171)** |
| `node test/run.js --quick` | FAILED 2 of 149 | ALL PASSED (150) |
| `node test/check-inline.js` | 0 | 0 |
| `node test/check-inline.js docs/index.html` | 0 | 0 |

`APP_VERSION = 'v75_d'`. `docs/` rebuilt.

---

## MEASURED, not shipped — the Android TTS report is a real hole in `v74_j`

> *"i still get caribbean sounding english on the static site at github, and only on android"*

Not a stale cache and not a stale deploy. **`v74_j` fixed only the case where the exact locale is
PRESENT.** `languages.json` maps `en → en-GB`. When no `en-GB` voice is installed, `_ttsRankVoices`
falls through `usable → exact → quality`, no voice is exact, and **quality alone decides — so a
NETWORK voice in an arbitrary region beats the LOCAL `en-US`.** Measured by calling the product
ranker:

| simulated inventory | picked |
|---|---|
| `en-GB` present (the `v74_j` fixture) | English United Kingdom \| `en-GB` ✓ |
| same device, `en-GB` absent | **English Nigeria \| `en-NG`** |
| typical Android (no `en-GB`, many network locales) | **English India \| `en-IN`** |

This explains all three parts of the report: *still* (the fix does not reach this branch), *only
Android* (only Android ships those network locales; desktops expose two or three local English
voices), *on the static site* (the fix IS deployed — `unit-static-freshness` is green — it just does
not cover this case).

`unit-tts-voice-ranking` §5 builds exactly this inventory (`NOREGION`, no `en-GB`) but asserts only
that the app *speaks*, never **which** voice — deliberately, from `v55_x`: *"a regional accent is
not the failure `v55_x` refuses"*. That position is what the user is now disputing.

**Not shipped because the obvious fix is barred by the standing design principle.** "`en-US` is
closer to `en-GB` than `en-JM`" is a hand-authored language fact — a per-language proximity table,
wrong in ways invisible until a native speaker looks. Two signals are available that are machinery
rather than language knowledge, and the choice between them is the user's:

1. **`voice.default`** — the platform's own pick for that language. Prefer it among non-exact
   matches. Costs nothing, needs no table, but is only as good as the device's default.
2. **`navigator.language`** — prefer the region the DEVICE is set to when the requested region is
   unavailable. Also machinery, and probably the better read of "what should an Austrian learner's
   English sound like", but it makes the voice depend on phone settings.

A third option is to leave the ranking alone and **surface the choice**: roadmap §6 wants the
storyline-page TTS selector back, and `v74_j` already makes that menu preselect what would actually
be spoken. That would let the user pick `en-US` once and have `imp3_voice_en-GB` persist it.
(Note that store is written **only** on an explicit pick in the selector — it is not the cause here.)

---

## Serbian and Croatian — answering the question before doing the work

> *"do we need a scripts.json entry or does Serbian just use standard cyrillic?"*

**No — Serbian does not use "standard Cyrillic", and mapping it to the existing table would ship a
silent content error.** `scripts.json`'s `cyrillic` table is the **33-letter Russian alphabet**: it
contains `Ё Й Ы Э Щ Ъ Ь Ю Я`, none of which exist in Serbian, and it reads `Е` as *ye* (`ipa: je`),
which in Serbian is plain `/e/`. Serbian Cyrillic is 30 letters and adds `Ђ Ј Љ Њ Ћ Џ`, none of
which are in the table. A learner would be taught the Russian alphabet under a Serbian flag — and
`scripts.json`'s own header comment says every language must be mapped, so leaving `sr` out is not
an option either (an unmapped code reads as "no script").

Serbian is genuinely digraphic — Cyrillic and Latin are both official and equal — so the shape that
fits is the `ja: ["hiragana","katakana"]` array precedent: `"sr": ["cyrillic-sr", "latin"]`.
Croatian is Latin only: `"hr": "latin"`, no new table.

**Not started, because it needs a ruling and one of the options is content authoring.** The three
ways forward:

- author a `cyrillic-sr` table (30 letters + IPA) — but that is 30 rows of language content written
  by whoever is editing the code, which is what the design principle exists to prevent;
- ship `sr` as Latin-only for now and add the Cyrillic table when a native speaker or the model
  produces one — reversible, and Serbian Latin is fully standard;
- have the model generate the table under the existing prompt machinery, then QC it.

Both languages also need a `tts` code (`sr-RS`, `hr-HR`) and 29 `names` entries each, plus an
`ui.json` stub so `translate-ui.js` can fill them and they appear in the selection menus.

---

## Carried forward — do not let these drop

Everything in `roadmap_v75.md` §§3–6 is untouched, plus the three items lost once at the v71→v72
boundary and recovered in `v73_k`:

- **Global QC** checkbox menu, merged with making the book's automatic QC opt-in from the
  lesson-type menu and running it AFTER the storyboard pass. **Reverses the `v68.1` ordering.**
- **Crossword**: show the correct word's translation instead of the empty underline. **Needs a
  decision first** — `word_forms` items have no translation.
- **Live mode with teacher mode OFF must hide every editing control.** Same `_canEdit()`
  conflation as the authorization plan.

### Owed by the user

- **The pass mark** (roadmap §1) — still blocked on a browser pass, unchanged by this session.
  Note `v75_d` does **not** move it: the item denominator is unchanged (8332 → 8332).
- **The translate pass**, now for **two** keys, both new and `en`-only:
  `complete.words_solved` = *"Words you can read in this chapter"*,
  `form.finish_mixed` = *"Finish the chapter with a mixed review round (no AI)"*.
  Every other language is missing exactly these two and nothing else — verified. `t()` falls back
  through English meanwhile. **`v71_q`: never assert a dropped key absent.**
  **When the file comes back, `unit-ui-key-exists` will catch it if it predates the code again.**
- **The comprehension QC checker** — needs a new prompt and a live model.
- **A browser pass on `v75_d`** — the ordering change is a render path; see "how to see it work".

---

## New standing rules from this session

1. **A comment near a source-scanned pattern must not spell the pattern.** The repair comment for
   `common.cancel` contained a literal `t('…')` call and failed the very sweep it was documenting.
   `roadmap_v75.md` rule 4 from the other direction.
2. **When a guard asserts the precondition of a render, assert it against the state the render
   LEAVES.** A precondition checked before the render passed under its own revert, because the
   render is what changes the state the branch reads.
3. **A test that does not reset shared state is a test of whatever ran before it.** `seed()`
   preserves `APP.progress` by design, and the §3 lock probe writes completion keyed by topic NAME.
   One corpus change made two fixtures the same chapter and the leak became visible. Sections that
   depend on progress being empty must clear it and say so.
4. **Timestamps are evidence.** `ui.json` older than `index.html` was the whole diagnosis of the
   first failure, and the handover explicitly says to check them. It was worth doing first.

---

## `v75_e` — comprehension (and math) lesson edits were silently discarded

User-reported: a comprehension question was edited in `tp_579238210` (`Erdkröten` → `Laubfrosch`),
saved, and held while the editor stayed open — then vanished on the next load from the server, with
nothing in the diff but a fresh `updatedAt`.

**The server's `/api/lessons/edit` merge is a WHITELIST of content fields, and `questions` was not
on it.** The edit was accepted with **HTTP 200** and dropped. The client kept it in `APP.lessonData`,
which is why closing and reopening the editor still showed it.

The user asked whether other edit interfaces were affected. Probed by POSTing one edit per field to
the REAL endpoint for all eleven registry types and reading the STORE back — **6 of 16 lost**:

| type | fields lost |
|---|---|
| comprehension | `q`, `choices`, `correctIndex`, `why` — every editable field |
| math | `numbers`, `mathOps` — the number pool and the operator set |

Everything else round-tripped. Fixed by adding `questions` (same `mergeFlaggable` path as
`words`/`items`, so a flag or rating on a question would behave like the rest — nothing sets one
today) and `numbers`/`mathOps`.

`e2e-lesson-edit-roundtrip` (new) covers all eleven types, **and parses `LESSON_TYPE_META` out of
`index.html` to assert every registry type has a case here** — verified by adding a fake lesson type
to the registry and watching it fail. A whitelist fails silently and per-type, so the guard has to
be per-type too, and driven off the registry or it rots at the next lesson type. It also asserts a
save moves CONTENT, not just `updatedAt` — the reported symptom stated directly.

Revert-verified three ways: drop `questions` → names all four comprehension fields; drop the math
pair → names both; add a registry type → names it as uncovered.

---

## `v75_f` — a flagged merge-import destroyed a storyline's storyboard

User-reported, with `dreizunge-flagged-1785844074192.json` and its import diff. **Reproduced exactly
against the real payload**, then re-run with the fix.

`mergeFlags` is innocent — it leaves topic content alone, as designed. The damage is the step after:
`/api/lessons/import` calls `_syncStorylineForTopic` for every incoming topic, unconditionally, and
that function identified a chain **by id alone** — the id being a hash of the chapter list. A
storyline whose stored id is not that hash is not recognised as its own chain: `existing` missed,
`partialMatch` hit, `isExtension` was false (the chain had not grown), and it fell through to the
**FORK** branch, which rebuilds a storyline from six fields:

```js
upsertStoryline({ id: slId, title: chain[0], icon: '📖', chapters: chapterIds, lang, srcLang });
```

`storyboard`, `storyboardMeta`, `storyboardPanels`, `storyboardScheme`, `summary`, `summaryMeta`
and `tags` are not among them. The rebuild is `unshift`ed to the FRONT, so the dedup step then saw
two storylines with an identical chapter sequence and had to choose — and its tie-break prefers a
"curated" title, meaning one that is not just the first chapter's name. **That is a proxy for
authorship, not for content.** With both copies looking auto-titled it kept the first: the bare one.

Confirmed against the real data — the hashes match the diff exactly:

```
11-chapter chain  stored id sl_1854567313   chain hash sl_286814306   <- the id the diff created
 9-chapter chain  stored id sl_738316017    chain hash sl_1044576877
```

**BOTH chains in that export hit the defect.** Only one lost its content, and the margin is two
characters: storyline titles are truncated to 20 chars, so the 9-chapter chain is titled
`"Das kleine Ich bin i"` while its first chapter is `"Das kleine Ich bin ich"` — not equal, so the
tie-break called it curated and kept it. The 11-chapter chain is titled `"Das kleine i"`, exactly
its first chapter's name. Replaying the user's file without the fix reproduces the diff:
`sl_1854567313` → `sl_286814306`, icon `🔍` → `📖`, storyboard, summary and the
`"manually curated"` tag all gone. With the fix both storylines are untouched and the three flags
still land.

**Fixed at the identity check, not the tie-break:** a storyline covering exactly these chapters IS
this chain, whatever its id says. That prevents the duplicate from ever being created, so the dedup
never has to guess.

```js
const sameChain = s => (s.chapters||[]).length === chapterIds.length
                    && chapterIds.every((c,i) => c === s.chapters[i]);
const existing = allSl.find(s => s.id === slId) || allSl.find(sameChain);
```

`e2e-import-storyboard` (new) covers four shapes — id matching the hash, id not matching with a
curated title, id not matching with an auto-looking title, and the reported case with the real
chapter ids and titles. Each asserts the chain is still ONE storyline (a duplicate is the shape the
dedup has to guess about), that every derived field survives, that the id is unchanged (a new id
orphans every client-side reference), and that the imported flags were actually applied — otherwise
"nothing was lost" would be satisfied by "nothing happened".

### Still worth a look, not changed

The dedup's title-based tie-break is still the rule that decides which copy of a duplicated chain
survives. It is no longer reachable from this path, but it remains a content-losing decision made on
a non-content signal. If duplicates can arise another way, it should prefer the copy that HAS
derived content.

---

## `v75_g` — Serbian and Croatian, and a Serbian Cyrillic table that is not the Russian one

The question was *"do we need a scripts.json entry or does Serbian just use standard cyrillic?"*
**No.** `scripts.json`'s `cyrillic` table is the **33-letter Russian alphabet**: it contains
`Ё Й Щ Ъ Ы Ь Э Ю Я`, none of which are Serbian, and it reads `Е` as *ye* (`ipa: je`) where Serbian
has plain `/e/`. Serbian Cyrillic is 30 letters and adds `Ђ Ј Љ Њ Ћ Џ`. Mapping `sr → cyrillic`
would have taught the Russian alphabet under a Serbian flag — a content error invisible to anyone
who does not read both — and leaving `sr` unmapped was not an option either: the file's own header
says an unmapped code reads as "no script".

Authored `cyrillic-sr` (30 rows: `ch`, `lower`, `name`, `translit`, `ipa`) and mapped
`sr: ["cyrillic-sr","latin"]` — Serbian is genuinely digraphic, both scripts official and equal, so
the `ja: ["hiragana","katakana"]` array precedent fits — and `hr: "latin"`.

`translit` is **Gaj's Latin alphabet**, not a romanisation invented here: it is the co-official
Serbian script, in strict 1:1 correspondence with the Cyrillic (`lj`/`nj`/`dž` are single letters
there too). `name` is the standard Serbian letter name written in that same Latin, which also keeps
the column unique — `ће` and `че` would both romanise to "che" under a looser scheme and yield two
correct answers to one MCQ.

**Validated by machinery, not by re-reading my own table.** Unicode property checks on every row
(uppercase Cyrillic, `lower` is its exact lowercase, `translit` is Latin-only), uniqueness on all
five MCQ-keyable columns, and the set difference against the Russian table came out exactly as
predicted: **9 dropped, 6 added.** Then the PRODUCT builder was run on it —
`introScriptExercisesFrom` yields **65 exercises**.

Two gating results fall out of the data rather than needing a rule:

| | |
|---|---|
| `cyrillic-sr` teachable to a Latin reader | **true** |
| `latin` teachable to a Serbian reader | **false** — they already read it |

The second is right and free: `latin.soundsFor` does not list `cyrillic-sr`, so the existing
`scriptTeachable` gate declines it. No rule about "which languages need Latin" was added.

`languages.json`: `sr`/`hr` with `tts` `sr-RS`/`hr-HR` and **`names.en` only**. The other 28 name
translations would be hand-authored language content, and `_langName` already falls back through
`names.en` to `name`. Inserted in the file's own hand-formatted style — the first attempt
round-tripped the file through `JSON.stringify` and turned 62 lines into 1099, which was caught by
comparing against the original and redone surgically. `ui.json` gets empty `sr`/`hr` stubs so
`translate-ui.js` lists them.

### Two existing tests failed, both correctly

- **`unit-intro-script`** demanded a Unicode script property for the new table. Its message says
  *"add it when adding a table"* — the guard doing its job. Added `'cyrillic-sr': 'Cyrillic'`.
- **`unit-model-settings`** asserted that EVERY language carries the two provenance keys. That is
  the roadmap DoD §3 trap **from the other side**: the comment above that assertion already records
  that *"these keys are absent everywhere"* went stale once the translate pass ran — and *"every
  language has these keys"* goes stale the moment a language is **added**. A stubbed language is not
  a regression; it is the normal state between adding a language and running the pass. Rescoped to
  languages that have been translated at all, with a non-vacuity floor (`>= 20`) so the check cannot
  quietly pass over an empty list.

Revert-verified: pointing `sr` back at the Russian table, dropping a Serbian-only letter, and giving
`Е` the Russian `/je/` reading each fire a named assertion.

### What is still owed on Serbian/Croatian

The 28 non-English `names` entries, the `ui.json` translate pass for both languages, and a
**native-speaker check of the 30 rows** — particularly the letter names and the IPA column. The
table is mine, and the design principle exists because exactly this kind of table is wrong in ways
that stay invisible until someone who reads the language looks at it.

---

## `v75_h` — the read-out was cut off, and the two reported symptoms were one defect

> *"if solved correctly, we currently jump to the next question before the read-out is finished; and
> if the next question starts with a read-out, the read-out is cut short"*

`_speakAndAdvance` armed a **flat `setTimeout(advance, 4000)`**. A long sentence takes longer than
four seconds to speak at rate 0.9, so on exactly those items the safety net fired **mid-utterance**:
it advanced, `renderEx` auto-spoke the next question, and that path's `speechSynthesis.cancel()`
truncated the readout still in progress. **The second symptom is the first one's consequence** — the
two utterances overlapped because the first was never allowed to finish.

Three changes:

1. **The net watches PROGRESS, not the clock.** It gives up only after three consecutive idle polls
   (300 ms apart), which cannot happen while speech is running, however long the text. Three rather
   than one because the engine is briefly idle *between chunks*. An absolute cap and a start-grace
   remain, so a wedged engine still cannot strand the learner — which is what the flat timer was
   there for, and that reason was sound.
2. **`cancel()` only when something is in flight**, in all three speak paths. It was unconditional,
   and `cancel()` immediately before `speak()` truncates or drops the new utterance on several
   engines — the second half of the report, on the common path where there was nothing to cancel.
3. **The text is chunked** through the shared `_speakChunksThen`. The old code built ONE utterance
   from the whole string and ignored `_ttsChunks`, whose 200-char cap exists because browsers drop
   over-long utterances outright — the exact items this report is about.

`unit-speak-advance` (new) drives a fake engine and pins the policy, since real speech timing is a
property of the device and will never be testable here: a 6 s readout is not cut at 4 s and the
advance follows the speech; a readout that never starts still advances; no `cancel()` when idle; an
in-flight utterance **is** still cancelled; long text is chunked and the advance waits for the last
chunk; and a language with no voice stays silent but still advances. Each revert-verified.

### A source pin that pinned the defect's own spelling — twice

`unit-tts-no-approximation` went red on a change that altered no behaviour. It pinned the literal
`if (!u) {` — the *spelling* of the refusal, not the claim — and the refactor inlined that variable.

**The first replacement was worse than the original.** A loose `_ttsNoVoice … doAdvance` window
reached PAST the refusal block and matched the advance belonging to the normal spoken path, so it
**passed under its own revert** while the behavioural test correctly failed. Caught only because
both were reverted together. Now scoped to the refusal block itself — from the no-voice handler to
the `return` that ends it — with an assertion that the `return` was actually found, since without
one the slice would run to the end of the function and reproduce the same vacuity.

---

## How to see the two browser-only changes work

**`v75_h` — the read-out.** Play any lesson with a long target sentence and answer it CORRECTLY.
Before this release the card advanced after 4 seconds whatever the sentence, cutting it off; now it
waits for the readout to end, then advances after a ~120 ms pause. If the next question auto-speaks,
that readout should now play in full rather than being clipped at the start. **Test this on Android
specifically** — that is where the flat net bit hardest (more chunking, slower network voices), and
it is the device the report came from. Also worth confirming the two safety cases still behave:
a muted round advances briskly, and a language with no installed voice (e.g. Swahili) stays silent
and still moves on rather than hanging.

**`v75_g` — Serbian.** Pick Serbian as a target language and generate or open a chapter; the
"learn the script" lesson type should offer the 30-letter Serbian Cyrillic course, with answers in
Gaj's Latin (`đ ž ć č š lj nj dž`). A learner whose SOURCE language is Serbian should NOT be offered
a Latin script course — that is intended, they already read it. Croatian should offer no script
course in either direction, for the same reason.

---

## Baseline at the end of session 29

| command | at session start | now |
|---|---|---|
| `node test/run.js` | **FAILED 2 of 170** | **ALL PASSED (174)** |
| `node test/run.js --quick` | FAILED 2 of 149 | ALL PASSED (151) |
| `check-inline` (both builds) | 0 | 0 |

`APP_VERSION = 'v75_h'`. Eight releases: `v75_b` … `v75_h`. `docs/` rebuilt and verified to carry
`cyrillic-sr`, the `sr-RS`/`hr-HR` codes and the new watchdog.

## New standing rules from this session (full list)

1. **A comment near a source-scanned pattern must not spell the pattern.**
2. **When a guard asserts the precondition of a render, assert it against the state the render
   LEAVES**, not the one it finds.
3. **A test that does not reset shared state is a test of whatever ran before it.**
4. **Timestamps are evidence, and cheap.**
5. **A whitelist fails silently and per-type, so its guard must be per-type AND driven off the
   registry** — otherwise it guards only the types someone thought of.
6. **A "curated title" is a proxy for authorship, not for content.** Deciding which copy of a
   duplicated record survives by any signal other than its content will eventually delete content.
7. **"Every language has key X" goes stale when a LANGUAGE is added**, exactly as "key X is absent
   everywhere" goes stale when the translate pass runs. Scope such claims to the languages that
   have been translated, and floor them for non-vacuity.
8. **Replacing a brittle source pin is itself a change that needs revert-verifying.** The first
   replacement here was vacuous in a new way, and only the paired behavioural test exposed it.
