// unit-furigana-difficulty.test.js
// Difficulty-tiered furigana density, RESTORED at v82_i (found dead since ~v40 at v82_c, flagged
// as separate scoped work rather than fixed there). `sysStory` used to take a `difficulty`
// parameter and select among `furiganaNote1/2/3` (beginner: every kanji without exception /
// standard / advanced: only rare kanji); the signature had dropped it, so every Japanese story fell
// back to the flat `furiganaNote` regardless of the chapter's actual difficulty.
//
// `furiganaNote1/2/3` shared the flat note's OWN pre-v82_c weakness too (no "mandatory for the
// whole story" language, no worked example — the exact gap that let the model echo its example
// once near the end instead of applying it throughout) — fixed here for all three, not just
// restoring the selection.
//
// Real-execution test, not a source regex: extracts `sysStory` + its new `_furiganaNoteFor` helper
// and runs them with stubbed dependencies, so the CLAIM ("difficulty 1 gets furiganaNote1's text")
// is checked against actual output, not against how the source happens to be phrased.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const PROMPTS = { story: JSON.parse(fs.readFileSync(path.join(ROOT, 'prompts.json'), 'utf8')).story };

function ext(name) {
  const at = server.indexOf('function ' + name + '(');
  assert.ok(at >= 0, 'missing ' + name);
  const b = server.indexOf('{', at); let d = 0, i = b;
  for (; i < server.length; i++) { const c = server[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return server.slice(at, i);
}

const langName = (code) => code;
const fillPrompt = (tmpl, vars) => String(tmpl).replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null) ? vars[k] : m);
const scriptPinNote = () => '';
const getStoryStyle = () => null;

const sysStory = new Function('langName', 'fillPrompt', 'scriptPinNote', 'getStoryStyle', 'PROMPTS',
  ext('_furiganaNoteFor') + '\n' + ext('sysStory') + '\nreturn sysStory;')(
  langName, fillPrompt, scriptPinNote, getStoryStyle, PROMPTS);

// ── 1. Each recognised difficulty selects its OWN note ───────────────────────
{
  const sys1 = sysStory('ja', false, 300, null, null, null, 1);
  const sys2 = sysStory('ja', false, 300, null, null, null, 2);
  const sys3 = sysStory('ja', false, 300, null, null, null, 3);
  assert.ok(sys1.includes(PROMPTS.story.furiganaNote1), 'difficulty 1 gets furiganaNote1');
  assert.ok(sys2.includes(PROMPTS.story.furiganaNote2), 'difficulty 2 gets furiganaNote2');
  assert.ok(sys3.includes(PROMPTS.story.furiganaNote3), 'difficulty 3 gets furiganaNote3');
  // Non-vacuity: the three notes are genuinely distinct text, so this couldn't pass by accident.
  const notes = [PROMPTS.story.furiganaNote1, PROMPTS.story.furiganaNote2, PROMPTS.story.furiganaNote3];
  assert.strictEqual(new Set(notes).size, 3, 'the three tier notes are distinct strings');
  assert.ok(!sys1.includes(PROMPTS.story.furiganaNote2) && !sys1.includes(PROMPTS.story.furiganaNote3),
    'difficulty 1 does NOT also carry another tier\'s note');
}
console.log('  each difficulty (1/2/3) selects its own distinct furigana note: OK');

// ── 2. Missing/unrecognised difficulty falls back to the flat note ───────────
// A caller that forgets to pass difficulty degrades to the PRE-restoration behaviour, not a throw.
{
  const sysNone = sysStory('ja', false, 300, null, null, null, undefined);
  const sysWeird = sysStory('ja', false, 300, null, null, null, 99);
  assert.ok(sysNone.includes(PROMPTS.story.furiganaNote), 'missing difficulty falls back to the flat note');
  assert.ok(sysWeird.includes(PROMPTS.story.furiganaNote), 'an unrecognised difficulty falls back too');
  assert.ok(!sysNone.includes(PROMPTS.story.furiganaNote1), 'and does not accidentally pick tier 1');
}
console.log('  a missing or unrecognised difficulty falls back to the flat furiganaNote: OK');

// ── 3. Non-Japanese languages never get ANY furigana note, at any difficulty ──
{
  for (const diff of [1, 2, 3, undefined]) {
    const sys = sysStory('de', false, 300, null, null, null, diff);
    for (const note of [PROMPTS.story.furiganaNote, PROMPTS.story.furiganaNote1,
                         PROMPTS.story.furiganaNote2, PROMPTS.story.furiganaNote3]) {
      assert.ok(!sys.includes(note), `German at difficulty ${diff} carries no furigana note`);
    }
  }
}
console.log('  non-Japanese languages carry no furigana note at any difficulty: OK');

// ── 4. The restored notes share furiganaNote's OWN fixed structure ───────────
// The whole point of restoring them was not leaving them with the pre-v82_c weakness (no
// "mandatory for the whole story" language, no worked example) the flat note already had fixed.
{
  for (const key of ['furiganaNote1', 'furiganaNote2', 'furiganaNote3']) {
    const note = PROMPTS.story[key];
    assert.ok(/MANDATORY/.test(note) && /WHOLE STORY/i.test(note),
      `${key} states the annotation is mandatory for the whole story, not just an example once`);
  }
  // Tiers 1 and 2 (unconditional "annotate every kanji") can safely carry a worked FULL-SENTENCE
  // example — no frequency judgement needed to verify it. Tier 3 ("skip common kanji") deliberately
  // does NOT assert a specific worked example here: which kanji count as "common" is exactly the
  // kind of per-language judgement this project keeps out of the app (INTERNALS §4) — tier 3 is
  // fixed via a CONSISTENCY instruction instead (see prompts.json's own text), not an invented example.
  for (const key of ['furiganaNote1', 'furiganaNote2']) {
    assert.ok(/。/.test(PROMPTS.story[key]) && /出\[で\]かけます/.test(PROMPTS.story[key]),
      `${key} carries a worked full-sentence example, not just a single-word one`);
  }
}
console.log('  the restored notes share furiganaNote\'s mandatory-whole-story fix, not just its selection: OK');

console.log('unit-furigana-difficulty: ALL PASSED');
