// unit-story-translation-toggle.test.js
// v60.6 — when a story has a stored source-language translation (the auto-translate pass's
// storyTranslation), show a toggle in the "read story" panels to switch languages. Two panels:
// the completion card (comp-story-*) and the landing saved-item story (sis-*). Contract:
//   • The toggle button is HIDDEN unless storyTranslation exists.
//   • Default view is the target-language story; toggling swaps to the translation and back.
//   • The button labels the OTHER language (showing target → "Translation", source → "Original").
//   • The completion card's 🔊 reads whichever language is shown.
//   • Vocab highlighting applies only to the target story (a translation isn't the target lang).
//   • The static build gets it for free (whole topics baked, storyTranslation preserved).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const builder = fs.readFileSync(path.join(ROOT, 'build-static.js'), 'utf8');

function ext(src, name) {
  let at = src.indexOf('\nfunction ' + name + '(') + 1;
  if (at < 1) at = src.indexOf('\nasync function ' + name + '(') + 1;
  assert.ok(at >= 1, `found ${name}`);
  const b = src.indexOf('{', at);
  let d = 0, i = b;
  for (; i < src.length; i++) { const c = src[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(at, i);
}

// DOM stub factory.
function makeDoc() {
  const els = {};
  const mk = id => els[id] || (els[id] = {
    style: {}, dataset: {},
    setAttribute(k, v) { this['_a_' + k] = v; }, getAttribute(k) { return this['_a_' + k]; },
    get textContent() { return this._t; }, set textContent(v) { this._t = v; },
    get innerHTML() { return this._h; }, set innerHTML(v) { this._h = v; },
    classList: { contains: () => false, toggle: () => {} },
  });
  return { getElementById: mk, _els: els };
}

// ── 1. Completion card toggle (behavioral) ───────────────────────────────────
{
  const doc = makeDoc();
  const APP = { lang: 'de', _compStoryLang: 'target',
    lessonData: { story: 'ZIEL story', storyTranslation: 'SOURCE translation', lang: 'it', srcLang: 'de' } };
  const t = k => ({ 'story.show_translation': 'Translation', 'story.show_original': 'Original' }[k] || k);
  const { _renderCompStory, toggleCompStoryLang } = new Function('document', 'APP', 't', 'setComplete',
    ext(html, '_renderCompStory') + '\n' + ext(html, 'toggleCompStoryLang') +
    '\nreturn { _renderCompStory, toggleCompStoryLang };')(doc, APP, t, () => true);

  _renderCompStory(true);
  assert.strictEqual(doc.getElementById('comp-story-text').textContent, 'ZIEL story', 'defaults to the target story');
  assert.strictEqual(doc.getElementById('comp-story-xlate').style.display, '', 'toggle visible when a translation exists');
  assert.strictEqual(doc.getElementById('comp-story-xlate').textContent, 'Translation', 'button offers the translation first');

  toggleCompStoryLang();
  assert.strictEqual(doc.getElementById('comp-story-text').textContent, 'SOURCE translation', 'toggles to the translation');
  assert.strictEqual(doc.getElementById('comp-story-xlate').textContent, 'Original', 'button now offers the original');
  assert.ok(doc.getElementById('comp-story-spk').getAttribute('onclick').includes('storyTranslation'),
    'the 🔊 reads the translation while it is shown');

  toggleCompStoryLang();
  assert.strictEqual(doc.getElementById('comp-story-text').textContent, 'ZIEL story', 'toggles back to the target');

  // No translation → toggle hidden, story still shown.
  APP.lessonData.storyTranslation = ''; APP._compStoryLang = 'target';
  _renderCompStory(true);
  assert.strictEqual(doc.getElementById('comp-story-xlate').style.display, 'none', 'no translation → toggle hidden');
  assert.strictEqual(doc.getElementById('comp-story-text').textContent, 'ZIEL story', 'story still shown without a translation');

  // Incomplete (teacher peek) truncates BOTH languages the same way.
  APP.lessonData.storyTranslation = 'x'.repeat(300); APP._compStoryLang = 'source';
  _renderCompStory(false);
  assert.ok(doc.getElementById('comp-story-text').textContent.endsWith('…'), 'preview truncates the shown language');
}
console.log('  completion card: default target, toggle to translation, 🔊 follows, hidden when absent: OK');

// ── 2. Saved-item card toggle (behavioral) ───────────────────────────────────
{
  const doc = makeDoc();
  const t = k => ({ 'story.show_translation': 'Translation', 'story.show_original': 'Original' }[k] || k);
  const furiHtml = s => s;                       // identity for the test
  const _highlightVocabHtml = (s) => '[HL]' + s; // marker so we can detect highlighting
  const cache = {};
  const env = new Function('document', 't', 'furiHtml', '_highlightVocabHtml', '_savedStoryCache',
    ext(html, '_renderSavedStory') + '\n' + ext(html, 'toggleSavedStoryLang') +
    '\nreturn { _renderSavedStory, toggleSavedStoryLang };');
  const { _renderSavedStory, toggleSavedStoryLang } = env(doc, t, furiHtml, _highlightVocabHtml, cache);

  cache['x'] = { story: 'ZIEL', storyTranslation: 'SOURCE',
    lessons: [{ vocab: [{ target: 'ZIEL' }] }] };
  const body = doc.getElementById('sis-body-x'); body.dataset.storyLang = 'target';
  _renderSavedStory('x');
  assert.ok(doc.getElementById('sis-body-x').innerHTML.includes('ZIEL'), 'shows the target story');
  assert.ok(doc.getElementById('sis-body-x').innerHTML.includes('[HL]'), 'target story gets vocab highlighting');
  assert.strictEqual(doc.getElementById('sis-xlate-x').style.display, '', 'toggle visible with a translation');

  toggleSavedStoryLang('x');
  assert.ok(doc.getElementById('sis-body-x').innerHTML.includes('SOURCE'), 'toggles to the translation');
  assert.ok(!doc.getElementById('sis-body-x').innerHTML.includes('[HL]'), 'translation is NOT vocab-highlighted (not the target language)');
  assert.strictEqual(doc.getElementById('sis-xlate-x').textContent, 'Original', 'button offers the original');

  // No translation → toggle hidden.
  cache['y'] = { story: 'ONLY', storyTranslation: '', lessons: [] };
  doc.getElementById('sis-body-y').dataset.storyLang = 'target';
  _renderSavedStory('y');
  assert.strictEqual(doc.getElementById('sis-xlate-y').style.display, 'none', 'no translation → toggle hidden');
}
console.log('  saved-item card: target-with-highlight, toggle to plain translation, hidden when absent: OK');

// ── 3. Markup + static parity ─────────────────────────────────────────────────
{
  assert.ok(/id="comp-story-xlate"[^>]*onclick="toggleCompStoryLang\(\)"/.test(html), 'completion card has the toggle button');
  assert.ok(/id="sis-xlate-\$\{sid\}"[^>]*onclick="event\.stopPropagation\(\);toggleSavedStoryLang\('\$\{sid\}'\)"/.test(html),
    'saved-item card has the toggle button');
  // The loader caches the whole loaded topic so the toggle needs no re-fetch.
  const ts = ext(html, 'toggleSavedStory');
  assert.ok(/_savedStoryCache\[id\] = d/.test(ts), 'toggleSavedStory caches the loaded topic for the toggle');
  // build-static bakes whole topics (spreads ...topic), so storyTranslation survives → static gets
  // the feature with no extra code. Assert the serializer doesn't drop it.
  assert.ok(/\{ \.\.\.topic, lessons: publicLessons \}/.test(builder) || /return topic;/.test(builder),
    'static serializer keeps whole topics (storyTranslation preserved)');
  const ui = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
  assert.ok(ui.en['story.show_translation'] && ui.en['story.show_original'], 'i18n keys present');
}
console.log('  markup + cache + static parity + i18n: OK');

console.log('unit-story-translation-toggle: ALL PASSED');
