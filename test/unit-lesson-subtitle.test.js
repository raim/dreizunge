// Unit tests for lessonSubtitle (v45 minor): the lesson-row subtitle shows vocab
// mode (extend/neutral/reinforce, via gen.vocab_mode_*) + difficulty, falling back
// to the per-type description.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
assert.ok(html.includes('function lessonSubtitle'), 'lessonSubtitle missing');
// node-desc now uses the helper, not the old inline IIFE.
assert.ok(html.includes('<div class="node-desc">${lessonSubtitle(L, diff)}</div>'),
  'node-desc not wired to lessonSubtitle');
console.log('  source-shape: OK');

function extract(name) {
  const at = html.indexOf('function ' + name + '(');
  const braceStart = html.indexOf('{', at);
  let depth = 0, i = braceStart;
  for (; i < html.length; i++) { if (html[i] === '{') depth++; else if (html[i] === '}') { depth--; if (!depth) { i++; break; } } }
  return html.slice(at, i);
}
// Stub globals the helper depends on.
const t = key => ({
  'gen.vocab_mode_extend': '➕ extend vocab',
  'gen.vocab_mode_neutral': '○ neutral',
  'gen.vocab_mode_reinforce': '🔁 reinforce vocab',
  'lesson.type.desc.grammar': 'Practice grammar patterns',
  'lesson.type.desc.vocab': 'Practice vocabulary',
})[key] ?? key;   // unknown keys echo back (mirrors a missing-translation)
const DIFF_SHORT = () => ({ 1: '🟢 Beginner', 2: '🟡 Intermediate', 3: '🔴 Advanced', 4: 'Error hunt' });
const descKeyLit = html.match(/const LESSON_DESC_KEY = (\{[\s\S]*?\n\});/);
assert.ok(descKeyLit, 'could not extract LESSON_DESC_KEY');
const preamble = 'const LESSON_DESC_KEY = ' + descKeyLit[1] + ';\n';
const { lessonSubtitle } = new Function('t', 'DIFF_SHORT',
  preamble + extract('lessonSubtitle') + '\nreturn { lessonSubtitle };')(t, DIFF_SHORT);

// arc lesson: mode + difficulty
assert.strictEqual(lessonSubtitle({ type: 'grammar', _arcMode: 'reinforce', difficulty: 2 }, 2),
  '🔁 reinforce vocab · 🟡 Intermediate');
assert.strictEqual(lessonSubtitle({ type: 'standard', _arcMode: 'extend' }, 1),
  '➕ extend vocab · 🟢 Beginner');
assert.strictEqual(lessonSubtitle({ type: 'standard', _arcMode: 'neutral', difficulty: 3 }, 1),
  '○ neutral · 🔴 Advanced');
console.log('  mode + difficulty: OK');

// non-arc lesson: difficulty only (per-lesson overrides topic)
assert.strictEqual(lessonSubtitle({ type: 'standard', difficulty: 3 }, 1), '🔴 Advanced');
assert.strictEqual(lessonSubtitle({ type: 'grammar' }, 2), '🟡 Intermediate');
console.log('  difficulty from lesson/topic: OK');

// no mode + no difficulty anywhere: fall back to per-type description
assert.strictEqual(lessonSubtitle({ type: 'grammar' }, null), 'Practice grammar patterns');
assert.strictEqual(lessonSubtitle({ type: 'standard' }, undefined), 'Practice vocabulary');
// when even the per-type desc key has no translation (echoes), use L.desc
assert.strictEqual(
  (new Function('t', 'DIFF_SHORT', preamble + extract('lessonSubtitle') + '\nreturn { lessonSubtitle };')(k => k, DIFF_SHORT))
    .lessonSubtitle({ type: 'grammar', desc: 'Synonym drill' }, 0),
  'Synonym drill');
console.log('  description fallback: OK');

console.log('unit-lesson-subtitle: ALL PASSED');
