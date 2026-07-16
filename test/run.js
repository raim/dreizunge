// Dreizunge headless test runner.
//   node test/run.js            # full suite
//   node test/run.js --quick    # skip the e2e (server-spawning) tests
// Exits non-zero if any step fails.
const cp = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const quick = process.argv.includes('--quick');

function run(label, cmd, args, opts = {}) {
  process.stdout.write(`\n▶ ${label}\n`);
  const r = cp.spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', ...opts });
  if (r.status !== 0) { console.error(`✗ ${label} FAILED (exit ${r.status})`); failures.push(label); }
  else console.log(`✓ ${label}`);
}

const failures = [];

// 1) Static checks — always run.
run('server.js node --check', 'node', ['--check', path.join(ROOT, 'server.js')]);
run('inline script: index.html', 'node', [path.join(__dirname, 'check-inline.js'), path.join(ROOT, 'index.html')]);
const docs = path.join(ROOT, 'docs', 'index.html');
if (fs.existsSync(docs)) run('inline script: docs/index.html', 'node', [path.join(__dirname, 'check-inline.js'), docs]);
run('ui.json parses', 'node', ['-e', "require(path.join('" + ROOT.replace(/\\/g, '\\\\') + "','ui.json'));console.log('  ui.json: OK')"]);
run('lessons.json parses', 'node', ['-e', "require(path.join('" + ROOT.replace(/\\/g, '\\\\') + "','lessons.json'));console.log('  lessons.json: OK')"]);

// 2) Unit tests — always run.
run('unit: id-based resolvers (item 2)', 'node', [path.join(__dirname, 'unit-resolvers.test.js')]);
run('unit: arc-mode options (item 3)', 'node', [path.join(__dirname, 'unit-arc-options.test.js')]);
run('unit: arc reinforce types (v46 bug #1)', 'node', [path.join(__dirname, 'unit-arc-reinforce-types.test.js')]);
run('unit: pdf text-span selection', 'node', [path.join(__dirname, 'unit-pdf-selection.test.js')]);
run('unit: conjugation grouping (item 4)', 'node', [path.join(__dirname, 'unit-conjugation-grouping.test.js')]);
run('unit: grammar reinforce note (item 5)', 'node', [path.join(__dirname, 'unit-grammar-reinforce.test.js')]);
run('unit: editor sync on delete (item 3)', 'node', [path.join(__dirname, 'unit-editor-sync.test.js')]);
run('unit: tts voice-quality helpers (item 1)', 'node', [path.join(__dirname, 'unit-tts-voice.test.js')]);
run('unit: always-on sound-test row (v49)', 'node', [path.join(__dirname, 'unit-tts-test-row.test.js')]);
run('unit: lesson-type meta table (item 8)', 'node', [path.join(__dirname, 'unit-lesson-type-meta.test.js')]);
run('unit: word-count tokenizer (item 8)', 'node', [path.join(__dirname, 'unit-word-count.test.js')]);
run('unit: lesson-row subtitle', 'node', [path.join(__dirname, 'unit-lesson-subtitle.test.js')]);
run('unit: lowercase title + app.motto tagline (v49)', 'node', [path.join(__dirname, 'unit-app-motto.test.js')]);
run('unit: word_forms validator', 'node', [path.join(__dirname, 'unit-word-forms.test.js')]);
run('unit: word_forms client play', 'node', [path.join(__dirname, 'unit-word-forms-client.test.js')]);
run('unit: synonyms in-context builder', 'node', [path.join(__dirname, 'unit-synonyms.test.js')]);
run('unit: synonyms context sentence', 'node', [path.join(__dirname, 'unit-syn-context.test.js')]);
run('unit: storyline bottom row + re-create wiring', 'node', [path.join(__dirname, 'unit-recreate-ui.test.js')]);
run('unit: chapter navigation (same-language)', 'node', [path.join(__dirname, 'unit-chapter-nav.test.js')]);
run('unit: user-flag editor (correct version + apply)', 'node', [path.join(__dirname, 'unit-user-flag-editor.test.js')]);
run('unit: play-flag target matching', 'node', [path.join(__dirname, 'unit-play-flag.test.js')]);
run('unit: static teacher-mode edit gating', 'node', [path.join(__dirname, 'unit-static-teacher.test.js')]);
run('unit: continue-story language filter', 'node', [path.join(__dirname, 'unit-continue-filter.test.js')]);
run('unit: attribute escaping (escAttr not escHtml)', 'node', [path.join(__dirname, 'unit-attr-escaping.test.js')]);
run('unit: lesson-type build registry (B-phase-1)', 'node', [path.join(__dirname, 'unit-build-registry.test.js')]);
run('unit: renderEx exercise-renderer registry (B-phase-2)', 'node', [path.join(__dirname, 'unit-renderex-registry.test.js')]);
run('unit: lesson-editor registry (B-phase-3)', 'node', [path.join(__dirname, 'unit-editor-registry.test.js')]);
run('unit: add-lesson server registry (B-phase-4)', 'node', [path.join(__dirname, 'unit-add-lesson-registry.test.js')]);
run('unit: per-language prompt examples — 4 prompts + de seed (A)', 'node', [path.join(__dirname, 'unit-prompt-examples.test.js')]);
run('unit: storyline-screen QC button + lesson-types dropdown (v47)', 'node', [path.join(__dirname, 'unit-storyline-screen-extras.test.js')]);
run('unit: static flag hiding + download/submit pill (v47)', 'node', [path.join(__dirname, 'unit-static-flags.test.js')]);
run('unit: import merge mode — flags-only onto existing (v47)', 'node', [path.join(__dirname, 'unit-import-merge.test.js')]);
run('unit: harvest rated items → examples.json (A)', 'node', [path.join(__dirname, 'unit-harvest-examples.test.js')]);
run('unit: mixed-type review lessons (C)', 'node', [path.join(__dirname, 'unit-mixed-lessons.test.js')]);
run('unit: mixed pool rating-aware (v46 #7)', 'node', [path.join(__dirname, 'unit-mixed-rating.test.js')]);
run('unit: static story edit (in-memory save)', 'node', [path.join(__dirname, 'unit-static-story-edit.test.js')]);
run('unit: static summary edit (in-memory save)', 'node', [path.join(__dirname, 'unit-static-summary-edit.test.js')]);
run('unit: chapter export (error-hunt + meta)', 'node', [path.join(__dirname, 'unit-export-lessons.test.js')]);
run('unit: static client export (eh/aeh + meta)', 'node', [path.join(__dirname, 'unit-client-export.test.js')]);
run('e2e: mixed lesson edit (type round-trip)', 'node', [path.join(__dirname, 'e2e-mixed-lesson-edit.test.js')]);
run('e2e: rating/flag round-trip (v46 Tier 1)', 'node', [path.join(__dirname, 'e2e-rating-edit.test.js')]);
run('unit: static build markers', 'node', [path.join(__dirname, 'unit-static-markers.test.js')]);
run('unit: generation metadata (_genMeta everywhere)', 'node', [path.join(__dirname, 'unit-genmeta.test.js')]);
run('unit: edit-history report (v46 #12)', 'node', [path.join(__dirname, 'unit-report-edits.test.js')]);
run('unit: chapter-link repair (v46 bug #2)', 'node', [path.join(__dirname, 'unit-chapter-link-repair.test.js')]);
run('unit: storyline lock hardening (v46 bug #2)', 'node', [path.join(__dirname, 'unit-storyline-lock-hardening.test.js')]);
run('unit: japanese furigana paste + tokenizer (v47)', 'node', [path.join(__dirname, 'unit-furigana.test.js')]);
run('unit: intro learn-the-script course (v48)', 'node', [path.join(__dirname, 'unit-intro-script.test.js')]);
run('unit: QC dispatch — synonyms/word_forms (v48)', 'node', [path.join(__dirname, 'unit-qc-dispatch.test.js')]);
run('unit: QC skip already-checked lessons (v49 bug 6)', 'node', [path.join(__dirname, 'unit-qc-skip.test.js')]);
run('unit: static version derived from server APP_VERSION (v49)', 'node', [path.join(__dirname, 'unit-version-derivation.test.js')]);
run('unit: translate-ui discovers every offered language (v53)', 'node', [path.join(__dirname, 'unit-translate-ui-langs.test.js')]);
run('unit: llm.js race guard clears its timer (v53_c)', 'node', [path.join(__dirname, 'unit-llm-timeout-handle.test.js')]);
run('unit: storyline summary model log + stamp (v53_c)', 'node', [path.join(__dirname, 'unit-storyline-summary-stamp.test.js')]);
run('unit: story provenance stamp + buildGenMeta model required (v53_d)', 'node', [path.join(__dirname, 'unit-story-stamp.test.js')]);
run('unit: translation provenance stamp (v55_f)', 'node', [path.join(__dirname, 'unit-translation-stamp.test.js')]);
run('unit: QC for generated texts — correct + guard (v55_g)', 'node', [path.join(__dirname, 'unit-qc-correct.test.js')]);
run('unit: collapsible model popover (v55_o)', 'node', [path.join(__dirname, 'unit-model-popover.test.js')]);
run('unit: static landing parity — storyboard+summary (v55_p)', 'node', [path.join(__dirname, 'unit-static-landing-parity.test.js')]);
run('unit: identical source/target ratio rule, corpus-calibrated (v53_g)', 'node', [path.join(__dirname, 'unit-identical-ratio.test.js')]);
run('unit: drill lessons — review my mistakes (v54)', 'node', [path.join(__dirname, 'unit-drill.test.js')]);
run('unit: storyline SVG storyboard (v55)', 'node', [path.join(__dirname, 'unit-storyboard.test.js')]);
run('unit: stable per-question IDs (qid) — Commit A', 'node', [path.join(__dirname, 'unit-qid-stability.test.js')]);
run('unit: coverage model (fraction/assembly/complete) — Commit B', 'node', [path.join(__dirname, 'unit-coverage.test.js')]);
run('unit: learned-vocab ledger + my-story wiring (v50)', 'node', [path.join(__dirname, 'unit-learned-vocab.test.js')]);
run('unit: my-story generation plumbing (v50)', 'node', [path.join(__dirname, 'unit-my-story.test.js')]);
run('unit: dialect glossary importer (M1, deterministic)', 'node', [path.join(__dirname, 'unit-dialect-glossary.test.js')]);
run('unit: dialect TTS approximate detection (M1)', 'node', [path.join(__dirname, 'unit-dialect-tts.test.js')]);
  run('unit: dialect import panel toggle (M1)', 'node', [path.join(__dirname, 'unit-dialect-panel.test.js')]);
  run('unit: dialect story generator + gate (M2)', 'node', [path.join(__dirname, 'unit-dialect-story.test.js')]);
  run('unit: dialect mute + no-lang prompt', 'node', [path.join(__dirname, 'unit-dialect-mute.test.js')]);
run('unit: no-keyboard glyph ordering (v48)', 'node', [path.join(__dirname, 'unit-no-keyboard.test.js')]);
run('unit: hidden lessons omitted/non-blocking in static (v48)', 'node', [path.join(__dirname, 'unit-hidden-lessons.test.js')]);
run('unit: inline onclick escaping (read-story SyntaxError)', 'node', [path.join(__dirname, 'unit-inline-escaping.test.js')]);
run('unit: error-hunt content-aware RTL', 'node', [path.join(__dirname, 'unit-error-hunt-rtl.test.js')]);
run('unit: order-exercise RTL keying (v49)', 'node', [path.join(__dirname, 'unit-order-rtl.test.js')]);
run('unit: word_forms/synonyms content-aware RTL (v49)', 'node', [path.join(__dirname, 'unit-wordforms-syn-rtl.test.js')]);
run('unit: stripThink reasoning-model hardening', 'node', [path.join(__dirname, 'unit-strip-think.test.js')]);
run('unit: model-picker wiring + static-exclusion', 'node', [path.join(__dirname, 'unit-model-picker.test.js')]);
run('unit: parseTableLesson non-ASCII header regression', 'node', [path.join(__dirname, 'unit-table-lesson.test.js')]);
run('unit: close-lang-pairs identical-field gating', 'node', [path.join(__dirname, 'unit-close-lang-pairs.test.js')]);
run('unit: dialect + synonyms prompt strictness', 'node', [path.join(__dirname, 'unit-prompt-strictness.test.js')]);
run('unit: QC editor model-aware label', 'node', [path.join(__dirname, 'unit-qc-editor-label.test.js')]);
run('unit: QC collect-and-compare per model', 'node', [path.join(__dirname, 'unit-qc-collect.test.js')]);
run('unit: feedback animations + mixed source icons', 'node', [path.join(__dirname, 'unit-ui-feedback-mixed-icons.test.js')]);
run('unit: storyline theme by story style', 'node', [path.join(__dirname, 'unit-storyline-theme.test.js')]);

// 3) E2E — spawn the real server + fake Ollama. Skipped with --quick.
if (!quick) {
  run('e2e: generate-book + storyline-title (item 5)', 'node', [path.join(__dirname, 'e2e-generate.test.js')]);
  run('e2e: userPrompt stores full input', 'node', [path.join(__dirname, 'e2e-userprompt.test.js')]);
  run('e2e: dialect glossary import (M1)', 'node', [path.join(__dirname, 'e2e-dialect-import.test.js')]);
  run('e2e: bookjob continuation + arc lessons', 'node', [path.join(__dirname, 'e2e-bookjob.test.js')]);
  run('e2e: book topic not truncated', 'node', [path.join(__dirname, 'e2e-booktopic.test.js')]);
  run('e2e: ui.json hot-reload', 'node', [path.join(__dirname, 'e2e-ui-reload.test.js')]);
  run('e2e: upload filename stored on storyline', 'node', [path.join(__dirname, 'e2e-bookfile.test.js')]);
  run('e2e: word_forms lesson generation', 'node', [path.join(__dirname, 'e2e-word-forms.test.js')]);
  run('e2e: synonyms context sentences', 'node', [path.join(__dirname, 'e2e-synonyms.test.js')]);
  run('e2e: re-create storyline lessons', 'node', [path.join(__dirname, 'e2e-recreate.test.js')]);
  run('e2e: model picker + table-format + split-translation + provenance', 'node', [path.join(__dirname, 'e2e-models.test.js')]);
} else {
  console.log('\n(skipping e2e tests: --quick)');
}

console.log('\n' + '='.repeat(50));
if (failures.length) { console.error(`FAILED (${failures.length}): ${failures.join(', ')}`); process.exit(1); }
console.log('ALL CHECKS PASSED');
