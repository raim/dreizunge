// unit-dialect-panel.test.js
// Regression for the live bug: ticking "🗣 I have a dialect glossary" hid the story input but the
// dialect panel never appeared and the (normal) Generate button silently no-op'd. Root causes:
// (1) the panel is a .user-story-panel whose CSS is display:none — it must be shown via the .open
// CLASS, not an inline style; (2) the normal Generate button row must be hidden in dialect mode so
// it can't be clicked with no topic. This test locks both in via static analysis (no DOM/deps).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function ext(name){
  const at = html.indexOf('function ' + name + '(');
  if (at < 0) throw new Error('not found: ' + name);
  const b = html.indexOf('{', at); let d = 0, i = b;
  for (; i < html.length; i++){ if (html[i] === '{') d++; else if (html[i] === '}'){ d--; if (!d){ i++; break; } } }
  return html.slice(at, i);
}

// ── 1) The panel is shown via the .open class, and the CSS rule exists ────────
assert.ok(/\.user-story-panel\.open\{display:flex\}/.test(html),
  '.user-story-panel.open{display:flex} rule exists (this is what actually shows the panel)');
const fn = ext('onUseDialectCb');
assert.ok(/panel\.classList\.toggle\('open'\s*,\s*on\)/.test(fn),
  'onUseDialectCb toggles the .open CLASS (not inline style, which the CSS display:none would win over)');
assert.ok(!/panel\.style\.display\s*=/.test(fn),
  'onUseDialectCb does NOT set panel.style.display (that was the bug)');

// ── 2) The panel markup has no blocking inline display:none ──────────────────
const panelTag = html.match(/<div class="user-story-panel" id="dialect-panel"[^>]*>/);
assert.ok(panelTag, 'dialect-panel element exists');
assert.ok(!/display:none/.test(panelTag[0]),
  'dialect-panel has NO inline display:none (would override the .open class)');

// ── 3) The normal Generate button row is hidden in dialect mode ──────────────
assert.ok(/id="gen-btn-row"/.test(html), 'the Generate button row has an id to hide');
assert.ok(/gen-btn-row'\)\s*;\s*if\(gbr\)\s*gbr\.style\.display=on\?'none':''/.test(fn.replace(/\s+/g,' ')) ||
          /gbr\.style\.display=on\?'none':''/.test(fn),
  'onUseDialectCb hides the Generate button row when dialect mode is on');
assert.ok(/gen-form-section'\)[\s\S]*?gf\.style\.display=on\?'none':''/.test(fn),
  'onUseDialectCb also hides gen-form-section');

// ── 4) The dialect panel is OUTSIDE gen-form-section (so hiding the section doesn't hide it) ──
const panelIdx = html.indexOf('id="dialect-panel"');
const sectionIdx = html.indexOf('id="gen-form-section"');
assert.ok(panelIdx > 0 && sectionIdx > 0 && panelIdx < sectionIdx,
  'dialect-panel appears before (outside) gen-form-section in the markup');

// ── 5) The panel contains its own Build button + inputs (the real action in dialect mode) ──
const panelStart = html.indexOf('id="dialect-panel"');
const panelSlice = html.slice(panelStart, html.indexOf('id="gen-form-section"'));
for (const id of ['dialect-name-input', 'dialect-input', 'dialect-import-btn', 'dialect-attr-input', 'dialect-report']) {
  assert.ok(panelSlice.includes('id="' + id + '"'), `panel contains #${id}`);
}
assert.ok(/onclick="doDialectImport\(\)"/.test(panelSlice), 'Build button calls doDialectImport()');

console.log('  dialect panel: shown via .open class, Generate row hidden, panel self-contained: OK');
console.log('unit-dialect-panel: ALL PASSED');
