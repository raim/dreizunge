# Session 32 — opened at the `v78` cut, shipped `v78_b`

Short session. Most of it went into the baseline, which was red for a reason worth writing down,
and the rest into one group-B item plus one guard that replaces a note that had failed four times.

**Closing state:** `APP_VERSION = 'v78_b'`, suite **194** (`--quick` **170**), `check-inline` 0 on
both builds, `docs/` rebuilt.

---

## 1. The red baseline was a finding, not a chore

`node test/run.js` opened at **192 checks, 2 failed** — `unit-static-freshness` and
`unit-script-choice`. Both are the guards the prompt and HANDOVER tell you to clear with a one-line
fixer. I nearly did that. The reason not to: **HANDOVER records both as already cleared AT the v78
cut**, so a fresh red is either a second data drop or something else, and the fixers are not
diagnostics.

What the evidence said, in the order it arrived:

- **Corpus size had NOT moved.** 308 topics / 86 storylines — exactly the numbers HANDOVER records
  for the cut. So "a new data drop arrived" was already doubtful.
- **`lessons.json` was the OLDEST file in the tree** (17:19; everything else 17:23). A file that had
  just been rewritten by `backfill-script.js --write` would be the newest. (Session-29 rule 4:
  timestamps are evidence, and cheap. They were the whole first half of this diagnosis.)
- `unit-static-freshness` named exactly one stale input: `lessons.json`, docs built from
  `919bcac2cbcb`, on disk `dfa8a16082be`.

**First hypothesis, and it was WRONG.** I guessed the shipped `lessons.json` was simply the
*pre-backfill* copy — that packaging had picked up the file from before the cut's stamping run, and
that everything else in the tree was post-backfill. That predicts a specific, checkable thing: run
the backfill and the hash should come out at `919bcac2cbcb`. It came out at `d3c6c01027d7`. So
`docs/` was built from a corpus that is neither the shipped file nor the shipped file plus stamps.

Worth stating plainly because the hypothesis was *plausible and cheap to check, and checking it is
the only reason the real answer got found*. Had I run both fixers on the strength of it, the tests
would have gone green and the actual difference would never have surfaced.

**What was actually different.** I extracted the corpus baked into `docs/index.html` (bracket-matched
out of `const STATIC_LESSONS = …`) and diffed it topic by topic against disk:

| | |
|---|---|
| topics in both | 308, same ids, none added or removed |
| topics differing | **9** |
| 7 of them | disk has an **`ai_error_hunt` lesson** the baked copy lacks |
| 2 of them | an edited `synonyms` / `word_forms` lesson, `updatedAt` **~80 minutes newer** on disk |
| present only in `docs/` | nothing except the older copies of those two edited lessons |

So the shipped `lessons.json` is the user's **newer working file**, and `docs/` was a corpus behind
it. The `ai_error_hunt` lessons come from the story-QC acceptance path (`/api/story-qc/accept`),
which mutates the topic in place and calls `saveStore` — consistent with the user having run story
QC after the cut's build.

**Two consequences that matter more than the fix:**

1. **Order matters, and the obvious order is wrong.** Running `build-static.js` first — the fixer the
   freshness failure literally asks for — would have baked the UNSTAMPED corpus into `docs/` and
   overwritten the only remaining copy of the pre-drop baked state. Backfill first, rebuild second.
   Nothing in HANDOVER says this, because HANDOVER lists the two guards independently.
2. **The freshness guard did exactly the job it was written for.** `unit-static-freshness`'s header
   comment describes the failure as "a static build on GitHub Pages quietly serving an older corpus
   than the live server, which nobody sees until a chapter is missing." That is precisely what was
   in the tree: seven topics whose error-hunt lesson existed live and not on Pages.

**Verified before rebuilding** that nothing existed only in the baked copy, so the rebuild could not
lose user content. Baseline then confirmed at the documented **192 / 168 / 0 / 0**.

### Rule earned (23)

**A fixer is not a diagnosis, and two guards firing together may be one cause seen twice.** When a
guard's remedy is a single documented command, running it destroys the evidence that would have
said whether the remedy was right. Check what MOVED first — here, three cheap facts (corpus counts,
mtimes, the named hash) narrowed it before any file was written. Corollary, learned the hard way in
the same hour: **when the remedies interact, the order is part of the diagnosis.**

---

## 2. `v78_b` — synonym/antonym questions state how many words to find

User testing note, group B: *"Synonym/antonym questions should state how many are to be found
('<n> similar to <word>')."*

`syn_select` is **the only multi-select exercise in the app**. Every other type is answered by one
tap or one typed string, so "have I finished answering?" never arises. Here it does, and there was
no signal: a learner who had tapped one of three correct words had nothing telling them two
remained, and Check scored the round. The question was testing a guess about the QUESTION rather
than about the vocabulary.

The prompt now reads **"3 similar to Haus"**. The count is `ex.correct.length` — the same array
`check()` scores against (`ex.correct.some(...)`) — so the number displayed and the number required
cannot drift apart. `unit-syn-count` §3 asserts that join by rendering and scoring the same object.

**A NEW key, not a reworded one.** `ex.syn.q_synonyms_n` / `ex.syn.q_antonyms_n` sit beside the
existing uncounted keys rather than replacing their English values. `translate-ui.js` fills keys
that are **missing**, not keys whose English value **changed** (session protocol, DoD item 3), so
editing the old values in place would have left the other 31 languages rendering the uncounted
prompt indefinitely, with nothing flagging it. The uncounted keys stay live as the fallback below.

**Fallback, and why it is not defensive clutter.** The builder guarantees a non-empty `correct`
(`if(!correct.length) return null`), but `tSynSelect` is also reachable from edited and imported
lesson data where it is not. A zero or missing count falls back to the uncounted key rather than
rendering "0 similar to" or "undefined similar to". §4 is the section that catches this, and it is
the section that caught a real mistake under revert (below).

### Revert-verification — and the part that needed a second pass

Reverting the render fails §1 as a named assertion carrying the actual markup, not a `TypeError`.

But §1 aborting the file means **§2–§6 were never executed** under that revert (v71_r: "a failure
appearing after you fix another one may not be new — it may be running for the first time", from the
other direction). So each later section was verified separately against a revert it alone could see:

- **§6 (`docs/`)** — restored `index.html`, left `docs/` built from the reverted client. §1–§5 pass,
  §6 fails naming `node build-static.js`. Discriminates.
- **§4 (fallback)** — first weakening I tried (`(ex.correct||[]).length` instead of
  `Array.isArray(...)`) is **behaviourally equivalent**, and the section correctly still passed;
  that is not a vacuous pass, it is a non-difference. The real failure mode is using the `_n` key
  unconditionally, which renders "0 similar to" — §4 fails on exactly that, with §1–§3 still green.

Recording the equivalent-weakening attempt because "I reverted something and the test still passed"
reads as a failed guard and here it was the guard being right.

**How to see it work** (browser): open any storyline chapter with a `synonyms` lesson — e.g. the
`synonyms` lesson on *Das Ich trifft das i=√(-1)* (`tp_579238210`) — and play to a synonym or
antonym question. The green/red prompt line above the tiles now begins with a number: *"2 similar
to …"*. Tapping fewer than that many and pressing Check still scores as wrong, as before; the
change is that the learner can now see how many the round is asking for. Tile count is unchanged,
so the number narrows the question without answering it.

---

## 3. A note NOT acted on — it presupposes a feature that does not exist

Group B: *"Sentence-translation read-out should include the `\"Übersetze: \"` prefix (tp_579238210) —
read the whole question in the source language."*

`Übersetze: "{sentence}"` is `ex.order.q`, the **word-order** exercise: the question is the source
sentence and the learner orders target-language tokens. Everything in that question is in the
source language, which fits "read the whole question in the source language" exactly.

**But there is no read-out of it.** Enumerated every `speak()` / `speakLang()` / `speakBodyText()`
call site in the client: `renderEx` auto-speaks only for `listen_mcq` and `listen_type`, and speaks
`ex.target`. `tOrder` renders no speaker control at all, and no question-level read-out exists for
any exercise except `tRead`'s 🔊 (which speaks the target sentence, not the question).

So the note is either **(a)** a request to ADD a question read-out to the order exercise, in the
source language, including the prefix — a new affordance, not a prefix fix — or **(b)** about a
different screen than the one I found. Group B triage read it as a small fix to an existing
read-out; on the code that reading does not hold.

**Owed by the user: which of the two.** Guessing here would have built an affordance nobody asked
for, on the reasoning that the note implies one. Left untouched.

---

## 4. The protocol's version sentence — a note replaced by a guard

The session-protocol block carries one version-specific sentence naming the release line it belongs
to. `roadmap_v78.md` said **"This is the `v77` line"**, and the very next line said "this file stays
current through the whole **v77** line".

The roadmap's own parenthetical documents this having happened at `roadmap_v73.md` ("the v72 line")
and `roadmap_v76.md` ("the v75 line", for its entire run). Each correction ended with a note asking
the next session to check it again. **It was missed again at the v78 cut, in both sentences** —
the fourth failure, and the second sentence had survived every previous correction because each one
only fixed the first.

Corrected, and then replaced as a mechanism: **`unit-roadmap-version`** asserts that the
highest-numbered `roadmap_v*.md` names the same base version as `server.js`'s `APP_VERSION`, in
every sentence that names one. Both sentences revert-verified separately against the exact
historical mistakes (`v77` in sentence 1; `v77` in sentence 2), each failing while the other passes.

The roadmap finds itself by NUMBER rather than by name, so the guard survives the next cut without
being edited. It also fails usefully at a base bump — a new base version with no matching roadmap
is protocol item 7 not yet done, and it says so.

### Rule earned (24)

**A note instructing the next session to check something is not a guard.** Four repeats of the same
stale line, each ending in a fresh reminder, is enough evidence that the reminder was never the
mechanism. If a fact can be derived from a source of truth, assert it; the reminder is what you
write when you have decided not to.

---

## 5. New `en`-only keys — OWED to the translate pass

| key | English |
|---|---|
| `ex.syn.q_synonyms_n` | `{n} similar to {word}` |
| `ex.syn.q_antonyms_n` | `{n} opposite to {word}` |

Both carry two placeholders (`{n}` and `{word}`); a translation that drops `{n}` silently loses the
whole feature for that language, so it is worth a glance when the file comes back.

`unit-syn-count` §5 asserts they are en-only. **Per the protocol, that half of the section is
correct only while the keys are NEW** — when the translate pass returns, flip it to "no language
holds the English string verbatim" (`v71_q`: never assert a dropped key absent). Flagged in the
test's own comment so it is not read as permanent.

The uncounted `ex.syn.q_synonyms` / `ex.syn.q_antonyms` remain in use as the fallback and are
already translated — do not delete them.

---


---

## 7. The second data drop (session 32, mid-session) — `ui.json` + `lessons.json` + `learners.json`

The user sent a translated `ui.json` and current data. **Validated before merging**, per DoD item 3
and rule 23 — the ordering matters because a merge is not reversible without the previous copy.

**`ui.json`, the returning file.** 32 languages, none added or removed. `en` came back at **612 keys
against the tree's 614** — exactly the "did a key vanish" case the protocol names. The difference
was entirely the two `v78_b` keys, which the file predates: **no `en` key vanished, and no `en` value
had drifted** (0 changed). Safe to take wholesale.

What it gained: **`sr` went 0 → 612, fully translated.** `hr` is still 0. The other 30 languages are
unchanged, each still missing the same 14–16 accumulated keys. The `sr` pass is genuine, not English
passed through — 19 values identical to `en`, in line with `de` (28) and `it` (26).

**Flagged, not assumed: the `sr` UI is 100% Latin script, 0 Cyrillic characters.** Plausibly what the
user wants, but `sr` is the one digraphic language in the corpus and they have just built a
Latin→Cyrillic storyline, so it is worth a confirmation rather than a guess.

**`lessons.json`.** 308 → 309 topics, 86 → 87 storylines; 2 new topics, 1 removed, 2 new storylines,
1 removed. Both data guards fired again, and this time **the diagnosis was already written** — the
freshness guard named only the two files just replaced (no surprise third input), and the script
guard named **the same two `sr` topics as the previous drop**. That confirms the earlier reading:
the backfill runs in the container, the user runs from their own copy, so the stamps are lost on
every round-trip and `backfill-script.js --write` is a **per-drop step, not a one-off repair**. Now
recorded as such in HANDOVER. Backfill first, then `build-static.js`. No test needed correcting.

**`sl_56647998` arrived with it** — the storyline from the user's script-lesson report:
`tp_17862984310970000000`, `lang sr` / `script cyrillic-sr` → `srcLang sr` / `srcScript latin`, both
fields stamped by the v76_i picker. **So §7 now has a real reproduction case in the shipped corpus**
rather than a synthetic one, and the fix is testable against the data that prompted the report
(v70_n's rule, from the good direction for once).

## 8. `v78_c` — the `--langnames` crash

`isBlocking` is `issues => issues.some(i => i.severity === 'error')`: it takes the whole ARRAY. The
`--langnames` writer called it as `issues.some(isBlocking)`, so it received one issue OBJECT per
invocation and evaluated `issue.some(...)`.

**Why it shipped, and why the mode's own guard was green: it is unreachable on the happy path.**
When a name validates, `issues` is empty, and `[].some(fn)` never invokes `fn` at all. The defect
only exists once a name is REJECTED. That is the same shape as `v76_c` — in the same mode — where
`--langnames` shipped broken because only its no-op `--check` path had ever been run. The other two
call sites in the file were already correct, which is the tell: the mistake was made once, at the
site nobody could reach.

`unit-langnames` §4 forces a rejection (the model answers with an empty string for one code) and
asserts the run **completes**, reports the rejected cell, does **not** write the bad value, and
still writes the good cells in the same and later batches — the last of these separating "handled
the rejection" from "gave up quietly". Under revert it reproduces the user's exact message.

Not affected: the survey. The 119 missing cells were counted correctly, and `v76_f`'s per-batch save
means the `lb` names earned before the crash were kept.

## 9. `v78_d` — conjugation distractors

The wrong-answer pool was `shuffle([...wrongSameVerb, ...wrongOther])` — a UNION with every form of
every other verb in the lesson, capped at three. Because it was **shuffled**, the intruders crowded
out the real paradigm even when the verb had six forms of its own, so this was not a rare fallback:
it was the common case in any lesson carrying more than one verb.

Measured under revert on a two-verb Italian fixture: `essere (voi)` → **`siete / parli / parla /
parlano`**. Three of four from `parlare`. A learner answers by matching the stem to the infinitive
and never looks at the paradigm — a vocabulary question wearing a grammar badge.

Now same-verb only, and **no padding**: a verb with two contrasting forms asks a two-option question
rather than being topped up from a neighbour.

**Checked for the v71_s trap** — "when a builder is narrowed, narrow the COVERAGE UNIVERSE to
match", because a form that yields no MCQ leaves its universe key unreachable. It holds without
change: a fully syncretic verb merges to ONE `cleanForm`, so its only index is 0 and `fi % 3 === 0`
still emits the typed variant; any verb with more than one distinct form gives every form a
same-verb distractor. Asserted (§5) rather than argued.

§1 and §4 revert-verified **independently** — §4 by a targeted weakening that pads only when short,
which passes §1 and fails §4, which is the only combination that proves §4 is not riding on §1.

## 10. `v78_e` — chapter-level clear-progress, and a third copy of the `v77_s` bug

The user's note carried its own trap: *"reuse it, do not re-implement, or the new button will forget
`chapterDone` all over again."* **That was already true of code in the tree.**

`slBottomClearProgress` (storyline-wide) had the rule. `clearLessonProgress` (the lesson-set page)
was a **second, older implementation** — and it cleared `completed` and `solved` but **not**
`chapterDone` or `storyShown`, which is precisely the `v77_s` defect: clearing from that page left
every chapter still reading "finished". So the new control would have been a third copy, and one of
the existing two was already wrong.

Extracted **`_clearChapterProgress(topicKey)`** as the single rule; all three entry points call it.

**The guard asserts PARITY, not behaviour-in-isolation.** Wiping every chapter one-by-one must leave
byte-identical state to the storyline-wide wipe. That is what catches a future re-implementation
that drops a store — its own unit checks would pass, and the diff would not. Revert-verified by
reintroducing exactly the `v77_s` mistake: §1 and §2 still pass, §3 fails.

The card re-renders through **`showComplete(true)`**, the REVIEW render. A play render would
re-judge a chapter nobody just played and re-record the completion it had just erased — the third
time this shape has mattered (v71_n, v71_s, and here). §5 asserts the argument value, and
discriminates.

**Found on the way — a stale source pin.** `unit-qid-stability` §5 pinned two source PHRASINGS
(`delete APP.progress.solved[tp]`). The extraction renamed the variable to `topicKey` and the pin
broke **while the product was correct** — standing rule 18, arriving exactly as written. Retired
behaviourally rather than re-pinned to the new spelling, and the **replacement itself was
revert-verified** (session-29 rule 8: replacing a brittle pin is a change that needs verifying, and
the first replacement of the `if (!u)` pin was vacuous in a NEW way).

## 11. An incident: the roadmap was truncated to zero bytes

Writing a doc update, a Python heredoc contained emoji as `\ud83e\uddf9` surrogate escapes.
`str.encode('utf-8')` rejects lone surrogates, so the write threw **after** the file had been opened
for writing — leaving `roadmap_v78.md` at 0 bytes.

**`unit-roadmap-version` caught it on the very next suite run**, which is the first time that guard
(written earlier the same session, to retire a note that kept going stale) earned its keep. Restored
from the packaged `v78_b` zip and the later edits re-applied; the suite was green at 196 throughout,
so nothing shipped from the damaged state.

### Rule earned (25)

**Never put emoji — or any non-BMP character — in a string literal inside the script that writes a
file.** Write such blocks with a `cat` heredoc to a temp file and splice that file in, so the bytes
come from the file rather than from an escape the writer has to encode. And note the failure mode:
the exception arrives *after* truncation, so a "failed" write is not a no-op. **This is also an
argument for the packaged zip: it was the only intact copy of a file the working tree had lost.**

---


---

## 12. `v78_f` — the teacher-mode switch on every page

User: *"Teacher-mode switch at the bottom of every page, beside the UI-language and mute controls.
(Will later depend on credentials.)"*

It existed, but only on the landing page (`teacher-mode-bar`, a full-width labelled button shown in
both live and static). The two other footers — `lang-footer-lessonset` and `lang-footer-storyline`,
which carry the UI-language select and the mute button — had nothing.

**Three controls, one updater.** The obvious implementation is to paste the button into two more
footers, and that is precisely the shape that has cost this project twice: `v71_w`'s storyline
connector line drifted from a second copy of the completeness rule, and `v77_q` found four card
headers rendering four different titles from four copies of the same markup. So `_TEACHER_TOGGLES`
lists the three ids and `updateTeacherModeBtn` fills all of them; the compact footer glyph is taken
as the **first character of the same label string** the landing button renders, not spelled a second
time. Revert-verified by hard-coding the glyph — which passes §1 and §2 and fails §3's agreement
check, as it must.

**Reachability decided the scope.** The v71 rule: a learner-facing affordance placed on the
lesson-set page is unreachable, because learners skip that screen entirely (v60 learner nav). So
"every page" could not be satisfied by the easiest footer — landing and the storyline page are the
learner-reachable ones and both had to carry it.

**Found and fixed on the way: `toggleTeacherMode` synced the button BEFORE re-rendering.** That
ordering was harmless for as long as the control lived only on the landing page, and wrong the
moment it moved *into* the screens the function redraws (`buildPath`, `_renderStorylineScreen`) —
the page the user clicked would have shown its pre-click state. The sync moved after the re-renders,
and §6 asserts the ORDER rather than the outcome, because the outcome is identical on any page that
was not redrawn.

**No new i18n**, deliberately: `teacher.mode_on` / `teacher.mode_off` / `teacher.unlock_tooltip`
already carry both presentations. §7 asserts no new `teacher.*` key was invented, so a later "just
hard-code the emoji" edit has to argue for itself.

**"Will later depend on credentials" is unchanged and still ahead.** The new controls are wired to
`APP._teacherMode` exactly as the landing button always was, so gating on credentials remains the
same one change in the same one place — this release did not make that harder or easier.

**How to see it work** (browser): open a storyline, look at the footer row beside 🗣 and 🔊 — there is
now a 🔓 (or 🔒 when teacher mode is on). Tap it: the deck re-renders with locks removed, the icon
turns green, and the landing page's own button shows the same state when you go back. The same
control sits in the lesson-set footer. The state survives a reload (localStorage `dz_teacher_mode`).

## 13. Two user decisions recorded, no code

- **"Inside error / AI-error-hunt lessons"** (the unbuilt half of `v78_e`) meant something different
  from a chapter wipe: clearing the errors the LEARNER had marked, so they can be re-tagged. **The
  user then dropped it — "we can actually skip this."** Recorded in group B and NOT carried forward
  as an open item; a deferred item that nobody decided is how the v71→v72 boundary lost three
  things.
- **The Latin-script `sr` UI stays**, with both options possibly wanted later. Filed under the
  roadmap's "Second script for Serbian" entry rather than as a new item, because it is the same
  question in a third place: a language whose UI, story text and lesson content can each be in
  either script wants ONE notion of "which script is this learner reading", not three toggles that
  can disagree. **Sequenced after §7**, which is the first code to actually READ the per-topic
  `script`/`srcScript` pair and should prove that carrier before a third consumer is built on it.

---


---

## 14. `v78_g` — §7, script lessons for a digraphic source

The user's report: *"I generated a serbian-latin → serbian-cyrillic lesson, sl_56647998, but I can't
add script lessons to this. Script lessons would obviously fit such a script-focussed lesson."*

**The gate was asking the wrong question.** `needsIntroScript` computed the learner's readable
scripts as `scriptsForLang(srcLang)` — every script the source LANGUAGE admits. For `sr → sr` that
is `["cyrillic-sr","latin"]` on *both* sides, so `tgt.some(s => !src.has(s))` was false and the gate
concluded the learner already reads everything. It was answering "which scripts CAN this language be
written in" where the question is "which script is THIS pair actually written in" — and since
`v76_g`/`v76_h` that is a stored per-topic fact (`script` / `srcScript`).

One helper, `_scriptSideOf(langCode, chosen)`, now narrows each side, in **both copies**. A chosen
script is honoured only if the language actually admits it, so a stale or hand-edited stamp falls
back rather than inventing an alphabet — and the fallback is **per side**, which cost a corrected
assertion (see below).

**Why the builder had to change too.** If the gate narrowed and `buildArcIntroLessons` did not, a
digraphic pair would pass the gate and then skip every script inside the loop
(`srcScripts.has(scr)` true for all of them), returning `[]` with no error. That is the
silent-empty shape INTERNALS §2 is full of, and §6 asserts gate and builder ask the same question
rather than trusting that they do.

**Threading found two real gaps, neither visible by reading the diff:**
- `base` (the generate job) did not carry the chosen scripts, so `base.script` was `undefined`
  downstream. The arc primer would have kept the OLD behaviour while the gate reported the new one —
  a disagreement between the checkbox and the thing it controls.
- `/api/generate-book` destructures its own body set, which had no `script`/`srcScript`. My call
  passed identifiers that did not exist in that scope: a **`ReferenceError` in nine e2e tests**.
  Worth recording that the suite caught this and reading did not — the edit looked right in both
  places it was written.

**Guarded against the real corpus.** `sl_56647998` arrived in the session-32 drop, so the test drives
`tp_17862984310970000000` from `lessons.json` rather than a fixture (v70_n, from the good direction
for once). §0 asserts the premise — that `sr` really is the digraphic language and admits exactly
those two scripts — because a test built on a corpus coincidence is how the `v78` cut produced a
wrong test. §5 sweeps **31 non-digraphic corpus pairs** and asserts none changed answer: the
narrowing is inert where a language has one script, which is the entire regression surface.

**Revert-verified two ways**, deliberately:
- Reverting the narrowing reproduces the user's report exactly — §1 fails on the real storyline.
- Reverting only the SERVER copy fails **only** §7 (parity) while every behavioural section still
  passes. That is the one-sided-fix failure this change was most exposed to, and it is the shape
  that would otherwise ship: the menu offering an option the generator then refuses to build.

**Three extraction sites in `unit-intro-script` needed the helper injected.** `ext()` grabs one
named function, so splitting a function into two broke the harness, not the product. The
`ReferenceError` it raised was the test's own. Fixed at all three sites rather than by inlining the
helper back — inlining would have meant two copies of the narrowing rule, one in the gate and one in
the builder, which is precisely what §6 exists to prevent.

**NOT done, deliberately — and this is a language decision, not a code one.** Teaching LATIN to a
Serbian-Cyrillic reader stays unoffered. The Latin table's `sounds` column is keyed by the reader's
script and carries `cyrillic` — Russian-flavoured respellings, "эй" for A, "си" for C — but not
`cyrillic-sr`. Aliasing them would print the answers in letters a Serbian reader does not use (no
э, ы, ё), and INTERNALS §4 puts that judgement outside the code. Added to the owed list as a real
26-respelling column needing a model pass and a native check. §8 asserts the REASON, not the
symptom, so adding the column flips the behaviour deliberately.

**A corrected assertion, recorded because the product was right and I was not (twice).** §4 first
claimed an invalid stamp turns the option off; in fact the sides fall back independently, so a bogus
target stamp with a VALID source stamp correctly still finds `cyrillic-sr` unreadable. §8 first
asserted the withheld direction on the MENU gate — but `scriptLessonAvailable` checks both
directions by design ("worth offering whenever a table-backed script is involved on either side"),
so it rightly still offers the `cyrillic-sr` lesson. Both were restated against the function that
actually encodes the claim. Two different questions, and the first draft asked the wrong one.

**How to see it work** (browser): open `sl_56647998` (*Učenje skriptova*), go to the chapter and open
the add-a-lesson menu — the script-lesson option is now offered, and generating it produces a
Serbian Cyrillic alphabet primer built from the 30-letter `cyrillic-sr` table. The arc checkbox on a
new `sr`-latin → `sr`-cyrillic storyline now defaults ON for the same reason.

---


---

## 15. §0e/§3 re-planned — the coupling was right for a seventh of the data

The roadmap has said for three sessions that this pair "needs re-planning, not implementing". Done
here, by measurement rather than by reading the old note again.

**Three of the v75 plan's four parts turned out to be already-done or moot:**
- the apostrophe fix shipped as `v77_u`;
- the corpus-derived article sets are unnecessary since session 30 ruled article noise ACCEPTED,
  which also retires `roadmap_v74.md`'s wrong claim that `_articleStatsFor` already derived them;
- a matcher already exists (`_highlightVocabHtml` + `_hlKey`), so "one shared matcher" is an
  extension, not a new thing.

**One part is ready to build**: `_highlightVocabHtml` matches a multi-token vocab entry only as a
whole phrase — verified by calling it, `['la variazione genetica']` marks that phrase but a story
containing only `variazione` marks nothing. Whitespace splitting is the ruled change (+782 marks,
96 chapters) and is still unshipped.

**And the part the coupling rested on is dead.** The v75 note justified attaching §0e to §3 by
saying story-ordering "is the same token-alignment problem, not a separate nicety". Simulating the
cumulative panel against the chapter story actually on screen, through the product matcher, over 612
entries in 12 multi-chapter storylines:

| | |
|---|---|
| exact match in the shown story | 82 (13%) |
| only a word-form / stem match | 24 (4%) |
| **absent entirely** | **506 (83%)** |

`The Lion's Mischief`: 221 cumulative words, 25 in the story. `Nights in Cairo`: 0 of 23.

**The cause is two correct decisions that were never compared.** The v75 ordering note assumed the
panel showed the CHAPTER's vocabulary; `v77_f` then made it cumulative across the deck (133 words vs
24, measured at the time). Separately reasonable; together they make "order as the words appear in
the story" an instruction about a seventh of the list.

Word forms do not rescue it either: the v75 note's "greedy matching, to allow for word forms" is
worth the 4% above, and greedy stem matching is the one part of this that risks marking the wrong
word. Four points is not a good price for that.

So the re-plan does not schedule the work — it puts a **ruling** in front of the user with three
options, all of which still share ONE matcher (so the coupling survives, on better grounds), and
recommends **"mark, do not reorder"**: use the matcher to flag which panel words occur in this
chapter's story, keeping the existing order. Well-defined for 100% of the panel, and the panel stops
re-shuffling as the learner moves between chapters.

**Also identified, and it is the real prerequisite:** `_highlightVocabHtml` does a regex replace and
returns a STRING, so it can answer "mark this" but not "where, and in what order". Every option
needs the second answer, so the shared matcher must return matches WITH OFFSETS and highlighting
becomes a thin wrapper over them — which keeps §3 byte-identical and revert-verifiable while §0e is
built on the same call.

### Rule earned (26)

**When two releases each change the same surface, re-measure the older plan against the newer
behaviour before scheduling it.** Neither the v75 ordering note nor `v77_f`'s cumulative panel was
wrong; the plan was stale because nothing forced them to be compared. The tell was cheap and was
available the whole time — one probe over the corpus asking "does this panel word occur in this
story", 612 entries, ten minutes. **A plan that has been carried forward unchanged across three
roadmaps is a plan whose premises have not been checked against three roadmaps' worth of changes.**

---


---

## 16. `v78_h` — every word-bearing source feeds the story highlight

Only `L.vocab[].target` had ever been marked, so a chapter that teaches through conjugation,
word_forms, grammar or synonyms showed a story with almost nothing lit up.

**Measured over 90 corpus chapters with a story: 704 marks → 1043, +48%, 44 of the 90 gaining.**
Re-measured after wiring; the shipped collector reproduced the figure exactly.

One detail that would silently have produced zero: the corpus stores conjugation forms WITH their
pronoun (`io parlo`) while the story contains only `parlo`. The collector strips it.

**The design claim is not "more words".** `_storyWordSources` emits each word together with the
PROBE — the exercise shape whose qid identifies the question that teaches it — so light ("in your
lessons") and dark ("you have answered it") are two reads of ONE list. Computing them separately is
how this panel and the storyline page came to light the same story differently before `v74_n`. The
probes are the shapes `_qidCanonical` already switches on, and solved-ness is tested with the
product's own `qid`, so a qid-scheme change moves both sides together.

A word_forms **distractor is light but can never be dark**: no question has it as its correct
answer, and calling it learned would be a lie the shading tells.

## 17. `v78_i` — three user rulings, and a guard that was measuring the corpus

**Auto-read removed** from the progress card and added nowhere else — superseding §0f (`v77_v`) and
the brief "card before comprehension lessons" re-scoping. The helper is KEPT (the speaker control
still reads the story; it carries the four restraints), but `unit-story-autoread` now asserts it has
**no call site**, revert-verified by re-adding one. Without that assertion the removal is a fact
about one commit, and the next session — reading three releases of discussion about where to put
it — puts it back.

**Conjugation prefers MCQ over typing**, per the user. This also fixed a real defect: `mcq_conjugation`
and `type_conjugation` share ONE qid (`infinitive|pronoun`), so emitting both put two exercises with
one identity into a round.

**The conjugation reveal shows the whole phrase** (`vi ste`, not `ste`). The read-out has composed
pronoun+form since it was written, so the app SAID the full phrase while SHOWING half of it.

### The instructive part: `unit-replay-focus` §8c was measuring the corpus

The user's first conjugation lesson made it fail, and **the product was right**. §8c asserted a
replay has ZERO repeats. But `_cutCoverageRound` calls
`assembleCoverageRound(exs, cap, 1 - FAMILIAR_SHARE, true)`, and `FAMILIAR_SHARE` (0.15)
deliberately reserves part of every round for review.

It passed for years because grammar — the only capped builder in the bundled corpus — leaves
25 − 14 = 11 unsolved against a cap of 14, so trim mode hands back 11 questions with no room for a
review slot and the share never showed. The new 30-question lesson left 16 unsolved, the round
filled to 14, and the two designed slots appeared.

Bounded by the designed share instead of zero. The guard keeps its power: a random cut re-asks about
half a round, far outside the bound. **This is the same story the file's own header tells about §8
one section down — twice in one file, found five sessions apart.**

## 18. `v78_j` — three small specified items, and two guards that earned themselves

**Grammar + Konjugation restored** to the single-chapter add-lesson menus. No gate, only an
omission. The structural defect is that the option list is **written out three times**, so the new
guard asserts the two add-lesson menus AGREE rather than merely containing the two types — and it
immediately caught a second difference I had not noticed: the library menu lacks `mixed`. That one
is REAL (a mixed lesson pools the OPEN set's other lessons; its handler throws `mixed.need_open_set`
without one) and is now the single documented exception, with the guard also asserting that handler
exists so the exception is a reason rather than an excuse.

**Slovenian added.** `unit-lang-menu-coverage` fired exactly as predicted — and then caught
something I had not predicted: my first edit **reflowed `languages.json`**, and that guard protects
the file's hand-written line shape because a reflow makes every future diff unreadable. Redone as a
textual append.

**`--batch` / `--threads` for `translate-ui.js`.** `setNumThread` had existed in `llm.js` since
`v71_q` but only the model MENU ever called it. Guarded behaviourally — the same 20 keys go out as
1 batch at `--batch 20` and 4 at `--batch 5`, through the real script with a counting stub. A flag
that parses but never reaches the loop passes a source check and fails this one.

## 19. `v78_k` — §3 whitespace splitting, and a stale number restated

The last unshipped part of §3, ruled in sessions 29/30. A multi-token entry matched only as a whole
phrase, so `la variazione genetica` marked nothing in a story containing just `variazione` — the
commonest shape, since vocabulary is stored with its article (181 of 1408 entries carry a space).

**A/B measured on the current corpus, same 96 chapters, splitting off then on: 761 → 1071 marks,
+310, 41 chapters gaining.**

**The ruling recorded +782, and I did not repeat it.** My first attempt at the measurement was also
wrong in a way worth recording: I compared "all entries" against "single-token entries only", which
removes the multi-token PHRASE matches the old code already made — so it measured the wrong
difference and got +368. The honest A/B is to disable the split and re-run the same call, which is
what the numbers above are. The ruling's +782 predates `v77_u` (the apostrophe fold recovered part
of the same gap independently) and a corpus that has turned over several times. Direction and
decisiveness hold; the figure does not.

**Both shades split together.** The stronger shade is keyed on the MATCHED text, so splitting only
the light set would have shown `variazione` as unlearned inside the very phrase the learner had
answered. Both halves revert-verified independently — §1 catches the split, §5 catches the shade.

**Article noise is asserted as a RULING.** Splitting marks bare `la`/`il`. §4 asserts that
deliberately, because the alternative is a future session seeing a lit-up article, reading it as the
`v73_d` one-letter bug returning, and "fixing" a decision that was measured and taken. Consequence
worth restating: **no article set is derived anywhere, and none is needed.**

---


---

## 20. `v78_l` — Replay's target ordering

The user's question was the useful part: *"Is this request in conflict with the definition of this
button?"* Answering it honestly is what made the fix small.

**It is not in conflict.** Replay is `repeatForCoverage`; its job is to raise COVERAGE, so skipping a
lesson at 100% is correct — replaying it raises nothing. But an unplayed lesson is not at 100%, it
is at ZERO. "Prefer ones not yet seen" is therefore the STRONGEST case of the rule already there,
not a second rule competing with it. Nothing needed redefining; only the order was wrong.

`_firstCoverageShortLessonIdx` returned the first coverage-short lesson in DOCUMENT order. A
comprehension lesson sits early and — since `v77_t` narrows a repeat to the questions still
unanswered — stays short for a long time, so it won that scan every time and later unplayed lessons
were never reached. Precisely the symptom reported.

**A fraction, not a remaining count.** A 4-question lesson never played should outrank a 40-question
one that is 90% done, even though both have four questions left. §3 asserts that with the remainders
deliberately EQUAL, so the count rule and the fraction rule give different answers and only the rule
under test can decide it.

**Ties keep document order**, so an evenly-covered chapter behaves exactly as before. That is what
keeps this an ordering fix rather than a reshuffle of the whole card.

### Revert-verification, and why three weakenings rather than one

- first-in-order → §1 fails (the original bug).
- fewest-remaining → §1 fails too.
- **most-remaining-first → §1 and §2 PASS, §3 fails.**

Only the third isolates the fraction rule, because the first two are caught by §1 and abort the file
before §3 runs. This is the same trap as `v78_b`: an early assertion aborting means the later
sections were never executed under that revert, so "the guard failed" is not evidence that every
section works.

**`probe_gates_v77.js` re-run and diffed** against the `v78_k` package — the 16-row gate table is
byte-identical. The protocol requires this after any progress-card change, and the diff is the
cheap half; running the probe without diffing it against the previous cut proves nothing.

---


---

## 21. `v78_n` — the three §0d card items

Two fixed, and **one measured already true and left alone**, which is the part worth recording.

**The ✕ returns to the progress card of the lesson being played.** Quitting a question is a step
back inside the chapter; the deck discards the context the learner was in. It uses the REVIEW
render, which records nothing — `confirmQuit` has already folded the round's partial score into
`completed` a few lines earlier, and a play render would count it a second time (the `v71_n` shape:
a review render is not a play).

`showComplete` needed an optional `lessonIdxOverride`, because review mode deliberately points
`lessonIdx` at the LAST counted lesson. That is right for its original purpose — re-opening a
finished chapter, where "which lesson" has no answer — and wrong here, where it has a very definite
one. Excluded for drills (`endDrill()` has just restored the real topic, so the index no longer
refers to anything) and it falls back to the old behaviour whenever the card cannot render, so ✕
always goes somewhere.

**The post-unlock bar shows on every card of the chapter.** It came from `_lessonGate`, which is set
only when a story-gated lesson is BOTH unfinished AND the one just played — so the learner saw
"Verständnis 3/8" on one card and nothing at all on the next, with no way to tell the work still
existed. One row per post lesson now, labelled with the lesson's OWN TITLE: data, not a new
`ui.json` key, which matters because the user is mid-translation. The gate row is no longer emitted
separately — it is already among them, and two bars for one quantity is the `v74_g` mistake.

**"Replay must ALWAYS be available" needed no change.** Measured: `v71_h` already shows the button
unconditionally, and `repeatForCoverage` falls back to `APP.cur.lessonIdx` when nothing is
coverage-short, so a finished chapter still replays and 100% stays reachable. Asserted in §5 rather
than "fixed" — an item that is already satisfied should be closed by measurement and a guard, not by
a change that appears to do something.

### Three more stale pins, all rule 18

Two SIGNATURE pins broke on the `showComplete` parameter while the product was correct:
`unit-learner-nav` and `unit-card-errors` both pinned `function showComplete(review)` exactly. Both
relaxed to a prefix match, which preserves the claim they actually make.

One POSITIONAL pin: `unit-coverage-threshold` read the %-solved bar as `rows[rows.length - 1]`. That
held only while nothing was appended after it — and `v73_d`'s gate row already could be, so it had
been passing on the chapters it happened to pick rather than on the rule. Now found by LABEL.

That is **five stale pins retired this session** (two here, two in `unit-qid-stability`, one in
`unit-replay-focus`'s §8c bound). Every one was a guard describing HOW the code was written rather
than WHAT it must do, and every one broke on a correct change. §0a's "retire the source pins" item
is not cosmetic housekeeping — it is the difference between a suite that catches regressions and one
that taxes correct work.

**`probe_gates_v77.js` re-run and diffed against the `v78_l` baseline: byte-identical.** All three
items touched the progress card, so the diff was run once for the three rather than three times.

---


---

## 22. The coverage measurement — done, and it reframes the request

The roadmap had said for three sections that this number comes first. Done at the `v78_n` cut,
through the PRODUCT matcher over 120 chapters with a story. Probes kept as
`build_history/probe_coverage_v78n.js` and `probe_coverage_bands_v78n.js`, with the results in
their headers so a later run has something to diff against.

**How much of a chapter's story do its lessons teach?**

| | |
|---|---|
| token coverage (running words) | **9.2%** (1946 / 21048) |
| type coverage (distinct words) | **8.2%** (1127 / 13764) |
| per-chapter type coverage | min 0% · p25 5.3% · **median 13.2%** · p75 19.2% · max 48.6% |
| chapters below 25% | 108 of 120 · above 50%: **none** |

**It is a GENERATION problem, decisively** — which is exactly the question the number was for. A
learner who has solved every lesson in a chapter can read about one word in eleven of its story.
"Exhaust the vocabulary of the input text" is an order of magnitude away, not a top-up.

**The second cut is the one that changes the design.** Splitting the story's word types by CORPUS
FREQUENCY per language — statistics, not a word list, so no language knowledge enters the code:

| band | covered |
|---|---|
| top-100 most frequent types | 9.0% |
| top-500 | 12.2% |
| rare (everything else) | **5.1%** |

**The rarest words are the LEAST covered.** That is the opposite of the user's "start with the
hard/unusual words", and it means the request is a change of POLICY, not only of volume: at ten
times the output, a generator that still picks the way it currently picks would leave the hard words
last all the same. It also settles a sub-question the user raised — "for a simple short text, go
towards the basic words as well" is not a separate mode, because at 9% coverage of the top-100 band
the basic words are not covered either.

**The next thing to measure, before sizing any generator.** A story contains proper nouns, numbers,
and inflected forms of words the lessons DO teach; the matcher counts an inflection as uncovered
unless a `word_forms` lesson happens to list it. **What share of the uncovered types are inflections
of covered lemmas?** That is the difference between "generate ten times as much" and "teach the
forms of what is already taught" — two different products — and `v78_h`'s tier-2 note (corpus
inflections from `word_forms` / `grammar.plural`) is the machinery that would answer it.

**Method caveat, recorded so the figure is not over-read.** "Covered" means the word appears in some
lesson of THAT chapter, which is strict — a learner also carries vocabulary from earlier chapters.
The cumulative measurement from the §0e re-plan errs the other way (83% of a learner's cumulative
vocabulary does not occur in the chapter on screen). The two bracket the real answer rather than
agreeing; **neither is above 20%**, which is why the conclusion holds either way.

---


---

## 23. The v79 cut — and a bug the cut itself found

The data drop for the cut was clean in every dimension the protocol checks: 617 `en` keys with none
vanished and no value changed, `sl` now a full block (33 languages complete), `languages.json` at
**1089/1089** name cells, 309 → 315 topics, 87 → 88 storylines, nothing removed.

**Then `backfill-script.js` reported something it had never reported before: `ambiguous (left
alone): 1`.** One Serbian chapter, `tp_17863746762340000193` — 459 Cyrillic characters against 127
Latin. The guard's message said a mixed passage means the generator was never told which script to
use, and the temptation was to read that as stale, since `v78_p`/`v78_q` had just fixed exactly that
and the console had shown `[script] story prompt pinned to Cyrillic for sr`.

**Inspecting instead of assuming found the real thing.** The story is *pure* Cyrillic — zero Latin
runs. The 127 Latin characters are all in one place: the vocabulary lesson's TARGET words. `reka`,
`sanjati`, `vetar`, `miris`, `grad`. **A Cyrillic chapter teaching Latin words** — so nothing the
learner studied could ever be highlighted in the text they were reading, and the two would look like
unrelated languages.

The cause was written down two sessions before it happened. `v76_h`'s own comment says naming the
script inside `{L}` "is not enough on its own — the model still drifts between scripts inside one
text", and adds the explicit rule to the STORY prompt. The three LESSON prompt builders got the
script only through `langName(lang, script)` — the name, not the rule. The comment predicted the
failure and the fix was applied to one of four call sites.

`v79_a` extracts `scriptPinNote(lang, script)` and appends it in `sysLesson`, `sysLessonFromText`
and `sysLessonTable`. Verified by building the real prompt: pinned for `sr`+`cyrillic-sr`, untouched
for a non-digraphic language.

**The existing chapter stays broken** — regenerating it needs a live model, so it is owed by the
user. Rather than relax the assertion, the id is listed in `unit-script-choice` with a note that a
SECOND id means the fix did not hold rather than that the list should grow. A guard that stops
counting is worth less than a guard with one documented exception.

### Rule earned (27)

**When a comment predicts a failure mode, check every site the prediction covers, not the one in
front of you.** `v76_h` wrote down that the language name alone lets the model drift, fixed the
story prompt, and left three lesson prompts unfixed for two sessions — until the corpus produced the
exact artefact described. The prediction was the finding; nobody re-read it. **A note that says "X
is not enough" is a search instruction: grep for every place X is done alone.**

## 24. What the v79 cut carries forward

- `roadmap_v79.md` carries the protocol, the **27** standing rules, every open item and the triaged
  user notes. **The `v78` shipped table stays in `roadmap_v78.md`** — history, not queue; copying it
  forward would make the roadmap grow without bound.
- `unit-roadmap-version` was written in this session to stop the protocol's version sentence going
  stale a fifth time, and it did its job at the cut: both sentences were caught and updated to name
  the `v79` line.
- **The largest open item is a RULING, not a task**: `useFullChain` promises the storyline and
  delivers one chapter. Recorded in full at the top of `roadmap_v79.md`, with both options and the
  reason not to pick one silently — the honest version is a two-line reword, the true version
  changes what every continuation costs on a model already taking ~100s per short story.

---


---

## 25. Two corrections from the user, and what they cost

Both landed after the v79 cut was packaged. Recorded at length because in each case the artefact was
real, the reasoning was plausible, and the conclusion was wrong.

### The mixed-script chapter was `reinforce` working correctly

I read `tp_17863746762340000193` — Cyrillic story, Latin vocabulary — as the lesson prompts drifting
for want of a script pin, wrote `v79_a`, and shipped it. **The user identified it as the `reinforce`
arc mode**, which explicitly re-trains vocabulary from EARLIER chapters; those chapters were Latin
because the user was deliberately switching that storyline from Latin to Cyrillic. The Latin is the
prior vocabulary, faithfully reproduced.

**The lesson's own `_genMeta` said so**: `_arcMode: "reinforce"`, sitting in the file I had already
opened twice. And the plain lesson in the same chapter, from the same builder four minutes earlier,
is correct Cyrillic — which on its own should have made "the builder drifts" suspicious.

So the corpus does **not** demonstrate that lesson prompts drift. `v79_a` is retained on `v76_h`'s
original reasoning (a name is not an instruction) but is now labelled UNMEASURED in the shipped
table, with its open question stated: nobody has checked what a pinned prompt does when `reinforce`
hands it prior-script vocabulary to re-teach. That is a real interaction, not a hypothetical.

**Rule 28** came out of this: `_genMeta` records how every lesson was made — read it before
diagnosing what a lesson contains.

Note what rule 27 was actually earned on. I wrote it as "when a comment predicts a failure mode,
check every site" — which is still sound advice — but the failure it was written about turned out
not to be that failure. The rule survives; its worked example does not.

### The `cyrillic-sr` sounds column was never owed

I had listed it for three releases as owed by the user, and when asked, produced it: 26 Serbian
Cyrillic respellings of the Latin letter names, verified mechanically against our own 30-letter
table — zero characters outside the Serbian alphabet.

Then `unit-intro-script` failed on a `v75_g` ruling I had not read: **"a Serbian reader must NOT be
offered a Latin course: they already read it"**, Serbian Latin being co-official. The missing column
is not an oversight — it is the mechanism that ENFORCES that ruling. Adding it would have silently
reversed a deliberate decision.

Reverted. Both test comments that described the absence as "owed" are corrected to say it is
deliberate, and to name `unit-intro-script` as the assertion that must change first if the ruling is
ever reopened. **The guard caught what three sessions of my own notes had got wrong** — and the
comment in that guard says exactly why it pins the behaviour rather than the mechanism: *"it is the
behaviour, not the mechanism, that matters"*. Written by a past session, for exactly this.

The table itself is kept here in case `v75_g` is ever reopened:
`A еј · B би · C си · D ди · E и · F еф · G џи · H ејч · I ај · J џеј · K кеј · L ел · M ем · N ен ·
O оу · P пи · Q кју · R ар · S ес · T ти · U ју · V ви · W дабл-ју · X екс · Y вај · Z зед`

### The pattern

Both were cases of an artefact fitting a story I already had. The script-plumbing bugs of `v78_p`
and `v78_q` were fresh, so a script-shaped artefact looked like more of the same; the "owed
translation passes" list was long, so a missing data column looked like another entry on it. In each
case the disconfirming evidence was already in the repository — one field in `lessons.json`, one
assertion in a test file.

---

## 6. What the next session should know

- **Baseline at the `v79` cut: 206 / 182 / 0 / 0.** Corpus 315 topics, 88 storylines, 33 languages. Corpus 309 topics, 87 storylines. **33 languages.**
- **Group B is DONE. §3 is DONE. §7 is DONE.** Thirteen point releases this session (`v78_b`…`v78_o`); `v78_o` is measurement and documentation only.
- **Nothing is owed by the user except two translation passes** — `sl` has no `ui.json` block, and
  Slovenian reopened `languages.json` name cells. Both are faster now (`--batch`, `--threads`).
- **The next real item is a DISCUSSION the user asked for**, not an implementation: the per-text
  learning scheme (roadmap → "session 32, second batch" → "NEEDS DESIGN"). **The prerequisite
  coverage measurement is DONE — §22 above, and the roadmap's "THE COVERAGE MEASUREMENT" section.
  9.2% of tokens, 8.2% of types, and the RAREST words are the least covered (5.1%).** It is a
  generation problem and a policy change, not a top-up. **Bring the numbers to the discussion; do
  not re-derive them.** The one thing still unmeasured, and worth doing before any generator is
  sized: what share of the uncovered types are INFLECTIONS of covered lemmas.
- **Buildable without discussion:** §0h question navigation (its own session — `C.cur`, `check()`,
  per-run answer state, `_speakAndAdvance` advancing one way only). The Replay ordering fix shipped
  as `v78_l`, and the three §0d card items as `v78_n` (one of which needed no change — it was
  already true, and is now asserted). **§0d is empty.**
- **On the next data drop:** read §1 and §7 of these notes before reaching for the fixers, and run
  **backfill before build-static**. Note the script stamps SURVIVED the second drop, so the
  per-drop-repair rule may be softening — check, do not assume either way.
- **Writing docs: never put emoji in a Python string literal** (rule 25, §11 — it truncated the
  roadmap to zero bytes).
- **Three guards earned their keep this session by catching things nobody was looking for**:
  `unit-roadmap-version` caught the zero-byte roadmap; `unit-add-lesson-menu` caught the
  library/`mixed` divergence; `unit-lang-menu-coverage` caught a `languages.json` reflow. All three
  were written for other reasons.
