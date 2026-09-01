// unit-tts-allcaps.test.js
// item AW (v88_b) — an ALL-CAPS word must be SPOKEN as a word, not spelled out.
//
// The report (real content): ONTEIGENINGSZONE, extracted from a photographed sign into
// tp_17880367188140000070's story, was read out letter by letter. That is the speech engine's own
// "a run of capitals is an initialism" heuristic — correct for BBC, wrong for a shouting sign.
// The user's own rule: a run of 4+ capitals is a word. Three-letter runs stay untouched, because
// that is exactly where the genuine initialisms live.
//
// TWO layers are asserted, deliberately:
//   §1 the pure transform (_ttsSpeakableText) — cheap to enumerate, covers the edge cases;
//   §2 the transform actually REACHES the utterance (_ttsMakeUtterance) — which is the behavioural
//      claim. §1 alone would stay green if the call site were deleted, which is the vacuous-guard
//      trap the protocol names (and which this file's own mutation test at the foot checks for).
// And §3 pins the OTHER half of the claim: rendering is untouched. The fix is a SPOKEN projection.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const client = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function ext(src, name) {
  const at = src.indexOf('function ' + name + '(');
  assert.ok(at >= 0, `found ${name}`);
  const b = src.indexOf('{', at);
  let d = 0, i = b;
  for (; i < src.length; i++) { const c = src[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(at, i);
}

// ── 1. The transform itself ───────────────────────────────────────────────────
const spoken = new Function(ext(client, '_ttsSpeakableText') + '\nreturn _ttsSpeakableText;')();

{
  // The reported word, in the shape it actually appears in the corpus.
  assert.strictEqual(spoken('ONTEIGENINGSZONE'), 'Onteigeningszone',
    'the reported all-caps word is title-cased, so the engine reads it as a word');
  assert.strictEqual(spoken('Let op: ONTEIGENINGSZONE hier.'), 'Let op: Onteigeningszone hier.',
    'in a sentence, only the shouted word changes');
  console.log('  ONTEIGENINGSZONE → Onteigeningszone, in isolation and mid-sentence: OK');
}
{
  // The threshold, from both sides. 3 is the user's own boundary and is where initialisms live.
  assert.strictEqual(spoken('BBC'), 'BBC', 'a 3-letter initialism is LEFT ALONE (spelling it out is correct there)');
  assert.strictEqual(spoken('EU'), 'EU', '2 letters likewise');
  assert.strictEqual(spoken('A'), 'A', '1 letter likewise');
  assert.strictEqual(spoken('NASA'), 'Nasa', '4 letters is the first length that is treated as a word');
  console.log('  threshold: 1/2/3 capitals untouched, 4 transformed: OK');
}
{
  // Several runs in one string, and runs that are not whole words.
  assert.strictEqual(spoken('GRATIS KOSTENLOS'), 'Gratis Kostenlos', 'every qualifying run in the string');
  assert.strictEqual(spoken('Die STRASSE ist zu.'), 'Die Strasse ist zu.', 'a single shouted word among normal ones');
  assert.strictEqual(spoken('normal text'), 'normal text', 'text with no capital runs is returned unchanged');
  assert.strictEqual(spoken('Normal Title Case'), 'Normal Title Case', 'ordinary capitalisation is not a run');
  console.log('  multiple runs, mixed text, and no-op inputs: OK');
}
{
  // §4's own tier rule: this must be Unicode machinery, not a language table. A cased NON-ASCII
  // script must behave identically, and a CASELESS script must be untouched.
  assert.strictEqual(spoken('ΑΘΗΝΑ'), 'Αθηνα', 'Greek capitals are handled by the same \\p{Lu} rule — no ASCII assumption');
  assert.strictEqual(spoken('ПРИВЕТ'), 'Привет', 'Cyrillic likewise');
  const jp = '東京は大きい';
  assert.strictEqual(spoken(jp), jp, 'a caseless script cannot match \\p{Lu} and is returned byte-identical');
  const ar = 'مرحبا بالعالم';
  assert.strictEqual(spoken(ar), ar, 'Arabic likewise');
  console.log('  Unicode-general, not ASCII: Greek/Cyrillic transformed, Japanese/Arabic untouched: OK');
}
{
  assert.strictEqual(spoken(null), '', 'null is not a crash');
  assert.strictEqual(spoken(undefined), '', 'undefined likewise');
  console.log('  null/undefined tolerated: OK');
}

// ── 2. The transform REACHES the utterance ────────────────────────────────────
// This is the behavioural claim; §1 is only the arithmetic behind it. Runs the REAL
// _ttsMakeUtterance with its real dependencies, exactly as unit-tts-no-approximation does.
function mkUtterance(text) {
  const code = ext(client, '_ttsRankVoices') + '\n' + ext(client, '_ttsSavedVoiceName') + '\n'
             + ext(client, '_ttsPickVoice') + '\n' + ext(client, '_ttsSpeakableText') + '\n'
             + ext(client, '_ttsMakeUtterance');
  const voices = [{ name: 'Xander', lang: 'nl-NL', localService: true }];
  const APP = { _ttsVoiceName: null };
  const LANGS = { nl: { tts: 'nl-NL', name: 'Dutch' } };
  const speechSynthesis = { getVoices: () => voices };
  const f = new Function('APP', 'LANGS', 'speechSynthesis', 'window', 'renderTtsPill', 'SpeechSynthesisUtterance',
    code + '\nreturn _ttsMakeUtterance;');
  return f(APP, LANGS, speechSynthesis, { speechSynthesis }, () => {}, function (t) { this.text = t; })(text, 'nl-NL', 0.9);
}
{
  const u = mkUtterance('Let op: ONTEIGENINGSZONE');
  assert.ok(u, 'a matching voice exists, so an utterance is built (the §1 fix must not change this)');
  assert.strictEqual(u.text, 'Let op: Onteigeningszone',
    'the SPOKEN text carries the fix — this is the assertion that fails if the call site is removed');
  console.log('  _ttsMakeUtterance speaks the transformed text, not the raw string: OK');
}
{
  // The fix must not have disturbed the voice resolution this function exists for.
  const u = mkUtterance('gewoon');
  assert.strictEqual(u.text, 'gewoon', 'untransformed text passes through unchanged');
  assert.ok(u.voice && u.voice.name === 'Xander', 'voice selection still works');
  assert.strictEqual(u.lang, 'nl-NL', 'and the locale still follows the chosen voice');
  console.log('  voice/locale resolution is unaffected by the fix: OK');
}

// ── 3. RENDERING is untouched — the fix is a SPOKEN projection only ───────────
// The other half of the claim, and the half a "does it speak correctly" test cannot see. If
// _ttsSpeakableText ever leaked into a render path, a photographed sign would stop LOOKING like a
// sign. Asserted at the SOURCE layer because that is where the claim ("only speech calls this") is
// observable — a DOM assertion could only cover whichever renderer the fixture happened to hit.
{
  const calls = [...client.matchAll(/_ttsSpeakableText\s*\(/g)].length;
  const def   = [...client.matchAll(/function\s+_ttsSpeakableText\s*\(/g)].length;
  assert.strictEqual(def, 1, 'defined exactly once');
  assert.strictEqual(calls - def, 1,
    'called from exactly ONE site. If this fails, a new caller appeared — check it is a SPEECH path '
    + 'and not a renderer before raising this number.');
  const at = client.indexOf('_ttsSpeakableText(', client.indexOf('function _ttsMakeUtterance('));
  assert.ok(at > 0 && at - client.indexOf('function _ttsMakeUtterance(') < 800,
    'the one call site is inside _ttsMakeUtterance');
  console.log('  exactly one call site, and it is inside _ttsMakeUtterance: OK');
}

console.log('unit-tts-allcaps: ALL PASSED');
