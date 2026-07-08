# v52 — session 5 notes → released as v52_e

Dedicated QC model role. Released as **v52_e** (`APP_VERSION='v52_e'`). Suite green (97 checks).

## Why
QC (`qcCheck*`) ran on `OLLAMA_TRANSLATION_MODEL` — the SAME knob as the story-translation panel. So
you couldn't run the story translation on qwen while QC-checking Lëtzebuergesch pairs on
translategemma; one knob served both. (Surfaced when the user asked which model QC uses.)

## Change
- **`OLLAMA_QC_MODEL`** — new runtime-mutable role. Defaults to `OLLAMA_TRANSLATION_MODEL` at startup
  (so existing behaviour is unchanged) but is independently settable thereafter (does not auto-follow
  translation — same convention as the other roles).
- **`callLLMQC(system, user, max)`** → `_callLLM(OLLAMA_QC_MODEL, …)`. The four QC functions
  (`qcCheckDialectPair`, `qcCheckPair`, `qcCheckCloze`, `qcCheckSynonymSet`) repointed to it. The
  non-QC `callLLMTranslation` uses (dialect story rewrite V1/V2, story-translation panel) are
  untouched.
- **Wiring:** `currentModels()`/`setRuntimeModels()` include `qc`; `POST /api/models` accepts `qc`
  (and the requested-collection bug that would have dropped a qc-only switch is fixed);
  `/api/info.ollamaQcModel`; a 4th "QC" dropdown in the picker (`models.qc`, en-only); `APP.info`
  syncs `ollamaQcModel`.
- Setting QC = translategemma does NOT flip the lesson format (only the Lessons role derives format).

## Tests
- `e2e-models`: default qc = boot model; independent qc switch leaves translation untouched (and
  vice versa); `/api/info` exposes qc; qc=translategemma doesn't change lessonFormat.
- `unit-model-picker`: 4th selector renders; `models.qc` key present.

## State
- Full suite green, `check-inline` 0 on both builds, static rebuilt, **v52_e** packaged from a clean
  unzip.
- Roadmap updated (QC split marked shipped; realises the roadmap_v46 `OLLAMA_QC_MODEL` sketch). The
  **drill remains the START-HERE item** (untouched).
- Owed: LIVE-TEST §§58–65 (Ollama/browser), TranslateGemma i18n pass on the `models.*` keys.
