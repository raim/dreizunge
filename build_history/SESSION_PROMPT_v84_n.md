# Session prompt — written at the `v84_n` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v84_o`, `v84_p`, …) unless a future
session has a good reason to switch to `v85_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v84_n`** — full write-up in
`roadmap_v84.md`'s own `v84_g`…`v84_n` entries; condensed here.

**`v84_n`, condensed** (docs-only, no code): the user asked "what's next, back to the installation
scripts?" — pointing at `roadmap_v83.md`'s discussion-only "Windows installability" note (two tiers
laid out, neither built, explicitly "not required for now" at the time). Asked which tier via
`AskUserQuestion`; the user picked **Tier 1 — written steps, no code** over Tier 2 (a real
`winget`+PowerShell installer). Added a `## Windows` section to `README.md`: Ollama's/Node's own
native installers (both double-click), GitHub's "Download ZIP" (no `git` needed), the one genuinely
OS-specific step (opening a terminal in that folder — Windows 11 vs. 10 differ), then the SAME
`ollama pull`/`node server.js` commands Option B already documents for Linux/macOS. `install.sh` line
16 already said "read README.md ... for Windows/WSL notes" — this section is what that comment was
pointing at before the content existed. **Not tested on a real Windows machine — reasoned, not
measured, said so in the README itself**; `test/unit-install-script.test.js`'s existing README/
`install.sh` cross-checks still pass (confirmed by re-running, not assumed). Tier 2 remains
discussion-only, not queued.

**This whole speech-recognition arc (`v84_g`→`v84_m`) has been driven by REAL device testing**, not
just written specs — every release past `v84_g` exists because the user actually tried the previous
one on a real Android phone and reported back what was genuinely missing or wrong, which is worth
reading as the whole shape of how this feature got built.

**`v84_g`→`v84_i`, condensed**: browser-native speech recognition reused for answer checking.
`v84_g` covered typed-answer exercises and the three target-choice MCQ types
(`mcq_article`/`mcq_plural`/`mcq_conjugation`); a match checks/taps the answer, a miss never
auto-submits, so a misheard word can never spend a heart the learner didn't actually get wrong. Also
a "reply ready" speech-bubble badge on the tutor fab (unrelated feature, same release). `v84_h`
widened MCQ coverage to the SOURCE-language-choice types too (`mcq_target_source`/`listen_mcq`) via
`cGrid`'s `speakable:'target'|'source'` kind. `v84_i` closed a real gap `v84_h` had missed
(`mcq_source_target`/`tMcqEI` — its render function is SHARED with the script-primer intro items, and
the `v84_h` audit only read those closely) and made the MCQ mic SHOW what it heard, reversing `v84_g`'s
original "never shown" design.

**`v84_k`, condensed**: `syn_select` (synonym/antonym tiles) got speech input — a recognized word
SELECTS+COLOURS a tile live (green if correct, red otherwise), never auto-checks. Then EVERY
per-exercise mic button (including the one just added) was replaced by ONE persistent pill,
`#speech-mic-pill`, in the bottom bar — auto-listening the instant a speakable question renders, no
tap needed. `_speechKindFor(ex)` became the one place speakability is decided, directly unit-tested.
A real stale-generation bug (found by this session's own mutation-testing, not the user) — a delayed
pass from a PREVIOUS question could silently fill/check the NEW question — was fixed.

**`v84_l`, THREE more direct follow-ups landing together**: *"please suppress all (or most...) sound
effects (beeps)... also we want it to be active all the time, except the microphone icon is pressed
to mute input."* (1) Android plays an audible tone on every `SpeechRecognition.start()` that JS
cannot suppress — `v84_k`'s design restarted after EVERY phrase/mismatch, meaning a beep every few
seconds. Replaced with ONE `continuous:true` session per question (`_speechListenSession`) — the tone
now plays once per question, not once per phrase. A `'type'`/`'mcq'` match still explicitly stops the
session (about to speak the reveal aloud); `'syn'` never does (more words may follow). The browser's
own silence timeout still auto-resumes (still "always listening"); a hard error stops for good. (2)
The pill's tap is now a MUTE TOGGLE (`APP.micMuted`, not persisted, mirroring `APP.muted`), replacing
its old "retry" meaning — redundant once listening is continuous. Muted is a STANDING preference,
surviving navigation to another speakable question. A THIRD follow-up, mid-session: *"can we have a
permanent animation (a wave or dots)... animated when speech is actively recognized... and still if
not?"* — three dots (`.mic-dots`) now replace the 🎤 glyph while `.listening` is present, animating
continuously (the Web Speech API has no "hearing something right now" signal to react to honestly, and
the user's own "still if not" confirms that's the right call).

**TWO real bugs found by this session's OWN mutation-testing and live rendering, neither reported by
the user**: (1) `_speechStopListening()` originally ran BEFORE `check()`/`pickChoice()` on a match —
stopping can fire `onend` SYNCHRONOUSLY, whose own resume-decision reads `APP.cur.answered`, which
hadn't been set yet — spawning a superfluous second session right after a correct answer. Fixed by
reordering to check-then-stop. (2) The pill's `background`/`border`/`opacity` had been set in its own
inline `style=""` since `v84_k` — an inline style always beats a stylesheet rule regardless of class
specificity, so `.active`/`.listening`/`.muted`'s colours had been complete no-ops THE WHOLE TIME,
invisible to `test/lib-dom.js` (no real CSS cascade) across FIVE releases of mutation-tested "green"
tests. Found only by starting a throwaway server on a spare port and reading the pill's actual
COMPUTED style in a real browser — not assumed correct because the rules existed and every test
passed. Fixed by moving the default look to a base `#speech-mic-pill{}` rule and keeping the state
rules as compound `#speech-mic-pill.xxx` selectors.

**`v84_m`, TWO more direct follow-ups, immediately after `v84_l`**: *"there are still a lot of beeps
from the speech recognition; suppress them all. the currently recognized word should be shown in a
floating pill."* (1) `interimResults` turned on (`_speechListenSession`) — a documented mitigation for
Android's silence timeout firing more readily with it off, since the engine has nothing to report
until a phrase fully finalizes. Nothing in the Web Speech API lets a page silence the tone itself, so
this REDUCES rather than eliminates beeps — said so plainly rather than overclaiming "suppress them
all" was fully achieved. (2) `#mic-heard-pill` — ONE persistent pill floating above the bottom-bar mic
(`#speech-mic-wrap`, same anchor pattern as `#tutor-fab-badge`), fed live by the new `onInterim`
callback (neutral grey, never self-clears) and settled by the unchanged final-result path (green+stays
on a match, red+self-clears on a miss). Universal across `'type'`/`'mcq'`/`'syn'`, replacing the old
MCQ-only `#mcq-mic-heard` span — `cGrid`'s `speakable` parameter, which existed only to drive that
span, was removed entirely (function + all 11 call sites) once nothing consumed it any more. **A
same-session-across-questions optimization was designed to cut beeps further, found via mutation-
testing to silently defeat `v84_k`'s own stale-generation guarantee, and deliberately reverted before
shipping** — see `roadmap_v84.md`'s `v84_m` entry's own "Rejected" section before reaching for the same
idea again.

**⚠️ Speech recognition is live-verified on the ORIGINAL typed-answer + basic-MCQ surfaces (`v84_g`/
`v84_h`, confirmed via real phone use across this whole arc). `v84_k` THROUGH `v84_m` — the bottom-bar
redesign, `syn_select` tile colouring, continuous listening, the mute toggle, the listening animation,
interim results, and the floating "heard" pill — have NOT been tried on a real device yet.** Getting
speech recognition working live at all surfaced two deployment gaps worth remembering for ANY future
browser-API feature: (1) work can sit on a feature branch while the user's own live server runs
`main` — always fast-forward `main` before assuming "shipped" means "reachable" (came up AGAIN at
`v84_l`: verifying against `localhost:3000` initially showed nothing, because that's the user's real
server reading the MAIN checkout, not the uncommitted worktree — a throwaway spare-port instance was
needed instead, and was used again this release for the same reason); (2) Chrome's Speech Recognition
API (like the PWA install prompt before it) requires a SECURE CONTEXT (HTTPS or `localhost`) — over a
LAN IP on plain HTTP the constructor is simply absent, indistinguishable from "unsupported." See
`# ⚠️ OWED BY THE USER` below.

**Process note carried from `v84_f`, still worth reading before naming a version letter yourself**:
that release's own fix had originally shipped in a DIFFERENT session as `v83_g`, but a SECOND session
independently cut its OWN `v83_g` (a story-panel border-color feature) from the same `v83_f` parent at
the same time — neither could see the other's concurrent work, and the orphaned commit sat invisible
to `unit-roadmap-version` (which only checks the roadmap/prompt pair that IS on `main`) until a later
session checked `main`'s actual history before naming its own next release. **If two sessions might be
running concurrently, check `main`'s own `git log` for the actual next free version letter — the local
`SESSION_PROMPT` alone is not enough.**

**`v84_e`, condensed** (full write-up in `roadmap_v84.md`) — a SECOND mobile follow-up batch, sent
while `v84_d` was still being finalized (same real-phone-use conversation), refining two of `v84_d`'s
own decisions and adding a genuinely new interaction: (1) nav icons (prev/☰/next) moved BELOW the
whole text field on BOTH progress and entry cards — superseding `v84_d`'s own two-row-within-
`<summary>` split, which this follow-up explicitly said didn't go far enough; (2) the entry card's
"next" now goes to the chapter's own progress card instead of starting a lesson directly (the old
`v77_k`-era "two destinations" design collapsed to one); (3) a short tap on PLAIN story/summary text
now advances like Next — built on the SAME `sel.isCollapsed` signal `PLAN §12`'s selection popover
already trusts, so a drag-select still opens that popover unchanged; (4) a highlighted word
(`tapWord()`/`.wp-tap`) keeps its own tap-to-lesson behaviour, per the user's own explicit follow-up
clarification sent right after item 3 shipped. All verified via REAL DOM `.click()` dispatch against
a real chapter's real data, not just direct function calls.

**`v84_d`, condensed** — the FIRST mobile follow-up batch, same conversation: `#comp-story-panel`'s
header row split into two (superseded above); the corner-pill cluster and tutor fab unified into one
full-width translucent `#bottom-bar` (`--bottom-bar-h` CSS var, still current); question-card
flag/star buttons moved below the collapsed story panel; the mobile selection popover — found
rendering correctly but hidden under the phone's own native "Copy/Share" toolbar — now pins above
`#bottom-bar` on touch devices via `_isTouchDevice()`.

**`v84_b`/`v84_c`, condensed** — PWA install support (confirmed working for real in Google Chrome on
Ubuntu, same day it shipped; a LAN IP over plain HTTP separately does NOT get an install option,
service workers need a secure context, not a bug, fix is a TLS proxy the user deprioritized) and the
`dreizunge` PATH launcher (`bin/dreizunge`, installed onto `~/.local/bin` by `install.sh`, starts the
server + opens the browser, `--no-browser` to skip). Also fixed at `v84_b`: `test/lib-dom.js`'s
`loadClient()` had a fragile trailing-regex assuming `init();` was the LAST statement in the client
script — fixed by anchoring on the `@static-engine-end` marker instead (falls back to the old regex
only for `docs/index.html`, which never carries that marker).

`roadmap_v84.md` was cut from `roadmap_v83.md` at the user's own request, "push to v84 for a fresh
session," purely for accumulated-context reasons — not a milestone cut. `roadmap_v83.md` is kept and
stays the record for everything `v83_b`…`v83_s` shipped: the whole `PLAN §7.0`/Track A migration
(CP1–5, all done), the first script that writes real lessons into `lessons.json`
(`apply-cp-lessons.js`, with two real bugs found reading its own output), and `install.sh` (the
one-line installer, its default model, and its no-auto-start + resource-check follow-ups). Read
`roadmap_v83.md`'s own `# SHIPPED IN THE v83 LINE` for how any of that was built — none of it was
copied into this file.

**Two discussion-only notes were also recorded at the very end of the `v83` line**, both explicitly
"not required for now" — read them in `roadmap_v83.md` (search "📝 Note") before re-deriving either:
Windows installability for a non-coder (two tiers laid out: written-steps vs. a real `winget`+
PowerShell installer), and mic-based spoken-reply recording/comparison (recording is trivial;
word-level correctness via speech-to-text is a real infrastructure decision — local model vs. browser
API vs. cloud call; pronunciation-quality scoring is hard and out of scope).

## Orient yourself

1. **This file**, whole.
2. `build_history/roadmap_v84.md` — its **index table** and **⚠️ Session protocol** block first, then
   `# ⚠️ OPEN AT THE v84 CUT` (findings, `§0`/`§0i`, the standing RULES — now 37, see "Rules earned in
   the v83 line" for the two newest), then `# SHIPPED IN THE v84 LINE` for `v84_n`'s Windows-docs
   release, `v84_m`'s interim-results-plus-floating-pill release, `v84_l`'s continuous-listening-
   plus-mute release, `v84_k`'s syn_select-plus-bottom-bar-redesign release, `v84_i`'s
   missed-gap-plus-heard-field release, `v84_h`'s MCQ-coverage widening, `v84_g`'s speech-recognition +
   tutor-badge pair, `v84_f`'s orphaned-fix recovery (and the version-collision process lesson),
   `v84_e`'s second mobile batch, `v84_d`'s first, `v84_c`'s launcher, and `v84_b`'s PWA work — read
   all of it before touching any of those areas.
3. `INTERNALS.md` — constants, silent-failure modes, invariants. **§6b is a feature → function map**
   — read it BEFORE grepping for where anything lives.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 267 checks
node test/run.js --quick                  → expect 233
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Corpus at this cut: **327 topics, 92 storylines, 33 languages, 662 `en` keys** (topics/storylines/
languages unchanged since `v83_m`; `en` keys: `v84_g` added 4, `v84_h`/`v84_i`/`v84_l`/`v84_m`/`v84_n`
added none, `v84_k` REMOVED 1 — `ex.mic_tooltip`, orphaned once every per-exercise mic button it
labelled was replaced by the one persistent pill's own hardcoded title — net 659→662).
`APP_VERSION = 'v84_n'`. `v84_m` added tests INSIDE the existing `test/unit-speech-recognition.test.js`
(no new test FILE), and `v84_n` touched only `README.md` (no test file needed a change at all — the
EXISTING `test/unit-install-script.test.js` already cross-checks README/`install.sh` consistency), so
the 267/233 counts above are unchanged since `v84_l` — don't be alarmed that two releases with real
content didn't move either number; `test/run.js`'s "checks" count is per FILE, not per assertion.

✅ **`unit-replay-focus` is FIXED — a genuinely concurrent session landed it mid-`v84_h`, commit
`63ff97e`, "in this same worktree."** Spawned as a background task (`task_08149dde`) when the user's
own real `lessons.json` commit (`e2b93bd`, "added inspo for t, noble-like lessons" — a PLAN §7.0
CP1-3-proposed vocabulary lesson) made the test's fixture-selection land on that new lesson and fail
deterministically. The bug was in the TEST, not the product: its `seed()` helper never set
`APP.cur.lessonIdx`, so `assembleCoverageRound`'s bare `qid(ex)` lookups silently resolved against
lesson index 0 instead of the fixture's own — "worked" only because every prior fixture happened to
sit at index 0. Fixed, verified 15/15, mutation-tested — full write-up in that commit's own message.
**Worth noting as a process fact, not a caution**: that session committed directly to THIS branch
while a different, unrelated release (`v84_h`, this one) was mid-flight in the same place, and scoped
itself to touch only the one file the fix needed — a working example of two concurrent sessions
sharing a branch safely, the thing the `v83_g` collision (`v84_f`'s own entry) got wrong.

⚠️ **Check `git status --short lessons.json` at the start of this session.** If it shows modified,
that is very likely the user's own real, uncommitted `PLAN §7.0`/CP4-pipeline evaluation data — not
yours to revert, commit, or "fix around" without asking. Back it up, `git checkout --` it for any
build/test work, restore it after — the dance every `v83` release touching this did.

⚠️ **The user's own main dev server (port 3000) needs a MANUAL restart to see anything past
`v83_f`** — check its reported version against `APP_VERSION` before assuming it's current, and ask
before restarting it.

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is the thing to
> fix**, not the guard.

## The habits that cost this project the most

*(Full incident history lives in `roadmap_v83.md`'s "Rules earned in session N" / "Rules earned in
the v83 line" blocks — this is the short form.)*

1. **Measure before editing.**
2. **Guard at the layer where the claim is observable**, and mutation-test every guard.
3. **For any refactor claiming to preserve behaviour, CAPTURE the old output and DIFF it.**
4. **`buildExercises` is NON-DETERMINISTIC IN CONTENT, not just order.**
5. **Ask before restarting a dev server you did not start, and before deleting data you did not
   create.** Applies equally to the user's own uncommitted `lessons.json` evaluation data.
6. **A live model call needs a live test AND a real human reading the output** — neither a crash-free
   run nor a plausible prompt proves correctness.
7. **A fix to one stage's OUTPUT SHAPE can silently break a DOWNSTREAM consumer that assumed the OLD
   shape** — re-run the full suite for every affected file, not just the one you changed.
8. **A per-caller fix (e.g. `think:false`) does not generalize to other callers of the same
   primitive** — grep for every call site before trusting a class of bug is closed.
9. **A new test that spawns a server belongs in its own e2e file** — `unit-run-summary.test.js`
   enforces this; split the file, never loosen the guard.
10. **When a change is the FIRST of its kind to touch the live app or write to a real corpus, ASK how
    far it should go before building.**

# WHERE TO START

## The mobile UI follow-up arc is DONE — closed, don't re-open without a reason

Two full batches (`v84_d`, `v84_e`), all from real phone use in the same conversation, all verified
live. Nothing known-broken remains on this surface. If the user reports something new here, treat it
as genuinely new feedback (their phone, their real usage), not a reopening of a settled decision.

## My suggestion: re-evaluate `apply-cp-lessons.js` output with `v83_p`'s register fix

Carried forward from `v84_d`'s own prompt, since the mobile arc took priority instead: the user's own
two `PLAN §7.0` evaluation runs (`v83_n` qwen2.5:7b, `v83_o` qwen3.6:35b-a3b) both predate `v83_p`'s
register-mismatch fix. Re-running with `--replace` would show whether the fix actually produces
correct output on real content. Leans more on the user's own judgment (reading translations) than
code — flag that up front.

## Other buildable-now items, unranked

- **Re-evaluate `apply-cp-lessons.js` output with `v83_p`'s register fix** — closes a real,
  already-known gap (the user's own two evaluation runs both predate that fix). Leans more on the
  user's own judgment (reading translations) than code.
- **`PLAN §7.0`'s still-open gaps**: no function-word filtering (`v83_n`), confidence not surviving
  into CP4's written lesson (`v83_n`), browser reachability for `apply-cp-lessons.js` (needs a UI
  trigger + a background job for CP2's slow per-sentence calls — not authorized).
- **The PASS MARK** — still owed by the user, needs a browser pass, not code.
- See `roadmap_v84.md`'s carried-forward `# ⚠️ OPEN AT THE v84 CUT` for the older, still-unresolved
  items (§C1's first bug, §0i's reconciliation) — read before assuming any of them are new.

## ⚠️ OWED BY THE USER, not doable in a container

- **Speech recognition is live-verified only on the ORIGINAL `v84_g`/`v84_h` surfaces** (typed-answer,
  and MCQ well enough that the user's own bug report about the target/source asymmetry proved they'd
  tried both directions). **`v84_k` THROUGH `v84_m` — the bottom-bar redesign, `syn_select` colouring,
  continuous listening, the mute toggle, the listening-dots animation, interim results, and the
  floating "heard" pill — have NOT been tried on a real device yet.** Specifically worth checking:
  does `v84_m`'s `interimResults` change actually cut the beeping further the way the user asked for a
  SECOND time ("still a lot of beeps"), or does the browser still make SOME noise per question that a
  mock can't reveal (very possibly yes — nothing in the Web Speech API lets a page silence the tone
  itself, and this was said plainly rather than promised away)? Is `#mic-heard-pill` legible/positioned
  well above the mic button on a real phone screen, or does it collide with something else in that
  corner? Does the muted (red) vs. active (blue) pill state read clearly at a glance? Does the
  three-dot animation read as "listening" rather than as decoration? All of this is only proven
  against a MOCKED `SpeechRecognition` constructor plus one throwaway-port desktop-browser check of
  computed CSS/bounding-box position — proves the WIRING (including two real bugs `v84_l`'s own
  mutation-testing and live rendering found and fixed, neither reported by the user: a stop-before-check
  ordering hazard, and a `background`/`border`/`opacity` inline style silently overriding every state
  class for two whole releases, PLUS a third thing this release deliberately did NOT ship — a
  same-session-reuse optimization caught defeating the stale-generation guarantee before it ever
  reached a commit), says nothing about how it actually SOUNDS or feels to use on a phone.
- **Windows Tier 1 (`v84_n`'s new `README.md` section) is unverified on a real Windows machine** —
  reasoned from both dependencies shipping official installers, not measured. If the user (or anyone)
  tries it on real Windows, the steps themselves are the thing to confirm, not just that the app runs.
- **Windows Tier 2** (a real `winget`+PowerShell one-click installer, laid out in `roadmap_v83.md`) —
  still discussion-only; the user picked Tier 1 at the `v84_n` cut, Tier 2 remains neither ruled out
  nor queued.

## NOT yours to start without the user naming it

`PLAN §7.0` CP6 (a CONDITIONAL, not a queued slice). Mastery-driven progression (`PLAN §9b/D2`) — a
user product decision.

## Standing tools — use them

- `_speechKindFor(ex)` (`v84_k`) — the ONE place that decides whether the CURRENT exercise is
  speakable and how (`{kind:'type'|'mcq'|'syn', locale?}` or `null`). Extend an exercise type here,
  not by scattering a new `cGrid` call site or template check — this function is what
  `_speechMicRefresh()` reads to decide the pill's state, so anything not represented here is
  invisible to it regardless of what a template renders.
- `_speechMicRefresh()` (`v84_k`, rewritten `v84_l`) — called from `renderEx()` and `show()`; the ONE
  place that sets `#speech-mic-pill`'s disabled/active/muted state. ALWAYS stops whatever session was
  running first (`_speechStopListening()`), even when nothing new starts, then starts a fresh one via
  `_speechStartSession(gen, cfg)` UNLESS `APP.micMuted`. Bumps `_speechGen` every call. **`v84_m`
  deliberately did NOT change this to reuse an already-open session across two same-language
  questions** — read its own comment before trying that "obvious" optimization; it was implemented,
  mutation-tested, found to defeat the stale-generation guarantee (below), and reverted.
  `_speechMicPillClick()` (`v84_l`) is now a pure MUTE TOGGLE — flips `APP.micMuted`, then calls this
  same function to react — it no longer means "retry," which continuous listening made redundant.
- `_speechListenSession(lang, onPhrase, onInterim, onSessionEnd)` (`v84_l`, replacing `v84_g`'s
  one-shot `_speechRecognizeOnce`; `onInterim` added `v84_m`) — sets `rec.continuous = true` and keeps
  ONE recognizer open across MANY phrases, so Android's un-suppressible start/stop tone plays once per
  SESSION, not once per phrase. `rec.interimResults = true` since `v84_m` (a documented mitigation for
  Android's silence timeout firing more readily with it off — "still a lot of beeps" was the user's own
  follow-up after `v84_l`) — `onresult` now branches on `r.isFinal`: a final result still calls
  `onPhrase(alts)` unchanged; a not-yet-final one calls the new `onInterim(text)`, top alternative
  only. **If you touch this dispatch, re-check the test mock (`mockSessions` in
  `test/unit-speech-recognition.test.js`) sets `isFinal` on its own result objects** — when `v84_m`
  turned this on, EVERY existing match/mismatch assertion briefly went red because the old mock never
  set `isFinal` at all, so every scripted "phrase" was read as an interim by the new code; caught
  immediately by the green→red baseline check, not shipped broken. `_speechStartSession(gen, cfg)` is
  the caller that owns resuming it on the browser's own silence timeout (a soft `onSessionEnd`) —
  unless the generation is stale, muted, answered, or the end was a HARD error (`_MIC_HARD_ERRORS`,
  toasted once, never retried blindly).
- `_speechHandlePhrase(gen, cfg, alts)` (`v84_l`, replacing `v84_k`'s `_speechRun`) — one recognized
  FINAL phrase, dispatched by `cfg.kind`. **Re-checks `gen !== _speechGen` the INSTANT it runs, before
  any DOM write** — a session is long-lived now, so a phrase can arrive well after the question
  changed, and acting on stale state is the bug `v84_k`'s own mutation-testing found and fixed; that
  guard survived the move to continuous sessions unchanged. **⚠️ On a `'type'`/`'mcq'` match, `check()`/
  `pickChoice()` MUST run BEFORE `_speechStopListening()`, not after** — stopping can fire `onend`
  SYNCHRONOUSLY, and `onSessionEnd`'s own resume-decision reads `APP.cur.answered`; stop-first left
  that read seeing `false` and spawned a superfluous second session. Found by `v84_l`'s own first
  mutation-test of this code, documented inline at the call site — don't "simplify" the ordering back.
  All three kinds now call `_micShowHeard` (below), not just `'mcq'` (`v84_m`).
- `_speechHandleInterim(gen, text)` (`v84_m`) — the NOT-YET-FINAL counterpart to `_speechHandlePhrase`.
  Same stale-generation guard, `gen !== _speechGen`, checked first — mutation-tested the same way (test
  11 in `test/unit-speech-recognition.test.js`). Does NO matching of its own by design: interim text
  can still revise itself before finalizing, so it exists purely to feed `_micShowHeard` live, never to
  trigger a check/advance early.
- **`#speech-mic-pill`'s look lives in a base stylesheet rule, NOT its inline `style=""`** (`v84_l`
  fix). An inline style ALWAYS wins over a stylesheet rule regardless of class specificity — the pill
  had `background`/`border`/`opacity` inline since `v84_k`, which made `.active`/`.listening`/`.muted`
  completely inert for two releases without a single test noticing, because `test/lib-dom.js` doesn't
  implement a real CSS cascade. Only a computed-style check in an actual browser caught it. If you ever
  add a new visual state to this pill (or copy this pattern elsewhere), keep colour/border/opacity OUT
  of any inline `style=""` and in a class rule instead, and add/extend the SOURCE-LEVEL guard in
  `test/unit-speech-recognition.test.js` (section 2b) that greps the inline style for exactly these
  properties — it's the only thing standing between this bug and recurring silently again.
- `_speechExLocale(kind)` (`v84_g`, `kind` added `v84_h`) — resolves the recognizer's locale.
  `'target'` reuses the existing `_speechLocaleFor` unchanged; `'source'` is the plain
  `lessonSrcLang().tts` (no per-chapter override exists for source language anywhere else in the app).
- `cGrid(cs, one, mode)` (`v84_g` added a 4th `speakable` argument, widened `v84_h`/`v84_i`, REMOVED
  again `v84_m`) — the `speakable` argument existed only to render the old per-MCQ `#mcq-mic-heard`
  span; once `v84_m` replaced that with the universal `#mic-heard-pill` (below), nothing consumed it
  any more, so it was removed from the function AND all 11 call sites rather than left as a dead
  parameter. Speakability itself was never decided here — `_speechKindFor` is and remains the one place
  for that, independent of this template layer. **If a render function is SHARED between a regular MCQ
  type and a script-primer `_intro` variant (`tMcqEI`/`tLMcq` both are), check EVERY branch separately
  in `_speechKindFor` — `v84_i` exists because `v84_h` read only the `_intro` branches and assumed the
  whole function was glyph-related** — that lesson is about `_speechKindFor`, not `cGrid`, and still
  applies even though `cGrid` itself no longer carries the flag.
- `_micShowHeard(text, state)` / `_MIC_HEARD_CLEAR_MS` (`v84_i`, REWRITTEN `v84_m` — dropped the `el`
  param, now always targets the ONE persistent `#mic-heard-pill` floating above the bottom-bar mic,
  universal across `'type'`/`'mcq'`/`'syn'`, not the old per-MCQ-only `#mcq-mic-heard` span).
  `state` is `null` (interim — neutral, no self-clear timer), `'match'` (final hit — green, stays), or
  `'bad'` (final miss — self-clears after `_MIC_HEARD_CLEAR_MS`, 2.5s). The clear timer lives ON the
  element (`el._micClearTimer`) so a later pass cleanly supersedes an earlier pending clear rather than
  racing it — and, critically, an interim call must NEVER arm it (test 10 mutation-tests exactly this;
  test 12 mutation-tests the miss branch DOES arm it). `_speechMicRefresh()` clears the pill
  unconditionally on every render — a word left over from the PREVIOUS question has nothing to do with
  the one now on screen.
- `_tutorNoteReplyLanded()` / `_tutorClearUnread()` (`v84_g`) — the tutor-fab "reply ready" badge.
  Landed calls are at all three history-push sites in `_tutorSend`/`_tutorReadStream`; the only clear
  call is in `toggleTutorWidget()`. A fourth reply-landing site, if one is ever added, needs the same
  call — nothing derives this generically.

**Before grepping for where something lives, check `INTERNALS.md` §6b.** The whole `PLAN §7.0`
pipeline (`canonical-text.js`/`canonical-analysis.js`/`curriculum-plan.js`/`curriculum-lesson.js`/
`apply-cp-lessons.js`), `install.sh`, and `llm.js`'s `warmup()` all have their own §6b entries — read
those before touching any of them again, they carry the exact fixes and gotchas from the `v83` line.

`manifest.json`/`icon.svg`/`sw.js` (`v84_b`, repo root, local server only) — served by three new
`GET` routes in `server.js` right after `GET /`. `test/lib-dom.js`'s `loadClient()` now anchors on
`index.html`'s `@static-engine-end` marker to suppress the live bootstrap (falls back to a trailing
regex ONLY for `docs/index.html`) — if you ever add code after `init();` in `index.html` again, this
harness already handles it; if you touch `loadClient()` itself, re-read its own comment block first.

`bin/dreizunge` (`v84_c`, repo root) — the PATH launcher, symlinked to `~/.local/bin/dreizunge` by
`install.sh`. Resolves its OWN location by following symlinks BY HAND (portable to macOS's non-GNU
`readlink`) — if you ever touch its location-resolution logic, re-verify with a REAL symlinked run
(`test/unit-dreizunge-launcher.test.js` already does this; re-read it before assuming a source-level
change is safe).

`--bottom-bar-h` (`v84_d`, CSS var in `index.html`'s `:root`) — the ONE place `#bottom-bar`'s height
is stated; `.toast`/`#gen-status`/`.static-flag-banner`/`#tutor-widget`'s open position/the touch
selection-popover's fixed position ALL offset from it via `calc(var(--bottom-bar-h) + Npx)`. If the
follow-up batch above changes what's IN `#bottom-bar`, re-check whether this number still matches
reality (currently sized for the 44px `tutor-fab-btn`).

`_isTouchDevice()` (`v84_d`, `index.html`) — `'ontouchstart' in window || navigator.maxTouchPoints > 0`.
Used by `_storySelShowPopover`'s touch/desktop branch.

`_storyTapMaybeAdvance()`/`_storyTapInit()` (`v84_e`, `index.html`) — a short tap on plain
`#comp-story-text`/`#sum-sumtext` fires `comp-next`/`sum-next`. Reuses `PLAN §12`'s own
`sel.isCollapsed` signal (NOT a new time/movement threshold) to tell a tap from a drag-select, and
excludes `.wp-tap` (highlighted words) by target. If you touch this, re-verify with a REAL DOM
`.click()` dispatch (`test/unit-tutor-selection.test.js` §11 already does this) — a direct function
call alone would not have caught the cross-realm `vm.Context` gotcha this section's own testing hit
(`assert.deepStrictEqual` on an object returned straight from `C.run()` fails even when equal —
round-trip through `JSON.stringify`/`JSON.parse` instead).

`sum-next`'s onclick (`index.html`, the `showComplete()`-adjacent summary render function) — both
the ENTRY and WALK cases now call `sumForwardToCard()`; the `_entry`-derived label ("Start"/"Next")
is the only thing still branching on `_entry`. If a future change needs the entry card to start a
lesson directly again, that is a explicit product reversal, not a bug fix — confirm with the user
first, the same way this change itself came from an explicit user request.
