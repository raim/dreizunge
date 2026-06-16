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

// 3) E2E — spawn the real server + fake Ollama. Skipped with --quick.
if (!quick) {
  run('e2e: generate-book + storyline-title (item 5)', 'node', [path.join(__dirname, 'e2e-generate.test.js')]);
  run('e2e: bookjob continuation + arc lessons', 'node', [path.join(__dirname, 'e2e-bookjob.test.js')]);
} else {
  console.log('\n(skipping e2e tests: --quick)');
}

console.log('\n' + '='.repeat(50));
if (failures.length) { console.error(`FAILED (${failures.length}): ${failures.join(', ')}`); process.exit(1); }
console.log('ALL CHECKS PASSED');
