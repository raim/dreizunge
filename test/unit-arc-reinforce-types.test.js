// Unit guard for Bug #1 (todos_v46): the grammar-arc reinforcement must generate
// the NEW word_forms + synonyms lesson types, not the LEGACY grammar + conjugation
// ones. Two client paths set `arcReinforce` (the gen form and the PDF/book import);
// both regressed to ['grammar','conjugation'] while the UI label promised
// "Word forms + synonyms". This scans index.html and asserts every arcReinforce
// assignment names the new types and none names the legacy ones.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// Grab every `arcReinforce = [ ... ]` / `arcReinforce=[ ... ]` assignment.
const re = /arcReinforce\s*=\s*\[([^\]]*)\]/g;
const assigns = [];
let m;
while ((m = re.exec(html)) !== null) assigns.push(m[1]);

assert.ok(assigns.length >= 2,
  `expected >=2 arcReinforce assignments in index.html, found ${assigns.length}`);

assigns.forEach((body, i) => {
  assert.ok(/word_forms/.test(body) && /synonyms/.test(body),
    `arcReinforce assignment #${i + 1} must use word_forms + synonyms (got: [${body.trim()}])`);
  // Legacy types are the regression we are guarding against. The token 'grammar'
  // must not appear as a reinforcement type here (note: the *arcMode* value
  // 'grammar' is a separate, allowed internal key and lives elsewhere).
  assert.ok(!/\bgrammar\b/.test(body) && !/\bconjugation\b/.test(body),
    `arcReinforce assignment #${i + 1} must NOT use legacy grammar/conjugation (got: [${body.trim()}])`);
});

// And the visible arc-mode option label (ui.json) must match what is generated.
const ui = require(path.join(__dirname, '..', 'ui.json'));
assert.ok(/word forms/i.test(ui.en['form.arc_mode_grammar']) &&
          /synonym/i.test(ui.en['form.arc_mode_grammar']),
  'ui.json form.arc_mode_grammar should describe word forms + synonyms');

console.log(`unit-arc-reinforce-types: ALL PASSED (${assigns.length} arcReinforce assignments, all word_forms+synonyms)`);
