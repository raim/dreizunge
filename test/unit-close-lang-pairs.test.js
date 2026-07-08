// The "identical source/target" heuristic (generateOneLesson) catches a model that copied the
// target language into the source field. For CLOSE language pairs (dialects, or e.g.
// Lëtzebuergesch↔German) many items legitimately share spelling, so identical items are logged but
// NOT blocked. This tests the closeness decision and the gating/logging wiring.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

function extract(name) {
  const at = src.indexOf('function ' + name + '(');
  const b = src.indexOf('{', at); let d = 0, i = b;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(at, i);
}
const pairsDecl = src.match(/const CLOSE_LANG_PAIRS = \[[\s\S]*?\];/)[0];
const isCloseLangPair = new Function(pairsDecl + '\n' + extract('isCloseLangPair') + '\nreturn isCloseLangPair;')();

// ── Close pairs (both orderings) ────────────────────────────────────────────────
assert.strictEqual(isCloseLangPair('lb', 'de'), true, 'Lëtzebuergesch ← German is close');
assert.strictEqual(isCloseLangPair('de', 'lb'), true, 'order-independent');
assert.strictEqual(isCloseLangPair('cs', 'sk'), true, 'Czech ↔ Slovak close');
assert.strictEqual(isCloseLangPair('nb', 'nn'), true, 'Norwegian variants close');
assert.strictEqual(isCloseLangPair('ru', 'uk'), true, 'East Slavic close');

// ── Dialects: lang === srcLang is always close ──────────────────────────────────
assert.strictEqual(isCloseLangPair('de', 'de'), true, 'de/de dialect topic is close');
assert.strictEqual(isCloseLangPair('it', 'it'), true, 'any lang===srcLang is close');

// ── Distant pairs are NOT close (the check still fires for them) ─────────────────
assert.strictEqual(isCloseLangPair('de', 'en'), false, 'German→English not close');
assert.strictEqual(isCloseLangPair('ja', 'en'), false, 'Japanese→English not close');
assert.strictEqual(isCloseLangPair('fr', 'it'), false, 'French→Italian not close (mostly distinct)');
assert.strictEqual(isCloseLangPair('es', 'en'), false, 'Spanish→English not close');

// ── Guards ──────────────────────────────────────────────────────────────────────
assert.strictEqual(isCloseLangPair('', 'de'), false, 'empty lang → not close');
assert.strictEqual(isCloseLangPair('de', null), false, 'missing srcLang → not close');
console.log('  isCloseLangPair: close pairs, dialects, distant pairs, guards: OK');

// ── Wiring: the block must log offending items and gate the throw on !_close ─────
const block = src.slice(src.indexOf('const _sameField ='), src.indexOf('const _sameField =') + 1200);
assert.ok(/console\.warn/.test(block), 'identical items are logged to the console');
assert.ok(/it\.target\}\s*=\s*.*it\.source/.test(block) || /it\.target}  =  \${it\.source}/.test(block),
  'each offending item is printed as "target = source"');
assert.ok(/const _close = isCloseLangPair\(lang, srcLang\)/.test(block), 'closeness computed from the pair');
assert.ok(/if \(!_close\) \{[\s\S]*vocabSame\.length > 2[\s\S]*throw/.test(block), 'vocab throw gated on !_close');
assert.ok(/sentSame\.length > 1[\s\S]*throw/.test(block), 'sentence throw present');
console.log('  gating + logging wired (log always, block only for distant pairs): OK');

console.log('unit-close-lang-pairs: ALL PASSED');
