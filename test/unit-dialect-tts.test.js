// unit-dialect-tts.test.js
// M1 final piece: dialect content is spoken with the base-language (German) voice and labelled
// "approximate", since there's no native dialect voice. Tests the pure detection logic:
// _lessonIsDialect() and ttsIsApproximate()'s dialect branch.
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

// Sandbox with a controllable APP + minimal LANGS.
const APP = { lessonData: null, cur: { lessonIdx: 0 }, lang: 'de', srcLang: 'en', ttsLang: null };
const LANGS = { de: { tts: 'de-DE' }, it: { tts: 'it-IT' } };
const M = new Function('APP', 'LANGS',
  [ext('_lessonIsDialect'), ext('ttsIsApproximate')].join('\n') +
  '\nreturn { _lessonIsDialect, ttsIsApproximate };')(APP, LANGS);

// ── 1) Non-dialect German lesson, native voice → not approximate ──────────────
APP.lessonData = { lang: 'de', lessons: [{ type: 'standard', vocab: [{ target: 'Hund', source: 'dog' }] }] };
APP.ttsLang = null;
assert.strictEqual(M._lessonIsDialect(), false, 'plain German lesson is not dialect');
assert.strictEqual(M.ttsIsApproximate(), false, 'native German voice on German content is exact');
console.log('  plain German lesson: not dialect, not approximate: OK');

// ── 2) Topic-level _dialect → dialect + approximate ──────────────────────────
APP.lessonData = { lang: 'de', _dialect: { label: 'Osttirol' }, lessons: [{ type: 'standard', vocab: [{ target: 'Gitsche', source: 'Mädchen', _dialect: true }] }] };
assert.strictEqual(M._lessonIsDialect(), true, 'topic-level _dialect detected');
assert.strictEqual(M.ttsIsApproximate(), true, 'dialect content is always approximate (base voice)');
console.log('  topic-level dialect: detected, approximate: OK');

// ── 3) Lesson-level _dialect flag → dialect ──────────────────────────────────
APP.lessonData = { lang: 'de', lessons: [{ type: 'standard', _dialect: true, vocab: [{ target: 'x', source: 'y' }] }] };
assert.strictEqual(M._lessonIsDialect(), true, 'lesson-level _dialect detected');
console.log('  lesson-level dialect flag: detected: OK');

// ── 4) Item-level _dialect (no lesson/topic flag) → dialect ──────────────────
APP.lessonData = { lang: 'de', lessons: [{ type: 'standard', vocab: [{ target: 'bleckfüeßet', source: 'barfuß', _dialect: true }] }] };
assert.strictEqual(M._lessonIsDialect(), true, 'item-level _dialect detected');
console.log('  item-level dialect marker: detected: OK');

// ── 5) Approximate stays true for dialect even with a matching base override ──
APP.ttsLang = 'de-DE';  // user set German voice explicitly
assert.strictEqual(M.ttsIsApproximate(), true, 'dialect + base voice override is still approximate');
console.log('  dialect approximate regardless of TTS override: OK');

// ── 6) Badge helper branches on dialect (source check) ───────────────────────
assert.ok(/tts\.approx_dialect/.test(html), 'badge uses a dialect-specific label key');
assert.ok(/_lessonIsDialect\(\)/.test(html), 'badge branches on _lessonIsDialect()');
const ui = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ui.json'), 'utf8'));
assert.ok('tts.approx_dialect' in ui.en, 'tts.approx_dialect present in en');
assert.ok(/\{lang\}/.test(ui.en['tts.approx_dialect']), 'dialect label names the (base) voice via {lang}');
console.log('  approximate badge is dialect-aware (names the base voice): OK');

console.log('unit-dialect-tts: ALL PASSED');
