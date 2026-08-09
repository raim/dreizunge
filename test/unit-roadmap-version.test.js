// unit-roadmap-version.test.js
// v78_b — the session protocol's one version-specific sentence is now GUARDED rather than
// remembered.
//
// The protocol block in the current roadmap names the release line it belongs to. That sentence
// had shipped stale four times by session 32: roadmap_v73 said "the v72 line", roadmap_v76 said
// "the v75 line" for its entire run, and roadmap_v78 was written at the cut still naming the v77
// line — in both of the two sentences that carry it. Each time the correction was a note asking
// the NEXT session to check. Four repeats is the evidence that it was never going to be checked,
// so it becomes an assertion instead.
//
// Scope, deliberately narrow: this pins the roadmap's own statement of WHICH LINE IT IS against
// the single source of truth (server.js APP_VERSION). It says nothing about roadmap content.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

// ── The current base version, from the one place that defines it ─────────────
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const vm = server.match(/const APP_VERSION\s*=\s*'([^']+)'/);
assert.ok(vm, "server.js declares APP_VERSION");
// A point release is `v78_b`; the LINE it belongs to is `v78`. The roadmap is per BASE version.
const base = vm[1].split('_')[0];
assert.ok(/^v\d+$/.test(base), `APP_VERSION '${vm[1]}' yields a base of the form vNN (got '${base}')`);

// ── The current roadmap is the highest-numbered one ──────────────────────────
// Found by number, not by name, so this keeps working across cuts without being edited.
const roadmaps = fs.readdirSync(path.join(root, 'build_history'))
  .map(f => /^roadmap_v(\d+)\.md$/.exec(f))
  .filter(Boolean)
  .map(m => ({ file: m[0], n: Number(m[1]) }))
  .sort((a, b) => a.n - b.n);
assert.ok(roadmaps.length, 'build_history contains at least one roadmap_v*.md');
const current = roadmaps[roadmaps.length - 1];

assert.strictEqual(`v${current.n}`, base,
  `the highest-numbered roadmap is ${current.file} but APP_VERSION is '${vm[1]}' (base ${base}) — ` +
  'a version bump to a new BASE needs its own roadmap (protocol item 7)');
console.log(`  current roadmap ${current.file} matches APP_VERSION ${vm[1]}`);

// ── It names its own line, in every sentence that names one ──────────────────
// Both sentences are checked: the v78 cut got exactly this wrong, correcting neither. Matching all
// occurrences rather than the first is the difference between the two failures this test exists
// for. The patterns are anchored on the surrounding prose so the parenthetical that RECOUNTS the
// old mistakes ("roadmap_v73.md said \"the `v72` line\"") is not mistaken for a live claim.
const text = fs.readFileSync(path.join(root, 'build_history', current.file), 'utf8');
const claims = [
  { re: /\*\*This is the `(v\d+)` line\.\*\*/g,            what: 'the "This is the … line" sentence' },
  { re: /this file stays current through the whole (v\d+) line/g, what: 'the "stays current through" sentence' },
];
let checked = 0;
for (const { re, what } of claims) {
  const found = [...text.matchAll(re)];
  assert.ok(found.length, `${current.file} still carries ${what} — if it was reworded, update this guard`);
  for (const m of found) {
    assert.strictEqual(m[1], base,
      `${what} in ${current.file} names '${m[1]}' but this is the '${base}' line`);
    checked++;
  }
}
console.log(`  ${checked} version claim(s) in the protocol block name ${base}`);

console.log('unit-roadmap-version: ALL PASSED');
