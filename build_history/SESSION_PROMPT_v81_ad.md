# Session prompt — written at the `v81_ad` cut (session 41, in progress)

*(Rename this file for the version the session WRAPS UP WITH. `SESSION_PROMPT_v81_ac.md` was the
previous one — superseded by this file and renamed, not kept alongside. Keep using the double-
letter suffix scheme (`v81_ae`, `v81_af`, …) unless a future session has a good reason to switch to
`v82_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Fresh session picking up from the **`v81_ad`** cut.

**`v81_ad`: `PLAN §C4`'s LAST piece — the speech-mismatch status pill — and `§C4` is now fully
done.** The user's original UI brief: "If a lesson is using speech different from its intended
target/chapter/storyline locale, the SC shows an explicit status pill and a one-click restore
action for the intended speech." Measured first: two SEPARATE mechanisms, `_speechLocaleFor()`
(`v79_n`, the AUTHORED intended locale) and `APP.ttsLang` (a global OVERRIDE, set only by the
lesson-set footer's "speech language" picker). The mismatch is exactly `APP.ttsLang`, when set,
disagreeing with `_speechLocaleFor()` for the open lesson — individual read-out buttons pass their
own explicit langCode and bypass the override entirely, already guarded by
`unit-speech-locale.test.js` §11. Shipped `_speechMismatchInfo()`, `#speech-mismatch-pill` inside
`#settings-modal` (styled like the existing `#sl-lang-mismatch-pill`), and
`restoreIntendedSpeech()` (clears `APP.ttsLang`/`APP._ttsVoiceName`, the same pair
`goLanding()`/`goLandingClean()`/`goLibraryClean()` already use). A measured non-bug found along
the way, left alone: `buildPath()` unconditionally resets `APP.ttsLang` to the plain per-language
default on every lesson-set render, which would shadow a chapter/storyline `speechLocale` if one
were ever set — but zero topics or storylines in the corpus currently set one, so nothing today is
affected. New guard `test/unit-speech-mismatch-pill.test.js`, 14 checks, 4 mutation-tested.
Verified live against both the running server and the rebuilt static build. See the roadmap's
`v81_ad` entry for the full write-up.

**Session 41, part 2: with `PLAN §C0` (the router seam, `v81_m`–`v81_u`) complete, the user asked
"what's next?" and confirmed it — splitting the landing page into a Generation Card and a
corpus/library screen (`PLAN §C5`), eventually also a Settings Card (`PLAN §C4`).** `v81_v` was
stage 1: pure naming/routing prep, zero visual change. `v81_w` is stage 2: the ACTUAL split, the
first real visual change of this track — verified in a live browser, not only headlessly. **This is
a NEW, ongoing track** — unlike `§C0`'s renames, `§C5`/`§C4` are real UI redesign, so expect further
staged releases (a Settings Card, `§C4`, is still ahead). See `v81_v`'s roadmap entry for the two
design forks ruled on before writing any code (picker duplication + sync, "home" now means the
library) and `v81_w`'s entry for how they were actually built.

**`v81_r` through `v81_u` (part 1) shipped `PLAN §C0.3` — all four remaining named surfaces.** Two
SEPARATE user rulings drove this: ruling 1 (after `v81_q`) picked `showTeacher()` alone from a menu
of options; ruling 2 (after `v81_r` shipped) said do THREE MORE, smallest first, no re-asking
between them — `lesson-set` → `lesson-screen` → `storyline-screen`. **All three of ruling 2 shipped;
the whole router-seam track is done.**

`v81_r`: a FIFTH surface seamed — the teacher dashboard, chosen directly by the user after `v81_q`'s
remaining named examples (QC/editing, library browsing) turned out on measurement NOT to be clean
separable screens. `showTeacher()` wraps `openTeacherDashboard()`; 2 callers rerouted; no
`build-static.js` reroute needed (backend-only, button hidden in the static build). Documented a
previously-unwritten harness fact in `INTERNALS.md` §5 along the way: `lib-dom`'s fake document
never parses STATIC markup outside the `<script>` block, so a static button's inline `onclick` is
unreachable by `querySelector` — the new journey's exit calls `showGenerationClean()` directly
instead.

**`v81_s`: the scoping pass the user asked for, on `storyline-screen` and `lesson-set`.** Measurement
found neither is a clean separable screen — both mix browsing with scattered edit/QC/generation
controls, and **"QC/editing" turns out not to be a screen-shaped surface in this codebase at all**
(no `.screen` owns it). A THIRD candidate surfaced during scoping, not part of the original ask:
`lesson-screen` (`startLesson()`, 12 callers) is a clean literal match for "exercise running."
Presented all three plus the QC/editing finding; **the user's ruling 2 above is what this and the
next entry both come from.** `v81_s` shipped `showLessonSet()`, wrapping `goLessonSet()`; 4 callers
rerouted (`index.html`'s `loadSaved`, `doGenerate`'s cached-hit branch, one inline button,
`confirmQuit`'s teacher fallback); `build-static.js`'s own `loadSaved` updated to match. Four
pre-existing source-text pins broke in `unit-learner-nav.test.js`, all true positives, all fixed.
Two more harness gaps documented in `INTERNALS.md` §5: `innerHTML` never reflects nodes added via
`appendChild` (assert `.children.length` instead), and the same static-markup-click gap `v81_r`
found applies here too. Mutation-tested with a standalone isolation script, since the existing
"generation" journey block caught the mutation FIRST and would have masked a vacuous new assertion.

**`v81_t`: `lesson-screen`, second of the three from ruling 2 — the cleanest match yet to one of the
plan's own named examples.** `showLesson(idx)` wraps `startLesson(idx)`, forwarding its return
value (callers branch on `false`, the guard-exit signal — unlike the previous two delegates, this
one is not called purely for effect). **12 external callers rerouted, the largest single reroute in
this track**: `loadSaved`, `buildPath`'s node click, `startNextLesson()`, `repeatForCoverage()`,
THREE separate `compNext.onclick` branches inside `showComplete`, `showStoryUnlocked`'s
`us-next.onclick`, `showStorySummary`'s `sum-next.onclick`, `tapWord`, and one chapter-icon
`onclick` built via `innerHTML` (so, unlike the teacher/lesson-set exit buttons, reachable by the
test harness). `build-static.js`'s matching call site updated. **14 test files referenced
`startLesson` by name** — sorted into stubs (unaffected), direct-call test drivers (unaffected), and
source-text pins (6 broke, all true positives, all fixed) before touching anything. Mutation-tested
with the SAME isolation trick `v81_s` needed — the pre-existing "learner" journey block catches a
broken `showLesson()` FIRST, so a standalone script proved the new block's own assertion is not
vacuous. One flake observed and cleared during verification (`unit-observations-log.test.js`, 1 of
1 in a `--quick` run, clean on immediate re-run and 15/15 standalone) — unrelated content, not this
release's doing.

**`v81_u`: `storyline-screen`, third and last of ruling 2 — the track's biggest slice.** Four
distinct entry functions already existed, each with real, DIFFERENT behaviour (same reasoning
`showGeneration`/`showGenerationClean` used for two, scaled to four): `showStoryline` (raw entry,
pushes history), `showStorylineForTopic` (resolves by topic membership, FALLS BACK to a standalone
lesson set if none found), `showStorylineById` (resolves by id, pushes — the fork-switch
destination), `showStorylineByChainId` (URL/hash entry, REPLACES history, does not even call
`openStorylineScreen` — an independent render path). **17 external callers rerouted across
`index.html`, plus 3 in `build-static.js`.** One caller was nearly missed: a grep for
`_tryOpenStorylineByChainId(chainId);` returned two identical-looking lines, and the reflex was to
assume one was the function's own retry-recursion — it was not; the real self-recursion had
different text entirely, and the "identical" second line was a genuine 17th caller inside the
`popstate` handler. **Lesson: a text match found via grep is a location, not a classification** —
read what a call site actually is, don't infer it from how many other matches share its substring.
8 test files referenced these four names; pins broke in 4 of them (13 individual assertions,
`unit-fork-display.test.js` alone had 8), all true positives, all fixed. **A real mutation-testing
gap found and closed**: the new journey first proved entry via `showStorylineById` only;
mutation-testing the other three found `showStoryline()` itself is called by NONE of its siblings,
so breaking it survived silently until a DEDICATED assertion was added — `v81_n`'s "a mutation
surviving is not proof of correctness" lesson, in the shape of "a seam with several sibling names
needs its OWN name proven." All four wrapper names are now independently mutation-tested.

**The router-seam track (`§C0`) is fully done as of `v81_u`.** See the roadmap's `v81_r` through
`v81_u` entries for the full write-ups.

**`v81_v` starts `PLAN §C5`: splitting generation off the landing page.** Measured the current
landing page first: it's three logically distinct chunks on one screen — dual-purpose language
pickers (set the generation form's target language AND filter the library), the generation form
itself (`#gen-area`, ~250 lines), and the library/corpus list (`#saved-list` + its header). Two
consequential design forks surfaced and were ruled on before any code: (1) duplicate the language
pickers but keep them SYNCED (one shared value on two screens) rather than fully decoupling them —
chosen because `selectLang`/`selectSrcLang` already carry six separate historical bug-fix
references for this exact kind of state coupling; (2) "🌍 home" and the stranded-learner fallback
now mean the LIBRARY, not generation — "home" = "see what you've made," with a dedicated "+
Generate new" entry point still to come. A third question (whether to fold in the already-documented
storyline-picker/per-chapter-dropdown/book-arc "add lesson type" drift, `§0i` reconciled against
this plan) was ruled OUT of this release, kept as its own follow-up.

**`v81_v` itself ships ONLY the "home means library" ruling, as pure routing prep — no visual
change yet.** `goLibraryClean()`/`showLibraryClean()` added, deliberately byte-for-byte
`goLandingClean()`'s body today (the actual screen split hasn't happened — both still show
`'landing'`). All 10 "home" callers (7 static buttons, 3 JS stranded-learner fallbacks) rerouted
from `showGenerationClean()`; `build-static.js`'s matching copy updated. `showGeneration()`/
`showGenerationClean()` themselves are unchanged — measured first, confirmed all 3 remaining
callers genuinely want the generation form. One test-fallout item worth knowing: a source-text
regex checking the `comp-hdr-home` button was already vacuously passing (a weak alternation
predating this release) — tightened while fixing it, not left as found. Also hit a genuine bug of
my own making while adding `showLibraryClean()`'s own mutation-proof: reusing a spy's captured-
original variable name across two `C.run()` calls in the same persistent vm context caused real
infinite mutual recursion (`Maximum call stack size exceeded`) — fixed with a distinct variable
name, documented in `INTERNALS.md` §6b so it isn't rediscovered the hard way.

**`v81_w`: stage 2, the actual split — the first real visual change in this whole track.**
`#gen-area` + `.backend-row` + the full `.lang-box` (unchanged internally, same ids, including the
script sub-pickers) MOVED out of `#landing` into a new `#generation-screen`, styled with the SAME
`sl-screen`/`sl-screen-hdr`/`sl-screen-body` classes teacher-screen/lesson-set already use — no new
CSS needed. `goLanding()`/`goLandingClean()` now `show('generation-screen')`; `goLibraryClean()`
still shows `'landing'` — the two bodies `v81_v` deliberately kept identical finally diverge. A new
"✨ Generate new" button (`.gen-btn` class, already existed) is the library's entry point.

**A structural surprise found while moving the markup, worth knowing before touching `#landing`
again**: `.landing-inner` does NOT wrap the whole screen the way its indentation suggests — it
closes right after the picker + button, and `#tts-footer-landing`/`#teacher-mode-bar`/`.library` are
children of `#landing` DIRECTLY, not nested inside `.landing-inner`. A naive regex depth-count got
this wrong twice; a real HTML parser (Python's `html.parser`, stack-tracking) settled it. The file
also carries one genuinely-orphaned extra `</div>` at the very end — harmless, pre-existing, not a
bug to fix, just something a structural check must expect rather than flag.

**The library's picker (`lib-src-lang-select`/`lib-lang-select`) is a separate, simpler duplicate** —
full option list including "all", no script sub-picker (that's a generation-time decision).
`selectSrcLang`/`selectLang` now sync BOTH directions on a real `fromForm=true` change, but a
`fromForm=false` footer-driven mid-story view still touches neither select — the library filter
must not silently follow whatever a learner happens to be reading. `applyUIStrings()` re-clones the
mirror's options from the canonical select's OWN value (`tgtSel.value`/`srcSel.value`), deliberately
not `APP.lang`/`APP.srcLang` (the active render context, which can differ while viewing a lesson).

**The static build needed real adaptation.** `renderPill()`'s "hide absent-language options" logic
used to run once against options that persist in place — now that `lib-lang-select`'s options are
torn down and rebuilt by every `applyUIStrings()` call, that hiding was silently lost on the next
language change. Fixed by hoisting it to a module-scope function and re-invoking it from
`selectSrcLang`'s static override. The old "relabel to 🗣️From/📖To" hack (which assumed one combined
picker) is gone — two real separate pickers each already read fine as-is. Three `ui.json` strings
that said "above"/"below" a now-nonexistent combined page were reworded (`en` only, per convention);
`lib.empty`'s "above" stays literally true on purpose — the new button sits above `#saved-list`.

**Verified in a real running browser** (`preview_start` + `computer`/`get_page_text`/
`javascript_tool`), not only headlessly, since this is genuine visual work: library renders with no
generation form visible, the full generation screen opens with every control intact, the home
button returns cleanly, and the live sync mechanism matches the headless test's claim exactly.

**New dedicated test file `test/unit-lang-picker-sync.test.js`** (6 checks, all mutation-tested) —
see `INTERNALS.md`'s `PLAN §C5` section for what each one guards. Along the way, found and fixed a
genuine test-authoring mistake, not a product bug: two `history.replaceState` spy blocks in
`unit-ui-journeys.test.js` had been passing WITHOUT `await settle()` by timing coincidence, not
because they were actually synchronous — exposed the moment their destinations diverged from each
other.

**`v81_x`: same-session follow-up — the static build's library "Generate new" button is now
hidden.** The user spotted it in a live check of `docs/index.html` right after `v81_w` shipped:
generation is entirely disabled in the static build (`#gen-area` hidden, a warning overlay in its
place), so a visible "✨ Generate new" button on the library screen opened a screen with nothing
usable on it. `renderPill()` in `build-static.js` now hides `lib-generate-new-btn` too, next to the
`#gen-area`/`.backend-row` hiding it already did. Verified against the BUILT artifact in a real
browser (a plain static HTTP server, not the Node backend) — `display: none`, confirmed. New guard
`test/unit-static-gen-btn-hidden.test.js` follows `unit-static-selectlang-tts.test.js`'s established
pattern (assert against the WINNING `renderPill` in `docs/index.html`, not the builder's string-array
source — the built page defines it twice and the later one wins), and mutation-tests itself.

**`v81_y`: `PLAN §C4` stage 1 — the Settings Card shell, and only that.** The user confirmed
continuing straight into `§C4`, the roadmap's "biggest UI change" bullet. Scoping it BEFORE writing
code (measured, not guessed) surfaced a real complication: the teacher-mode toggle, one of the
listed absorb items, already exists in three deliberate instances by an explicit prior user ruling
(`v78_f`, "reachable from every page that has the footer controls") — folding it into one shared
card instance would reverse that ruling, not just relocate a scattered control. Presented this plus
a staging question; **the user ruled: Stage 1 only** — a `#settings-pill` next to the login pill,
opening a `#settings-modal` that absorbs the four items that were ALREADY single-instance and
self-contained (`ui-translate-row`, `export-static-btn`, `teacher-dash-btn`, the import label),
unchanged internally. Model selection, speech/sound-test, the global mute-pill consolidation, the
teacher-mode toggle, and both acceptance-detail forks (arrow-control language selector,
speech-mismatch status pill) are all explicitly deferred to future releases. `test/unit-settings-
card.test.js` (8 checks, all mutation-tested) guards both what moved and what deliberately did not.
Verified in a real browser against the live server AND the rebuilt static build. See the roadmap's
`v81_y` entry for the full write-up, including a naming note: `showSettings()` already existed
(`v81_n`, the model-backend pill's popover) and is unrelated to this new `openSettings()`/
`closeSettings()` — both are "settings" in English only.

**`v81_z`: "keep going" on `§C4` — the global mute-pill consolidation, plus a real bug found along
the way.** Before building, presented two findings: (1) model selection and speech-language/
sound-test are CONTEXT-BOUND (model choice only matters while generating; speech/sound-test only
matters for the open lesson) — unlike stage 1's genuinely global items; (2) the mute-pill
consolidation is itself well-scoped and still global. **The user ruled both**: leave model
selection/speech-sound-test alone — their absorption into `§C4` is now CLOSED, not deferred — and
build the mute pill. `#mute-pill` joined `#corner-pills`; six scattered `.mute-btn` instances
removed (a dead always-hidden copy, the library header, the `lesson-set`/`storyline-screen`
footers, the question-nav row, the sound-test row). `updateMuteButtons()` needed zero code changes
— it was already generic. **Found and fixed as a drive-by**: `#qback` (the "← previous question"
button) carried `class="mute-btn"` too, a coincidental copy-paste artifact — clicking mute anywhere
while a question was open silently corrupted qback's "←" into a speaker icon (the click still
worked, only the label lied). Reproduced with a standalone harness script both BEFORE and AFTER the
fix. Two pre-existing guards needed genuine claim changes, not re-anchoring (rule 29):
`unit-tts-test-row.test.js` and `unit-speech-locale.test.js` §10 both used to require the
sound-test row's mute button present — inverted to require it absent. New guard
`test/unit-mute-consolidation.test.js`, 6 checks, all mutation-tested. See the roadmap's `v81_z`
entry for the full write-up.

**`v81_aa`: the "arrow control" acceptance detail — and a naming-scheme housekeeping item resolved
along the way.** `v81_z` was the last single letter in the old suffix scheme, so this release
needed a new convention — went with double-letter continuation (`v81_aa`), the least surprising
option, no guard changes needed since `base = APP_VERSION.split('_')[0]` already handles it.

The actual work: one of `§C4`'s two remaining acceptance-detail forks, deferred at `v81_y`/`v81_z`
pending confirmation. **The user flagged a possible misunderstanding on the term itself before
greenlighting the build** — explained the reading (the roadmap's one condensed sentence is the
ONLY source; no earlier elaboration exists anywhere in the tracked history), and **the user
confirmed it was correct, specifically confirming the arrow is INERT** — a plain separator glyph,
not a clickable control; the two `<select>`s underneath stay exactly as interactive as before.
Worth asking before building: a static-vs-clickable ambiguity in "control" is cheap to catch early
and expensive to discover wrong.

Shipped: the 🗣/📖 icon + "I speak"/"I learn" `<label>` pair above each of the FOUR selects (both
synced `v81_w` copies) is gone — moved into `title=` tooltips via `applyUIStrings()`'s EXISTING
`_setAttr(id, 'title', t(key))` idiom (the same convention `v79_o` already used for the sound-test
row), not a new mechanism. `.lang-pair-arrow` — a div that already existed with a bare, entirely
unstyled "→" — got real CSS now that it's the primary separator instead of a minor decorative
touch. Drive-by cleanup in the same edit: the now-dead `.form-lbl[data-i18n]` sweep (it existed to
translate exactly these two labels) was removed rather than left as a silent no-op, along with one
adjacent, already-dead, unrelated line sitting in the same block. Verified live against both the
running server and the rebuilt static build — both picker copies, plus confirming a language change
still correctly updates state, unaffected by this purely visual change. New guard
`test/unit-lang-pair-arrow.test.js`, 7 checks, 2 mutation-tested.

**`v81_ab`: three more user follow-ups, sent together right after `v81_aa` shipped.** (1) The
lang-pair arrow got THICKER and pinned to exactly the select's own live-measured height
(`height:44px`, flex-centered) so it can never grow taller than the pickers by construction — glyph
swapped from thin `→` to the heavy round-tipped `➜`. (2) Every "click to hear this text" trigger
stopped showing 🔊, which was visually indistinguishable from the newly-consolidated global mute
pill — landed first with 🗣, then an IMMEDIATE follow-up asked for 💬 everywhere the app used 🗣 for
speech, not just the read-aloud triggers: the tts-pill, the dialect-glossary labels (baked
per-language in `ui.json`, mechanically swept across all 33 blocks), and the sound-test button. The
ONE 🗣️ deliberately spared is the icon-picker's own palette entry — a real corruption risk since it
uses the VS16 variant containing bare 🗣 as a prefix; a negative-lookahead regex protected it,
verified by an exact count (30 bare + 1 VS16 = 31). New guard
`test/unit-speech-icon-consistency.test.js`, built on Rule 32 (guard the enumeration). (3) The
teacher-mode toggle FINALLY consolidated from `v78_f`'s three instances into ONE, inside
`#settings-modal` — its original reachability justification is now satisfied by the Settings Card
itself. Both `unit-settings-card.test.js` check #5 and the whole of `unit-teacher-toggle.test.js`
needed real rewrites (rule 29), not re-anchoring. See the roadmap's `v81_ab` entry for the full
write-up.

**`v81_ac`: the fourth follow-up, UI language DECOUPLED from "I speak" — the biggest single piece
of `§C4`, deliberately held for its own release.** Measured first: `APP.srcLang` was already doing
double duty as BOTH "I speak" (content/generation) AND the field `loadUIStrings()` rendered the
chrome in — opening any lesson-set or storyline auto-overwrote it (and the visible UI language)
to match that content's own source language. Two design forks put to the user directly before
writing code: **(1) field scope — ruled FULLY DECOUPLE** (a genuinely separate `APP.uiLang`, not
one field wearing two hats, so generating/playing a story never forces the chrome to switch);
**(2) lesson-set scope — ruled STORYLINE ONLY** (lesson-set's identical auto-follow stays
untouched, permanently, no overrule option there). Of ~61 `APP.srcLang` call sites, only the ones
rendering CHROME became `APP.uiLang` (`updateDocDir`'s `dir` half, the `loadUIStrings` call chain,
`topicLabelText`, `_restoreFormLang`'s restore) — the other ~55 (generation payloads, translation
hints, ledger keys, tutor scope) stayed untouched on purpose. `selectSrcLang`'s `fromForm=true`
branch (the "I speak" picker) no longer calls `loadUIStrings` at all; `fromForm=false` (the
lesson-set footer, the only remaining caller) still does. New Settings controls:
`#ui-lang-select`/`selectUiLang()` and `#overrule-sl-lang-cb`/`toggleOverruleStorylineLang()`. The
storyline footer's own picker is gone (moved to Settings); lesson-set's is untouched. New warning
pill `#sl-lang-mismatch-pill` on the storyline screen.

**A real bug, reported in the same session and reproduced live before fixing**: in
`docs/index.html`, starting a new question SOMETIMES switched the UI back to the lesson's source
language even with the fix-checkbox on. Root cause: `goLessonSet` is not just the standalone
lesson-set's entry point — it's the SHARED plumbing `loadSaved()` uses for every chapter open,
INCLUDING a storyline's own "continue to the next chapter," and its unconditional auto-follow was
silently overriding the overrule flag on every transition ("some but not all" = only chapter
transitions re-trigger it). Fixed by checking storyline MEMBERSHIP (`_storylineIdForTopic`), not
entry point — a chapter belonging to a storyline now respects overrule; a genuinely standalone
topic keeps the old unconditional behaviour, still correctly out of scope. Two more follow-ups in
the same batch: the checkbox moved onto the picker's own row, and its label shortened to "Fix"
(full explanation moved to a hover tooltip, same convention `v79_o` established). New guard
`test/unit-ui-lang-decouple.test.js`, 14 checks, including a live functional repro of the exact
reported scenario. See the roadmap's `v81_ac` entry for the full write-up.

**`§C4` is now FULLY done, as of `v81_ad`.** Model selection and speech/sound-test are permanently
out of scope; the teacher-mode question is resolved; UI language is decoupled and relocated; the
speech-mismatch status pill (the other acceptance-detail fork) shipped at `v81_ad` — see that
entry above and the roadmap's `v81_ad` write-up. Nothing is owed on this track.

**Session 40 ran across two agents: Codex shipped `v81_k`/`v81_l`, then ran out of session budget
mid-work; Claude Code picked up the uncommitted state and shipped `v81_m` through `v81_q`.**
`v81_q`: `PLAN §C0.4` — `_renderCompStoryboard` and its two single-caller helpers DELETED, a
**genuine, considered exception to "measure, don't ask"**: the roadmap's own `v80_z` entry carried
an explicit standing warning against exactly this deletion ("deleting it was never the ask... a
guard that did not say so would let a future session remove it"). A caller search found zero live
callers anywhere — including the storyline page, which `v80_z` believed still used it (confirmed
false by reading: it embeds the raw board SVG directly, unframed). Rather than pick a reading, both
possibilities (proven-dead vs. a silent regression in real, tested functionality) were presented to
the user; **the user ruled: delete.** Five test files touched for five different reasons — one
deleted outright (`unit-storyboard-frames.test.js`, 155 lines that tested the helpers only in
isolation, never proving they were wired into anything — the "tests the helper, not the caller"
shape that let this go unnoticed), one section rewritten to keep what's still true (`unit-learner-nav`
§4c), one executed section removed (`smoke-render` §12), one dead line removed
(`unit-card-errors.test.js`), one comment left alone as valid history (`lib-dom.js`). Also updated
`roadmap_v80.md`'s `v80_z` entry itself with a pointer, rather than leaving its warning looking
silently contradicted.

**`v81_p`: `PLAN §C0.3`'s SECOND bounded surface** — "progress/card state plus story navigation." All
10 remaining EXTERNAL callers of `showComplete(...)` rerouted onto `showProgressCard(...)` (9 in
`index.html`, 1 in `build-static.js`, same "both files" pattern as `v81_o`). Two internal self-calls
inside `showComplete`'s own body deliberately left untouched — implementation detail, not an entry
point. Mostly guarded by EXISTING behavioural tests (DOM clicks), which is why few pins broke despite
the size; two did break in `unit-learner-nav.test.js` and both were true positives, fixed. Mutation-
tested five structurally distinct call sites; one was caught by a DIFFERENT test file than first
suspected (`unit-next-chapter-entry.test.js`, not `unit-learner-nav.test.js`) — re-run against the
right file rather than concluding the site was unguarded. **Found, not fixed:** `build-static.js`'s
`loadSaved` is missing the entire `_isLaterChapter()` branch `index.html` has — a real, pre-existing
static/live divergence, left for its own measurement.

**`v81_o`: `PLAN §C0.3`'s FIRST bounded surface** — generation is now FULLY behind the router seam, per
the plan's own ordering ("start with generation and settings"; settings was already done at `v81_n`).
All 14 remaining callers of `goLanding`/`goLandingClean` (3 + 3 JS, 7 inline HTML "home" buttons)
rerouted onto `showGeneration()`/`showGenerationClean()` — the latter a NEW seam function, kept
separate because `goLandingClean` additionally resets the URL hash and folding it into
`showGeneration` would have silently dropped that. `build-static.js`'s OWN re-implementation of
`loadSaved` needed the same fix — INTERNALS' documented "both files" risk, not hypothetical:
`unit-learner-nav`'s static-parity check caught the miss immediately. Three pre-existing source-text
pins in `unit-learner-nav.test.js` broke as a result (true positives, all fixed, all now point at
`showGenerationClean()` with a comment naming this release). Mutation-tested three ways, all caught.
An unrelated one-off e2e flake (`e2e-lesson-edit-roundtrip`) surfaced once during a full-suite run
and did not reproduce in 3 standalone re-runs — not this release's doing, noted rather than chased.

**`v81_n`: `PLAN §C0.2`, the router seam.** `APP.screen` is the one authoritative route state, written
only by `show(id)` (already the single funnel for all 21 existing screen transitions — a one-line
change). Four explicit renderers (`showProgressCard`/`showStory`/`showGeneration`/`showSettings`)
exist as thin, documented delegates to the functions that already render their screen — nothing
about HOW a screen renders changed. **Deliberately narrow at the time**: only the two call sites that
were each their underlying function's SOLE caller got rerouted (`compNext.onclick` → `showStory()`,
the settings pill → `showSettings()`); `showComplete`'s 15+ other callers were left for later, and
`goLanding`'s callers are the ones `v81_o` above just finished. Mutation-tested six ways; one
mutation (dropping `showSettings`'s event argument) passed on the first attempt because the test
harness models no real event bubbling — closed with a direct spy rather than left uncovered. Also
found and fixed, unrelated to this change: `test/unit-next-chapter-unlocked.test.js` was a dead test
for code deleted at `v80_e`, never registered in `test/run.js`, deleted in its own commit.

**`v81_m`: `PLAN §C0.1`, journey-transition tests** — test-only, no functional change. Locks the
rendered/interactive outcome of the learner walk (progress card → story-unlock → lesson →
`confirmQuit()` back), the generation landing→cached-generation→landing walk, and the settings
popover open/close, all of which `§C0.2`'s router seam had to preserve (and now does). Verified
independently before committing: ran standalone and inside the full suite (both green), and
mutation-tested one assertion (forcing `_showUnlock` to always route past the story-unlock screen)
to confirm it is not vacuous.

**Session 40 also shipped `v81_l`: `PLAN §8/B4`, BKT in shadow mode.** A newly appended graded
observation now recomputes canonical skill mastery from the append-only log using a fixed, explicit
prior (`.20`) and the plan's `.15/.10/.20` learn/slip/guess parameters. `APP.progress.bktShadow`
stores the derived skill state, tagged-topic comparisons, and only changed disagreement pairs with
the existing completion/pass-mark result. It is shown nowhere and cannot affect a gate, renderer,
picker, or progression. Pending/legacy topics without reviewed vocabulary IDs remain incomparable.
The BKT and live observation guards were mutation-tested. Full / quick suite: **235 / 209**; corpus
unchanged at that cut, 323 topics, 91 storylines, 33 languages, 617 `en` keys (see "Establish a green
baseline" above for the CURRENT count — `unit-roadmap-version`'s regex matches the first bolded
"`N` topics, `N` storylines, `N` languages, `N` `en` keys" pattern in this file, so only ONE mention
may ever use that exact bold format, deliberately not this one).

**Session 39 shipped `v81_k`: `PLAN §8/B2–B3`, the target-language skill registry and vocabulary
tagging foundation.** `skills.json` is server-side, separate from `lessons.json`; model-proposed
`<target>:vocab:<dictionary-form>` IDs become usable only after explicit review/registration or a
reversible alias. A disposable browser pass registered `it:vocab:successione`, played it, and
confirmed the first-attempt observation with that exact canonical ID.

**Session 38 shipped two things and started nothing else.** `v81_i`: one user ruling, delivered
directly rather than queued — the lesson-path's SEQUENTIAL lock ("previous lesson done") is
removed, since it was already unenforced everywhere except this one render
(`_firstUnfinishedLessonIdx`'s `_playable` never read it, `tapWord` bypasses it: 438 of 447 taps,
98%, on a fresh learner). The STORY GATE (`_storyLocked`, `v80_b`) is untouched and is now the only
lock a lesson-path node can carry. `v81_j`: `PLAN §8/B1`, the observations log — an append-only
`APP.progress.observations`, one record per graded answer, wired into `check()`. It was the largest
buildable-now item at the `v81_i` cut, flagged as the only one whose value decays while it waits.
No UI; ships silently. `skillId`/`userId` are `null` by design (skill tagging is `§8/B2`, auth is
`PLAN §9` R3 — neither exists yet).

**Session 37 shipped two user-reported bug fixes plus the `§T7` ruling.** `v81_c`: arriving at a
later chapter is not finishing it — the progress card's Next was skipping the comprehension lesson
(52 of 72 chapters walked on to the NEXT chapter) and the card announced "Lesson complete!" on
arrival. `v81_d`: a word is graded only on questions a round can BUILD — 52% of highlighted words
could never turn green because the denominator counted unbuildable questions. `v81_e`: the user
ruled `§T7` reading 1 (HIGHLIGHT ONLY) and it shipped — a wrong answer demotes a word from green to
amber without touching the solved store. `v81_f`: a tap on a word with no question now opens the
lesson that TEACHES it (dead taps 181 → 79). `v81_g`: the storyline bar measures COMPLETION, so no
deck shows green before anything is played. `v81_h`: a hidden lesson's words leave the story panel,
which takes dead taps to zero.

**⚠️ A STANDING USER RULE was given in session 37 and is IN FORCE UNTIL REVOKED** — one learner only,
so progress impact is not a blocker on shipping. See the roadmap's STANDING RULE block; it does NOT
license skipping measurement. **Seven of the eight need a device pass; see
`build_history/v81h_session37_notes.md` for `v81_c`…`v81_h` (what to click, including the
containment check that matters most on `v81_e`) and `build_history/v81i_session38_notes.md` for
`v81_i`. `v81_j` ships no UI — nothing to click; see `build_history/v81j_session38_notes.md` if you
want to eyeball the log in the console anyway.**

> **THE DOCUMENT SET IS TWO FILES.**
> - **`build_history/roadmap_v81.md`** — durable. Protocol, standing rules, the open sections,
>   **TRACK T**, and the folded **THE LARGER PLAN**. Searched, never read cold.
> - **this prompt** — the only document that describes "now".
>
> **`roadmap_v80.md` is KEPT, not superseded.** The whole v80 line's release history
> (`v80_a` … `v80_z`) lives there under `# SHIPPED IN THE v80 LINE`. Go there for how something was
> built or why a guard is shaped the way it is. `HANDOVER.md` and `implementation_plan.md` no longer
> exist — folded in at `v80_d`. **Do not recreate them.**

## Orient yourself

1. **This file**, whole.
2. `build_history/roadmap_v81.md` — its **index table** and the **⚠️ Session protocol** block first,
   then **TRACK T** (the current focus), then the standing RULES.
3. `INTERNALS.md` — constants, silent-failure modes, invariants, harness limits. **§6b is a
   feature → function map** — read it BEFORE grepping for where anything lives.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 243 checks
node test/run.js --quick                  → expect 217
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Corpus at this cut: **323 topics, 91 storylines, 33 languages, 625 `en` keys** (2 new keys this
session: `settings.speech_mismatch`, `settings.speech_restore` — `PLAN §C4`, `v81_ad`, the last
acceptance-detail fork).
`APP_VERSION = 'v81_ad'`.

> **These four expectations and the four corpus numbers are GUARDED** by `unit-roadmap-version`
> against the actual suite and against the data files. **If that test fails, the number in THIS file
> is the thing to fix.**

- `unit-static-freshness` red → `node build-static.js`. **Read what it NAMES first.**
- `unit-script-choice` red saying topics are unstamped → `node backfill-script.js --write`.
- **Order matters: backfill FIRST, build-static SECOND.** A fixer is not a diagnosis (rule 23).

## The five habits that cost this project the most

1. **Measure before editing.** A warning in the notes is a claim about a DESIGN, not about the
   problem (rule 35).
2. **Guard at the layer where the claim is observable** (rule 34). **A guard that pins SOURCE TEXT
   for a claim about BEHAVIOUR cannot fail** — this cost two releases (`v80_c`, `v80_s`). Render and
   inspect, then **MUTATION-TEST**: break the rule and check the guard goes red. If it does not, the
   guard is wrong, however green the suite is.
3. **For any refactor claiming to preserve behaviour, CAPTURE the old output and DIFF it.** "The
   tests still pass" is a weaker claim — at `v80_q` the whole suite was green with a real
   contamination bug in place, found only by diffing 59 real chapter/user pairs.
4. **`buildExercises` is NON-DETERMINISTIC IN CONTENT, not just order** (`v80_t`). Any test that
   samples the corpus must accumulate across builds and be verified over ~15 consecutive runs. Seven
   successive versions of `unit-tap-word` were flaky, and **every failure was the TEST being wrong
   about correct behaviour.** The seventh was repaired at `v81_d` (0 in 40 now), and its lesson is
   sharper than "accumulate": **accumulating across builds is not the same precondition as
   CO-OCCURRING in one build.** A fixture chosen on the union satisfied the first and not the second.
   Attribution was settled by running the same 40-iteration protocol against the PREVIOUS client —
   1 in 40 there too, so it was pre-existing. Do that before blaming your own change. **It then flaked
   an EIGHTH time at `v81_h`, in a section written that same session**, and the same repair applied:
   ⚠️ **when a section needs the run to contain something, STEER it there and skip the build if it
   cannot — do not sample and hope.** Note also that this one was caught only because the PACKAGED
   copy failed where the source tree had just passed: **run the suite in the staged release
   directory, not only in the working tree.** Re-run as the standing precaution at `v81_i` (not
   touched by that release's change): **0 failures in 40 consecutive runs.** `v81_j`'s own new file
   (`unit-observations-log.test.js`, which drives a real round through `check()`) ran clean **15
   times in a row** before shipping. `v81_m`'s `unit-ui-journeys.test.js` (inherited mid-flight from
   a different agent) was mutation-tested before being trusted and committed, not merely inherited —
   don't skip verification just because a guard already exists and already reads green. `v81_n`
   mutation-tested its own six claims and one PASSED that should not have: dropping `showSettings`'s
   forwarded event argument produced no observable difference, because the harness models no real
   event bubbling. **A mutation surviving is not proof the code is right — it may mean the test
   cannot see that particular failure mode.** Add a more direct assertion (here, a call-count spy)
   rather than accept the green. `v81_o` re-confirmed rule 34 from the OTHER direction: rerouting
   `goLanding`/`goLandingClean` callers broke THREE pre-existing SOURCE-TEXT pins in
   `unit-learner-nav.test.js` that had nothing to do with this session's own new tests — a reminder
   that "run the file I touched" is not the same precaution as "run the full suite before shipping."
   All three were true positives, not flakes, and all three needed the regex updated, not reverted.
   `v81_p` added a THIRD angle on the same rule: estimating the blast radius by grepping for source
   pins BEFORE editing found one real pin — the full-suite run afterward found two more the grep
   missed. **The grep is a sanity check, not a substitute for the run.** And a mutation that a test
   file does NOT catch is not automatically proof the call site is unguarded — one of five mutations
   here was silent in the file first suspected and caught cleanly by a different one
   (`unit-next-chapter-entry.test.js`); the fix was re-running against the right file, not concluding
   the site needed a brand-new guard. `v81_q` adds a rule of its own: **a zero-callers finding is not
   by itself permission to delete.** `_renderCompStoryboard` had zero callers AND a standing roadmap
   warning explicitly anticipating that exact finding and pre-emptively saying not to act on it alone
   ("deleting it was never the ask"). The caller search was necessary but not sufficient — what
   settled it was asking the user, presenting BOTH readings (dead vs. a silent regression) rather
   than picking one, and getting an explicit ruling. Measure, then check for a standing warning
   before assuming a measurement is the whole story, then ask if the two disagree.
5. **Never put emoji in a Python string literal** (rule 25); write them via a `cat` heredoc. And
   **check what a mechanical rewrite DID** — `v80_d`'s blanket replace mangled six sentences
   including a heading.

---

# WHERE TO START

## 1. ✅ NO RULING IS CURRENTLY OWED — the queue is clear

*(`v81_i`'s sequential-lock removal was a ruling delivered directly by the user, not drawn from
this list — nothing below was open because of it, so nothing here changes. `v81_j`–`v81_u`
(`PLAN §C0.1`–`§C0.4`, plus five further surfaces, Track B) all came from §3 below and are struck
there as they shipped — the whole router-seam track is DONE. `PLAN §C5` (`v81_v`–`v81_x`) is a NEW
track with its OWN two rulings, given directly when the user confirmed "what's next": (1) duplicate
the language pickers but keep them synced, not fully decoupled; (2) "🌍 home" now means the library,
not generation. **Both rulings are now FULLY BUILT**, plus a same-session follow-up (`v81_x`) — `§C5`
is done. `PLAN §C4` (the Settings Card) followed with several further scoping rulings: **Stage 1
only** — shell + the four already-self-contained absorb items (`v81_y`); then, on "keep going"
(`v81_z`), **model selection and speech-language/sound-test are OUT of this track entirely**
(context-bound, not global — a closed decision, not a deferral) and **the global mute-pill
consolidation shipped**; then the user confirmed the "arrow control" acceptance detail's meaning
(the arrow is inert, not a clickable control) and it **shipped at `v81_aa`**; then THREE more
follow-ups (arrow thickness, read-aloud icon consistency, teacher-mode consolidation) all shipped
at `v81_ab`. Then the fourth, biggest item from that same batch — UI language DECOUPLED from
"I speak", moved into Settings, reversing a prior placement decision, with two more forks ruled
directly (fully decouple; storyline only) — **shipped at `v81_ac`**, along with a same-session bug
fix (the overrule flag was being silently bypassed on storyline chapter transitions, because
`goLessonSet` is shared plumbing `loadSaved()` also uses for those) and two more small follow-ups
(checkbox moved onto the picker's row, label shortened to "Fix"). Then the LAST acceptance-detail
fork, the speech-mismatch status pill, measured and built without needing a further ruling (the
mechanism was unambiguous once the two speech layers — `_speechLocaleFor()` vs. `APP.ttsLang` —
were actually traced) — **shipped at `v81_ad`. `§C4` is now FULLY done, nothing owed.**)*

All three items that headed this section at the `v81_b` cut are closed:

- ~~`§T7`, the SCOPING question~~ **✅ RULED at `v81_e`: reading 1, HIGHLIGHT ONLY** — a wrong answer
  takes a word out of green via a PARALLEL `wrong` store; the solved store stays monotonic. `§T7` in
  the roadmap is now marked RULED AND SHIPPED. ⚠️ **Reading 2 (mastery decay) is NOT ruled**, remains
  `PLAN §9b/D2`, and is still blocked on `§8/B4`. If it is ever re-opened, start from the fact that
  the roadmap's original reader list was incomplete — the ROUND BUILDERS read the solved store too.
- ~~The WORD GATE switch~~ **✅ RULED at `v81_a`: leave it off.** ⚠️ Its numbers went stale at
  `v81_d`; re-measure before re-opening.
- ~~Entry cards for chapters > 1~~ **✅ RULED AND SHIPPED at `v81_b`.**

**So the next session can start on something buildable without waiting.** The largest owed item is
not a ruling but a DEVICE PASS — see §4.

## 2. The PASS MARK is still owed, and still by the user

`Churros` is 40 items where it was 83 questions, and an item is solved by ANY correct answer, so 80%
is a materially lower bar. Needs a browser pass, not a code change.

## 3. BUILDABLE NOW, no ruling needed

- ~~`PLAN §8/B1`, the observations log; B2/B3 registry and new-vocabulary tags; B4 shadow BKT~~
  **✅ SHIPPED at `v81_j`–`v81_l`.** `APP.progress.observations` remains append-only; reviewed
  vocabulary IDs now feed `APP.progress.bktShadow`, which compares BKT only with the existing gate
  and controls nothing. `error_hunt`/`ai_error_hunt` and the crossword still grade differently and
  are NOT wired. The next Track B candidate is B5, a read-only aggregate surface, but it needs real
  reviewed evidence to be useful.
- **`PLAN §7.0` CP1, canonical text + report-only analysis records** — now the first buildable slice
  of the accepted parallel curriculum pipeline. It defines stable chapter/sentence/span/token IDs
  and provenance, but must not change existing lessons, player, learner progress, or publishing.
  See the durable roadmap diagram and migration sequence; CP1 comes before a new generator.
- ~~`PLAN §C0.1`, UI journey transition tests~~ **✅ SHIPPED at `v81_m`.** `test/unit-ui-journeys.test.js`
  locks the learner, generation, and settings entry/exit behaviour that `§C0.2`'s router seam must
  preserve.
- ~~`PLAN §C0.2`, the router seam~~ **✅ SHIPPED at `v81_n`.** `APP.screen` is the one authoritative
  route state; `showProgressCard`/`showStory`/`showGeneration`/`showSettings` exist as thin delegates.
- ~~`PLAN §C0.3`, generation moved behind the seam (first bounded surface)~~ **✅ SHIPPED at `v81_o`.**
  All 14 remaining `goLanding`/`goLandingClean` callers rerouted onto `showGeneration()`/
  `showGenerationClean()` (a new seam function — `goLandingClean` also resets the URL hash, kept
  distinct rather than silently dropping that). `build-static.js`'s own `loadSaved` reimplementation
  updated to match. Generation + settings, the plan's own FIRST surface, is now fully done.
- ~~`PLAN §C0.3`, progress/card state + story navigation (second bounded surface)~~ **✅ SHIPPED at
  `v81_p`.** All 10 remaining EXTERNAL `showComplete` callers rerouted onto `showProgressCard()` (9
  in `index.html`, 1 in `build-static.js`). `showComplete`'s own two internal self-calls are
  deliberately left as-is — implementation detail, not an entry point. **Nothing from `PLAN §C0`'s
  original example list remains un-seamed.** `unit-ui-journeys.test.js` is still the acceptance test
  for the FOUR original screens; extend it rather than bypass it if you touch any of them again.
  Found but NOT fixed at `v81_p`: `build-static.js`'s `loadSaved` is missing the whole
  `_isLaterChapter()` branch — a genuine static/live divergence, needs its own measurement before
  its own release.
- ~~`PLAN §C0.4`, remove proven-dead paths~~ **✅ SHIPPED at `v81_q`** (partially — one path found and
  removed by USER RULING, not a general sweep). `_renderCompStoryboard` + its two single-caller
  helpers deleted; zero live callers confirmed, but a standing `v80_z` warning meant the finding
  alone wasn't enough — the user was asked and ruled delete. **This is not "C0.4 is done"** — it is
  one dead path found and removed while working the C0.2/C0.3 surfaces, not an exhaustive dead-code
  sweep of the app. No new dead paths are known right now.
- ~~`PLAN §C0.3`, a FIFTH surface — the teacher dashboard~~ **✅ SHIPPED at `v81_r`**, by direct user
  ruling (not on the plan's original four-name list). `showTeacher()` delegates to
  `openTeacherDashboard()`; both external callers rerouted.
- **"QC/editing" is NOT a screen-shaped surface in this codebase — a scoping finding, not a
  ruling to re-derive.** Measured at `v81_r`/`v81_s`: `storyline-screen` and `lesson-set` each mix
  browsing with scattered edit/QC/generation controls; neither has a `.screen` boundary that
  corresponds to "QC/editing" alone. The router seam owns a screen's ENTRY/EXIT naming, not the
  separation of concerns mixed inside it — that would be a distinct, later, harder initiative.
- ~~`PLAN §C0.3`, a SIXTH surface — lesson-set~~ **✅ SHIPPED at `v81_s`**, first of three ruled
  together (user, after `v81_r`: `lesson-set` → `lesson-screen` → `storyline-screen`, smallest
  first, no re-asking between them). `showLessonSet()` delegates to `goLessonSet()`; 4 external
  callers rerouted, `build-static.js`'s own `loadSaved` updated to match.
- ~~`PLAN §C0.3`, a SEVENTH surface — lesson-screen~~ **✅ SHIPPED at `v81_t`**, second of the same
  three. `showLesson(idx)` delegates to `startLesson(idx)`, forwarding its return value (callers
  branch on `false`). 12 external callers rerouted — the largest single-name reroute in this track —
  plus `build-static.js`'s matching call site. Exit needed no new work: `confirmQuit()` already
  routes through pre-existing seams.
- ~~`PLAN §C0.3`, an EIGHTH surface — storyline-screen~~ **✅ SHIPPED at `v81_u`**, third and last of
  the ruling — **the whole ruling is now fully shipped, nothing owed on this track.** The biggest
  slice: FOUR distinct entry functions, each with real different behaviour, got FOUR wrapper names
  (`showStoryline`/`showStorylineForTopic`/`showStorylineById`/`showStorylineByChainId`). 17 external
  callers rerouted in `index.html`, 3 in `build-static.js`. Mutation-testing found `showStoryline()`
  itself is invisible to its three siblings' tests — needed its own dedicated assertion. See the
  roadmap's `v81_u` entry for the full write-up, including a grep-vs-read lesson about a caller
  nearly missed because two matches looked textually identical.
- ~~`PLAN §C5` stage 1 — "🌍 home" means the library~~ **✅ SHIPPED at `v81_v`**, pure routing prep,
  zero visual change (`goLibraryClean()`/`showLibraryClean()`, still byte-for-byte `goLandingClean()`
  today). 10 callers rerouted (7 buttons, 3 JS fallbacks); `showGeneration()`/`showGenerationClean()`
  themselves untouched — their 3 remaining callers all genuinely want the generation form.
- ~~`PLAN §C5` stage 2 — the actual visual split~~ **✅ SHIPPED at `v81_w`** — both design forks from
  `v81_v` are now BUILT, not just ruled. `#gen-area`/`.backend-row`/`.lang-box` moved (unchanged
  internally) into a new `#generation-screen`; `lib-src-lang-select`/`lib-lang-select` are the
  library's own synced-mirror duplicate; `showGeneration()`/`showGenerationClean()` now show
  `'generation-screen'`. Verified in a real browser, not only headlessly. A same-session follow-up
  (`v81_x`) hid the library's "Generate new" button in the static build, where generation is fully
  disabled. **`PLAN §C5` is done, nothing owed.**
- ~~`PLAN §C4` stage 1 — the Settings Card shell~~ **✅ SHIPPED at `v81_y`** — `#settings-pill` next to
  the login pill, `#settings-modal` absorbing `ui-translate-row`/`export-static-btn`/
  `teacher-dash-btn`/the import label (unchanged internally). **Deliberately stage 1 only, by user
  ruling.**
- ~~`PLAN §C4` "keep going" — the global mute-pill consolidation~~ **✅ SHIPPED at `v81_z`** —
  `#mute-pill` joins `#corner-pills`; six scattered `.mute-btn` instances removed;
  `updateMuteButtons()` needed no code changes (already generic). **Found and fixed a real bug along
  the way**: `#qback` carried `class="mute-btn"` too, silently corrupting its "←" label on any mute
  toggle while a question was open — see the roadmap entry. **Also ruled OUT of `§C4` entirely, not
  deferred**: model selection and speech-language/sound-test, both context-bound rather than global.
- ~~`PLAN §C4` — the "arrow control" acceptance detail~~ **✅ SHIPPED at `v81_aa`** — user confirmed
  the reading (the arrow is inert, not clickable) before building. The 🗣/📖 icon + "I speak"/"I
  learn" label above each of the four synced selects is gone, moved to `title=` tooltips via the
  SAME `applyUIStrings()` idiom `v79_o` already used elsewhere. `.lang-pair-arrow` (previously
  unstyled) now has real CSS.
- ~~Three `v81_ab` follow-ups: arrow thickness, read-aloud icon consistency, teacher-mode
  consolidation~~ **✅ SHIPPED at `v81_ab`** — arrow pinned to the select's own 44px height, glyph
  swapped to the heavy `➜`; every read-aloud trigger moved off 🔊 (first to 🗣, then an immediate
  follow-up to 💬 EVERYWHERE the app used 🗣 for speech — see the roadmap entry for the VS16-safety
  detail on the icon-picker's own palette entry); the teacher-mode toggle collapsed from THREE
  `v78_f` instances into ONE inside `#settings-modal`.
- ~~UI language DECOUPLED from "I speak", moved into Settings~~ **✅ SHIPPED at `v81_ac`** —
  `APP.uiLang` is now a genuinely separate field (two rulings: fully decouple; storyline only, not
  lesson-set). `#ui-lang-select`/`#overrule-sl-lang-cb` in the Settings Card; the storyline
  footer's own picker is gone; `openStorylineScreen`/`goLessonSet` both gate their UI-language
  auto-follow behind the overrule flag (the LATTER only for topics that belong to a storyline —
  see the bug fix below). **A real bug found and fixed in the same release**: `goLessonSet` is
  shared plumbing `loadSaved()` uses for a storyline's own chapter transitions too, so its old
  unconditional auto-follow was silently bypassing the overrule flag — fixed by checking storyline
  MEMBERSHIP (`_storylineIdForTopic`), not entry point. Plus two small follow-ups: the checkbox
  moved onto the picker's row, label shortened to "Fix" (tooltip carries the full explanation).
- ~~`PLAN §C4` — the speech-mismatch status pill, the LAST acceptance-detail fork~~ **✅ SHIPPED at
  `v81_ad`** — `_speechMismatchInfo()` compares the global override `APP.ttsLang` against
  `_speechLocaleFor()` for the open lesson; `#speech-mismatch-pill` inside `#settings-modal`
  (styled like `#sl-lang-mismatch-pill`); `restoreIntendedSpeech()` clears the override so
  `activeTtsCode()` falls through to the resolver on its own. **`§C4` is now FULLY done — nothing
  is owed on this track.**
- **`PLAN §C1`'s FIRST gate bug** — *"browsed forward to the story card and back, solved no
  comprehension lesson, yet could proceed."* **⚠️ THREE readings are already DEAD ENDS** — see the
  `v80_b` entry in `roadmap_v80.md` before spending time (a third, `v81_j`, was added this session:
  the story-unlocked-page round trip, and cross-chapter browsing in BOTH the live and static
  builds — all driven through the real call chain, not traced by hand, all clean). **What is still
  unmodelled is the "Back LINK" specifically, distinct from the "← Back" button the third reading
  already covers — get the exact click sequence from the user before trying a fourth reading.**
- ~~`PLAN §C1`'s single-chapter `1/1` and 100% bar, and the header off-by-one~~ **✅ RULED AND SHIPPED
  at `v81_g`**: the BAR now measures completion, the LABEL still counts unlocked chapters (`v77_p`).
  One root cause, and NOT the index off-by-one the plan guessed. `PLAN §C1`'s FIRST gate bug is
  still open and still has two dead-end readings.
- ~~DEAD TAPS, 26.1%~~ **✅ CLOSED — `v81_f` + `v81_h` take them to ZERO.** Kept here only as the
  measurement trail; nothing is owed. (Original note follows.) **✅ MOSTLY FIXED at `v81_f`** by user ruling (route the tap into the teaching
  lesson): 181 dead taps → **79**. **⚠️ WHAT REMAINS IS A DIFFERENT QUESTION, and it is a HIGHLIGHTING
  one:** all 79 are words whose ONLY teaching lesson is HIDDEN. They are marked on the story panel,
  graded by `_wordProgress`, and unreachable — `startLesson` correctly refuses a hidden lesson, so
  `false` is the honest answer for them. **The open decision: should the panel mark a word at all
  when its only teaching lesson is hidden?** Not a tap fix; needs a ruling.
  `probe_tap_reachable_v81d.js` measures it — ⚠️ it now CALLS `tapWord` rather than reading the
  question resolver, because the resolver's answer is deliberately unchanged (still no question for
  all 181); pinned one layer down it reported no improvement from a release that fixed 102 cases.
- **`PLAN §F2`'s second half** — the "answer visible in the stem" detector, measured and deliberately
  left unenforced because prefix-matching is mild morphology. Reported by
  `probe_word_forms_defects_v80g.js`.
- **`e2e-lesson-edit-roundtrip` flakes inside the FULL suite, still unfixed.** Re-confirmed at the
  `v81_r` baseline check: failed 1 of 235 on the first full-suite run of the session, then passed
  235/235 on an immediate re-run, and 3/3 standalone. Consistent with the `v81_q`-era note (2 of 4
  runs then), still nothing to do with the router-seam work — pure server-side lesson editing.
  Likely a port or teardown race with an adjacent e2e boot under load; not investigated further.
  Reproduce with several consecutive `node test/run.js` (not `--quick`, since `e2e-*` files are
  skipped there) before assuming a fix worked, and before blaming any future session's change.

## 4. ⚠️ OWED BY THE USER, not doable in a container

- **`PLAN §F3`** — the article prompt fix shipped at `v80_j` and is **UNVERIFIED BY DESIGN**.
  Regenerate MANY lessons, then re-run `probe_article_symmetry_v80j.js` against its baseline: **1.0%
  overall but BIMODAL** (191 chapters at 0%, two at 100%). **One lesson proves nothing** —
  `tp_17869977371640000022` went 7-of-8 to 0-of-8 BEFORE the fix shipped.
- **`summary.title` was retired at `v80_y`**; `lesson.read_summary` replaces it in all 32 languages.
  No translate pass is owed for it.
- **The translate pass** for the remaining `en`-only keys, `translate-ui.js --langnames`, the
  `hr` `ui.json` pass, and a **native-speaker check of the `cyrillic-sr` table**.
- **A device pass on `v81_a` … `v81_w`.** The v80 line changed every card and every question screen: the story
  panel is on all of them, never collapsed, three-state coloured, tappable, with a translate toggle;
  the progress bars moved to the bottom; the storyboard row became clickable chapter icons.
  `v81_i` adds one more thing to look at: ordinary lessons on the node path are clickable out of
  order now — see `build_history/v81i_session38_notes.md` for what should still stay locked.
  `v81_j`–`v81_p` ship no VISUAL change — the router seam changes which function ends up calling
  `show()`/`goLandingClean()`/`showComplete()`, never what gets rendered. **Worth a specific
  spot-check anyway**: the seven "🌍 home" buttons and the three JS generation-flow entries
  (`v81_o`), and the drill-completion flow, the story-unlocked page's Back/Next, the summary/finished
  cards' Forward/Back, and the ✕ quit button (`v81_p`) — all mechanically rewired across many
  scattered sites. `v81_q` removes code, not UI — the completion card's storyboard was ALREADY chapter
  icons since `v80_z`, so there is nothing new to look at, but it's worth confirming the card still
  looks exactly the same as before this cut. `v81_r` also ships no VISUAL change to the teacher
  dashboard's own rendering — only worth spot-checking that the "🎓 Learners" entry button and the
  dashboard's own 🔄 refresh button still open/refresh it (both now call `showTeacher()` instead of
  `openTeacherDashboard()` directly), which needs a teacher-mode session against a live backend to
  reach at all. `v81_s` ships no visual change either — worth spot-checking that opening any chapter
  (from the landing library, from a fresh generation, and by quitting a question as a teacher) still
  lands on the same lesson-set page as before. `v81_t` likewise: worth spot-checking that every way
  into a lesson still opens the right one — a lesson-path node tap, Next on the progress card (all
  three of its branches), the story-unlock page's Next, the summary card's forward, a word tap, and
  the chapter-icon row on the completion card. `v81_u` has the widest surface to spot-check of the
  whole track: opening a storyline from the landing list, from the lesson-set page's storyline chip,
  from a fork's greyed alternative branch, from the completion card's "back to storyline" button,
  from a fresh generation, and via a `#sl=` URL/hash link — all should still open the right storyline
  and look exactly as before (no visual change intended anywhere in this track). `v81_v` also ships
  no visual change (it's routing prep only) — worth spot-checking that every "🌍 home" button and a
  stranded solo-chapter quit still land on the SAME page as before. **`v81_w` is the FIRST real
  visual change in this whole session** — already spot-checked live in a browser during development
  (see the roadmap's `v81_w` entry for what was clicked through), but worth a second, independent
  look: the library screen should show NO generation controls at all, just the compact picker, the
  "✨ Generate new" button, and the saved-lessons list; the generation screen (reached via that
  button, or via "continue this story"/a fresh multi-chapter job) should show the FULL form exactly
  as it used to look, just on its own page with a 🌍 home button; and changing the language on
  EITHER screen's picker should be reflected on the other the next time you look.

## 5. NOT yours to start

Import "new" mode is POSTPONED. **Track A's CP1 report-only analysis (`PLAN §7.0`) is now authorised;
new input/UI import mode remains postponed.** **Mastery-driven progression (`PLAN §9b/D2`) remains a
user product decision**: B4 now runs in shadow mode, but it
must accumulate a meaningful disagreement log before that decision is reconsidered. The
learner/teacher rework — `_canEdit()` is done; `Edit / rename topic` stays visible by user ruling.

**⚠️ THE TRACK T COLOURING NUMBERS MOVED AT `v81_d`** — the denominator used to count questions no
round can build. GREEN 18.6% → **27.8%**, PARTIAL 19.5% → **11.8%**, mean questions per word 2.20 →
**1.79**. So `§T5.1`'s "mean 1.70", `§T5.4`'s "84% RED" and `v81_a`'s 95% re-lock were all measured
against the inflated figure. **No ruling is reversed; none may be re-opened without re-measuring**
via `probe_word_green_impact_v81d.js` (NOT `probe_learner_known_v80l.js`, which re-derives the
colouring inline and cannot see inside `_wordProgress`).

**Do not re-derive the per-text learning scheme measurements.** A chapter's lessons teach **9.2% of
its story's tokens, 8.2% of its distinct words**, rarest words least covered (**5.1%**). Inflection
share measured at `v80_f`: **47.3% of taught words are findable in the story, 36.4% ABSENT in any
form**, and a matcher is worth ~10 points, not fifty — **the ceiling is a GENERATION problem.**

## Standing tools — use them

**Before grepping for where something lives, check `INTERNALS.md` §6b.**

- `probe_gates_v80c1.js` — the `PLAN §C1` gate probe. Reports, does not assert.
- `probe_gates_v77.js` — re-run **and diff** after any progress-card change. **⚠️ It SELECTS its
  chapters from the corpus, so a data drop moves the selection.** This has looked like a regression
  at two consecutive cuts and been data both times. **Disambiguate by re-running the PREVIOUS client
  against the CURRENT corpus** — one command. Baseline: `v80i_card_gates.txt`.
- `probe_word_green_impact_v81d.js` — what TRACK T's colouring paints, **through `_wordProgress` /
  `_wordState`**. `PROBE_CLIENT=` diffs two builds. Use this one for anything about the screen.
- `probe_word_green_v81c.js` — declared probe keys vs the BUILDABLE universe (60.8% at `v81_d`).
- `probe_comp_skip_v81c.js` — drives `showComplete(true)` over every later chapter and CLICKS
  `comp-next`. Re-run after ANY change to the progress card's Next wiring.
- `probe_tap_reachable_v81d.js` — highlighted words whose tap resolves to nothing.
- `probe_learner_known_v80l.js` — the older colouring probe. ⚠️ **It RE-DERIVES the colouring inline**
  rather than calling `_wordProgress`, so it is blind to changes inside the collector and did not move
  at all across `v81_d`. Its "84% RED, 8.7% green" predates that fix.
- `probe_inflection_v80f.js`, `probe_article_symmetry_v80j.js`, `probe_lesson_script_v80h.js`,
  `probe_word_forms_defects_v80g.js`, `probe_forks_v79k.js`, `probe_coverage_v78n.js`.
  **All report; none assert.** The article one is explicitly NOT language-blind — its article lists
  must never migrate into the app.
- `_cardErrors()` — assert it is empty after any card render you add.
- `_storyBodyHtml(d, opts)` — **the ONE story renderer** for question panels and progress cards.
- `_wordProgress(d)` / `_wordState(rec)` — **the ONE per-word progress collector.**
- `_storyLockedLesson(L, d)` — the ONE "is this lesson closed" rule.
- `_cardHeader(prefix)` + `.card-screen` — every new card page uses both.
- `scriptPinNote(lang, script, role)` — every prompt emitting target-language text calls it.
- `recordObservation(ex, correct)` / `APP.progress.observations` / `refreshBktShadow(d)` — the
  `PLAN §8/B1–B4` evidence path (`v81_j`–`v81_l`). See `INTERNALS.md` §6b before extending it:
  only `check()`-graded exercises are logged, only resolved vocabulary IDs feed BKT, and no BKT
  value may become a reader of progression without a separate product ruling; `learners.js`'s
  `MAX_STATE_BYTES` growth ceiling remains unaddressed.
- `APP.screen` / `showProgressCard`/`showStory`/`showGeneration`/`showGenerationClean`/`showSettings`/
  `showTeacher`/`showLessonSet`/`showLesson`/`showStoryline`/`showStorylineForTopic`/
  `showStorylineById`/`showStorylineByChainId`/`showLibraryClean` (`v81_n`–`v81_w`, `PLAN §C0.2`–
  `§C5`) — the router seam. See `INTERNALS.md` §6b before extending it: `showComplete`'s own TWO
  internal self-calls are deliberately NOT rerouted (implementation detail, not an entry point —
  `unit-coverage-threshold` pins one); `showSettings` deliberately does not correspond to a `.screen`
  — it is the model-backend pill's popover toggle, UNRELATED to the new `PLAN §C4` Settings Card
  below despite the name (neither is a `.screen` either — both are modals/popovers outside the
  `APP.screen` router entirely); `showGenerationClean` is NOT the same as
  `showGeneration` — it also resets the URL hash, and `build-static.js` has its OWN copy of that
  call site (keep both in sync); `showTeacher` has NO `build-static.js` copy to keep in sync — the
  static build hides its entry button entirely; `showLessonSet`/`showLesson`/`showStoryline*`/
  `showLibraryClean` DO have `build-static.js` copies — kept in sync at `v81_s`/`v81_t`/`v81_u`/
  `v81_v`; `showLesson` FORWARDS `startLesson`'s return value (`false` on a guard exit) rather than
  discarding it — callers branch on it; the FOUR `showStoryline*` names wrap FOUR distinct real
  functions with genuinely different behaviour — not four names for one underlying call.
  **`showGeneration()`/`showGenerationClean()` now show `'generation-screen'`, not `'landing'`** —
  `v81_w`'s actual split. `showLibraryClean()` still shows `'landing'` — the two bodies `v81_v`
  deliberately kept byte-for-byte identical have now diverged for real. **`§C0` itself is fully
  done** — nothing from its original four-name list has any external caller left un-seamed as of
  `v81_p`; `v81_r`–`v81_u` add five further surfaces from two separate rulings, all shipped.
- `lib-src-lang-select`/`lib-lang-select` (`v81_w`) — the library screen's OWN synced-mirror
  duplicate of `src-lang-select`/`lang-select` (which stay on `generation-screen`, unchanged, full
  `.lang-box` including script sub-pickers). Sync is bidirectional through `selectSrcLang`/
  `selectLang` themselves (both files — `build-static.js` has its OWN overrides, kept in sync), on a
  real `fromForm=true` change ONLY — a `fromForm=false` footer-driven mid-story view must not drag
  the library filter along. `applyUIStrings()` re-clones the mirror's options every call, compared
  against the CANONICAL select's OWN `.value` (not `APP.lang`/`APP.srcLang`, the active render
  context, which can differ). See `test/unit-lang-picker-sync.test.js` and `INTERNALS.md`'s
  `PLAN §C5` section before touching either half of this.
- `#settings-pill`/`#settings-modal`/`openSettings()`/`closeSettings()` (`v81_y`, `PLAN §C4` stage
  1) — the Settings Card. `#settings-pill` lives in `#corner-pills`, a shared fixed wrapper with
  `#acct-badge` (the login pill), and unlike it carries NO default hiding — reachable on every page
  including static, which never sets `APP.info.canGenerate`. STAGE 1 ONLY: absorbs `ui-translate-
  row`/`export-static-btn`/`teacher-dash-btn`/the import label, all unchanged internally. The
  teacher-mode toggle (`_TEACHER_TOGGLES`, three `v78_f` instances) was deliberately left OUT —
  consolidating it would reverse an explicit prior ruling, not just relocate a control. See
  `test/unit-settings-card.test.js` and `INTERNALS.md`'s `PLAN §C4` section before extending this —
  in particular before assuming model selection or speech/sound-test belong here: `v81_z` ruled
  BOTH out of this track entirely, not just deferred.
- `#mute-pill` (`v81_z`, `PLAN §C4` "keep going") — the global mute pill, also in `#corner-pills`,
  `class="mute-btn"` so `updateMuteButtons()`'s existing `querySelectorAll('.mute-btn')` sync drives
  it with no code change. Six scattered instances were removed to make this the ONLY one — see
  `test/unit-mute-consolidation.test.js` and `INTERNALS.md`'s `PLAN §C4` section. ⚠️ `.mute-btn` has
  NO CSS rule — it exists purely as this query-selector target, which is exactly how a stray
  `class="mute-btn"` on an unrelated button (`#qback`, fixed this release) silently corrupted that
  button's label on every mute toggle. Before giving ANY new button `class="mute-btn"`, check it is
  actually meant to call `toggleMute()` — the class alone is what makes `updateMuteButtons()` rewrite
  it.
- `.lang-pair-arrow`/`title=` tooltips on the four language selects (`v81_aa`, `PLAN §C4` "arrow
  control"; sizing SUPERSEDED at `v81_ab`) — the 🗣/📖 icon + "I speak"/"I learn" `<label>` wrapper
  is gone from BOTH synced copies (`src-lang-select`/`lang-select` on `#generation-screen`,
  `lib-src-lang-select`/`lib-lang-select` on the library screen). The removed strings are wired to
  `title=` via `applyUIStrings()`'s `_setAttr(id, 'title', t(key))` — the SAME idiom `v79_o` used
  for the sound-test row, not a new mechanism; extend that pattern rather than inventing another
  one if a future control needs the same treatment. The arrow's own CSS now pins `height:44px`
  (the select's own live-measured height, so it can never grow taller) with the heavy `➜` glyph at
  `font-size:34px;font-weight:900`. See `test/unit-lang-pair-arrow.test.js` and `INTERNALS.md`'s
  `PLAN §C4` section.
- `💬` is now THE speech icon app-wide (`v81_ab`) — every "click to hear this text" trigger, the
  `.lang-footer-lbl.tts-pill` speech-state pill, the dialect-glossary labels, and the sound-test
  button. `.mute-btn`'s own `🔊`/`🔇` is a SEPARATE, unrelated concept — don't conflate the two when
  adding a new speech-related control. See `test/unit-speech-icon-consistency.test.js` (built on
  Rule 32 — it enumerates every `onclick="...speak...("` call site rather than hand-pinning each
  one) and `INTERNALS.md`'s `PLAN §C4` section, which also documents the VS16-safety detail for the
  icon-picker's own untouched `🗣️` palette entry.
- `#teacher-mode-btn` inside `#settings-modal` is now the ONLY teacher-mode toggle (`v81_ab`,
  superseding `v78_f`'s three-instance placement). `_TEACHER_TOGGLES` is down to one entry but
  stayed a list — register a future second instance there, don't hard-code a single id. See
  `test/unit-teacher-toggle.test.js` (rewritten wholesale for the single-instance claim) and
  `test/unit-settings-card.test.js` check #5.
- `APP.uiLang`/`APP.overruleStorylineLang` (`v81_ac`, `PLAN §C4`) — `uiLang` is the UI CHROME
  language, genuinely separate from `APP.srcLang` ("I speak"/content). Only touch `APP.uiLang` for
  something that actually renders CHROME text (`loadUIStrings`/`applyUIStrings`, `updateDocDir`'s
  `dir` half, `topicLabelText`) — everything else stays on `APP.srcLang`, deliberately, even where
  it looks similar. ⚠️ `goLessonSet` is NOT just the standalone lesson-set's entry point — it's
  shared plumbing `loadSaved()` uses for EVERY chapter open, storyline chapters included. A future
  auto-follow/language-sync added there needs the SAME storyline-membership check
  (`_storylineIdForTopic`) `openStorylineScreen` and `goLessonSet` both already use, or it will
  silently bypass the overrule flag exactly like the `v81_ac`-same-release bug did. See
  `test/unit-ui-lang-decouple.test.js` and `INTERNALS.md`'s `PLAN §C4` section before touching any
  of this.
- `test/unit-ui-journeys.test.js` (`v81_m`–`v81_w`, `PLAN §C0`/`§C5`) — the route-parity reference
  for the FOUR original screens plus the teacher dashboard, lesson-set, lesson-screen, and
  storyline-screen. Extend it, don't bypass it, if you touch any of them again. ⚠️ Also grep the
  WHOLE suite for the function being rerouted before shipping ANY future reroute — `v81_o` broke
  three source-text pins in `unit-learner-nav.test.js` this file does not cover; `v81_p` broke two
  more, `v81_s` broke four more, `v81_t` broke SIX more (across 14 files referencing `startLesson`),
  `v81_u` broke 13 more (across 8 files referencing the four storyline entry names), `v81_v` broke 4
  more (across `unit-learner-nav.test.js`'s pins on the rerouted "home" call sites — one of which was
  ALREADY a vacuously-passing weak regex before this release, tightened while fixing it) plus 1
  genuinely-exercised stub rename in `unit-story-unlocked-card.test.js`; the full-suite run is what
  caught them each time, not a pre-edit grep alone. `v81_r`'s new journey needed a DIFFERENT exit
  technique than the other four — see `INTERNALS.md` §5, the STATIC-markup-is-never-parsed bullet,
  which `v81_s`/`v81_u`'s journeys also needed. `v81_s` ALSO hit a second, different harness gap:
  `innerHTML` never reflects nodes added via `appendChild` — assert `.children.length` for anything
  `buildPath()`-shaped. `v81_t`'s mutation test needed the SAME standalone-isolation trick `v81_s`'s
  did. `v81_u`'s journey needed FOUR separate mutation tests, one per wrapper name — `showStoryline()`
  itself is called by NONE of its three siblings, so it was invisible to every other assertion in
  the file until it got its own. `v81_v`'s own new spy assertion hit a DIFFERENT bug entirely: reuse
  a spy's captured-original variable name across two `C.run()` calls in the same persistent vm
  context and you get real infinite mutual recursion, not a flake — use a distinct name (or restore
  the spied function) per spy setup. **`v81_w` found the SAME assertion block's two spy checks had
  actually been passing WITHOUT `await settle()` by timing coincidence, not because the screen
  transition is synchronous** (it happens inside an async `.finally()`) — exposed only once the two
  spies' destinations genuinely diverged from each other; both needed `await settle()` added.
- **`.landing-inner`'s real nesting is NOT what its indentation suggests** (`v81_w`, found while
  moving `#gen-area` out) — it closes right after the language picker + "Generate new" button;
  `#tts-footer-landing`/`#teacher-mode-bar`/`.library` are children of `#landing` DIRECTLY, not
  nested inside `.landing-inner`. A naive regex depth-count got this wrong twice; verify with a real
  parser (Python's `html.parser`, stack-tracking) before trusting an assumption about this file's
  nesting again. The block also carries one genuinely-orphaned extra `</div>` at the very end —
  harmless, pre-existing, not a bug.
- `build-static.js`'s `loadSaved` is missing the entire `_isLaterChapter()` branch `index.html` has
  (found at `v81_p`, not fixed) — a learner opening a later chapter in the STATIC build may not land
  on the progress card the way `v81_b`'s ruling intended. Needs its own measurement before a fix.
- `_renderCompStoryboard`, `_sbPanelSpans`, and `_sbFrameState` no longer exist (`v81_q`, `PLAN
  §C0.4`, direct user ruling — see the roadmap's `v81_q` entry and `INTERNALS.md` §6b). If you find a
  comment or an old branch still naming them, it's stale; the completion card's storyboard slot has
  been the chapter icon row since `v80_z`, and the storyline page renders the raw board SVG directly,
  unframed — neither path ever needs these three back. `_sbPanelChapter` is NOT part of this and
  stays, still driving the storyline page's own `_sbNavClick`/`_sbMarkCurrentPanels`.
