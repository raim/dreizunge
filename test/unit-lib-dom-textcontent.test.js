// Regression test for the lib-dom.js `textContent` getter (test-harness bug, not app code).
//
// parseHtmlInto used to collapse ALL of an element's own text — both BEFORE and AFTER its child
// elements — into a single `_text` string, and the textContent getter always placed that whole
// blob ahead of the children's own text. So 'x<b>A</b>y' read back with the trailing 'y' text
// misplaced before the child's 'A', instead of the correct document-order 'xAy'. Fixed by walking
// `childNodes`, which parseHtmlInto already populates in real document order, instead of `_text`
// followed by `children`.
const assert = require('assert');
const { makeDocument } = require('./lib-dom.js');

function textContentOf(html) {
  const doc = makeDocument();
  const div = doc.createElement('div');
  div.innerHTML = html;
  return div.textContent;
}

// Trailing text after a child element (the bug this test pins).
assert.strictEqual(textContentOf('x<b>A</b>y'), 'xAy', 'trailing text after a child element');
// Same shape, two levels of nesting (the case from the bug report).
assert.strictEqual(textContentOf('x<ruby>A<rt>B</rt></ruby>y'), 'xABy', 'trailing text with nested children');
// Leading text before a child element — must keep working (many existing tests depend on this).
assert.strictEqual(textContentOf('lead<b>A</b>'), 'leadA', 'leading text before a child element');
// Text on both sides of a child element.
assert.strictEqual(textContentOf('x<b>A</b>y<i>B</i>z'), 'xAyBz', 'text interleaved with multiple children');
// No text at all.
assert.strictEqual(textContentOf('<b>A</b><i>B</i>'), 'AB', 'children with no surrounding text');
// Plain text, no children.
assert.strictEqual(textContentOf('just text'), 'just text', 'plain text with no child elements');

console.log('  lib-dom textContent ordering: OK');
