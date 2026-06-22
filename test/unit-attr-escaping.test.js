// Regression guard: HTML attribute values must use escAttr (escapes " and '), never
// escHtml (only & < >). Using escHtml in an attribute lets a " in the data close the
// attribute early and truncate the value — this cut word_forms editor sentences at the
// first quote (e.g. a sentence containing '... ___: "..."').
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// escAttr must exist and escape both quote kinds.
const ea = html.slice(html.indexOf('function escAttr'), html.indexOf('function escAttr') + 200);
assert.ok(/&quot;/.test(ea) && /&#39;/.test(ea), 'escAttr must escape both " and \'');

// No attribute value (…="${escHtml(…) or …='${escHtml(…) anywhere.
const dq = (html.match(/="\$\{escHtml\(/g) || []).length;
const sq = (html.match(/='\$\{escHtml\(/g) || []).length;
assert.strictEqual(dq, 0, dq + ' double-quoted attribute(s) still use escHtml (should be escAttr)');
assert.strictEqual(sq, 0, sq + ' single-quoted attribute(s) still use escHtml (should be escAttr)');
console.log('  no attribute uses escHtml: OK');
console.log('unit-attr-escaping: ALL PASSED');
