// Source-shape test: the "continue an existing story" picker filters by BOTH the
// current target and source language, unless "show other languages" is ticked.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const at = html.indexOf('function repopulateContinueSelect(');
assert.ok(at >= 0, 'repopulateContinueSelect missing');
const body = html.slice(at, at + 1200);

// Reads both current target and source language.
assert.ok(/curLang\s*=\s*APP\.lang/.test(body), 'reads current target language');
assert.ok(/curSrc\s*=\s*APP\.srcLang/.test(body), 'reads current source language');
// Filters by both when not showing all.
assert.ok(/showAll\s*\?\s*saved/.test(body), 'showAll bypasses the filter');
assert.ok(/\(s\.lang\|\|'it'\)===curLang\s*&&\s*\(s\.srcLang\|\|'en'\)===curSrc/.test(body),
  'filters by BOTH target and source language');
console.log('  continue-select dual-language filter: OK');
console.log('unit-continue-filter: ALL PASSED');
