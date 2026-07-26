// unit-run-summary.test.js
// v70: the runner reports its own step count.
//
// Background: run.js used to end with a bare `ALL CHECKS PASSED` — no total — and the failure
// branch printed the number of FAILURES, which reads like a total but is not. Every check count in
// the roadmap and session notes was therefore hand-derived, and one drifted to 152 against an
// actual 133 with nothing to catch it. This guards that (a) the summary line carries the count,
// (b) the count comes from a counter incremented in run() itself rather than a literal, and
// (c) both exits go through the one summary function.
//
// summaryLine lives in test/summary.js precisely so this test can drive it directly: executing
// run.js from here would make the suite re-enter itself, since this file is one of its steps.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { summaryLine } = require('./summary.js');

const runSrc = fs.readFileSync(path.join(__dirname, 'run.js'), 'utf8');

// ── 1. Behaviour: the green line states the total ────────────────────────────
assert.strictEqual(summaryLine(133, []), 'ALL CHECKS PASSED (133 checks)');
assert.strictEqual(summaryLine(1, []), 'ALL CHECKS PASSED (1 checks)');
assert.strictEqual(summaryLine(0, []), 'ALL CHECKS PASSED (0 checks)');

// ── 2. Behaviour: the failure line distinguishes failures FROM the total ─────
// The old format was `FAILED (2): a, b` — a bare parenthesised number that invites being read as
// a check count. The count of failures and the count of checks must both be legible.
assert.strictEqual(summaryLine(133, ['a', 'b']), 'FAILED 2 of 133: a, b');
assert.strictEqual(summaryLine(133, ['solo']), 'FAILED 1 of 133: solo');
assert.ok(/\bof 133\b/.test(summaryLine(133, ['a'])), 'failure line names the total, not just the failures');

// ── 3. Behaviour: defensive against junk input (a summary must never throw) ──
assert.strictEqual(summaryLine(undefined, undefined), 'ALL CHECKS PASSED (0 checks)');
assert.strictEqual(summaryLine('7', []), 'ALL CHECKS PASSED (7 checks)');

// ── 4. Wiring: the total is COUNTED, not written down ────────────────────────
// The whole point is that the number cannot drift from reality, so there must be exactly one
// increment site and it must be inside run() — the function every step goes through.
const incs = runSrc.match(/^\s*total\+\+;?\s*$/gm) || [];
assert.strictEqual(incs.length, 1, 'exactly one total++ site (a second one would double-count)');

const runFn = runSrc.match(/function run\([\s\S]*?\n\}/);
assert.ok(runFn, 'run() is present in run.js');
assert.ok(/total\+\+/.test(runFn[0]), 'the increment lives inside run(), so every step is counted');

// Declared before run() — not after, which would leave a TDZ hazard if run() were ever hoisted
// into an earlier call site (the v68.1 crash class).
assert.ok(runSrc.indexOf('let total = 0') < runSrc.indexOf('function run('),
  'total is declared before run() (no TDZ hazard)');

// ── 5. Wiring: both exits print through the one summary function ─────────────
assert.ok(/require\(['"]\.\/summary\.js['"]\)/.test(runSrc), 'run.js requires the summary module');
const summaryCalls = runSrc.match(/summaryLine\(total, failures\)/g) || [];
assert.strictEqual(summaryCalls.length, 2, 'both the pass and fail exits use summaryLine(total, failures)');

// The old numberless / ambiguous strings are gone, so a future reader cannot cite a countless line.
assert.ok(!/console\.log\(['"]ALL CHECKS PASSED['"]\)/.test(runSrc),
  'the bare numberless ALL CHECKS PASSED is gone');
assert.ok(!/FAILED \(\$\{failures\.length\}\)/.test(runSrc),
  'the ambiguous `FAILED (n)` format is gone');

console.log(`  green summary:  ${summaryLine(133, [])}`);
console.log(`  failure summary: ${summaryLine(133, ['unit-foo', 'e2e-bar'])}`);
console.log('  counted at one site inside run(); both exits share summaryLine: OK');

// ── 6. --quick must actually skip the server-spawning tests (v70_b) ──────────
// run.js's own header says --quick "skip[s] the e2e (server-spawning) tests". Six of them were
// registered OUTSIDE `if (!quick)`, so --quick spawned servers anyway — the tooling quietly not
// doing what it said, the same shape of problem as the check count that was wrong in two docs.
// Guarded by behaviour (does the file spawn a server?) rather than by filename, since the `e2e-`
// prefix is a convention and conventions drift.
const quickAt = runSrc.indexOf('if (!quick) {');
assert.ok(quickAt > -1, 'run.js has a --quick block');

const spawnsServer = f => {
  const body = fs.readFileSync(path.join(__dirname, f), 'utf8');
  // A test can only spawn a server through test/lib.js, so requiring it is the precondition.
  if (!/require\(['"]\.\/lib(\.js)?['"]\)/.test(body)) return false;
  // Strip comments before looking for the call. The first cut of this check matched the word
  // "boot()" inside COMMENTS in unit-qc-skip and unit-qc-correct, which merely discuss server.js's
  // boot() — the exact over-broad-assertion trap the roadmap records twice. Scope to usage.
  const code = body
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/([^:'"`])\/\/.*$/gm, '$1');
  return /\bboot\s*\(|startFakeOllama\s*\(/.test(code);
};
const registered = [...runSrc.matchAll(/run\((?:.|\n)*?__dirname, '([a-z0-9.-]+\.test\.js)'\)/g)]
  .map(m => ({ file: m[1], at: m.index }));
assert.ok(registered.length > 100, 'found the registrations');

const strays = registered.filter(r => r.at < quickAt && spawnsServer(r.file)).map(r => r.file);
assert.deepStrictEqual(strays, [],
  `these spawn a server but are registered before the --quick block, so --quick would run them: ${strays.join(', ')}`);

// And the converse sanity check: the block is not empty, i.e. the guard above is not vacuous
// because everything got moved out.
assert.ok(registered.some(r => r.at > quickAt && spawnsServer(r.file)),
  'the --quick block still contains server-spawning tests (the check is not vacuous)');

console.log(`  --quick: ${registered.filter(r => r.at > quickAt).length} step(s) skipped, 0 server-spawning strays outside the block`);
console.log('unit-run-summary: ALL PASSED');
