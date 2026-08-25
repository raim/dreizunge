# Session prompt — written at the `v85_c` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v85_b`, `v85_c`, …) unless a future
session has a good reason to switch to `v86_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v85_c`** — `v85_a` was a fresh cut
from `roadmap_v84.md` for a generator-page redesign the user proposed, assessed and scoped into
`roadmap_v85.md`'s **`PLAN §13`**; `v85_b` shipped two small, unrelated fixes requested first
(speech-recognition auto-activation removed; a `#bottom-bar-toggle` button); **`v85_c` shipped
`PLAN §13` milestone 1 itself** — the generator-page wizard shell. See `roadmap_v85.md`'s `v85_c`
entry under `# SHIPPED IN THE v85 LINE` for the full write-up; short version: `#generation-screen`'s
always-visible form is now `#gen-wizard`, three `.gen-card`s (`#gen-card-1` = `.lang-box`,
`#gen-card-2` = topic/text-source cluster, `#gen-card-3` = catch-all for everything not yet split
into milestones 2-5's own cards — chaptering/lesson-selection/additional-features), one visible at a
time, navigated by `_genWizardGoto/Next/Back` and a `.pdf-step`-styled pill stepper. Pure re-layout —
every id/onclick/onchange inside each card is byte-for-byte unchanged; the ONLY new behaviour is
which card is visible and that `show('generation-screen')` always resets to card 1.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v85.md` — its **index table** and **⚠️ Session protocol** block first, then
   the `v85_c` shipped entry (top of `# SHIPPED IN THE v85 LINE`) for exactly what card 1/2/3 contain
   and what's still unwrapped inside card 3, then **`PLAN §13`** itself (search for it — near the end,
   under "THE LARGER PLAN") for the full generator-page redesign assessment and the approved
   milestone-by-milestone build order.
3. `INTERNALS.md` **§6b, the feature → function map** — read it BEFORE grepping for where anything
   lives (it now also carries the `v85_c` wizard-shell entry: card boundaries, the stepper, the
   navigation functions).
4. `roadmap_v84.md`'s own `# SHIPPED IN THE v84 LINE` if you need to know HOW something already
   working was built — not copied here, go there directly.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 270 checks
node test/run.js --quick                  → expect 236
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Corpus at this cut: **327 topics, 92 storylines, 33 languages, 667 `en` keys** (topics/storylines/
languages unchanged from the `v84` line's end; `en` keys grew by 5 at `v85_c` — the wizard's own
`gen.wizard_step1/2/3`/`gen.wizard_back`/`gen.wizard_next`, `en` only per convention).
`APP_VERSION = 'v85_c'`.

⚠️ **Check `git status --short lessons.json` at the start of this session.** If it shows modified,
that is very likely the user's own real, uncommitted evaluation/play data — not yours to revert,
commit, or "fix around" without asking. Back it up, `git checkout --` it for any build/test work,
restore it after.

⚠️ **The user's own main dev server (port 3000) needs a MANUAL restart to see anything past the
version it was last started with** — check its reported version against `APP_VERSION` before
assuming it's current, and ask before restarting it. (Note: `index.html` itself is served via
`fs.readFileSync` PER REQUEST — a plain reload picks up markup/script edits with no restart; only
`APP_VERSION`/other server-boot state needs one.)

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is the thing to
> fix**, not the guard.

## The habits that cost this project the most (full incident history: `roadmap_v84.md`'s "Rules
earned in session N…the v84 line" blocks)

1. **Measure before editing.**
2. **Guard at the layer where the claim is observable**, and mutation-test every guard — an inline
   `style=""` beating a stylesheet rule was found THREE times across this project's history because
   the guard kept pinning source text instead of rendered/computed state (rules 5, 34, 39).
3. **For any refactor claiming to preserve behaviour, CAPTURE the old output and DIFF it.**
4. **`buildExercises` is NON-DETERMINISTIC IN CONTENT, not just order.**
5. **Ask before restarting a dev server you did not start, and before deleting data you did not
   create.**
6. **A live model call needs a live test AND a real human reading the output.**
7. **A fix to one stage's OUTPUT SHAPE can silently break a DOWNSTREAM consumer that assumed the OLD
   shape** — re-run the full suite for every affected file, not just the one you changed (rule 36).
8. **A per-caller fix does not generalize to other callers of the same primitive** — grep every call
   site (rule 37).
9. **A "safe-looking" optimization that reads fresh state can still defeat an existing guarantee
   whose enforcement lived in a step the optimization skips** — mutation-test it against every
   EXISTING guard it touches, not just the new behaviour (rule 40).
10. **When a change is the FIRST of its kind to touch the live app or write to a real corpus, ASK how
    far it should go before building.**
11. **When restructuring markup into new wrapper elements, verify div-balance with a real HTML parser
    over the changed region** (Python's `html.parser`, stack-tracking start/end tags), not by
    eyeballing indentation — `v85_c`'s own wizard-shell edit used exactly this before trusting the
    result, per rule 2's own "render and inspect the actual output" standard.

# WHERE TO START

## `PLAN §13` — the generator-page redesign, milestone 2

`roadmap_v85.md`'s `PLAN §13` has the full assessment and the approved build order; its `v85_c`
shipped entry (top of `# SHIPPED IN THE v85 LINE`) has the exact card/id boundaries milestone 1 built.
Milestone 2, concretely: **the chaptering card + "create storyline now, add lessons later" shortcut**.
Today, chaptering (`#story-len-row`/`#num-chapters-row`/`#gen-arc-row`/`#style-wrap`/`#continue-row`)
lives inside `#gen-card-3` alongside lesson-selection (`#lesson-type-hdr`/`#diff-wrap`/`#format-wrap`)
and the Generate button (`#gen-btn-row`) — all still one undifferentiated catch-all card. Milestone 2
pulls the CHAPTERING fields out into their OWN `#gen-card`, between today's card 2 (text source) and
what's left of card 3 (which becomes, for now, just lesson-selection + Generate — milestone 3 is what
splits THAT out next). The stepper grows a 4th pill. The "create storyline now, add lessons later"
action is NEW UI (a button on the chaptering card) but reuses EXISTING backend machinery — the
empty-lesson-type no-op already in `index.html` (`if(!addTypes || !addTypes.length) return;`) means
chapter/storyline creation and lesson generation are already loosely separable server-side; this is
wiring a UI affordance onto that, not new pipeline work. Same discipline as milestone 1: **no id
renames on anything you relocate, no behaviour changes to what already works, pure re-layout** — grep
`test/*.test.js` for `gen-arc`, `continue-select`, `style-select`, `num-chapters` before moving
anything those tests reference, and verify with a real browser click-through (multi-chapter path
included) before calling milestone 2 done.

Milestones 3–5 (lesson-selection card + reworded "learning arc" label + per-chapter override;
additional-features card; small independent gap-fills) are each their own release — see `PLAN §13`'s
own build-order list. **Do not fold multiple milestones into one commit.**

**Explicitly out of scope, confirmed with the user — do not reopen without asking**: comic/image
import (`PLAN §7.0` Track A4, no code exists); the CP1-6 pipeline's cross-chapter arc-sequencing
(`PLAN §7.0`'s own note already deferred this on effort/necessity grounds); spell-check-driven auto
error-hunt generation (flagged during the original assessment as genuinely new, never confirmed in
scope). The browser-reachable single-chapter CP1-4 pipeline IS in scope, but sequenced AFTER
milestones 1–5 ship — it needs its own background-job design (CP2's per-sentence calls are slow: one
4-sentence chapter took 12+ minutes even on a warm model, measured live — see `roadmap_v83.md`'s own
addendum note on the blocked `v83_p` re-verification attempt for the same finding from a different
angle).

## ⚠️ OWED BY THE USER, not doable in a container

- **The whole `v84_g`…`v84_m` speech-recognition arc past the ORIGINAL typed-answer/basic-MCQ
  surfaces** (continuous listening, the mute toggle, the listening-dots animation, interim results,
  the floating "heard" pill) **is still not live-verified on a real device.** Only proven against a
  mocked `SpeechRecognition` constructor plus desktop-browser computed-style checks. (`v85_b`'s own
  mic-default change is IN this same boat — proven against the mock + a live desktop-browser
  click-through, not a real phone.)
- **Windows Tier 1 install docs (`v84_n`, `README.md`'s new `## Windows` section)** — reasoned, not
  measured on an actual Windows machine.
- **`apply-cp-lessons.js`'s `v83_p` re-verification** — attempted, blocked by real machine resource
  contention (near-zero free RAM, three Ollama models loaded, five concurrent Claude Code sessions
  running). `lessons.json` untouched either way. Retry once the machine has headroom — see
  `roadmap_v83.md`'s own addendum note for the exact numbers.
- **The PASS MARK** — still owed by the user, needs a browser pass, not code.
- **The `v85_c` wizard shell itself** — verified live against the running dev server (desktop
  viewport) this cut, but NOT on a real mobile device/viewport. The new Back/Next buttons and pill
  stepper are plain inline-styled elements matching the surrounding form's own conventions, but mobile
  layout (wrapping, touch target size) was not checked live.

## Standing tools — use them (unchanged from the v84 line; nothing here moved at this cut)

`INTERNALS.md` §6b has the full feature → function map, including the whole speech-recognition
subsystem (`_speechKindFor`, `_speechMicRefresh`, `_speechListenSession`, `_speechHandlePhrase`,
`_speechHandleInterim`, `_micShowHeard`, the `#speech-mic-pill`/`#mic-heard-pill` CSS-specificity
lesson), the `PLAN §7.0` pipeline (`canonical-text.js`/`canonical-analysis.js`/`curriculum-plan.js`/
`curriculum-lesson.js`/`apply-cp-lessons.js`), and now the `v85_c` generator-wizard entry
(`_genWizardGoto`/`_genWizardNext`/`_genWizardBack`, the `#gen-card-1/-2/-3` boundaries, the
`.pdf-stepper`/`.pdf-step` reuse) — read those entries before touching any of these areas, they carry
the exact fixes, gotchas and exact id boundaries from the `v84`/`v85` lines.
