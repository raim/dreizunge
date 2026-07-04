# START HERE (stable entry point for a new session)

This file never changes name, so "read START-HERE" is unambiguous (unlike "read the latest
roadmap", whose filename increments each release).

## Read these, in order
1. **The current roadmap** — the highest-numbered `build_history/roadmap_v*.md`
   (e.g. `roadmap_v51.md`). Its top has a **"⚠️ Session protocol — READ FIRST"** block that is
   the standing definition of done. Follow it without being re-told.
2. **`build_history/LIVE-TEST-CHECKLIST.md`** — everything that needs a real browser/Ollama and
   so isn't covered by the headless suite. Keep it updated (see protocol item 2).
3. The most recent **`build_history/v*_session*_notes.md`** for where the last session left off.

## Establish the green baseline before changing anything
```
node test/run.js          # full suite — must be ALL CHECKS PASSED
node test/check-inline.js  # must report 0 failures
```

## The easiest things to forget (history shows these get missed)
- **Update `LIVE-TEST-CHECKLIST.md`** whenever you add browser-only / Ollama-only behavior.
- **i18n**: new strings go in `ui.json` `en` ONLY (never English text in other languages —
  `translate-ui.js` fills *missing* keys). List new keys for the offline translate pass.
- **Bump `APP_VERSION`** in `server.js` at a release; regenerate `docs/` via `build-static.js`
  (the static build now derives the version from `server.js` — no hand-editing `build-static.js`).

The roadmap's protocol block is authoritative — this file is just the durable pointer to it.
