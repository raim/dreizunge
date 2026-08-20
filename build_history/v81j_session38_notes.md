# Session 38 — `v81_i` → `v81_j`

Continuing session 38 after `v81_i` shipped: `PLAN §8/B1`, the observations log — the largest
buildable-now item, chosen because it was flagged as the only one whose value decays while it
waits. Full write-up is in `build_history/roadmap_v81.md` under `# ✅ SHIPPED IN THE v81 LINE`,
`v81_j` entry (the measurement, the schema reasoning, the mutation results).

## What shipped

| release | what |
|---|---|
| `v81_j` | `PLAN §8/B1` — the append-only observations log, wired into `check()` |

## Not a browser-visible change — no device checklist needed

This ships no UI. `APP.progress.observations` accumulates silently in the background as the
learner answers questions; there is nothing to click and nothing that looks different. Verified
entirely by `test/unit-observations-log.test.js` (helper shape + the wiring into `check()`, driven
through a real round) — see the roadmap entry for what was mutation-tested.

**If you want to eyeball it anyway:** answer a few questions in any lesson, then in the browser
console: `JSON.parse(localStorage.getItem('imp3_prog')).observations`. Each entry should have a
`qid`, `correct`, `firstAttempt`, and a `timestamp`; `skillId`/`userId` are `null` by design (see
the roadmap entry — that's `§8/B2`/auth, both unbuilt).

## Probes

None new. This item doesn't have one — it's the FOUNDATION the BKT probes further down `PLAN §8`
will eventually read, not something with its own corpus-facing measurement yet.

## New i18n keys

**None.** No new user-facing strings.

## What is owed after this session

Unchanged from the `v81_i` cut — see `build_history/SESSION_PROMPT_v81_j.md` §4 ("Owed by the
user"): the pass mark, a device pass across `v81_a` … `v81_j` (nothing new to look at for `v81_j`
itself, per above), `PLAN §F3`'s regeneration check, the translate pass, the `cyrillic-sr`
native-speaker check.

**New, from this release:**
- `error_hunt`/`ai_error_hunt` and the crossword are NOT wired into the observations log — a scoped
  follow-up (different grading shape), not an oversight. See the roadmap entry.
- The log has no pruning and no size cap of its own; `learners.js`'s `MAX_STATE_BYTES` (2MB) is the
  ceiling on the whole synced `progress` blob. Not addressed this cut — revisit if/when it's hit,
  or before `§8/B4` needs the log at real scale.
- `PLAN §8/B2` (the skill registry) is the natural next step in this track: `skillId` stays `null`
  in every observation until it exists, so nothing written so far can be attributed to a skill yet.
