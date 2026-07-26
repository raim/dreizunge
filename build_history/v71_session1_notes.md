# v71 — session notes

## 0. ✅ Cut as `v71`

Clean cut after the v70 line (15 point releases, `v70_b` → `v70_p`). `roadmap_v70.md` is a closed
archive; `roadmap_v71.md` carries the protocol and every open item forward.

**Not a pure version bump** — unlike the v70 cut, this one carries data and one test change:

- **`lessons.json` replaced** with the user's current export: **283 topics, 80 storylines**
  (was 280 / 79).
- **`ui.json` merged** from the user's translation pass — see below, it needed repair.
- **One assertion restated** (`unit-tls-transport`), see below.
- `APP_VERSION` `v70_p` → `v71`, static rebuilt, both builds report `v71`.

### The returning `ui.json` needed validation, not just copying

Checked before merging, and two things were wrong:

1. **`crossword.done` was missing from `en` entirely.** It was added in v70_o; the user's export
   predates that release. The client calls `t('crossword.done')`, so copying the file in as-is would
   have shown a raw key on the crossword's Done button — a visible regression, shipped silently.
   Restored from the v70_p file.
2. **The pass covers 6 of 29 languages** (`nl pt fr de it es`), all partial. 23 are untouched:
   `tr hi ar sv ru zh ko pl ja he uk cs vi id ro th el fi hu da ca lb sw`.

Merge kept every translation the user produced and restored only what their export predated. Also
verified **no existing `en` value was altered** (0 changed) and **no language lost keys**.

Debt: **558 missing entries across 24 keys**, down from 667. `--qc` reports 0 structural defects —
every "error" is one of these absences.

**Standing rule added to the protocol:** validate a returning `ui.json` against the current one
before merging — per-language key counts, and whether any `en` key vanished.

### A test whose intent had to be restated

`unit-tls-transport` asserted `acct.insecure` was **en-only**. That was the correct rule while the
key was new: `translate-ui.js` fills *missing* keys and cannot detect English left sitting in
another language, so a seeded copy would never be corrected. It is the **wrong** rule once a real
translation pass has run — and it failed exactly as designed when the user translated the key into
six languages.

Restated to the durable invariant it was always protecting: **no language may hold the English
string verbatim.** Verified the six translations are genuinely different from English (none
identical), so the new assertion is meaningful rather than merely permissive.

This is worth noting as a category: an assertion can be right for a phase and wrong afterwards. The
fix is to ask what the assertion was protecting, not to delete it or force the old state back.

### Baseline

Suite **138** green (`--quick` **119**, ~10s), `check-inline` 0 on both builds, static build
byte-identical to a fresh rebuild, both builds report `v71`.

### Owed at handoff
- **i18n second pass** — 23 languages untouched, `crossword.done` never translated anywhere.
- **Browser pass** — the v70_o crossword fixes and v70_p storyline toggle are the newest unverified
  surfaces. `v70_browser_checks.md` (given to the user separately) still applies.
- **Drill result card** and **typing letter-by-letter diff** — first two items in the v71 roadmap.
