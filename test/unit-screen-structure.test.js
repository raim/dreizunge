// unit-screen-structure.test.js
// v69_s2 — every `.screen` must be a TOP-LEVEL element, never nested inside another `.screen`.
//
// Why this exists: the teacher dashboard rendered its content successfully (the console showed
// "rendered: 1 learner, 40 flags") but the page was blank. Cause: `#storyline-screen` was missing
// its closing </div>, so `#teacher-screen` — inserted after it — became its CHILD. Since
// `.screen { display:none }` and storyline-screen was inactive, the nested teacher-screen collapsed
// to width:0 height:0 even with `.active` applied. The browser's computed-style probe pinned it
// (`parent: "storyline-screen"`, height: 0) after source-level analysis repeatedly misread the
// nesting — regex counts were fooled by `</div>` appearing inside the inline <script>.
//
// A screen nested inside another screen is ALWAYS a bug: it can only ever show when its parent
// screen is also active, which is never the intent. This test parses the HTML (scripts removed) and
// asserts no `.screen` encloses another.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

function screenNesting(file) {
  let html = fs.readFileSync(file, 'utf8');
  // Remove inline scripts: `</div>` and `<div` appear inside JS strings and would corrupt a
  // structural scan (this is exactly what hid the bug from earlier analysis).
  html = html.replace(/<script[\s\S]*?<\/script>/g, '');
  const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));

  // Walk every <div ...> / </div>, tracking the stack of open divs and whether each is a `.screen`.
  const re = /<div\b([^>]*)>|<\/div>/g;
  const stack = [];
  const violations = [];
  let m;
  while ((m = re.exec(body))) {
    if (m[0] === '</div>') { stack.pop(); continue; }
    const attrs = m[1] || '';
    const isScreen = /\bclass\s*=\s*"(?:[^"]*\s)?screen(?:\s[^"]*)?"/.test(attrs);
    const idMatch = attrs.match(/\bid\s*=\s*"([^"]+)"/);
    const id = idMatch ? idMatch[1] : '(no id)';
    if (isScreen) {
      const screenAncestor = stack.find(f => f.isScreen);
      if (screenAncestor) violations.push({ id, insideOf: screenAncestor.id });
    }
    // Self-closing divs are not used in this codebase; every <div> gets a matching </div>.
    stack.push({ id, isScreen });
  }
  return violations;
}

for (const rel of ['index.html', 'docs/index.html']) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) continue;
  const v = screenNesting(file);
  assert.strictEqual(v.length, 0,
    `${rel}: a .screen is nested inside another .screen — it can only display when its parent is ` +
    `also active, which is never intended:\n` +
    v.map(x => `    #${x.id} is inside #${x.insideOf}`).join('\n'));
  console.log(`  ${rel}: no screen is nested inside another screen: OK`);
}

console.log('unit-screen-structure: ALL PASSED');
