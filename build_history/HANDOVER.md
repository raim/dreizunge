# HANDOVER — v80

One page. **Current release `v80`** (session 34, three point releases on top of `v79_j`, which closed session 33 after eight point releases on the `v79` line, which was
cut after session 32 shipped fourteen point releases on the `v78` line). **Read `build_history/roadmap_v80.md` next** — start with its
"⚠️ OPEN AT THE v79 CUT" block — then `INTERNALS.md`, then
`build_history/v79_session33_notes.md`, then `build_history/v78_session32_notes.md`. What any
`v78_*` release did is in `roadmap_v78.md`; that file is history now and is not carried forward.

## Green baseline

| command | expected |
|---|---|
| `node test/run.js` | **218 checks, ALL PASSED** |
| `node test/run.js --quick` | 194 |
| `node test/check-inline.js` | 0 failures |
| `node test/check-inline.js docs/index.html` | 0 failures |

`APP_VERSION = 'v80'`. Corpus: **321 topics, 90 storylines** (August drop, arrived mid-session). **33 languages**, `ui.json` complete
for all of them (617 `en` keys), `languages.json` at **1089/1089** name cells.

**These numbers are the ones to trust.** Every session prompt so far has quoted a count that was
right when written and stale when read. **If a prompt and this file disagree, measure.**

## ⚠️ On a data drop: the guards fire, but the FIXERS ARE NOT A DIAGNOSIS

- **Check three cheap things first** — corpus counts, file **mtimes** (a file a fixer just rewrote is
  the NEWEST), and the hash `unit-static-freshness` names.
- **ORDER MATTERS.** `node backfill-script.js --write` **first**, `node build-static.js` **second**.
- **Diff the baked corpus against disk before rebuilding**, so a rebuild cannot lose user content.
- **A test can be wrong on new data.** It happened three times in session 32
  (`unit-mixed-unlock-reachable`, `unit-replay-focus` §8c, `unit-coverage-threshold`'s positional
  read). Diagnose before re-pinning — but note the v79 cut's ambiguity was the guard being RIGHT.
- **`ambiguous (left alone): 1` is expected** at this cut — one known-bad chapter, item 2 of the
  roadmap's open block. A SECOND one is a real failure.

## ⚠️ Writing docs: NEVER put emoji in a Python string literal

Session 32 truncated a roadmap **to zero bytes** that way; the exception arrives AFTER the file is
opened, so a failed write is not a no-op. Write emoji-bearing blocks via a `cat` heredoc to a temp
file and splice that file in.

## ✅ RULED at the v80 cut — four decisions

**1. Language x lesson-type applicability: MODEL-DECLARED**, cached in `languages.json` with
provenance, ternary (`yes`/`no`/`different-mechanism`) plus a note, human override wins and is
marked. A measurement, not an authored language claim. `roadmap_v80.md` §2z.

**2. Observations log: BOTH scopes, keyed by a stable LOCAL id an account can ADOPT.** This was the
only thing blocking `implementation_plan.md` §8/B1 — **B1 can start now.** Adoption is a LINK, not a
rename; the local id stays the identity key permanently.

**3. Uploaded images: STORED SERVER-SIDE — as FILES, never inside `lessons.json`.**
`build-static.js` needs a follow-up decision (omit images in static, or copy assets and rewrite
paths).

**4. Duplicate storyline titles: SUPERSEDED — the user RENAMED one** to "Dough of the Ancients 2",
which fixes the `v79_k` fork-marker collision at its source. The enumeration guard (every fork's
marker distinguishable from the open storyline's label) is now PREVENTIVE and lower priority. **The
tree still holds the old titles; the next data drop brings the rename.**

## ⚠️ TWO BUGS DIAGNOSED AT THE v80 DROP — do not re-derive them

**1. The storyline title is NEVER generated for a new book** (`implementation_plan.md` §9c). The
`v78_r` guard — *generate only when there is none* — is correct, but `server.js:5207`/`5215` seed
`title: chain[0]` (the first chapter's topic name) when the storyline record is created **earlier in
the same flow**. So a title always exists by the time the guard looks, and the `generateStorylineTitle`
branch is unreachable. **Do not weaken the guard** (`v78_r` is a user ruling that stopped whole-story
titles being replaced by tail-only ones); make it able to tell a placeholder from an authored title —
recommended: a `titleAuto: true` flag. **Checked: `summary` is NOT seeded, so this is title-only.**

**2. The article asymmetry is a COIN FLIP, not a constant bias** (§F3c). Measured on this drop:
`tp_17869977371640000022` **7 of 8** asymmetric, `tp_17869980065780000104` **0 of 8** — same model,
same `_genMeta.type`, `rejected: 0`, four minutes apart. A self-contradicting prompt does not bias
output consistently, it makes it UNSTABLE. **So a single lesson can never validate the fix** — the
clean chapter is a lucky sample of the broken prompt, and the F3 probe must report a RATE over many
lessons per `_genMeta.at` cohort.

## ⚠️ THE ARTICLE MESS IS DIAGNOSED — `implementation_plan.md` §F3

German->French vocab with an article on the German side only. **The generation prompt contradicts
itself**: `BASE FORM ONLY … (with the usual article where the language uses one)` is PER-SIDE and
appeals to each language's citation convention; `ARTICLE SYMMETRY … both sides or neither` is
CROSS-SIDE. German cites `der Hund`, French cites bare `chien` — so a model obeying the first rule
produces exactly the reported defect, and the first rule is stated first and framed as definitional.

**It got worse because the symmetry rule was ADDED beside the contradiction instead of removing it**
(rule 31 — the `v79_i` failure repeated), because the deterministic normaliser was removed on good
grounds while `server.js:4438` claims *"the generation prompt still forbids a one-sided article"*
(it does not, cleanly), and because the QC check degrades quietly when its `siblings` context is
thin. **Fix by removing the contradicting clause and adding a WORKED COUNTER-EXAMPLE, then measure
per `_genMeta.at` cohort — not in aggregate, which is the `v80` word-forms lesson.**

`roadmap_v80.md` §2y and §2z carry all four; `implementation_plan.md` §9b has the designs.



## ⚠️ START HERE: `build_history/implementation_plan.md`

The user's **larger plan (PDF focus)** — ingest, pedagogy/BKT, surface clean-up, lesson types, QC,
export — is evaluated against these roadmaps in `build_history/implementation_plan.md`, written at
the v80 cut. **Read it before planning any session**, because it sorts the user's document into
five tracks at very different scales and says which are blocked and on what.

Its §10 proposes the next three sessions. Its §0 carries four findings that change the plan before
it starts, including two that are already actioned:

- `bayesian_knowledge_tracing.md` **ARRIVED** and is evaluated in plan §0.1 / §8. Track B is
  unblocked, but **the blocker was never the BKT maths** — it is skill tagging, skill-ID
  canonicalisation (which the document omits), and the fact that the existing `{seen, wrong}`
  counters **cannot be replayed** into a sequential model. **Plan §8/B1, the observations log, is
  the one item whose value decays if it waits.**
- `roadmap_v80.md` had **lost two whole open sections** when it was created. **RESTORED verbatim at
  this cut**, un-reconciled and flagged in place — reconciling them against the plan is the next
  session's first task.
- "Are QC tokens recorded?" — **yes**, `lesson_qc` / `story_qc` via `addTokenUsage`. Only a
  *run-level* total is missing.
- The ingest architecture question was **revised twice under user challenge** and is now §2.1–§2.7:
  images need no dependency at all, PDF is the only case needing a ruling, and §2.7 records what two
  real comic pages show — rotated text, unframed panels, words broken across lines, and all-caps
  destroying German noun capitalisation.

## `v80` — the cut, with the LIVE-PASS RESULTS in it

**`v79_f` CONFIRMED WORKING** — first real measurement. `tp_17864554460460000107` now holds two
conjugation lessons: the Aug 11 one with **0 Cyrillic characters** and the regenerated Aug 14 one
with **307**. The script pin reached the model and the model complied. **Worth a look: the chapter
now has TWO conjugation lessons where it presumably wants one.**

**`v79_i` — the prompt worked; the headline number cannot show it.** The probe reads 47 items /
7 pairs (15%) against 46 / 7 (15%) — flat. Per lesson it is not: `tp_872660509`'s OLD word_forms
lesson is 5 items, **all 5 two-choice**; the REGENERATED one is 6 items with **1**. The corpus-wide
denominator includes every un-regenerated lesson, so **a fixed prompt cannot move it until the old
lessons are regenerated** (rule 30). Read the per-lesson breakdown, not the percentage.

**The asymmetric fork is CLOSED by user ruling** — the ancestor was added to
`sl_1041030875.chapters`. Exactly one record changed. Both sides now count `pizza dough`
identically. The id mapping was never broken, so no story was deleted.

**⚠️ Still open there, an authoring call:** `sl_182891979` and `sl_1041030875` share title, icon and
language — the only duplicate title in 90 storylines — so each side's fork link names the storyline
the learner is already in. Rename one, or merge them.

## `v79_q` — wrap-up sweep

Closed the three side-effects `v79_p` listed as out of scope (a note is not a guard, rule 24),
including `updateDocDir()`, whose absence meant **a static learner picking Arabic or Hebrew got a
left-to-right word bank**. Then generalised the pairing guard from one refresher to four, across
all 19 static overrides — which immediately found **`selectSrcLang → refreshScriptPickers`**, a
second dropped script-pick reset nobody had gone looking for.

**Remaining soft spot, named not implied:** the REFRESHERS list is a judgement about which calls
re-sync visible UI. It needs extending when a new one appears.

## `v79_p` — the stale TTS row was a STATIC-BUILD gap

The photo showed the row's **flag** on French too, and the flag has always come from `APP.lang` —
so `v79_o`'s account could not explain it. What does: `updateTtsVoiceNote()` was never called on
that path at all. `build-static.js` re-implements `selectLang`; the override set `APP.lang` and
stopped. The Test button looked right only because `ttsTestVoice()` reads `APP.lang` at CLICK time.

**`v79_o` was a real fix the user could not have seen**, because its code path does not run in
static mode. The override now mirrors it. `unit-static-selectlang-tts` guards the PAIRING for all
19 re-implemented functions, not just this one.

**Still dropped by the static `selectLang`, out of scope and now on the record:** `updateDocDir()`
and `updateArcScriptRow()`.

## `v79_o` — three items from your static-`v79_l` pass

**Script primer: the new card is now used in BOTH directions** — a reversal of `v79_g`, which had
deliberately scoped it to `glyph_sound`. Your two screenshots were the argument. Audio stays scoped
to `glyph_sound`, because in the other direction the glyph is the ANSWER.

**The selector now follows a target-language change.** It read `APP.ttsLang || L.tts` while the Test
button speaks `APP.lang` and ignores `APP.ttsLang` — which is exactly why the test used Polish and
the selector did not. Both go through `_speechLocaleFor` now, and a stale override pointing at the
previous target is cleared.

**The row is tighter:** "Test" and "Mute:" are gone as visible text and live in the tooltips, so no
ui.json key is orphaned.

**Your source/target worry: answered and guarded.** `APP._ttsVoiceName` is global, so the doubt was
fair — but `_ttsPickVoice` looks the name up inside the ranked list for the language being spoken,
so a name from another language is not found and the ranker takes over. `unit-speech-locale` §11
speaks Italian then German with an Italian voice selected and asserts each keeps its own.

## `v79_n` — speech locale per storyline and chapter

Your ruling: **locale, not voice name.** Chapter `speechLocale` overrides storyline `speechLocale`,
which overrides `languages.json` — the pass-mark shape. `_speechLocaleFor(lang, topicId)` is the
one resolver; both speak paths consume it at the single point where a language code becomes a TTS
code. Teacher-mode selectors sit in the existing `#ls-passmark` / `#sl-passmark` blocks.

**Two things fell out for free and are guarded rather than assumed:** old chapters need no
migration (absence resolves to what absence always resolved to), and "fall back on an available
speech for that language" needed no new code, because `_ttsRankVoices` already filters on the
language prefix and only PREFERS the exact locale.

**The trap avoided:** the saved-list payload is a whitelist projection and the resolver reads
`APP.savedList`. Omitting the field would have made the setting save, persist, and silently do
nothing in live mode — the v74_i failure whose post-mortem sits two lines above the line I added.
`unit-speech-locale` §8 pins the projection at source level.

**⚠️ NEEDS A DEVICE PASS:** set a storyline locale in teacher mode, confirm chapters inherit it,
override one chapter, and check a locale your phone lacks (marked ⚠) still speaks in the right
language rather than going silent.

## `v79_m` — the screenshot changed the diagnosis

**The device HAS en-GB installed.** The teacher-mode picker lists en-GB, en-US, en-AU, en-IN, en-NG
with en-GB selected — that ordering IS `_ttsRankVoices` working. So `v79_d` (ranking) was right and
`v79_l` (persistence), though a real bug, **cannot explain the report**: with en-GB present the
ranker re-picks it after any reset.

**The cause is the empty-`getVoices()` window.** After a screen change on Android the list is `[]`
for a while; `_ttsMakeUtterance` then returns an utterance with no `.voice` and the OS picks its own
default English — Nigerian on that phone. It fits the report's shape, which nothing else did: the
sound test works, the next lesson does not. The speak paths now defer the first chunk until voices
load (`_ttsWhenVoicesReady`, bounded at 1200ms so a missing `voiceschanged` cannot mute the app).

**A fixture was corrected, not just extended:** `unit-tts-voice-persistence` claimed to reproduce
the reporting device while using a no-en-GB inventory inherited from a comment's hypothesis. It now
uses the screenshot's real list. **A guard is only as good as its fixture's provenance.**

## `v79_l` (session 34, cont.) — fork centring, and the speech-voice fix

**Fork layout:** the storyline you are reading now sits in the CENTRE, alternatives split to either
side (`alt | own | alt` on the 3-way fork). Guarded by `unit-fork-display` §5b, revert-verified.

**The Android English readout — the diagnosis is the finding.** `v79_d` fixed the ranker, and the
ranker was not the remaining problem. The chosen voice has been persisted as `imp3_voice_<code>`
since v55, but **nothing read it back at the point of use**: the only reader ran on the lesson-set
page and wrote `APP._ttsVoiceName`, which four navigation paths reset to `null`. The preference
survived in storage and died in memory on every navigation — precisely "worked in the sound test,
fell back to Nigerian English on the next lesson". `_ttsPickVoice` now reads the persisted choice
directly, so it no longer depends on a selector having been built on the current screen.

**The variant selector** the user asked for is on the main page beside the speech-test button,
labelled by LOCALE (`en-US`, `en-NG`) because Android voice names often do not distinguish them.
Hidden when there is nothing to choose; rebuilt on `voiceschanged`.

**Answering "aren't there official defaults for each language?"** — `languages.json` already holds
one per language (`en` -> `en-GB`, `pt` -> `pt-PT`, `de` -> `de-DE`); that IS the app's default and
it is what the ranker asks for. There is no universal registry that makes a region canonical; the
nearest thing is CLDR's "likely subtags", which would say `en` -> `en-US` and `pt` -> `pt-BR`. **The
bug was never a missing default — it was what happens when the default locale is not INSTALLED**,
which is a per-device fact no table can fix. Hence a persisted user choice.

**Dead markup found:** `#tts-footer-landing` (with its `-landing` selectors) has existed since v55,
is `display:none`, and is toggled by nothing. Left in place — `onTtsVoiceSelectGlobal` syncs it by
id — but it is not the selector anyone sees.

**⚠️ A guard that was green for the wrong reason**, caught by revert-verify:
`unit-tts-voice-persistence` first chose the voice the ranker would have picked anyway, so it
passed with the fix reverted. It now asserts the fixture differs from the ranker's pick first.

## What session 34 shipped, and the one ruling it needs back

**`v79_k` — the forked-storyline display** (roadmap §0). The other fork is now drawn COMPLETELY
rather than as a one-card stub; the `⑂A/B/C` marker became nothing on the open storyline and the
other storyline's icon+title elsewhere; and the whole greyed branch opens that storyline, so a
learner switches between forks from either side. **The user's ruling shaped it:** *"don't draw the
shared prefix multiple times, keep the forking"* — so a greyed branch starts AT the fork, the shared
chapters stay drawn once above it, and **the `_rendered` collision every prior note warned about
never happens**; it belonged to the rejected design.

**The fourth part needed no code.** "Shared chapters count the same for every fork" was measured
TRUE before anything was edited: completion is keyed by topic NAME and `_slProgressStats` walks a
storyline's own `chapters[]`, so a chapter both forks list already moves both decks identically.
`unit-fork-display` §6 pins it; revert-verify shows §6 passes on the pre-change code, so it is a
pin rather than a fix, and the write-up says so.

**⚠️ ONE RULING OWED BY THE USER — the ASYMMETRIC fork.** `sl_1041030875` lists one chapter that
continues from a chapter it does not contain, so it has no fork parent to branch from: no shared
prefix on screen, and playing that prefix moves the other deck and not this one. **Add the shared
ancestors to `chapters[]`, or have the display reach back across `continuedFromId` without touching
the data?** Roadmap §0 has it in full. Do not pick one unasked.

**Found while measuring, not fixed, not a fork bug:** `_slProgressStats` adds one for the
in-progress chapter, so **every single-chapter storyline reads 1/1 and a 100% bar with nothing
played**. Changing a headline number wants its own ruling.

**Two corrections to the record**, both in INTERNALS §6b: the old row saying the fork stub "renders
only `kids[0]`" was **wrong** (it drew one card per foreign kid; the truncation was the missing
recursion), and `tp_17825433860400000751` "Kalila and Dimna" names **itself** as `continuedFromId`
— inert in the client, but it makes a naive successor scan report a phantom 9-way fork.

**New standing tool:** `build_history/probe_forks_v79k.js` — enumerates every fork under the
client's own parent rule and reports what the screen and the completion helpers do with each.

## What is open

See `roadmap_v80.md` → "⚠️ OPEN AT THE v79 CUT". In short: a **PLANNED REWORK removing
`reinforce`/`neutral`/`extend`**, which the per-text learning scheme is the natural replacement for
— **do not remove them first and design after**; and the **per-text scheme discussion** itself,
whose prerequisite coverage measurement is already done: 9.2% of story tokens, 8.2% of types,
rarest words least covered at 5.1%.

**Closed in session 33 from the user's bug list:** the storyline-summary Cancel button (`v79_c`),
the wrong-region English voice (`v79_d`, the second report — `v74_j` fixed only the case where the
requested locale IS installed), the script pin reaching every target-text prompt (`v79_f` — `v79_a`
covered three prompts of fourteen and its shipped row is now marked SUPERSEDED), and the
script-primer glyph card plus an untranslated language name in its badge (`v79_g`).

Also closed: the script lesson missing from the STORYLINE-level add-lessons form (`v79_h` — the gate
was right, the row was absent from `ADD_LESSON_TYPES` and from the server's `ARC_LESSON_TYPES`
whitelist), and the word-forms prompt (`v79_i` — the rule was already there and the prompt
contradicted it three bullets earlier; the fix was to DELETE the bullet that asked for the defect).

Also closed: the `v71`-era roadmap item **"live mode with teacher mode OFF must hide every editing
control"** (`v79_j` — `_canEdit()` keyed on capability as well as role, so a learner on a live
install saw every editing affordance; generation stays on `canGenerate` by user ruling).

**The forked-storyline display SHIPPED as `v79_k`** (session 34) — three parts built, the fourth
measured already true, and **one ruling owed on the asymmetric fork** (see the session-34 block
above). The warning that "the progress-counting half is the risky one" turned out to be **wrong in
a useful way**: progress needed no change at all, because it is keyed by topic name. Import "new"
mode is still **POSTPONED by the user** to a possible future feature (§0b) — do not start it
without raising it.

**`v79_l` NEEDS A DEVICE PASS, and it is the point of the change:** on the Android that reads
English as Nigerian, open the main page, pick a variant from the new selector beside the speech
test button, press Test, then **start a lesson and listen**. The lesson is the step that used to
lose the choice. If it still reverts, the remaining suspect is the OS ignoring `u.voice`, not the
app forgetting — say which and I will chase that instead.

**A FOURTH thing wants a browser, and it is one click:** open a storyline with a fork
(`sl_1191899409` "Dolomites Disaster" is the clean two-way case) and **tap the greyed branch**. It
must open the OTHER storyline, not the chapter card under your finger, and **Back must return you
to the fork you came from**. The guard asserts the wrapper carries `_openStorylineById` and the
inner cards are `pointer-events:none`, but which element wins a real click is a browser
event-dispatch fact no container can see (rule 34). Also worth a glance: the fork marker should
read as the other storyline's title, and nothing at all above your own column.

**Three releases need a LIVE pass** before their claims are more than wiring: `v79_f` (regenerate
the conjugation lesson of `tp_17864554460460000107`, watch for the new `[script]` log line),
`v79_i` (regenerate a word-forms lesson, then re-run `build_history/probe_word_forms_v79i.js` and diff its header
numbers — the Aug 14 movement is NOT a result, that lesson was hand-edited, not regenerated), and
`v79_g` (play a script-primer lesson and listen).

**Closed in session 33: `useFullChain`.** The user ruled *make the label true* and `v79_b` shipped
it — the story prompt now takes the whole chain through `collectChainStory`, sized for `num_ctx`.
The label and tooltip were left alone because they became true. Details in the shipped table and
`v79_session33_notes.md`.

**Nothing is owed by the user.** Two items that were on that list are withdrawn — the "mixed-script
chapter" is `reinforce` working as designed, and the `cyrillic-sr` sounds column was never owed
(its absence enforces a `v75_g` ruling). Both corrections are in the session-32 notes §25.

**Buildable without a ruling:** §0h question navigation, which wants its own session (`C.cur`,
`check()`, per-run answer state, and `_speakAndAdvance`, which advances one way only). §0d is empty.

## What session 31 settled — §0b DONE, and §0c STARTED

**`v77_v` shipped §0f** (the story is read aloud when it unlocks — muted stays muted, once per
chapter, never interrupting speech in progress) and **`v77_u` shipped the APOSTROPHE fix**: 17
vocabulary words across 13 chapters now match that never could, folded as Unicode machinery rather
than a table.

**`v77_t` shipped §0g's code half:** a repeated comprehension lesson asks only the questions not yet
answered correctly, and Next restarts that lesson while any remain. **§0g's model-prompt change is
still OWED BY THE USER** (needs a live model). Next up was agreed as the **apostrophe fix**
(U+0027 vs U+2019) as a quick standalone release.

**`v77_s` (user):** wiping progress now clears the **`chapterDone` stamp**, so chapters re-lock and
the storyline bar empties — both of the user's first two notes were that one bug. Summaries moved
into the standard read-aloud field. **⚠️ And a RETRACTION: `v77_p`'s below-mark re-ordering is
unreachable while any lesson is unfinished** (`nextLessonIdx >= 0` is tried first), so it is not
what fixes the reported replay. **Open: why `_firstUnfinishedLessonIdx` returns -1 while an unplayed
comprehension lesson remains.** Prime suspect is its first line, `if (setComplete(d)) return -1;` —
a chapter that reads COMPLETE stops the search, and `chapterComplete` trusts the cached
`chapterDone` stamp that `v77_s` found surviving a wipe. **The `v77_s` fix may already have cured
it**; the user is watching for a recurrence. Full note in INTERNALS §2.

**`v77_q` (user):** the next-chapter card is now the STARTER for chapters 2..N (summary, header,
storyboard, bars) and the entry card is chapter one only; and **all five progress cards render an
identical header**, matching the storyline page, from one `_cardHeader(prefix)`. **Any new card page
must call it** — markup parity is not header parity, as the first attempt proved.

**`v77_p` (user):** Next opens UNPLAYED work before a coverage replay (it was sending learners into
replays instead of the comprehension questions); the story PREVIEW panel is gone entirely (locked
means locked, vocabulary only); the headline fraction counts **unlocked chapters, not lessons**; and
the entry card shows the real progress bars. **⚠️ Owed: the ordering claim in the first item does not
discriminate under revert** — `unit-story-unlocked-page` §6 records why, and it needs chasing.

**`v77_o` (user):** the entry card matches the other cards and now opens the STATIC build too
(`build-static.js` re-implements `loadSaved` — **rule 15, third time**); the finished card hydrates
chapters that the LIVE list projection ships without `story`; and **Next is never greyed** — below
the mark it leads to a coverage-short lesson, so a mixed round re-samples toward what is unsolved.

**`v77_n` (user):** the card header now spans the column like the storyline page's —
`.card-screen` needed `align-items:stretch`, because the card screens ARE the centring `.screen`
while the storyline page nests its content in a full-width `.sl-screen`. **Any new card page needs
`.card-screen` for this reason too.** The progress message also moved below the play buttons.

**`v77_m` fixed three things the user found in a browser pass:** the card's row order now mirrors the
storyline page (title+bar → storyboard → chapter bars → story+vocabulary → icons → buttons); the
story-finished card no longer fires on a **stale `chapterDone` stamp** (it now requires the
done-flags, and an unverifiable chapter counts as NOT done); and the story-unlocked page highlights
vocabulary like the card panel does.

**`v77_l` shipped §0d and ruling 1.** The card now reads verdict → **story** → its words → then the
storyboard, bars, icons and actions. `v74_l`'s hide-list is retired: Replay is always available and
Next is no longer the only route out. Measured: exactly 8 of 32 rows changed, as `v77_e` predicted.

**`v77_k` (user-requested):** every page of the walk now shares the storyline page's 540px column
via `.card-screen` — **the four pages added in `v77_f..v77_j` had no width rule at all** — and the
summary card is the **actual entry point**: opening a chapter shows it first and its forward starts
the lesson. Skipped when there is no summary, and after the next-chapter card so interstitials
never stack. **Add `.card-screen` to any new card page**, or the width jump comes back;
`smoke-render` asserts all five wear it.

**`v77_j` shipped the story-unlocked page — the walk is COMPLETE.** Shown once per chapter when the
prep gate flips; the progress card's own story panel stays, per the user's "sits beside it" ruling,
and is asserted to stay.

**`v77_i` shipped the next-chapter-unlocked card** — finishing a chapter now names what it opened
before carrying the learner in. Same destination, one page in between.

**`v77_h` shipped the summary card** — §0c's first page — and with it the first link of the
navigation spine (`comp-prev`, a NEW id: `comp-back` stays deleted). Hidden when the storyline has
no summary, so it never leads to a blank page.

**Ruling 2a is CONFIRMED by the user's browser pass:** the 🎉 card appears only on genuinely
finished stories. The narrower gate is the ruling — do not widen it.

**`v77_g` renamed the preview panel** to `comp-story-panel`, freeing the name for §0c's real
story-unlocked page. Pure rename, measured. `unit-card-consistency` now sweeps for the old id — a
half-done rename is invisible otherwise, since the stub auto-vivifies any id.

**`v77_f` shipped the story-finished card** — §0c's last page, built first because ruling 2a forbids
deleting `v74_o` until it exists and Next reaches it. New `finished-screen`: the whole story as
collapsible chapters, the cumulative vocabulary learned, back to the progress card, onward to the
storyline. **Ruling 2a was applied to ONE path deliberately:** the terminal branch also fires for a
learner who finished the LAST chapter with earlier ones unplayed, where a celebration would be a
lie — that case keeps `v74_o`'s hand-off. Both halves are clicked and revert-verified. **Say if you
want the card in both cases.**

**Still to build in the walk: summary (its FIRST page), story-unlocked, next-chapter-unlocked**, and
the back/next spine. §0h (back/next on the QUESTION cards) remains its own session.

## What session 31 settled — §0b is DONE, both halves

Opened GREEN at 182. Two releases, `v77_b` and `v77_c`, both revert-verified.

- **`v77_b`** — the **7 swallowing `catch(_) {}` blocks in `showComplete` are visible.** Each reports
  site+message to a per-render ledger (`_cardErrors()`); `APP._cardStrict = true` rethrows at the
  site. **Default behaviour unchanged.** Measured after: **0 swallowed errors across 1216 renders
  over all 304 topics** — the catches hide nothing today, so this is a net for the rework. The
  `probe_gates_v76` truth table diffs identical.
- **`v77_c`** — the **coverage key-space question is SETTLED: a seeding artefact, not a bug.**
  Coverage reads ITEM keys (`v74_c`), the v76 probe seeded QID keys, and the two spaces are
  **disjoint** (61 vs 24, 0 shared). `markSolved` writes both; a learner driven through the real
  solve path converges 62→95→95→100 and unlocks in **4 rounds** (builders sample, so replaying is
  the designed way up). New guard drives the real path instead of seeding.

## ⚠️ A correction session 31 found — read before starting §0c

**`comp-back` DOES NOT EXIST.** 0 occurrences of `id="comp-back"` in `index.html` and
`docs/index.html`. It was **deleted in `v71_k`** (`#comp-hdr`'s title is the route back), and
`unit-card-consistency` asserts its absence deliberately. The gate table showed it because
**`lib-dom` auto-vivifies any id**, so the probe measured a phantom; `comp-story` is the same.

So §0c's *"already there and already dead — revive or replace"* is backwards: **the navigation spine
must be BUILT**, and reusing that id means updating the guard too. Also: **`comp-story-unlocked` is
the whole bordered PANEL**, not a label — the §0c rename touches a container and its four children.
Both `v76_card_gates.md` and roadmap §0c have been corrected in place.

## Standing rules worth re-reading (26 now, in `roadmap_v78.md`)

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
8. **(new, 15)** **A fix to the client is not a fix to the published build.** `build-static.js`
   re-implements part of `index.html` (`loadSavedList`, `savedItemHtml`). The `v76_e` guard passed
   for two releases while `docs/` stayed broken. Assert against `docs/index.html` —
   `loadClient({ file })` drives it under the same harness.

## Next session — START HERE

### 1. The user's testing notes are ALREADY TRIAGED — see roadmap "USER TESTING NOTES".

Session 31 triaged the batch into five groups (A fixed, B small, C prompt work, D needs
reproduction, E larger features). **Start from group B** — small, self-contained, and each one
names the trap to avoid. The user may have more notes since; triage those the same way.

### 1b. How that triage went, if more notes arrive

The user tested heavily across this session and has collected more notes than one session should
swallow. **Do not start §0e/§3 or §0h before reading them.** Expect the same pattern this whole
session followed: most items are small, several are the same bug seen from different angles, and one
or two will turn out to be measurement artefacts rather than defects.

What worked, and is worth repeating:
- **Measure before believing the report OR the code.** Four of five findings in
  `v76_card_gates.md` were seeding artefacts; two of the user's own notes turned out to be one bug
  (`v77_s`); and one of my own fixes turned out to be unreachable dead code (`v77_p`, retracted in
  `v77_s`). A browser symptom and its cause were rarely the same thing.
- **Group before fixing.** "Bar fully green" and "wipe doesn't re-lock" looked like two items and
  were one stale `chapterDone` stamp.
- **Say so when a fix is unproven.** Two guards this session could not be made to discriminate;
  both are labelled in-place rather than left to imply protection they do not give.

### 2. One OPEN DEFECT the user is watching for

`_firstUnfinishedLessonIdx` can return -1 with a lesson still unplayed — full note in INTERNALS §2,
including the prime suspect and the debugging trap. **`v77_s` may already have cured it.** If the
user reports it again, that note is the starting point.

### 3. Then the remaining queue

- **§0e's ordering half + §3 highlighting**, sharing ONE matcher. **Needs re-planning, not
  implementing:** the roadmap records that the v75 plan was measured twice and is wrong. `v77_u`
  already fixed the apostrophe half of that area.
- **§0h — question navigation.** Its own session: `C.cur`, `check()`, per-run answer state, and
  `_speakAndAdvance`, which today advances in one direction only.
- Smaller, still open: §3b (the Android English voice), §5 (`_sbChapterTarget`), §6 (the
  storyline-page TTS selector), and the RECOVERED items carried since v71.

### 4. Standing tools built this session — use them

- `_cardErrors()` — assert it is empty after any card render you add (`v77_b`).
- `probe_gates_v77.js` — re-run and diff after every card change. Do NOT use
  `v76_card_gates.md`'s table; `v77_card_gates.md` is the corrected one.
- `_cardHeader(prefix)` — **every new card page must call it**, and must wear `.card-screen`.
  Markup parity is not header parity (`v77_q`) and id parity is not width parity (`v77_n`).

## Owed by the user, not doable in a container

- **A browser pass**, now including `v76_e` — see "how to see it work" in the session-30 notes.
- **Confirm the `v76_e` product judgement**: filtering the library to one language now shows a
  mixed-language storyline **whole**, including its chapters in other languages. The alternative
  leaves *"the lessons in a different language didn't show up"* unfixed. Say if you want it reversed.
- **The Android English voice.** `v74_j` fixed only the case where the exact locale is PRESENT; with
  no `en-GB` installed the ranker falls through to quality alone and a NETWORK `en-NG`/`en-IN` beats
  the LOCAL `en-US`. The obvious fix is barred by the design principle — choose between
  `voice.default`, `navigator.language`, or shipping §6's selector so you pick once.
- **The pass mark.** `Churros` is 40 items where it was 83 questions, and an item is solved by ANY
  correct answer, so 80% is a materially lower bar. Needs a browser pass, not a code change.
- **A `cyrillic-sr` sounds column for the `latin` letter table** (`v78_g`, NEW). Teaching the Latin
  alphabet TO a Serbian-Cyrillic reader is not offered, because `latin.soundsFor` carries `cyrillic`
  — Russian-flavoured respellings ("эй", "си") — and not `cyrillic-sr`. **Aliasing one to the other
  is a language judgement, not a code change**: Serbian Cyrillic has no э/ы/ё, so the answers would
  be printed in letters the reader does not use. Needs a real column (26 respellings) from a model
  pass plus a native check — the same treatment `v75_g`'s table is still owed. Until then the
  direction stays off, asserted with its reason in `unit-script-digraphic` §8 so adding the column
  flips it deliberately rather than silently. The direction the user actually built
  (latin reader → cyrillic-sr) works today: `cyrillic-sr` has no `soundsFor` restriction at all.
- **`translate-ui.js --langnames`** — `languages.json` name cells still empty. The last real run
  reported **119 missing of 1024**: `lb` 31, `sr` 32, `hr` 32, and 2 each (`sr`/`hr`) for 12 other
  languages. **`v78_c` fixed the crash that ended that run**, so it can be re-run; it saves per
  batch, so an interrupted run keeps its progress.
- **`sr`/`hr`**: the `ui.json` pass is **DONE for `sr`** (612 keys, arrived session 32) and **still
  owed for `hr`** (0 keys). Also still owed: the 28 non-English `names` entries, and a
  **native-speaker check of the `cyrillic-sr` table** — authored in-container, the exact case the
  design principle warns about. **Worth confirming: the returning `sr` UI is 100% LATIN script,
  zero Cyrillic.** Plausibly intended, but `sr` is the digraphic language and the user has just
  built a Latin→Cyrillic storyline.
- **The translate pass** for `complete.words_solved` and `form.finish_mixed` (`en`-only). `t()` falls
  back through English meanwhile. **`v71_q`: never assert a dropped key absent.**
- **The comprehension QC checker** — needs a new prompt and a live model.

**`en`-only keys owed to the translate pass.** The 30 already-translated languages are each missing
**14–16** of the current 617 `en` keys; `sr` is complete as of the session-32 drop and `hr` has none.
The named ones:
- **`v78_e`** — `chapter.clear_progress`, `chapter.clear_progress_confirm`,
  `chapter.clear_progress_done`.
- **`v78_b`** — `ex.syn.q_synonyms_n`, `ex.syn.q_antonyms_n`. **Both carry TWO placeholders — a
  translation that drops `{n}` loses the feature for that language.** The uncounted `ex.syn.q_*`
  keys stay as the fallback: **do not delete them.**
- **`v77_k`** `summary.start`; **session 30** `form.script_pick`; **`v77_f`** `finished.title`,
  `finished.vocab`, `finished.next`, `finished.back_card`.

`t()` falls back through English meanwhile. **A test asserting a key is "en-only" is correct while
the key is NEW and wrong once it has been translated** — `unit-syn-count` §5 still asserts it and
will need flipping to "no language holds the English string verbatim" after the next pass.

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
