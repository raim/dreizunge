# v70 — session 1 notes

Continues from the v69 line (18 point releases, v69_b → v69_t; full history in
`v69_session1_notes.md`, notes 1–24). Roadmap: `roadmap_v70.md`.

## 0. ✅ v70 — the cut (pure version bump)

Clean cut after the long v69 line, per the user's request to start a fresh session from a true
baseline rather than a repeatedly-patched roadmap.

- **No behavioural change.** Only `APP_VERSION` in `server.js` (`v69_t` → `v70`) and the derived
  static build changed. Suite stayed green throughout: **152 checks**, `check-inline` 0 on both
  `index.html` and `docs/index.html`. Both builds report `v70`.
- **Fresh roadmap** `roadmap_v70.md` written: carries forward every open item from the v69 roadmap
  (the single outstanding translation key `teacher.render_error`; the browser-verification pass,
  especially the empirical PDF model-cleanup tuning; the TLS banner; word-game lesson types;
  per-learner prefs; the concept graph; the two external/native-review waits), plus a new
  "Lessons the hard way" section distilling what the v69 line paid for (strip scripts before
  structural scans; probe the live element for render/layout bugs; verify LLM output against a
  contract; model every generator in the fake backend; scope assertions to usage not mention;
  one server at a time on the pid-derived port; the two builds diverge). The session protocol block
  is carried forward verbatim, with one addition: render paths must get a `smoke-render` case.
- `roadmap_v69.md` is now a closed archive.

Nothing else was touched. The next entry in this file will be the first real v70 change.
