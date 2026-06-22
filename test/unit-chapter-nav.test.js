// Unit tests for _chapterNeighbors: chapter prev/next navigation follows the
// storyline's ordered chapter ids (authoritative, collision-safe by id). A storyline
// may be intentionally mixed-language, and navigation then crosses languages by
// design. Navigation never leaks into a DIFFERENT storyline, and the continued-chain
// is only a fallback for chapters not in any storyline.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function extract(name) {
  const at = html.indexOf('function ' + name + '(');
  assert.ok(at >= 0, 'missing function: ' + name);
  const bs = html.indexOf('{', at);
  let d = 0, i = bs;
  for (; i < html.length; i++) { const c = html[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return html.slice(at, i);
}

// Two single-language storylines (de "Das kleine i", fr "La petit i") that came from
// the same PDF, plus one INTENTIONALLY mixed storyline.
const APP = {
  savedList: [
    { id: 'de1', topic: 'Eins',         lang: 'de', srcLang: 'en' },
    { id: 'de2', topic: '8 oder ∞',     lang: 'de', srcLang: 'en' },
    { id: 'de3', topic: 'Die Wahrheit', lang: 'de', srcLang: 'en' },
    { id: 'fr0', topic: 'Zero',         lang: 'fr', srcLang: 'en' },
    { id: 'mx0', topic: 'Antipasto',    lang: 'it', srcLang: 'es' },
    { id: 'mx1', topic: 'Entrée',       lang: 'it', srcLang: 'fr' },
  ],
  storylines: [
    { id: 'slDe', title: 'Das kleine i', chapters: ['de1', 'de2', 'de3'] },
    { id: 'slFr', title: 'La petit i',   chapters: ['fr0'] },
    { id: 'slMx', title: 'Cucina',       chapters: ['mx0', 'mx1'] }, // mixed, on purpose
  ],
};
const { _chapterNeighbors } = new Function('APP', extract('_chapterNeighbors') + '\nreturn { _chapterNeighbors };')(APP);
const byId = Object.fromEntries(APP.savedList.map(s => [s.id, s]));
const N = id => _chapterNeighbors(byId[id]);

// Storyline order is followed; "8 oder ∞" → "Die Wahrheit", staying in the de storyline.
let r = N('de2');
assert.strictEqual(r.prev?.id, 'de1', '8 oder ∞ prev = Eins');
assert.deepStrictEqual(r.nexts.map(x => x.id), ['de3'], '8 oder ∞ next = Die Wahrheit');
// Die Wahrheit is last in slDe → no next, prev within its own storyline.
r = N('de3');
assert.strictEqual(r.prev?.id, 'de2', 'Die Wahrheit prev = 8 oder ∞');
assert.strictEqual(r.nexts.length, 0, 'Die Wahrheit has no next');
// fr "Zero" is alone in slFr → no neighbours (does NOT leak into slDe).
r = N('fr0');
assert.strictEqual(r.prev, null, 'fr Zero no prev');
assert.strictEqual(r.nexts.length, 0, 'fr Zero no next');
console.log('  storyline-ordered, no cross-storyline leak: OK');

// Mixed-language storyline: navigation crosses languages by design.
r = N('mx0');
assert.deepStrictEqual(r.nexts.map(x => x.id), ['mx1'], 'mixed storyline: it/es → it/fr next allowed');
r = N('mx1');
assert.strictEqual(r.prev?.id, 'mx0', 'mixed storyline: prev crosses language');
console.log('  intentional mixed-language navigation: OK');

// Fallback (no storyline): follows the continued chain regardless of language.
const APP2 = { savedList: [
  { id: 'a', topic: 'A', lang: 'es', srcLang: 'en' },
  { id: 'b', topic: 'B', lang: 'es', srcLang: 'en', continuedFromId: 'a' },
], storylines: [] };
const { _chapterNeighbors: CN2 } = new Function('APP', extract('_chapterNeighbors') + '\nreturn { _chapterNeighbors };')(APP2);
assert.strictEqual(CN2(APP2.savedList[1]).prev?.id, 'a', 'fallback prev by continuedFromId');
assert.deepStrictEqual(CN2(APP2.savedList[0]).nexts.map(n => n.id), ['b'], 'fallback next by continuedFromId');
console.log('  fallback chain (no storyline): OK');

console.log('unit-chapter-nav: ALL PASSED');
