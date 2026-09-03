// unit-static-freshness.test.js
// v73_b — docs/index.html must be built from the CURRENT sources, not merely from a tree carrying
// the same APP_VERSION.
//
// Motivation, stated plainly: `unit-version-derivation` already asserts docs/ carries the server's
// version. That catches a release-boundary mistake and nothing else, because APP_VERSION changes
// once per release while index.html and lessons.json change many times inside one. Twice now a
// session has opened with docs/ built from a different corpus than the one on disk — most recently
// the v73 archive itself, whose docs/index.html predated lessons.json by 70 minutes. The suite was
// green both times. The consequence is a static build on GitHub Pages quietly serving an older
// corpus than the live server, which nobody sees until a chapter is missing.
//
// build-static.js now hashes each baked input and stamps the digests into the artifact as
// APP.buildSources. This test recomputes them and names the file that moved.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');

// build-static.js is in the set because a change to the TRANSFORM staleness-invalidates docs/ just
// as a change to the data does. server.js is not: only APP_VERSION reaches the artifact and
// unit-version-derivation already guards that.
const BAKED = ['index.html', 'lessons.json', 'ui.json', 'languages.json', 'scripts.json',
               'canonical-analysis.json', 'analysis-corrections.json', 'build-static.js'];

function fingerprint(file) {
  try { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 12); }
  catch (_) { return 'missing'; }
}

// ── 1. The builder stamps the digests ────────────────────────────────────────
// Source-level, and deliberately minimal: it only pins that the stamp is INJECTED rather than
// hardcoded. Everything that matters is asserted against the built artifact below.
{
  const build = fs.readFileSync(path.join(root, 'build-static.js'), 'utf8');
  assert.ok(/APP\.buildSources = \$\{JSON\.stringify\(BUILD_SOURCES\)\}/.test(build),
    'build-static.js injects the computed fingerprints (not a literal)');
  assert.ok(/function sourceFingerprint\(/.test(build),
    'build-static.js computes them from the files themselves');
}

// ── 2. The artifact carries a digest for every baked input ───────────────────
const docs = fs.readFileSync(path.join(root, 'docs', 'index.html'), 'utf8');
const m = docs.match(/APP\.buildSources = (\{[^}]*\});/);
assert.ok(m, 'docs/index.html declares APP.buildSources (rebuild docs: node build-static.js)');

let stamped;
try { stamped = JSON.parse(m[1]); }
catch (e) { assert.fail(`APP.buildSources in docs/index.html is not valid JSON: ${e.message}`); }

assert.deepStrictEqual(Object.keys(stamped).sort(), [...BAKED].sort(),
  'every baked input is fingerprinted — a new one must be added to build-static.js AND here');

// ── 3. Each digest matches the file on disk ──────────────────────────────────
// The payload assertion. Reported as a list so one rebuild fixes everything at once rather than
// the run stopping at the first stale file.
{
  const stale = [];
  for (const f of BAKED) {
    const now = fingerprint(path.join(root, f));
    if (now !== stamped[f]) stale.push(`${f} (docs built from ${stamped[f]}, on disk ${now})`);
  }
  assert.deepStrictEqual(stale, [],
    'docs/index.html is stale with respect to these files — re-run: node build-static.js');
}
console.log(`  docs/ built from the current ${BAKED.length} baked inputs: OK`);

console.log('unit-static-freshness: ALL PASSED');
