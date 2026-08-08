# Session 30 — `v76_c` → `v76_f`

Opened from the session prompt for the progress-card rework, but the rework was not started: the
baseline was RED, and **one of the two failing checks was the user's reported bug**. Three releases:
`v76_d` (test repairs, no product change), `v76_e` (the storyline bug), `v76_f` (`--langnames`).

---

## The baseline number in the prompt was stale — and that is worth stating first

The prompt said to expect **170** checks and to treat any other number as a finding. The tree gives
**176**, which is what `HANDOVER.md` and `roadmap_v76.md` both record. 170/149 are the numbers
session 29 *opened* on, before it added six checks across `v75_b`…`v76_c`. So the prompt's figures
were stale, not the tree. Nothing was diagnosed further on this.

**Baseline as found: FAILED 2 of 176.** Neither was a stale fixture in the sense of "delete and move
on", and neither was a product defect — both were tests that had encoded the *shape of the corpus*
rather than the claim they meant to make. The corpus had moved (`lessons.json` Aug 8 06:44 against
`index.html` 06:31 — timestamps again, session-29 rule 4).

---

## `v76_d` — two tests that pinned the fixture instead of the claim

### `unit-coverage-threshold`

```
+ actual   - expected
+ 'Eisiger Belgrad: Von der Freude zur Flu…'
- 'Eisiger Belgrad: Von der Freude zur Flucht'
```

The card truncates a long progress-bar row label — `index.html` ~15413, `>40 → slice(0,39)+'…'` —
and the corpus now supplies a **42-character** lesson title. The assertion compared against the raw
title.

The telling detail: the **chapter-row** assertion twenty lines above already models exactly this,
at its own 34-char cap. The gate row simply never had a title long enough to need it. Repaired to
accept either form, in the same idiom, plus a non-vacuity floor that the lesson has a title at all
(otherwise an empty title would satisfy it trivially).

### `unit-live-static-progress-parity`

```
only the full story stays locked — later chapters open once chapter 1 is complete (found 5 locks)
```

This asserted **`total 🔒 === 1`**, which silently encoded the shape of a *two-chapter* storyline:
chapter 2 open, full-story row locked. The chain the selector matches is now **six** chapters.

Rather than adjust the number, the locks were attributed by markup signature — the chapter-card
overlay (`index.html` ~7490) and the full-story row (~7608) are different elements — and then per
card, by parsing the locked/unlocked wrapper in render order:

```
chapter-card lock overlays : 4        card 1: locked=false  Frozen Belgrade Derby
full-story row lock        : 1        card 2: locked=false  Belgrade Winter Roar
                                      card 3: locked=true   Marakana's Cold Wind
                                      card 4: locked=true   Shadows of Belgrade
                                      card 5: locked=true   Flucht vor dem Krieg nach Wien
                                      card 6: locked=true   Жива ЕКС ЈУ заједница у Бечу
```

**The product was right.** Chapter 2 opens — which is the `v74_i`/`v74_k` claim the section exists
for — and chapters 3–6 are locked because *their own* predecessors are unplayed. Five is the correct
count for a six-chapter chain.

Rewritten to assert the claim (`cards[1].locked === false`) with a non-vacuity check evaluated on the
data the assertion actually runs against (session-28 rule 3): if the chain is longer than two,
`cards[2]` must still be locked, or nothing is locking anything and the check above passes for the
wrong reason. Revert-verified: restoring the raw `every(done-flag)` rule fires
*"the chapter AFTER a completed one opens…"*.

**No version bump and no `docs/` rebuild for `v76_d`** — it changes only test files, so no shipped
artifact moved. `unit-static-freshness` stayed green through it, which is the check that would have
caught the opposite.

---

## `v76_e` — the reported storyline bug, root-caused from the failing test

> *"I made a new story line(s) (c1935658823) that includes mixed language combinations. when i
> restarted the server, the lessons in a different language didn't show up anymore and the view of
> the story on the main page has lost its storyboard. However, the full storyline still seems to
> exist as sl_9302163 but is not shown on the main page."*

The parity test above selects "the first storyline in the corpus whose first chapter the two
completeness rules judge differently". That selector now lands on **`sl_9302163` — the user's
storyline**. Its six chapters span three language pairs:

```
tp_…087  sr<-en  Frozen Belgrade Derby
tp_…190  sr<-en  Belgrade Winter Roar
tp_…023  sr<-en  Marakana's Cold Wind
tp_…192  sr<-en  Shadows of Belgrade
tp_…064  sr<-de  Flucht vor dem Krieg nach Wien
tp_…186  hr<-sr  Жива ЕКС ЈУ заједница у Бечу
```

### One cause, three symptoms

`loadSavedList` built its chain index from the **filtered** topic list and projected every chain
through it:

```js
const byId = Object.fromEntries(filtered.filter(l=>l.id).map(l => [l.id, l]));
storylines = v29chains.map(sl => (sl.chapters||[]).filter(cid => byId[cid]));
```

So a chain whose chapters are not all in one language pair came out **truncated**.
`storylines_renderChain` then tries to recover the storyline by an exact, full-length, **positional**
match:

```js
const matchSl = slArr2.find(sl =>
  (sl.chapters||[]).length === chain.length &&
  (sl.chapters||[]).every((c,i) => c === chain[i])) || null;
const chainId = matchSl?.id || ('c' + hash(chainTopicsJson));   // <- the fallback
```

A truncated chain can never satisfy that, so `matchSl` is `null`, `slMeta` is `null`, and the card
renders under a synthetic legacy `'c'+hash` id with **no storyline object behind it** — no title, no
icon, no storyboard, no summary, and a chapter count and deck payload short by the hidden chapters.

### Confirmed against the user's own identifier

Enumerating every filter pair against the real store, and computing the client's own legacy hash:

```
lf=all  sf=all   chapters=6/6  match=true   id=sl_9302163
lf=all  sf=en    chapters=4/6  match=false  id=c1754087105
lf=sr   sf=en    chapters=4/6  match=false  id=c1754087105
lf=sr   sf=all   chapters=5/6  match=false  id=c1935658823   <<<< exactly as reported
lf=hr   sf=all   chapters=1/6  match=false  id=c318315491
```

Target filter on Serbian, source filter on **All**: the Croatian chapter is dropped, five of six
survive, and the card is keyed **`c1935658823`**. That is the id in the report, derived rather than
guessed, which settles the diagnosis.

The server restart was incidental. What actually changed was adding chapters in a second and third
language pair; before that every chapter was `sr<-en`, the filter kept them all, and the exact match
succeeded. **The store was never damaged** — `sl_9302163` still holds all six chapters, its
storyboard, its summary and its 🏟️ icon.

This is the same class as `v75_f`: **identity recovered from a hash of a projection instead of being
carried.** There it was a storyline rebuilt because its stored id was not the hash of its chapters;
here it is a storyline unrecognised because its chapter list was projected before it was matched.

### The fix, and the product judgement inside it

**A storyline is one unit: the language filter decides WHETHER it is shown, never WHICH of its
chapters are.**

```js
const byIdAll = Object.fromEntries(saved.filter(l=>l.id).map(l => [l.id, l]));
storylines = v29chains
  .filter(sl => (sl.chapters||[]).some(cid => byId[cid]))   // shown if ANY chapter matches
  .map(sl => (sl.chapters||[]).filter(cid => byIdAll[cid])) // …but the chain stays WHOLE
  .filter(c => c.length >= 1);
```

`matchSl` then succeeds by construction, so the identity bug disappears rather than being patched.
Eight chain-scoped lookups moved from `byId` to `byIdAll` (`newestOf`, `srcOf`, the source-language
grouping header, `chainTopics`, both language-pair badges, the two QC-flag reducers, and the summary
body's `data-lang`) — a chain may legitimately contain a chapter the current filter hides, and
`byId` would read it as missing. `inChain` uses the whole chain too, or a hidden chapter would
reappear under "Individual lessons".

**The judgement the user should confirm:** filtering the library to Serbian now shows this story
*including* its Croatian chapter. The alternative — fix identity only, keep truncating — restores
the storyboard but leaves *"the lessons in a different language didn't show up"* unfixed, and still
hands `openStorylineScreen` a chain missing chapters. A partial chain also misnumbers the story
("5 chapters") and silently drops chapters from the export and QC actions, so truncation is not a
neutral display choice.

### Measured, through the product renderer

`build_history/probe_landing_v76e.js` drives the real `loadSavedList` against the real corpus
(preserved — re-run and diff after any change to the landing page):

```
                            real id card   storyboard   chapters shown   synthetic c-ids
BEFORE  lf=sr  sf=all           false         false            ?          slgroup-c1935658823
BEFORE  lf=all sf=en            false         false            ?          slgroup-c1754087105
BEFORE  lf=hr  sf=all           false         false            ?          slgroup-c318315491
BEFORE  lf=all sf=all           true          true             6          none
AFTER   (all four)              true          true             6          none
```

### The guard

`test/unit-storyline-lang-filter.test.js` (new, registered). Hand-built fixture — the corpus is not
a constant and this needs exact counts — shaped like the reported chain: four chapters across three
language pairs, plus one topic belonging to no storyline.

Four filter states, each hiding at least one chapter; for each, the card must carry the **real** id,
the storyboard, the summary, the title, the icon, and a chapter count of 4, with no `'c'+hash` id
anywhere on the page. Then: no chapter of the chain is *also* offered as a loose lesson, and — the
other direction — a storyline with **no** matching chapter is still not shown, so the fix cannot be
satisfied by "show everything".

Revert-verified both halves separately, each firing a named assertion: resolving the chain through
`byId` again fires *"the storyline is rendered under its REAL id…"*, and dropping the visibility
filter fires *"a storyline with no chapter in the filtered language is NOT shown…"*.

**One vacuous guard was caught and fixed during that verification.** The "filter still filters"
section originally used a filter that matched *nothing*, and `loadSavedList` **returns early on an
empty list** — so it passed without ever reaching the storyline branch, and stayed green under its
own revert. It now carries an unrelated topic in the filtered language, and asserts that topic is
rendered, so the early return cannot be what makes it pass.

---

## `v76_f` — `--langnames` wrote only at the end

> *"the entries seem to not be stored until finished. Please store while we are going."*

Exactly right, and visible in the code: `runLangNames` accumulated every language in memory and
called `writeFileSync` **once, after the loop**. Any interruption — Ctrl-C, a backend timeout, a
crash thirty languages in — discarded everything the run had already paid for.

**The same file already does it properly.** `translateLang`, the `ui.json` path, ends each batch
with:

```js
// Save after each batch so progress isn't lost on interruption
fs.writeFileSync(UI_FILE, JSON.stringify(ui, null, 2), 'utf8');
```

`--langnames` simply never copied it. That is **standing rule 10 (*do not invent an interface you
can read*) a second time in the same function** — `v76_c` was the positional-`callLLM` half of it.

Fixed by extracting `_flushLangs()` (serialize in the file's hand-written shape, `JSON.parse` the
result, refuse to write anything that will not re-parse — unchanged behaviour, now reusable) and
calling it after every language batch that produced anything, reporting `· 💾 saved` per batch. A
write failure is reported and does not abort the remaining languages.

### The guard

`unit-langnames` §3 (new). Standing rule 11 — *a path exercised only in its `--check` mode is
untested* — is the reason `--langnames` shipped broken in the first place, so this section runs the
**real** mode: a stub answers the first batch and then `process.exit(9)` on the second, which skips
any after-the-loop write by construction. It asserts the run really was interrupted (exit code 9,
more than one batch attempted — non-vacuity, or it would be testing the end-of-run write it
replaces), that names earned before the interruption are on disk, and that the partially-written
file kept everything outside `names`.

Revert-verified: restoring the single end-of-run write fires *"the names earned BEFORE the
interruption are on disk…"*.

---

## Baseline now

| command | at session start | now |
|---|---|---|
| `node test/run.js` | **FAILED 2 of 176** | **ALL PASSED (177)** |
| `node test/run.js --quick` | FAILED 2 of 153 | **ALL PASSED (154)** |
| `node test/check-inline.js` | 0 | 0 |
| `node test/check-inline.js docs/index.html` | 0 | 0 |

`APP_VERSION = 'v76_f'`. `docs/` rebuilt (`unit-static-freshness` fired correctly after the
`index.html` change — the `v73_b` guard doing its job).

---

## How to see the two changes work

**`v76_e` — the storyline.** On the main page, set the library's **target** language filter to
Serbian and leave the **source** filter on All (the state the report came from). "Shadows of
Marakana" should now appear with its 🏟️ icon, its title, its storyboard strip and its summary, and
should read **6 chapters** — including the Croatian one. Opening it should show all six chapters on
the storyline screen, and the 🔗 share link should carry `sl_9302163`, not a `c…` id. Try the source
filter on English too: same card. Then set the target filter to a language the story does not use
(Japanese, say) — the card must **disappear**, not appear empty; that is the half of the fix that
keeps the filter meaningful.

**`v76_f` — `--langnames`.** Run
`OLLAMA_MODEL=translategemma:12b node translate-ui.js --langnames` and interrupt it with Ctrl-C
after two or three languages have reported. `languages.json` should already contain those names;
re-running continues from there rather than starting over. Each completed language now prints
`· 💾 saved`. `--langnames --check` still reports the gap without calling the model — currently
**151 cells** across `sr`, `hr` and the pre-existing `lb` column.

---

## Residual, not fixed — a legacy link can still miss

`_tryOpenStorylineByChainId` falls back, when no `sl_` id matches, to rebuilding chains from
`continuedFrom` links through `makeParentResolver`, which is **same-language guarded**
(`index.html:1429` returns `null` when `lang` or `srcLang` differ). A mixed-language chain cannot be
rebuilt that way, so an **old bookmark or shared link carrying one of the synthetic ids above**
(`#sl=c1935658823`) lands back on the landing page rather than opening the story.

Not fixed, deliberately: the v29 `storylines[]` path is what the app uses, no new `c…` ids are
produced after `v76_e`, and widening the parent resolver is a change to chain *construction* that
deserves its own release and its own measurement. Recorded because the same-language guard is a
latent hazard for every mixed-language storyline on the legacy and rebuild paths, and because the
next person to touch chain building should know it is there.

---

## One unreproduced flake, recorded rather than buried

During the final verification pass, one `--quick` run reported
`FAILED 1 of 154: unit: story-unlocked card — label, prose story, Next-only (v74_l)`.
It has not reproduced since: **21 subsequent clean runs** (3 full `--quick` suites and 18 direct
invocations), all green.

What can be said about it:

- **It is not concurrency.** `test/run.js` uses `spawnSync` — every test is a separate process, run
  sequentially — and `--quick` differs from a full run only in skipping the e2e block.
- **It is almost certainly not this session's changes.** `unit-story-unlocked-card` contains zero
  references to `loadSavedList`, `byIdAll` or `storylines_renderChain`, which is the entire surface
  `v76_e` touched; `v76_f` is confined to `translate-ui.js`.
- The failing assertion was not captured before the run was repeated, which was a mistake — the
  summary line names the file but not the check.

Left as an open observation, not a diagnosis. If it recurs, capture the assertion text *first*: the
file exercises the round builder, and `build()` **samples** (INTERNALS, "silent failure modes"), so
a sampling-dependent assertion is the first thing to suspect.

---

## `v76_g` — new data files, and stamping the Serbian script

The user supplied fresh `lessons.json`, `ui.json` and `learners.json` and asked for the existing
content to be stamped with its script.

**Data validated before use, per the protocol.** `ui.json`: 0 `en` keys vanished, 0 added, **0
values changed**, and 9 languages (`hi uk cs vi id ro th lb sw`) gained the two keys that were owed
— a partial translate pass ran. Still outstanding: `complete.words_solved` and `form.finish_mixed`
in 8 languages, and `sr`/`hr` remain at **0 of 598 keys**. `lessons.json`: same 303 topics and 84
storylines; exactly 5 topics changed, all of them Serbian chapters of `sl_9302163`. Suite green on
the new files after `build-static.js` (`unit-static-freshness` fired correctly).

### A correction to this session's earlier finding

Earlier in the session I reported that the `hr<-sr` chapter was **internally inconsistent** —
"Cyrillic title and vocabulary, Latin story". **That was wrong**, and the mistake is worth recording
because it is rule 2 from the other direction: I compared fields without checking which LANGUAGE
each one holds. Stories are in the TARGET language and topic titles are in the SOURCE language, so:

| chapter | story (target) | target vocab | source vocab | title (source) |
|---|---|---|---|---|
| `hr<-sr` | LAT — Croatian ✓ | LAT | **CYR** — Serbian | CYR ✓ |
| `sr<-de`, `sr<-en` ×4 | LAT | LAT | LAT | LAT |

Every chapter is internally **consistent**. The true picture is simpler and still motivates the
feature: Serbian-as-target came out Latin, Serbian-as-source came out Cyrillic, because nothing ever
told the model which script to use — `langName()` (`server.js:965`) returns the bare string
`"Serbian"` and that is the only thing any generator is told about the target language.

### The gate is NOT "more than one script"

The rule proposed earlier in this session — show a script picker when
`scriptsForLang(x).length > 1` — **is wrong**, and the corpus proves it. That condition is equally
true of Japanese, whose `_langScript` entry is `["hiragana","katakana"]` — but Japanese mixes those
two *inside one sentence*. There is no choice to make.

Measured over the corpus, target-language text per topic:

```
sr : 0 of 5  texts contain both scripts   -> ALTERNATIVE (a choice exists)
ja : 9 of 13 texts contain both scripts   -> CONCURRENT  (no choice exists)
```

So `scripts.json` now declares **`_scriptChoice: ["sr"]`** with a comment stating exactly this
distinction. It sits in `scripts.json` because that file already owns the fact that Serbian is
digraphic, and because a tier-3 data file is required to declare its own limits (its `_comment` and
`_stub_comment` are the precedent).

**The declaration is tier 3; the check on it is tier 2.** `unit-script-choice` §2 verifies the list
against the corpus in both directions — a declared language whose scripts co-occur fails, and a
multi-script language that is *not* declared but whose scripts partition also fails. So a wrong
entry fails loudly instead of silently offering a meaningless picker.

### The stamp

`backfill-script.js` (new, following the existing `backfill-provenance.js` / `backfill-createdby.js`
precedent) detects the script actually used and writes `script` (target side) / `srcScript` (source
side). Detection is Unicode only (`\p{Script=…}`); no language table is consulted or written. It
reports by default and needs `--write`, keeps a `.bak`, refuses to write a file that will not
re-parse, and **reports a tie rather than guessing** — a genuinely mixed passage is a finding, not a
default.

```
topics scanned: 303; language sides with a script choice: 6
  + tp_…186  sr (source)  -> cyrillic-sr   cyrillic-sr=217 latin=0
  + tp_…064  sr (target)  -> latin         latin=609 cyrillic-sr=0
  + tp_…192 / …023 / …190 / …087  sr (target) -> latin
to stamp: 6   already correct: 0   ambiguous: 0
```

All six unambiguous; none mixed. Re-running reports `to stamp: 0, already correct: 6` — idempotent.

`unit-script-choice` §4 runs the **real tool** in report mode rather than re-deriving detection
(`v71_u`: a test that re-implements the code it tests cannot fail when that code is wrong). Like
`unit-static-freshness`, **a failure here is the guard working**: a newly generated Serbian chapter
arrives unstamped and the assertion names the fix: `node backfill-script.js --write`.

Revert-verified: adding `ja` to `_scriptChoice` fires *"ja is declared as an ALTERNATIVE-script
language… but 9 of 13 texts contain both"*; removing one stamp fires *"every topic in a
script-choice language is stamped — 1 are not."*

### What this does NOT do

**Nothing reads `script` yet.** This is the migration step only. Still to build, and still needing
the user's ruling on the default: script-aware `langName()` + a prompt rule, the two selectors, and
a QC consistency check. The field exists and the corpus is stamped, so none of that has to guess at
history when it lands.

---

## `v76_h` / `v76_i` — telling the model the script, and letting the user choose it

The user's ruling at `v76_g`: **`script` field, per-chapter override, inheriting from the
storyline's previous chapter, with an explicit pick only for a brand-new story.**

### `v76_h` — the server half

`langName()` is the choke point: **every** prompt fills `{L}`/`{S}` from it, so decorating there
reaches the story generator, the lesson extractor and everything downstream without threading a
parameter through 56 call sites.

```
before:  "You are a creative writer and Serbian language teacher…"
after:   "You are a creative writer and Serbian (written in Cyrillic script) language teacher…"
         "You are a Serbian (written in Cyrillic script) language lesson extractor…"
```

Naming it is not sufficient on its own — the model still drifts between scripts inside one text — so
`prompts.json` gained **one** key, `story.scriptNote`, appended only when the language really has a
choice. (`prompts.json` was re-emitted at 178 lines with **0 pre-existing values changed**; the
first attempt also added a stray empty `lesson` key, caught by diffing against the previous copy.)

`script` / `srcScript` are accepted at `/api/generate`, **validated against `scripts.json` rather
than trusted** (`_validScript`) — the value goes into a prompt, so an undeclared one must never
reach it verbatim — threaded through `chainOpts` / `lessonOpts` / `sharedGenOpts`, and persisted on
the topic so the next chapter has something to inherit.

### Two mistakes, both caught by existing guards

1. **A `ReferenceError` inside a swallowing `catch`.** `sysErrorHunt(lang, difficulty, opts.script)`
   was added inside `generateErrorHunt`, which has **no `opts` in scope**. The throw was swallowed
   and every error-hunt lesson was silently dropped. `e2e-book-formats` caught it deterministically,
   and the pristine tree was checked before assuming the cause. This is the concrete form of the
   §0b concern about swallowed throws — the suite caught it only because a test asserted the
   RESULT (a chapter carries an error hunt), not the call.
2. **A vacuous line.** The first repair passed `c.chainOpts` in the arc registry; there is no such
   field — the real one is `sharedGenOpts` — so it was always `null`.
   `unit-add-lesson-registry` pins the exact argument shape and caught the change; the fix was to
   pass the real object rather than to pin the broken shape.

### A harness limit that made a guard vacuous

`fake-ollama` logged `sys.slice(0, 400)`. Every note appended AFTER a prompt's `system` block — the
script rule, the dialect note, the writing-style note, the continuation note — falls past that cut,
so **any test asserting on a prompt's TAIL through `readChatLog()` was checking the truncation, not
the prompt.** Widened to 8000. Recorded in `INTERNALS` → harness limits.

Also: booting a **second** live environment while the first is running returned an empty chat log.
The e2e now uses one environment and slices the log from a mark taken before each run.

### `v76_i` — the client half

Two pickers, rendered into `#script-wrap` (under 📖 "I learn") and `#src-script-wrap` (under 🗣 "I
speak"), **only** when `scripts.json` `_scriptChoice` lists that language. They are labelled
`Cyrillic` / `Latin` for a reader, not by the internal table name `cyrillic-sr`.

Because `continueFromLesson` already prefills the landing form (it does not open a separate dialog),
**"add chapter" and "new story" share one control** and the per-chapter override falls out for free.
Inheritance reads the `continue-select` — the parent chapter — so continuing a Cyrillic chapter
preselects Cyrillic, continuing a Latin one preselects Latin, and a brand-new story preselects
nothing. Changing either language clears a script chosen for the previous one.

`unit-script-picker` drives the real render. Its section 2 is the one that matters: **Japanese must
get NO picker**, because it lists two scripts and mixes them. Revert-verified — swapping the gate to
`scriptsForLang(x).length > 1` fires *"Japanese lists two scripts but MIXES them — offering a
hiragana/katakana choice is meaningless"*, and dropping the inheritance fires its own assertion.
`e2e-script-choice` revert-verifies the server half three ways (langName ignoring the script,
dropping the validator, dropping the field from the returned record).

### i18n

**One new key, `en` only: `form.script_pick` = "Script…"**. Add to the translate queue.

### How to see it work

Pick Serbian as the target language on the landing page: a small **Script…** menu appears under
"I learn", offering Cyrillic and Latin. It is absent for every other language — check Japanese
specifically, which has two scripts but no choice. Generate a chapter in Cyrillic; then open that
storyline and press ↪ (continue): the form should come back with **Cyrillic already selected**.
Switch it to Latin for that chapter only — the storyline now runs Latin chapters after Cyrillic
ones, which is the "train words in Latin, then Cyrillic in parallel" case. A chapter whose SOURCE is
Serbian (an `hr←sr` chapter) gets the picker under "I speak" instead.

---

## Still owed by the user (unchanged from the v76_c handover, plus one)

- **The three rulings blocking the progress-card rework** (`roadmap_v76.md` §0a) — none were
  answered this session, and §0c should not start before they are.
- **A browser pass**, now including `v76_e` (see "how to see it work").
- **Confirm the `v76_e` product judgement**: a storyline shown whole across the language filter.
- The Android English voice, the pass mark, the `sr`/`hr` `ui.json` pass and the 28 non-English
  `names` entries, the native-speaker check of the `cyrillic-sr` table, the comprehension QC
  checker, and the translate pass for `complete.words_solved` / `form.finish_mixed`.

**No new `ui.json` keys this session** — nothing to add to the translate queue.

---

## New standing rules from this session

12. **A test that hard-codes a COUNT of a repeated element is pinning the fixture, not the claim.**
    `total 🔒 === 1` meant "a two-chapter storyline"; it broke on a six-chapter one while the
    product was correct. Count by element *kind*, or assert the specific element the claim is about.
13. **A guard whose scenario matches nothing may never reach the branch it tests.** `loadSavedList`
    returns early on an empty filtered list, so a "this must not be shown" check written with a
    filter that matches nothing passed under its own revert. A negative assertion needs a positive
    one beside it proving the render got that far.
