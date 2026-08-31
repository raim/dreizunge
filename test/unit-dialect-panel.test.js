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

// ── Option A: LLM-authoring add-lesson types + AI-hunt gated off for dialect (UI) ──
// ⚠️ RE-ANCHORED at v87_o. The CLAIM is unchanged and still load-bearing — a dialect topic must
// never be offered the LLM-authoring lesson types, because those generators run in the base language
// and would inject standard-German content, breaking the "no invented dialect" guarantee. What
// changed is WHERE it is enforced.
//
// It used to live as a CSS class (`.opt-ai-authoring`) on the lesson-set card's own <select>, swept
// by openAddLesson at open time. v87_o deleted that <select>: the user asked for that surface to
// offer "the same checkmark list of all lesson types" as the storyline page, so it now routes through
// _pickLessonTypes → renderLessonTypeChecks over the SHARED ADD_LESSON_TYPES registry. The gate moved
// with it, from a class to a registry flag — which is strictly better, since the registry is the one
// list every add-lesson surface reads.
//
// Note, recorded rather than asserted: the LIBRARY menu's own <select> never carried those classes,
// so that surface never had this gate. Pre-existing, not introduced here, and out of scope for the
// v87_o change — worth fixing if a dialect topic is ever reachable from the library add-lesson row.
{
  const REG = html.slice(html.indexOf('const ADD_LESSON_TYPES = ['),
                         html.indexOf('\n];', html.indexOf('const ADD_LESSON_TYPES = [')));
  for (const type of ['synonyms', 'word_forms', 'inflections', 'grammar', 'conjugation',
                      // v71_l: comprehension joins the LLM-authoring set — its generator runs in the
                      // base language and would write standard-German questions about dialect text.
                      // v82_e: `writing` (PLAN §D4) joins it too, for the same reason.
                      'error_hunt', 'comprehension', 'writing']) {
    assert.ok(new RegExp("\\{ v: '" + type + "', ai: true,").test(REG),
      `${type} is flagged as LLM-authoring in the shared registry`);
  }
  for (const safe of ['standard', 'math', 'intro_script']) {
    assert.ok(!new RegExp("\\{ v: '" + safe + "', ai: true,").test(REG),
      `${safe} is NOT flagged — a dialect topic must still be offered it`);
  }
  assert.ok(/!\(x\.ai && o\.allowAi === false\)/.test(html),
    'renderLessonTypeChecks filters the flagged types out when a caller says allowAi:false');
  assert.ok(/allowAi: !\(d && d\._dialect\)/.test(html),
    'and the lesson-set card passes allowAi:false for a dialect topic — the gate is actually wired');
}
// It additionally needs a STORY — questions/tasks are written against the text — so it carries a
// second gate the other authoring types do not. `querySelectorAll`, not `querySelector`: two
// options now carry `.opt-needs-story` (comprehension, writing), and MUST run AFTER the dialect
// sweep above — that sweep unconditionally re-shows every `.opt-ai-authoring` option for a
// non-dialect topic, which used to silently undo this hide when it ran first (a real bug, found
// live while adding `writing` forced a second look at this function; fixed at v82_e by reordering).
assert.ok(/_fmtSel\.querySelectorAll\('\.opt-needs-story'\)\.forEach\(needsStoryOpt => \{/.test(html),
  'the no-story gate is wired for every needs-story option');
const _dialectPanelBody = html.slice(html.indexOf("function openAddLesson("), html.indexOf("function closeAddLesson("));
const _needsStoryGateAt = _dialectPanelBody.indexOf("querySelectorAll('.opt-needs-story')");
const _aiAuthoringGateAt = _dialectPanelBody.indexOf("querySelectorAll('.opt-ai-authoring')");
assert.ok(_needsStoryGateAt > _aiAuthoringGateAt && _aiAuthoringGateAt > 0,
  'the no-story gate runs AFTER the dialect sweep, so it has the last word on visibility');
assert.ok(/if \(!\(APP\.lessonData && String\(APP\.lessonData\.story \|\| ''\)\.trim\(\)\)\s*\n\s*&& \['comprehension', 'writing'\]\.includes\(_fmtSel\.value\)\) _fmtSel\.value = 'standard';/.test(html),
  'and a chapter with no story resets the selection instead of offering an impossible format');
// The AI error-hunt is a PURE human-edit diff (no LLM) — it must NOT be gated for dialect (it's the
// ideal tool for correcting dialect slop). Assert we did NOT hide it.
assert.ok(!/_huntLbl\.style\.display = _isDia \? 'none'/.test(html),
  'AI error-hunt (human-correction diff) is NOT hidden for dialect');
console.log('  Option A (UI): LLM-authoring add-lesson types hidden for dialect; human-edit AI-hunt kept: OK');

// ── PLAN §13 milestone 5 (v85_h): doDialectImport() sends the REAL selected language pair ──
// Was hardcoded `base:'de', source:'de'` regardless of #src-lang-select/#lang-select's actual
// values — dialect import could only ever target German. Static-analysis check (matching this
// file's own convention) against the function source; the runtime behaviour itself (a real request
// body carrying APP.lang/APP.srcLang) was verified live in the Browser pane, and the server-side
// half of this same bug (buildDialectTopic's caller also hardcoded base:'de', ignoring whatever the
// client sent) is covered by test/e2e-dialect-import.test.js's own new check.
{
  const fnImport = ext('doDialectImport');
  assert.ok(!/base\s*:\s*'de'/.test(fnImport), 'doDialectImport() no longer hardcodes base:\'de\'');
  assert.ok(!/source\s*:\s*'de'/.test(fnImport), 'doDialectImport() no longer hardcodes source:\'de\'');
  assert.ok(/base\s*:\s*APP\.lang/.test(fnImport), 'doDialectImport() sends base:APP.lang (the actual selected target language)');
  assert.ok(/source\s*:\s*APP\.srcLang/.test(fnImport), 'doDialectImport() sends source:APP.srcLang (the actual selected source language)');
}
console.log('  doDialectImport(): sends APP.lang/APP.srcLang, not a hardcoded \'de\'/\'de\' pair: OK');
