# Session prompt — written at the `v84_i` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v84_j`, `v84_k`, …) unless a future
session has a good reason to switch to `v85_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v84_i`** — full write-up in
`roadmap_v84.md`'s own `v84_g`/`v84_h`/`v84_i` entries; condensed here. **This whole arc has been
driven by REAL device testing**, not just written specs — every release past `v84_g` exists because
the user actually tried the previous one on a real Android phone and reported back what was
genuinely missing or wrong, which is worth reading as the whole shape of how this feature got built.

**`v84_g`**: browser-native speech recognition reused for answer checking — typed-answer exercises
first, then (initially) the three MCQ types whose choices were confirmed target-language text
(`mcq_article`/`mcq_plural`/`mcq_conjugation`). A match checks/taps the answer; a miss never
auto-submits or auto-selects, so a misheard word can never spend a heart the learner didn't actually
get wrong. Also a "reply ready" speech-bubble badge on the tutor fab, raised only when a reply lands
while the widget is closed (nothing else signals this — closing is a pure CSS toggle, the in-flight
request keeps running regardless), cleared only by reopening.

**`v84_h`**: a direct user follow-up widened the MCQ coverage to the SOURCE-language-choice types too
(`mcq_target_source`/`listen_mcq` — very common "translate this word" questions) by making `cGrid`'s
`speakable` a `'target'|'source'` kind instead of a boolean, so recognition listens in whichever
language a call site's choices actually are.

**`v84_i`**: ANOTHER direct follow-up, from actually trying `v84_h` on the phone. Two real findings,
not new scope: (1) `mcq_source_target` (`tMcqEI`) — a very common target-CHOICE vocabulary MCQ — had
been genuinely MISSED at `v84_h`, not deliberately excluded: its render function is shared with the
script-primer intro items, and the `v84_h` audit only read those closely, reasoning by (wrong)
association that the whole function was glyph-related. Now wired. (2) The MCQ mic now SHOWS what it
heard, in `#mcq-mic-heard` — green and left standing on a match, self-clearing after a timeout
(`_MIC_HEARD_CLEAR_MS`, 2.5s) otherwise — a direct reversal of `v84_g`'s original "never shown"
design, on the user's own explicit request once real use showed the hidden version left no feedback
that the mic had heard anything at all.

**⚠️ Speech recognition is now live-verified on TWO surfaces, still not a THIRD.** The user confirmed
on a real Android phone: the typed-answer mic (`v84_g`) works, and (implicitly, by reporting the exact
target/source asymmetry that led to `v84_i`) the MCQ mic's basic show/hide and match behaviour works
too. Getting the typed-answer case working live surfaced two real deployment gaps, both fixed and
worth remembering for ANY future browser-API feature: (1) work can sit on a feature branch while the
user's own live server runs `main` — always fast-forward `main` before assuming "shipped" means
"reachable"; (2) Chrome's Speech Recognition API (like the PWA install prompt before it) requires a
SECURE CONTEXT (HTTPS or `localhost`) — over a LAN IP on plain HTTP the constructor is simply absent,
indistinguishable from "unsupported." **Still NOT device-verified**: `v84_i` itself — the newly-wired
`mcq_source_target` mic, and the whole `#mcq-mic-heard` field/timeout/green-flash behaviour — shipped
after the user's LAST live-testing round, not confirmed by it. See `# ⚠️ OWED BY THE USER` below.

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
   the v83 line" for the two newest), then `# SHIPPED IN THE v84 LINE` for `v84_i`'s missed-gap-plus-
   heard-field release, `v84_h`'s MCQ-coverage widening, `v84_g`'s speech-recognition + tutor-badge
   pair, `v84_f`'s orphaned-fix recovery (and the version-collision process lesson), `v84_e`'s second
   mobile batch, `v84_d`'s first, `v84_c`'s launcher, and `v84_b`'s PWA work — read all of it before
   touching any of those areas.
3. `INTERNALS.md` — constants, silent-failure modes, invariants. **§6b is a feature → function map**
   — read it BEFORE grepping for where anything lives.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 267 checks
node test/run.js --quick                  → expect 233
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Corpus at this cut: **327 topics, 92 storylines, 33 languages, 663 `en` keys** (topics/storylines/
languages unchanged since `v83_m`; `en` keys 659→663, the 4 speech/tutor-badge strings `v84_g` added,
`v84_h`/`v84_i` added none). `APP_VERSION = 'v84_i'`.

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

- **Speech recognition is live-verified on the typed-answer path (`v84_g`) and, implicitly, the basic
  MCQ show/hide split (`v84_h`)** — the user's own bug report ("mic shown for source-choice MCQ, not
  target-choice") is itself evidence they tried MCQ live and could tell the two directions apart.
  **Still NOT device-verified: `v84_i` itself** — the newly-wired `mcq_source_target` mic and the
  whole `#mcq-mic-heard` field (does the timeout FEEL right at 2.5s? does the green flash read clearly
  on a small phone screen while the card is also about to advance?). Everything past what the user has
  actually clicked/spoken to is still only proven against a MOCKED `SpeechRecognition` constructor —
  proves the WIRING, says nothing about real recognition accuracy, timing feel, or accent robustness.
- **Windows installability** (two tiers laid out in `roadmap_v83.md`, discussion-only) — neither
  ruled nor queued.

## NOT yours to start without the user naming it

`PLAN §7.0` CP6 (a CONDITIONAL, not a queued slice). Mastery-driven progression (`PLAN §9b/D2`) — a
user product decision.

## Standing tools — use them

- `_speechRecognizeOnce(lang, onResult, onEnd)` (`v84_g`) — the ONE browser-`SpeechRecognition`
  wrapper; `_typeSpeechStart`/`_mcqSpeechStart` are its only two callers, via `_micListen(btn, locale,
  onDone)`. `_speechExLocale(kind)` (`kind`: `'target'|'source'`, v84_h) is what resolves the locale —
  `'target'` reuses the existing `_speechLocaleFor` unchanged, `'source'` is the plain
  `lessonSrcLang().tts` (no per-chapter override exists for source language anywhere else in the app).
  Extend an exercise type here by adding a THIRD caller, not by re-deriving the recognizer plumbing.
- `cGrid(cs, one, mode, speakable)`'s 4th argument (`v84_g`, widened `v84_h`/`v84_i`) — pass
  `'target'` or `'source'`, whichever language THIS call site's `choices` actually are, read from the
  exercise BUILDER, never guessed from the type name (`mcq_target_source`/`listen_mcq`'s own `choices`
  are source-language despite "target" in one of those names). **If a render function is SHARED
  between a regular MCQ type and a script-primer `_intro` variant (`tMcqEI`/`tLMcq` both are), check
  EVERY branch separately — `v84_i` exists because `v84_h` read only the `_intro` branches and
  assumed the whole function was glyph-related.** Omit entirely for a type where speech recognition
  would not work well — `comprehension_mcq` (full reasoning sentences) and the script-primer
  glyph-picking branches (`_intro==='glyph_sound'|'sound_glyph'|'listen_glyph'` — choices genuinely
  ARE target-language text in some cases, but a bare glyph isn't something a learner can usefully
  SPEAK) are excluded on purpose, not by oversight.
- `_micShowHeard(el, text, matched)` / `_MIC_HEARD_CLEAR_MS` (`v84_i`) — the MCQ "what did it hear"
  label (`#mcq-mic-heard`, next to `#mcq-mic-btn`). Green + left standing on a match; shown but
  self-clearing after `_MIC_HEARD_CLEAR_MS` (2.5s) otherwise. The clear timer lives ON the element
  (`el._micClearTimer`) so a second recognition pass cleanly supersedes an earlier pending clear
  rather than racing it. The typed-answer path (`#type-in`) does NOT use this — filling the real
  answer input already serves the same "show what was heard" purpose there, and auto-clearing a form
  field the learner might be mid-editing was judged a worse UX than a transient label next to a
  read-only MCQ choice.
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
