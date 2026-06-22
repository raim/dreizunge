// Unit tests for mergeConjugationForms (TODO item 4): only canonical syncretism
// is shown as one row — German er/sie/es; English {I,you,we,they}/{he,she,it};
// other pronouns stay separate even when a form coincides. Extracts the live
// function (+ stripPronoun) from index.html via brace-matching.
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
const { mergeConjugationForms } = new Function(
  extract('stripPronoun') + '\n' + extract('mergeConjugationForms') +
  '\nreturn { mergeConjugationForms };')();

// helper: map result to "pronoun=cleanForm" set for easy assertions
const rowset = rows => rows.map(r => r.pronoun.split('/').map(s => s.trim().toLowerCase()).sort().join('/') + '=' + r.cleanForm.toLowerCase());

// ── German: full present paradigm of "lachen". Model emits each pronoun separately,
//    including coincidental syncretism (er/sie/es/ihr all "lacht"; wir/sie "lachen").
const deForms = [
  { pronoun: 'ich', form: 'ich lache' },
  { pronoun: 'du', form: 'du lachst' },
  { pronoun: 'er', form: 'er lacht' },
  { pronoun: 'sie', form: 'sie lacht' },     // 3sg she
  { pronoun: 'es', form: 'es lacht' },
  { pronoun: 'wir', form: 'wir lachen' },
  { pronoun: 'ihr', form: 'ihr lacht' },
  { pronoun: 'sie', form: 'sie lachen' },     // 3pl they
];
const de = mergeConjugationForms(deForms, 'de');
const deSet = rowset(de);
// Exactly: ich, du, er/sie/es, wir, ihr, sie(pl)
assert.ok(deSet.includes('er/es/sie=lacht'), 'er/sie/es merged into one row: ' + JSON.stringify(deSet));
assert.ok(deSet.includes('ich=lache'), 'ich separate');
assert.ok(deSet.includes('du=lachst'), 'du separate');
assert.ok(deSet.includes('ihr=lacht'), 'ihr stays SEPARATE even though form == er/sie/es');
assert.ok(deSet.includes('wir=lachen'), 'wir separate');
assert.ok(deSet.includes('sie=lachen'), 'plural sie separate (form lachen)');
// No row may fuse ich/du/wir/ihr with anything.
for (const r of de) {
  const ps = r.pronoun.split('/').map(s => s.trim().toLowerCase());
  if (ps.length > 1) assert.ok(ps.every(p => ['er','sie','es'].includes(p)), 'only er/sie/es may be grouped, got: ' + r.pronoun);
}
assert.strictEqual(de.length, 6, 'German yields 6 rows (got ' + de.length + ')');
console.log('  German: only er/sie/es fused — OK');

// ── German with the model OVER-grouping (er/sie/es/ihr in one row) must be split.
const deOver = [
  { pronoun: 'ich', form: 'ich gehe' },
  { pronoun: 'du', form: 'du gehst' },
  { pronoun: 'er/sie/es/ihr', form: 'geht' },   // model wrongly fused ihr in
  { pronoun: 'wir/sie', form: 'gehen' },          // model wrongly fused wir+sie
];
const deO = rowset(mergeConjugationForms(deOver, 'de'));
assert.ok(deO.includes('er/es/sie=geht'), 'over-grouped ihr split back out: ' + JSON.stringify(deO));
assert.ok(deO.includes('ihr=geht'), 'ihr separated from er/sie/es');
assert.ok(deO.includes('wir=gehen') && deO.includes('sie=gehen'), 'wir and sie separated');
console.log('  German: model over-grouping corrected — OK');

// ── English: the two canonical clusters, regardless of how the model emitted them.
const enForms = [
  { pronoun: 'I', form: 'I watch' }, { pronoun: 'you', form: 'you watch' },
  { pronoun: 'he', form: 'he watches' }, { pronoun: 'she', form: 'she watches' },
  { pronoun: 'it', form: 'it watches' }, { pronoun: 'we', form: 'we watch' },
  { pronoun: 'they', form: 'they watch' },
];
const en = mergeConjugationForms(enForms, 'en');
const enSet = rowset(en);
assert.strictEqual(en.length, 2, 'English yields 2 rows (got ' + en.length + ')');
assert.ok(enSet.includes('i/they/we/you=watch'), 'I/you/we/they grouped: ' + JSON.stringify(enSet));
assert.ok(enSet.includes('he/it/she=watches'), 'he/she/it grouped');
console.log('  English: two canonical clusters — OK');

// ── Unknown language: keep the model's grouping untouched (no merge, no split).
const itForms = [
  { pronoun: 'io', form: 'parlo' }, { pronoun: 'tu', form: 'parli' },
  { pronoun: 'lui/lei', form: 'parla' }, { pronoun: 'noi', form: 'parliamo' },
];
const it = mergeConjugationForms(itForms, 'it');
assert.strictEqual(it.length, 4, 'unknown lang preserves the model rows (got ' + it.length + ')');
assert.strictEqual(it[2].pronoun, 'lui/lei', 'model grouping preserved verbatim');
console.log('  Unknown language: model grouping preserved — OK');

console.log('unit-conjugation-grouping: ALL PASSED');
