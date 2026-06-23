// Bug fix: in the static (server-less) build, the story edit pencil must (a) appear only
// when editing is allowed (teacher mode), and (b) save in-memory instead of POSTing to a
// non-existent server. The edit rides the JSON export (APP._dirtyExport).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

const fn = html.slice(html.indexOf('async function saveStoryEdit'), html.indexOf('async function saveStoryEdit') + 1400);
assert.ok(/if \(!APP\.info\?\.canGenerate\)/.test(fn), 'saveStoryEdit must branch for the static build');
assert.ok(/d\.story = newStory/.test(fn), 'static branch saves the story in memory');
assert.ok(/APP\._dirtyExport = true/.test(fn), 'static edit marks the export dirty (co-exported)');
const startAt = html.indexOf('async function saveStoryEdit');
assert.ok(html.indexOf('APP._dirtyExport = true', startAt) < html.indexOf("fetch('/api/save-story'", startAt),
  'static branch (dirty-export) comes before the server fetch');
console.log('  saveStoryEdit static branch: OK');

// The edit pencil is gated by _canEdit() (canGenerate OR teacher mode), so it shows in
// static teacher mode and stays hidden in static non-teacher mode.
assert.ok(/repToggle\.style\.display=_canEdit\(\)\?''/.test(html), 'story-edit pencil gated by _canEdit()');
console.log('  pencil gated by _canEdit(): OK');
console.log('unit-static-story-edit: ALL PASSED');
