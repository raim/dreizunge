// unit-word-forms-defects.test.js
// PLAN §F2 (v80_g) — a word_forms blank must be WHERE A WORD WAS REMOVED.
//
// The user's report: `"The sun was setting, casting long shadows across the path.___"` with answer
// `cast`. Nothing was removed — the blank is glued to the end of a finished sentence and the answer
// is still visible in it. `validateWordFormsItems` passed it because it only ever asked whether a
// blank EXISTS, never where it is.
//
// ⚠️ Fixtures are SYNTHETIC, on purpose. The corpus still holds 8 defective items (2.3% of 345),
// so a corpus-driven assertion would be red on arrival and would then be "fixed" by weakening it.
// The corpus number belongs to `build_history/probe_word_forms_defects_v80g.js`, which reports and
// does not assert. This file pins the DETECTOR.
//
// The rule is pure structure — terminal punctuation immediately followed by the blank — so it
// carries no language knowledge (INTERNALS: "no language knowledge in the code"). The Arabic and
// Japanese cases below are not decoration: four of the six real corpus hits are Arabic, which is
// what makes the signal structural rather than an artefact of Latin punctuation.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

// Extract the validator from server.js and run it standalone, so this tests the PRODUCT function
// rather than a re-typed copy of the rule (session-28 rule 1).
const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
function extract(name) {
  const at = src.indexOf('function ' + name + '(');
  assert.ok(at >= 0, name + ' is still defined in server.js');
  let i = src.indexOf('{', at), depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (!depth) return src.slice(at, j + 1); }
  }
  throw new Error('unbalanced braces reading ' + name);
}
const validate = new Function(
  extract('_wfNorm') + '\n' + extract('validateWordFormsItems') + '\nreturn validateWordFormsItems;')();

const item = (sentence, correct, others) => ({
  sentence, translation: 'x', choices: [correct].concat(others || ['zzz', 'qqq']),
  correctIndex: 0, explanation: ''
});
const reasonsFor = (it) => {
  const r = validate([it], 'some story text');
  return r.rejected.length ? r.rejected[0].reasons.join(' | ') : null;
};
const ORPHAN = /appended after a finished sentence/;

// ── 1. The reported item is REJECTED ───────────────────────────────────────
{
  const r = reasonsFor(item('The sun was setting, casting long shadows across the path.___', 'cast'));
  assert.ok(r && ORPHAN.test(r), 'the user\'s reported item is rejected as a misplaced blank, got: ' + r);
  console.log('  the reported item is rejected');
}

// ── 2. Structural, not Latin-specific ──────────────────────────────────────
// Arabic full stop, Arabic question mark, and the CJK ideographic stop.
for (const [label, s] of [
  ['arabic',   'فقلت: إن هذا غداء الملك أرسلني به الوحوش إليه.___'],
  ['arabic ?', 'أين ذهبت؟___'],
  ['cjk stop', '彼は本を読んでいました。___'],
  ['fullwidth', 'それは本当ですか？___'],
]) {
  const r = reasonsFor(item(s, 'قلت'));
  assert.ok(r && ORPHAN.test(r), `${label}: a blank after the stop is rejected too, got: ` + r);
}
console.log('  rejected across Arabic and CJK punctuation, not just "."');

// ── 3. ⚠️ THE DISCRIMINATOR — legitimate blanks are NOT rejected ───────────
// Without this the rule could be "reject anything ending in a blank", which would throw away good
// items wholesale. These are the shapes that must survive.
for (const [label, s, correct] of [
  ['blank before the stop',   'Ieri sono ___.',                         'andato'],
  ['blank ends, no stop',     'He wanted to ___',                       'leave'],
  ['blank mid-sentence',      'And each branch has more little branches ___ the one before?', 'than'],
  ['stop then space, mid',    'He arrived. Then he ___ the door.',      'opened'],
  ['blank before ! ',         'Che bello ___!',                         'giorno'],
]) {
  const r = reasonsFor(item(s, correct));
  assert.ok(!(r && ORPHAN.test(r)),
    `${label}: must NOT be rejected as a misplaced blank, got: ` + r);
}
console.log('  legitimate blanks survive, including a blank immediately before the stop');

// ── 4. Non-vacuity: the validator still accepts a clean item outright ──────
{
  const ok = validate([item('And each branch has more little branches ___ the one before?', 'than')], 'story');
  assert.strictEqual(ok.valid.length, 1, 'a clean item is accepted');
  assert.strictEqual(ok.rejected.length, 0, 'and not rejected for any other reason');
  console.log('  a clean item is still accepted');
}

// ── 5. The rule is REACHED, not shadowed by an earlier reason ──────────────
// The validator returns the FIRST reasons it accumulates; if an earlier check already rejected
// every malformed shape, this rule would be dead code that still looked green.
{
  const r = reasonsFor(item('The sun was setting, casting long shadows across the path.___', 'cast'));
  assert.strictEqual(r, 'blank is appended after a finished sentence, not in place of a word',
    'the misplaced-blank reason is the one that fires — not a side effect of an earlier check');
  console.log('  the rule is the reason that fires, not a shadow of an earlier one');
}

console.log('unit-word-forms-defects: ALL PASSED');
