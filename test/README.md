# Dreizunge headless test suite

Zero-dependency Node tests (no npm install). Everything resolves paths relative
to this folder, so it runs from any checkout.

## Run

```
node test/run.js            # full suite (static checks + unit + e2e)
node test/run.js --quick    # static checks + unit only (no server spawn)
```

The runner exits non-zero if any step fails.

## What each piece does

| File | Kind | Covers |
|------|------|--------|
| `run.js` | runner | sequences everything below; aggregates pass/fail |
| `check-inline.js` | static | extracts each `<script>` from an HTML file and `node --check`s it. `node test/check-inline.js <file.html>` |
| `lib.js` | helper | project paths, JSON HTTP client, and `boot()` which spawns the fake Ollama + real server against a throwaway temp store |
| `fake-ollama.js` | helper | canned, prompt-routed `/api/tags` + `/api/chat`. Set `FAKE_LOG=<path>` to log every chat prompt as JSONL for assertions |
| `unit-resolvers.test.js` | unit | item 2 — id-first parent resolution + same-language guard (incl. cross-language same-name and cross-`srcLang` cases). Also asserts the four resolver sites are still present in `index.html` |
| `unit-arc-options.test.js` | unit | item 3 — arc-mode `<option>` text is set from `ui.json` `en` |
| `e2e-generate.test.js` | e2e | item 5a (`nChapters<2` rejected, clamps to 20) + item 5b (`/api/storyline-title` keeps chapters/summary) |
| `e2e-bookjob.test.js` | e2e | generated-story continuation (continuation directive + full prior context) and arc lesson counts `[1,2,2]` |

## Notes / limits

- The fake Ollama returns **structurally valid but trivial** content. These tests
  verify control flow, routing, persistence, and counts — **not** model quality.
  Anything about whether real qwen output is coherent/correct lives in
  `../LIVE-TEST-CHECKLIST.md` and must be run against a real Ollama.
- E2E tests bind to `127.0.0.1` on a pid-derived port and write the store to the
  OS temp dir; they clean up after themselves.
- `/api/lessons` returns summaries only; to inspect lesson bodies the e2e tests
  read the temp store file directly (see `lib.readStore`).
