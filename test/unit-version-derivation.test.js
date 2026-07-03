// unit-version-derivation.test.js
// v49 tech-debt fix: the static build's version must be DERIVED from server.js's APP_VERSION,
// not hardcoded (it drifted to a stale value before v48). Guards that (a) build-static.js reads
// APP_VERSION from server.js, (b) it interpolates that value into both the info.version and the
// tagline-tooltip spots rather than a literal, and (c) a freshly built docs/index.html carries
// exactly the server's current version in both places.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const build = fs.readFileSync(path.join(root, 'build-static.js'), 'utf8');

// Server is the single source of truth.
const sm = server.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
assert.ok(sm, 'server.js defines APP_VERSION');
const version = sm[1];

// build-static.js parses it (not a hardcoded copy).
assert.ok(/APP_VERSION\s*=\s*['"]v0['"]/.test(build) || /let APP_VERSION/.test(build),
  'build-static.js declares an APP_VERSION it will fill from server.js');
assert.ok(/readFileSync\(serverFile[\s\S]{0,120}APP_VERSION\s*=\s*['"]\(\[\^'"\]\+\)['"]/.test(build)
       || /match\(\/APP_VERSION\\s\*=\\s\*\['"\]\(\[\^'"\]\+\)\['"\]\//.test(build),
  'build-static.js parses APP_VERSION out of server.js');
assert.ok(/version: '\$\{APP_VERSION\}'/.test(build),
  'build-static injects APP_VERSION into info.version (not a literal)');
assert.ok(/_v\.title='\$\{APP_VERSION\}'/.test(build),
  'build-static injects APP_VERSION into the tagline tooltip (not a literal)');
// No stale hardcoded version literal like 'v48' remains as the injected value.
assert.ok(!/version: 'v\d+'/.test(build) && !/_v\.title='v\d+'/.test(build),
  'no hardcoded version literal remains in the injected static init');

// The built artifact reflects the server version in both spots.
const docs = fs.readFileSync(path.join(root, 'docs', 'index.html'), 'utf8');
assert.ok(docs.includes(`version: '${version}'`),
  `docs/index.html info.version is ${version} (rebuild docs if this fails)`);
assert.ok(docs.includes(`_v.title='${version}'`),
  `docs/index.html tagline tooltip is ${version} (rebuild docs if this fails)`);

console.log(`  static build derives version (${version}) from server.js APP_VERSION: OK`);
console.log('unit-version-derivation: ALL PASSED');
