// test/summary.js — the headless runner's closing summary line.
//
// Lives in its own module (not a *.test.js, so run.js does not pick it up as a step) for one
// reason: it can be required and driven directly by a unit test. Testing it by executing run.js
// would make the suite re-enter itself, since that test would itself be one of the steps.
//
// Why this exists at all: until v70 the runner printed a bare `ALL CHECKS PASSED` with no total,
// so every check count quoted in the roadmap and session notes was a hand-derivation — and one of
// them drifted to 152 against an actual 133 without anything noticing. The number is now emitted
// by the harness that owns it.
'use strict';

function summaryLine(total, failures) {
  const n = Number.isFinite(Number(total)) ? Number(total) : 0;
  const f = Array.isArray(failures) ? failures : [];
  if (f.length) return `FAILED ${f.length} of ${n}: ${f.join(', ')}`;
  return `ALL CHECKS PASSED (${n} checks)`;
}

module.exports = { summaryLine };
