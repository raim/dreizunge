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
run('unit: pdf text-span selection', 'node', [path.join(__dirname, 'unit-pdf-selection.test.js')]);
run('unit: conjugation grouping (item 4)', 'node', [path.join(__dirname, 'unit-conjugation-grouping.test.js')]);
run('unit: grammar reinforce note (item 5)', 'node', [path.join(__dirname, 'unit-grammar-reinforce.test.js')]);
run('unit: editor sync on delete (item 3)', 'node', [path.join(__dirname, 'unit-editor-sync.test.js')]);
run('unit: tts voice-quality helpers (item 1)', 'node', [path.join(__dirname, 'unit-tts-voice.test.js')]);
run('unit: lesson-type meta table (item 8)', 'node', [path.join(__dirname, 'unit-lesson-type-meta.test.js')]);
run('unit: word-count tokenizer (item 8)', 'node', [path.join(__dirname, 'unit-word-count.test.js')]);
run('unit: lesson-row subtitle', 'node', [path.join(__dirname, 'unit-lesson-subtitle.test.js')]);
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
run('unit: mixed-type review lessons (C)', 'node', [path.join(__dirname, 'unit-mixed-lessons.test.js')]);
run('unit: static story edit (in-memory save)', 'node', [path.join(__dirname, 'unit-static-story-edit.test.js')]);
run('unit: static summary edit (in-memory save)', 'node', [path.join(__dirname, 'unit-static-summary-edit.test.js')]);
run('unit: chapter export (error-hunt + meta)', 'node', [path.join(__dirname, 'unit-export-lessons.test.js')]);
run('unit: static client export (eh/aeh + meta)', 'node', [path.join(__dirname, 'unit-client-export.test.js')]);
run('unit: static build markers', 'node', [path.join(__dirname, 'unit-static-markers.test.js')]);
run('unit: generation metadata (_genMeta everywhere)', 'node', [path.join(__dirname, 'unit-genmeta.test.js')]);

// 3) E2E — spawn the real server + fake Ollama. Skipped with --quick.
if (!quick) {
  run('e2e: generate-book + storyline-title (item 5)', 'node', [path.join(__dirname, 'e2e-generate.test.js')]);
  run('e2e: userPrompt stores full input', 'node', [path.join(__dirname, 'e2e-userprompt.test.js')]);
  run('e2e: bookjob continuation + arc lessons', 'node', [path.join(__dirname, 'e2e-bookjob.test.js')]);
  run('e2e: book topic not truncated', 'node', [path.join(__dirname, 'e2e-booktopic.test.js')]);
  run('e2e: ui.json hot-reload', 'node', [path.join(__dirname, 'e2e-ui-reload.test.js')]);
  run('e2e: upload filename stored on storyline', 'node', [path.join(__dirname, 'e2e-bookfile.test.js')]);
  run('e2e: word_forms lesson generation', 'node', [path.join(__dirname, 'e2e-word-forms.test.js')]);
  run('e2e: synonyms context sentences', 'node', [path.join(__dirname, 'e2e-synonyms.test.js')]);
  run('e2e: re-create storyline lessons', 'node', [path.join(__dirname, 'e2e-recreate.test.js')]);
} else {
  console.log('\n(skipping e2e tests: --quick)');
}

console.log('\n' + '='.repeat(50));
if (failures.length) { console.error(`FAILED (${failures.length}): ${failures.join(', ')}`); process.exit(1); }
console.log('ALL CHECKS PASSED');
