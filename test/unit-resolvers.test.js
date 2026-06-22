// Unit tests for the id-based parent resolvers (roadmap item 2).
// Asserts the live index.html still contains each resolver, then exercises the
// shared resolution semantics (id-first, same-language guard, name fallback).
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// 1) Source-shape: the forward resolvers now share one factory; the inverse
//    next-chapter finder (site D) is unchanged.
assert.ok(html.includes('function makeParentResolver'), 'index.html missing makeParentResolver factory');
const mustContain = [
  'const _slResolveParent = makeParentResolver(_slById, _slByTopicMap);',
  'const _resolveParent = makeParentResolver(_byIdAll, byTopic);',
  'const _resolveParentB = makeParentResolver(byId, byTopic);',
  'const _delResolveParent = makeParentResolver(byId, _delByTopic);',
];
for (const frag of mustContain) assert.ok(html.includes(frag), 'index.html missing resolver fragment: ' + frag);
// The old hand-inlined forward-resolver bodies must be gone (no duplicate logic).
assert.ok(!html.includes('const _resolveParentB = s =>'), 'old inline _resolveParentB body still present');
assert.ok(!html.includes('const _delResolveParent = s =>'), 'old inline _delResolveParent body still present');
console.log('  source-shape checks: OK');

// 2) Canonical resolver semantics — exercise the REAL factory from index.html.
function _extractFn(name) {
  const at = html.indexOf('function ' + name + '(');
  assert.ok(at >= 0, 'function not found in index.html: ' + name);
  const braceStart = html.indexOf('{', at);
  let depth = 0, i = braceStart;
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return html.slice(at, i);
}
const { makeParentResolver } = new Function(_extractFn('makeParentResolver') + '\nreturn { makeParentResolver };')();
function makeResolve(byId, byTopic) { return makeParentResolver(byId, byTopic); }

// Same story generated in de->en and fr->en: identical chapter names across languages.
const store = [
  { id: 'a1', topic: 'Kapitel 1', lang: 'de', srcLang: 'en' },
  { id: 'a2', topic: 'Kapitel 2', lang: 'de', srcLang: 'en', continuedFromId: 'a1' },
  { id: 'b1', topic: 'Kapitel 1', lang: 'fr', srcLang: 'en' },
  { id: 'b2', topic: 'Kapitel 2', lang: 'fr', srcLang: 'en', continuedFrom: 'Kapitel 1' },
  { id: 'c1', topic: 'Legacy A', lang: 'de', srcLang: 'en' },
  { id: 'c2', topic: 'Legacy B', lang: 'de', srcLang: 'en', continuedFrom: 'Legacy A' },
  { id: 'x1', topic: 'Cross', lang: 'de', srcLang: 'it', continuedFromId: 'a1' },
];
const byId = Object.fromEntries(store.filter(l => l.id).map(l => [l.id, l]));
const byTopic = Object.fromEntries(store.map(l => [l.topic, l]));
const resolve = makeResolve(byId, byTopic);

assert.strictEqual(resolve(byId.a2).id, 'a1', 'a2 -> a1 by id (not the same-named fr b1)');
assert.strictEqual(resolve(byId.b2).id, 'b1', 'b2 -> fr parent b1 by name (same language)');
assert.strictEqual(resolve(byId.c2).id, 'c1', 'c2 legacy -> c1 by name');
assert.strictEqual(resolve(byId.a1), null, 'a1 root');
assert.strictEqual(resolve(byId.b1), null, 'b1 root');
assert.strictEqual(resolve(byId.x1), null, 'x1 cross-srcLang rejected by language guard');
console.log('  canonical resolver semantics: OK');

// 3) Site A grouping (parent-topic-keyed, same-language only).
const childMap = {};
store.forEach(l => { const p = resolve(l); if (p) (childMap[p.topic] = childMap[p.topic] || []).push(l.topic); });
assert.deepStrictEqual(childMap['Kapitel 1'].sort(), ['Kapitel 2', 'Kapitel 2'], 'both same-name parents grouped (de+fr)');
assert.deepStrictEqual(childMap['Legacy A'], ['Legacy B'], 'legacy chain grouped');
assert.ok(!childMap['Cross'], 'cross-srcLang produced no grouping');
console.log('  site A grouping: OK');

// 4) Site B tails (targets = resolved parent topics; tails = not a target).
const allTargets = new Set();
store.forEach(s => { const p = resolve(s); if (p) allTargets.add(p.topic); });
const tails = store.filter(s => !allTargets.has(s.topic)).map(s => s.id).sort();
assert.deepStrictEqual(tails, ['a2', 'b2', 'c2', 'x1'], 'tails = chapters whose topic name is nobody\'s parent');
console.log('  site B tails: OK');

// 5) Site D inverse (find child of currentTopic), id-link + language guard.
function findChild(currentTopic) {
  const _cur = store.find(l => l.topic === currentTopic);
  return store.find(l => {
    const idMatch = _cur && _cur.id && l.continuedFromId === _cur.id;
    const nameMatch = !l.continuedFromId && l.continuedFrom === currentTopic;
    if (!idMatch && !nameMatch) return false;
    if (_cur && ((l.lang || '') !== (_cur.lang || '') || (l.srcLang || '') !== (_cur.srcLang || ''))) return false;
    return true;
  });
}
assert.strictEqual(findChild('Kapitel 1').id, 'a2', 'next after de Kapitel 1 is a2 (not cross-srcLang x1)');
assert.strictEqual(findChild('Legacy A').id, 'c2', 'legacy next by name');
console.log('  site D inverse finder: OK');

console.log('unit-resolvers: ALL PASSED');
