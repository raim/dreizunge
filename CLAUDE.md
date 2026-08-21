# Dreizunge — agent protocol

This repo is worked on by **both Claude Code and OpenAI's Codex**, alternating sessions, both
writing to the same `build_history/roadmap_v*.md`, `SESSION_PROMPT_v*.md`, and `INTERNALS.md`. This
file (read by Claude Code) and `AGENTS.md` (read by Codex) carry the same content deliberately — the
two agents must not drift on protocol. **This is a pointer and a summary, not a new source of
truth**: everything below already exists, spelled out in full with its reasoning, in
`build_history/roadmap_v82.md`'s "⚠️ Session protocol" block and its "Rules earned in session N"
sections. Read those before inventing anything not covered here.

## Orient yourself, in this order

1. The **newest** `build_history/SESSION_PROMPT_v*.md` (highest version number) — whole. It is the
   only document that describes "now": what last shipped, what's owed, what's open.
2. `build_history/roadmap_v*.md` (highest-numbered file = current) — its index table and **⚠️
   Session protocol** block first, then the standing RULES sections.
3. `INTERNALS.md` **§6b, the feature → function map** — read it BEFORE grepping for where anything
   lives. It exists so exploration time goes to the problem, not to locating code.

## Establish the green baseline before changing anything

```
node test/run.js                          → expect the count the current SESSION_PROMPT states
node test/run.js --quick                  → expect the count the current SESSION_PROMPT states
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

These counts are guarded by `unit-roadmap-version` against the actual suite and the data files. **A
red baseline is a FINDING, not noise** — diagnose which side is wrong (the number in the prompt, or
the tree) before editing either. Do not silently "fix" a failing guard by loosening it.

## Flaky tests

`buildExercises` is non-deterministic in CONTENT, not just order. A test that samples the corpus can
flake for reasons that have nothing to do with your change. **Reproduce a failing file 15–40 times**
before believing it's a real regression, and if it's suspicious, run the same protocol against the
PREVIOUS commit to see whether it's pre-existing.

## One release per commit

Each release is ONE commit containing, together: the `APP_VERSION` bump in `server.js`, the new
entry at the top of the roadmap's shipped section, and the session-prompt rename. Don't split these
across commits and don't land unrelated work in a release commit.

**The session prompt is RENAMED at each release, never duplicated.** `SESSION_PROMPT_v81_h.md`
becomes `SESSION_PROMPT_v81_i.md` (`git mv` + edit the content), not a new file kept alongside the
old one. Two `SESSION_PROMPT_v*.md` files in `build_history/` at once means a bad merge between the
two agents — `unit-roadmap-version` asserts exactly one exists and will catch it.

## Merge conflicts — where they land and how to resolve them

- **Roadmap entries append at the TOP of `# ✅ SHIPPED IN THE v82 LINE`** (or whichever line is
  current), so that is exactly where a merge conflict between two sessions' work will land. Resolve
  by **keeping BOTH entries**, ordered by version — never by picking one side and discarding the
  other's shipped write-up.
- **`docs/index.html` is GENERATED and ~7MB.** Never hand-resolve a conflict inside it. Take either
  side, then run `node build-static.js` and commit the regenerated file.
- **`learners.json` changes on every answered question.** Per the standing rule (one learner;
  progress impact is not a blocker on shipping — see the roadmap's STANDING RULE block), it is not
  worth merging carefully. Take either side.

## Working method

- **Measure before editing.** A warning in the notes is a claim about a design, not about the
  problem — verify it against the running code first.
- **Guard at the layer where the claim is observable.** A guard that pins SOURCE TEXT for a claim
  about BEHAVIOUR cannot fail even when the behaviour is wrong — this has cost multiple releases.
  Render and inspect the actual output (DOM, computed value, rendered markup), not a regex over the
  source.
- **Mutation-test every guard you write or rely on.** Break the thing it claims to protect and watch
  the guard go red. If it stays green, the guard is wrong, however green the suite looks. Don't trust
  a single "the fixture happened to pass" — vacuous fixtures have shipped guards that never actually
  fire.
- **For any refactor claiming to preserve behaviour, CAPTURE the old output and DIFF it.** "The tests
  still pass" is a weaker claim than an actual diff over real data.
- **A carried-forward open item must be cross-checked against the shipped list before being carried
  again** — an item can sit open in a prompt for releases after the roadmap already recorded it as
  shipped.

## Everything else

New user-facing strings go in `ui.json`, `en` only. If client or baked data changed, re-run
`node build-static.js`. Add or update a unit test for any new behavior. The full rule set, with the
incidents that earned each rule, lives in the roadmap — read it there, don't re-derive it here.
