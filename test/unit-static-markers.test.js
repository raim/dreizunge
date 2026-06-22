// The static build slices index.html on explicit markers (not coincidental code lines).
// Each marker token must start EXACTLY ONE line — if it also begins a line inside an
// explanatory comment, build-static's startsWith match grabs the wrong line and leaks
// server code into docs (this happened once). Guard that here.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const bs = fs.readFileSync(path.join(__dirname, '..', 'build-static.js'), 'utf8');

const MARKERS = ['// @static-exclude-start', '// @static-exclude-end', '// @static-engine-end'];
const lines = html.split('\n');
const at = {};
for (const m of MARKERS) {
  const hits = lines.map((l, i) => [l.trim(), i]).filter(([t]) => t.startsWith(m)).map(([, i]) => i);
  assert.strictEqual(hits.length, 1, `marker ${m} must start exactly one line (found ${hits.length})`);
  at[m] = hits[0];
}
assert.ok(at['// @static-exclude-start'] < at['// @static-exclude-end'], 'exclude-start before exclude-end');
assert.ok(at['// @static-exclude-end'] < at['// @static-engine-end'], 'exclude-end before engine-end');
console.log('  three markers, each unique, correctly ordered: OK');

// The excluded region holds server code; the included tail holds the client engine.
const excluded = lines.slice(at['// @static-exclude-start'], at['// @static-exclude-end']).join('\n');
const included = lines.slice(0, at['// @static-exclude-start']).join('\n') + '\n' +
                 lines.slice(at['// @static-exclude-end'], at['// @static-engine-end']).join('\n');
assert.ok(/async function init\(\)\{/.test(excluded), 'live init() must be in the excluded region');
assert.ok(/function buildPath\(\)\{/.test(included), 'buildPath() must be in the included region');
assert.ok(!/async function init\(\)\{/.test(included), 'live init() must NOT leak into the included client');
console.log('  excluded=server / included=client partition holds: OK');

// build-static.js drives the slice off the markers (not the old code lines).
for (const m of MARKERS) assert.ok(bs.includes(`findLine('${m}'`), `build-static must slice on ${m}`);
assert.ok(!bs.includes("findLine('async function init()')"), 'build-static must not slice on the init() code line');
console.log('  build-static slices on markers: OK');
console.log('unit-static-markers: ALL PASSED');
