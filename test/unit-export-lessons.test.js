// Export of chapters: error_hunt + ai_error_hunt must render the errors (strike wrong /
// green correct), word_forms/synonyms must not be empty, and each lesson shows a meta
// line (type · difficulty · arc).
const assert = require('assert');
const path = require('path');
const { buildExport } = require(path.join(__dirname, '..', 'export-lessons.js'));

const store = {
  topics: [{
    id: 'tp_1', topic: 'Test', story: 'The cat sat on the mat and slept well.', difficulty: 2,
    lessons: [
      { type: 'error_hunt', title: 'EH', _arcMode: 'reinforce', corruptedStory: 'The cat sit on the mat and slept good.' },
      { type: 'ai_error_hunt', title: 'AEH', sentences: [
        { ai: 'He go home.', corrected: 'He goes home.', reason: 'verb agreement' },
        { ai: 'It is fine.', corrected: 'It is fine.', reason: '' },   // no error -> skipped
      ] },
      { type: 'word_forms', title: 'WF', difficulty: 3, items: [
        { sentence: 'Yesterday I ___ it.', choices: ['see', 'saw', 'seen'], correctIndex: 1, translation: 'x' } ] },
      { type: 'synonyms', title: 'SYN', words: [{ base: 'big', synonyms: ['large', 'huge'], antonyms: ['small'] }] },
    ],
  }],
  storylines: [],
};

// HTML
const h = buildExport(store, { ids: ['tp_1'], html: true, lessons: true }).content;
assert.ok(/<del>sit<\/del>\s*<ins>sat<\/ins>/.test(h), 'error_hunt shows wrong struck + correct green');
assert.ok(/<del>good<\/del>\s*<ins>well<\/ins>/.test(h), 'error_hunt second error rendered');
assert.ok(/<del>go<\/del>\s*<ins>goes<\/ins>/.test(h), 'ai_error_hunt sentence diffed');
assert.ok(!/It is fine/.test(h), 'ai_error_hunt non-error sentence skipped');
assert.ok(/verb agreement/.test(h), 'ai_error_hunt reason shown');
assert.ok(/<strong>Yesterday I ___ it\.<\/strong>.*saw/.test(h), 'word_forms not empty (sentence + answer)');
assert.ok(/<strong>big<\/strong>.*large, huge/.test(h), 'synonyms not empty');
assert.ok(/class="meta">Error hunt · difficulty 2 · reinforce/.test(h), 'lesson meta line (type · difficulty · arc)');
assert.ok(/class="meta">Word forms · difficulty 3/.test(h), 'word_forms meta uses its own difficulty');
console.log('  HTML export: eh/aeh/word_forms/synonyms render + meta: OK');

// Markdown
const m = buildExport(store, { ids: ['tp_1'], html: false, lessons: true }).content;
assert.ok(/~~sit~~ \*\*sat\*\*/.test(m), 'md error_hunt diff');
assert.ok(/~~go~~ \*\*goes\*\*/.test(m), 'md ai_error_hunt diff');
assert.ok(/`Error hunt · difficulty 2 · reinforce`/.test(m), 'md meta line');
console.log('  Markdown export: diffs + meta: OK');
console.log('unit-export-lessons: ALL PASSED');
