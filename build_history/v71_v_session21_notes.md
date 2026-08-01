# v71_v — session 21 notes

Roadmap item, user-requested: **start a documentation of the inner workings and such limits.**

Suite **157** (unchanged — this release adds no code), `check-inline` 0 on both builds.

---

## What was added

`INTERNALS.md` at the repo root, ~190 lines. Deliberately the **engineering counterpart** to
`DOCUMENTATION.md`, not a replacement: that file explains what the app does (the three layers,
generating, the feedback loop) and stays user-facing. This one records what is true about the code.

Five sections:

1. **Tuning knobs** — one table of every constant worth changing, with its file, value and effect;
   then `NUM_CTX_MAX` in depth (the memory tradeoff, the story-chars-per-ceiling table, the
   unverified Ollama-reload caveat, flagged as unverified rather than asserted).
2. **Silent failure modes** — the dangerous class: plausible output, nothing thrown, no test
   necessarily failing. Ollama's silent truncation; standard lessons having no `type` field; a new
   lesson type without a `fake-ollama` branch; `callLLMLesson` opts overriding the think policy; a
   capped builder being a sampling builder.
3. **Invariants** — `_derivingUniverse`, "a review render is not a play", the chain-story trim
   direction, comprehension being gated by the story, withheld done-flags and `Next`, one-rule-per-
   question (including the **outstanding** two-readers case, named rather than quietly omitted).
4. **Test harness limits** — `lib-dom`'s tag-only `querySelectorAll`, isolated function extraction
   and `typeof` guards, the `APP.cur` default, the corpus not being a constant, and wiring changes
   needing a run.
5. **Where things live**, and **§6 how to maintain it**.

## Every claim verified against the code

A wrong reference document is worse than none — someone trusts it instead of checking. So every
factual claim was checked mechanically before shipping: 17 assertions over `llm.js`, `server.js`,
`index.html` and `README`/`DOCUMENTATION`, covering all twelve constants in the §1 table plus the
named functions in §3. One initially failed (`build-static` invocation) — the claim was correct,
my check grepped the wrong file; confirmed against `DOCUMENTATION.md`'s canonical line.

Values pinned this session, all read from source rather than memory:
`NUM_CTX_MAX` 16384 · `OLLAMA_TIMEOUT` 720000 (clamp 30 s–60 min) · `CHAIN_STORY_CHARS` 40000 ·
`THINK_TOKEN_MULT` 2.5 / `THINK_TIMEOUT_MULT` 3 · `THINK_MIN_TOKENS` 3000 · lesson base 3200 ·
`MIXED_ROUND_CAP` 30 · `FAMILIAR_SHARE` 0.15 · builder cap 14 · coverage default 0.8 ·
qid-universe convergence `NEEDED` 15 / `CAP` 120.

## Made discoverable, not just written

A reference nobody opens is a file, not documentation. Three links added:

- **Roadmap session-start list** — inserted as step **2**, above the session notes, with an
  instruction to read it *instead of* grepping the notes for "what is the value of X". Renumbering
  briefly produced two step 3s; fixed.
- **`DOCUMENTATION.md`** — a pointer near the top for readers working on the code rather than using
  the app.
- **`INTERNALS.md` §6** — when to add an entry, and the dividing line: the *why* stays in the
  session notes; entries here should be short and checkable in under a minute, or they are
  narrative and belong in the notes.

## Note on the roadmap entry

Marked **✅ STARTED**, not DONE. The document is explicitly ongoing — the "Maintaining this file" section exists precisely so future
sessions extend it — and marking it complete would invite exactly the staleness it is meant to
prevent. The original brief is preserved beneath the tick so the intent survives.

## Deliberately not done

- **No code changes.** The version bump and static rebuild are the only non-doc edits; the suite
  count is unchanged at 157 because nothing new is testable.
  (The rebuild was not optional: `unit-static-version` correctly failed the bump until `docs/` was
  regenerated — the guard doing its job.)
- **No migration of existing notes.** The notes stay as they are; `INTERNALS.md` references release
  tags rather than copying their narrative.
- **No `lib-dom` extension** — recorded under "Test harness limits" as a known limit with its cost, still its own session.

## Still owed

Unchanged from `v71_u`: browser passes on `v71_i`–`v71_v` · the `v71_t` live comprehension check ·
`NUM_CTX_MAX` decision (the estimate in §1.1 was reviewed and accepted this session, but the live
memory behaviour is still unmeasured) · translate queue **380**.

Code items unblocked and ready: two readers for "is this chapter complete" (`v71_s`) · deterministic
vocab QC · duplicate grammar targets (`v71_r`) · drill result card.
