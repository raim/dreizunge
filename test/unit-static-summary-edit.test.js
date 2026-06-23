// Bug fix: the storyline-page summary edit pencil must be gated by _canEdit() (so it is
// hidden without teacher mode in the static build), and saveSummaryEdit must save in
// memory instead of POSTing to a non-existent server ("failed to fetch").
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// Both summary pencils are _canEdit()-gated; neither is rendered unconditionally.
const pencils = html.match(/openSummaryEdit\([^)]*\)" title="Edit summary">✏️<\/button>/g) || [];
assert.ok(pencils.length >= 2, 'expected the storyline summary pencils to exist');
// The storyline-screen pencil must be wrapped in a _canEdit() guard, not emitted bare.
assert.ok(/_canEdit\(\) \? '<button class="storyline-hdr-btn" data-sumid=/.test(html),
  'storyline-screen summary pencil must be gated by _canEdit()');
assert.ok(/_canEdit\(\) \? `<button class="storyline-hdr-btn" style="flex-shrink:0;margin-right:6px" onclick="event\.stopPropagation\(\);openSummaryEdit/.test(html),
  'library-header summary pencil must be gated by _canEdit()');
assert.ok(!/\+ '<button class="storyline-hdr-btn" data-sumid=.*openSummaryEdit/.test(html),
  'no ungated storyline-screen summary pencil remains');
console.log('  both summary pencils gated by _canEdit(): OK');

// saveSummaryEdit: static branch saves in memory and returns before the server fetch.
const start = html.indexOf('async function saveSummaryEdit');
const fnEnd = html.indexOf('function cancelSummaryEdit', start);
const fn = html.slice(start, fnEnd);
assert.ok(/if \(!APP\.info\?\.canGenerate\)/.test(fn), 'saveSummaryEdit must branch for the static build');
assert.ok(/APP\._dirtyExport = true/.test(fn), 'static branch marks export dirty');
assert.ok(fn.indexOf('APP._dirtyExport = true') < fn.indexOf("fetch('/api/storylines'"),
  'static branch comes before the server fetch');
assert.ok(/APP\.storylines\[idx\]\.summary = summary/.test(fn), 'summary saved in memory');
console.log('  saveSummaryEdit static branch: OK');
console.log('unit-static-summary-edit: ALL PASSED');
