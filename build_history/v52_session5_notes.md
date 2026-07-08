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

## Addendum → v52_f: QC model provenance
Each QC result is now stamped with the model that produced it: `item.qc.by = OLLAMA_QC_MODEL` on a
flag, and `ls.qcBy` alongside `ls.qcAt` on a clean lesson pass. The QC console/job logging now
references `OLLAMA_QC_MODEL` (it still said `OLLAMA_TRANSLATION_MODEL`, a leftover from before the QC
role split). `unit-qc-dispatch` asserts `qc.by`; both `_runQc`-rebuilding tests (dispatch + skip)
gained an `OLLAMA_QC_MODEL` stub. LIVE-TEST §66. Released as **v52_f**.

## Addendum → v52_g: QC model shown in the lesson-editor
The editor QC flag now reads "<model> suggests:" (from `qc.by`) instead of the generic "QC
suggests:", at both render sites, with a fallback to the generic label for older flags lacking a
`by` stamp. New en-only key `qc.editor.suggests_by = "⚑ {model} suggests:"`. `unit-qc-editor-label`
guards both sites + the fallback. Released as **v52_g**.

## Addendum → v52_g (cont.): QC collect-and-compare
Superseding the earlier overwrite note: QC now COLLECTS verdicts per model in `item.qcByModel`
(`{ [model]: {sug, field, at} }`) so different QC models can be compared on the same item. A model
overwrites only its OWN entry; a model that now says OK drops only its own flag (others' remain);
`item.qc` stays as the primary (latest) for backward-compatible apply/dismiss/badges. Old single
flags are migrated into the map on next check. The skip optimisation is now PER-MODEL (`ls.qcBy ===
OLLAMA_QC_MODEL`) so a second model still runs. The editor shows one "<model> suggests:" row per model
(`qcSuggestRows`); apply/dismiss clear the whole item's QC; `qcByModel` is client-authoritative through
the lesson-edit merge. Tests: `unit-qc-collect` (two-model collection, selective clear, migration),
`unit-qc-editor-label` (multi-row render). User flags (`item.userFlag`) remain separate.
