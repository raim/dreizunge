// v52_d UI changes: (1) answer feedback uses rise-up (correct) / fall-down (wrong) instead of the
// sideways shake; (2) a mixed lesson card previews the LLM-picked icons of the lessons it pools from.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// ── (1) Feedback animations ──────────────────────────────────────────────────────
assert.ok(/@keyframes riseUp\{/.test(html) && /riseUp[\s\S]{0,120}translateY\(-\d\dpx\)/.test(html), 'riseUp keyframe lifts the card up');
assert.ok(/@keyframes fallDown\{/.test(html) && /fallDown[\s\S]{0,120}translateY\(\d\dpx\)/.test(html), 'fallDown keyframe drops the card down');
assert.ok(/\.rise-up\{animation:riseUp/.test(html) && /\.fall-down\{animation:fallDown/.test(html), 'rise-up/fall-down classes defined');
// Correct branch adds rise-up; wrong branch adds fall-down (and the old shake is no longer applied).
assert.ok(/classList\.add\('rise-up'\)/.test(html), 'correct answer adds rise-up');
assert.ok(/classList\.add\('fall-down'\)/.test(html), 'wrong answer adds fall-down');
assert.ok(!/classList\.add\('shake'\)/.test(html), 'the sideways shake is no longer applied on a wrong answer');
console.log('  feedback animations (rise-up / fall-down): OK');

// ── (2) Mixed source icons ───────────────────────────────────────────────────────
assert.ok(/function mixedSourceIcons\(d, mixIdx\)/.test(html), 'mixedSourceIcons defined');
assert.ok(/L\.type==='mixed'[\s\S]{0,160}mixedSourceIcons\(d,i\)/.test(html), 'mixed card renders source icons');

// Replay the helper: dedup, skip mixed/error-hunt/hidden/unbuildable.
const src = html;
const extract = (name) => {
  const at = src.indexOf('function ' + name + '(');
  const b = src.indexOf('{', at); let d = 0, i = b;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(at, i);
};
const _NEVER_POOLED = new Set(['mixed', 'error_hunt', 'ai_error_hunt']);
const lessonTypeMeta = () => ({ build: (l) => l._n ? new Array(l._n).fill(0) : [] });
const lessonTypeEmoji = () => '📖';
const mixedSourceIcons = new Function('_NEVER_POOLED', 'lessonTypeMeta', 'lessonTypeEmoji',
  extract('mixedSourceIcons') + '\nreturn mixedSourceIcons;')(_NEVER_POOLED, lessonTypeMeta, lessonTypeEmoji);

const d = { lessons: [
  { type: 'standard', icon: '🍎', _n: 5 },
  { type: 'grammar', icon: '📖', _n: 3 },
  { type: 'synonyms', icon: '🔁', _n: 2 },
  { type: 'mixed', icon: '🔀' },
  { type: 'error_hunt', icon: '🕵️', _n: 1 },   // never pooled
  { type: 'standard', icon: '🍎', _n: 4 },       // duplicate icon → deduped
  { type: 'standard', icon: '🎨', _n: 0 },       // unbuildable → skipped
  { type: 'standard', icon: '🌊', _n: 3, _hidden: true }, // hidden → skipped
] };
assert.deepStrictEqual(mixedSourceIcons(d, 3), ['🍎', '📖', '🔁'], 'dedups + skips error-hunt/hidden/unbuildable');
assert.deepStrictEqual(mixedSourceIcons({ lessons: [{ type: 'mixed' }] }, 0), [], 'empty chapter → no icons (card falls back to the label)');
console.log('  mixed source icons (dedup + filters): OK');

console.log('unit-ui-feedback-mixed-icons: ALL PASSED');
