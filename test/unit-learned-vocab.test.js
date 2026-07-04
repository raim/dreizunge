// unit-learned-vocab.test.js
// v50: cumulative learned-vocabulary ledger — the foundation for user-specific generation
// ("my story") and milestone unlocks (see roadmap). Foundation only: it ACCUMULATES learned
// words/sentences across lessons (per target|source language), tracks wrong-answered words, and
// gates the "my story" option — but the generator does not consume it yet.
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

const APP = { lang: 'de', srcLang: 'en', lessonData: null, cur: null, progress: {} };
let saved = 0;
const env = { APP, saveProg: () => { saved++; }, stripFuri: s => String(s == null ? '' : s) };
const src = [
  ext('_learnedLedger'), ext('recordLearnedFromLesson'), ext('learnedSummary'),
].join('\n');
const M = new Function(...Object.keys(env), src +
  '\nreturn { _learnedLedger, recordLearnedFromLesson, learnedSummary };')(...Object.values(env));

APP.lessonData = { topic: 'T1', lang: 'de', srcLang: 'en', lessons: [] };

// ── 1) Records vocab + sentences from a standard lesson ──────────────────────
const lesson1 = {
  type: 'standard',
  vocab: [{ target: 'Katze', source: 'cat' }, { target: 'Hund', source: 'dog' }],
  sentences: [{ target: 'Die Katze schläft', source: 'The cat sleeps' }],
};
M.recordLearnedFromLesson(lesson1, new Set());
let sum = M.learnedSummary('de', 'en');
assert.strictEqual(sum.vocabCount, 2, 'two vocab words recorded');
assert.strictEqual(sum.sentenceCount, 1, 'one sentence recorded');
assert.ok(saved > 0, 'ledger persists via saveProg');
console.log('  records vocab + sentences from a standard lesson: OK');

// ── 2) Accumulates across lessons; per-language keyed; seen increments ───────
const lesson2 = { type: 'standard', vocab: [{ target: 'Katze', source: 'cat' }, { target: 'Vogel', source: 'bird' }] };
M.recordLearnedFromLesson(lesson2, new Set());
sum = M.learnedSummary('de', 'en');
assert.strictEqual(sum.vocabCount, 3, 'accumulates (Katze de-duped, Vogel added) → 3 distinct');
const led = M._learnedLedger('de', 'en');
assert.strictEqual(led.vocab['Katze'].seen, 2, 'repeated word increments seen');
// different language pair is a separate ledger
APP.lessonData = { topic: 'T2', lang: 'fr', srcLang: 'en', lessons: [] };
M.recordLearnedFromLesson({ type: 'standard', vocab: [{ target: 'chat', source: 'cat' }] }, new Set());
assert.strictEqual(M.learnedSummary('fr', 'en').vocabCount, 1, 'fr ledger separate from de');
assert.strictEqual(M.learnedSummary('de', 'en').vocabCount, 3, 'de ledger unchanged by fr');
console.log('  accumulates across lessons, per-language, seen increments: OK');

// ── 3) Wrong-answered words are flagged for future focus ─────────────────────
APP.lessonData = { topic: 'T1', lang: 'de', srcLang: 'en', lessons: [] };
M.recordLearnedFromLesson({ type: 'standard', vocab: [{ target: 'Katze', source: 'cat' }] }, new Set(['Katze']));
assert.ok(M._learnedLedger('de', 'en').vocab['Katze'].wrong >= 1, 'wrong-answered word tracks a wrong count');
console.log('  wrong-answered words tracked for retraining focus: OK');

// ── 4) Flagged items are excluded ────────────────────────────────────────────
const before = M.learnedSummary('de', 'en').vocabCount;
M.recordLearnedFromLesson({ type: 'standard', vocab: [{ target: 'BADWORD', source: 'x', userFlag: { comment: 'no' } }] }, new Set());
assert.strictEqual(M.learnedSummary('de', 'en').vocabCount, before, 'flagged vocab is not recorded');
console.log('  flagged items excluded from the ledger: OK');

// ── 5) Other lesson types contribute (synonyms/grammar/conjugation) ──────────
M.recordLearnedFromLesson({ type: 'synonyms', words: [{ base: 'groß', gloss: 'big' }] }, new Set());
M.recordLearnedFromLesson({ type: 'grammar', grammar: [{ target: 'Tisch', source: 'table' }] }, new Set());
M.recordLearnedFromLesson({ type: 'conjugation', conjugations: [{ infinitive: 'sein', source: 'to be' }] }, new Set());
const led2 = M._learnedLedger('de', 'en');
assert.ok(led2.vocab['groß'] && led2.vocab['Tisch'] && led2.vocab['sein'], 'synonyms/grammar/conjugation contribute');
console.log('  synonyms/grammar/conjugation contribute to the ledger: OK');

// ── 6) Selector wiring: localized new-story, gated my-story sentinel ─────────
assert.ok(/<option value="">'\+escHtml\(t\('form\.new_story'\)\)\+'<\/option>'/.test(html),
  'new-story option is localized via form.new_story');
assert.ok(/value="__my__"/.test(html) && /t\('form\.my_story'\)/.test(html),
  'my-story option uses the __my__ sentinel and form.my_story label');
assert.ok(/learnedSummary\(curLang, curSrc\)/.test(html) && /vocabCount >= 8/.test(html),
  'my-story is gated on having learned vocabulary');
assert.ok(/contVal==='__my__'/.test(html),
  'doGenerate recognizes the __my__ sentinel (now wired to generation — see unit-my-story)');
console.log('  selector wiring: localized new-story + gated my-story sentinel: OK');

// ── 7) i18n: the moved/new keys are present in en and translated across languages ──
const ui = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ui.json'), 'utf8'));
const _lc = Object.keys(ui).filter(l => l !== 'en').length;
for (const k of ['form.new_story', 'form.my_story', 'toast.my_story_soon']) {
  assert.ok(k in ui.en, `${k} present in en`);
  const have = Object.keys(ui).filter(l => l !== 'en' && ui[l][k] !== undefined).length;
  assert.ok(have >= _lc - 3, `${k} translated across (nearly) all languages`);
}
console.log('  i18n keys present in en, translated across languages: OK');

console.log('unit-learned-vocab: ALL PASSED');
