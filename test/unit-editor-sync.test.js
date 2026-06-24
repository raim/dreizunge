// Unit test for _syncEditorFromDOM (TODO item 3): editing several entries then
// deleting one must NOT discard the other unsaved edits. Verifies the sync reads
// DOM values back into the in-memory lesson (so a re-render after delete keeps
// them). Extracts the live function from index.html via brace-matching and runs it
// against a tiny DOM stub.
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

// Fake input factory.
const inp = (type, attrs, value) => ({ dataset: { type, ...attrs }, value });

// In-memory lesson the user is editing.
const APP = { lessonData: { lessons: [{
  type: 'vocab',
  vocab: [{ target: 'a', source: '1' }, { target: 'b', source: '2' }, { target: 'c', source: '3' }],
  sentences: [{ target: 'old sentence', source: 'alt', words: ['old', 'sentence'] }],
  grammar: [{ target: 'Haus', source: 'house', article: 'das', gender: 'n', plural: 'Häuser' }],
}] } };

// The DOM the user has typed into (edits not yet saved):
const editedInputs = [
  inp('vocab', { li: '0', fi: '0', field: 'target' }, 'A-edited'),
  inp('vocab', { li: '0', fi: '0', field: 'source' }, '1-edited'),
  inp('vocab', { li: '0', fi: '1', field: 'target' }, 'b-edited'),
  inp('vocab', { li: '0', fi: '2', field: 'target' }, 'c'),            // unchanged
  inp('sentence', { li: '0', fi: '0', field: 'target' }, 'brand new words here'),
  inp('grammar', { li: '0', fi: '0', field: 'plural' }, 'Hauser-edited'),
];
const el = { querySelectorAll: () => editedInputs };
const document = {
  getElementById: id => (id === 'lesson-editor' ? el : null),
  createElement: () => ({ set innerHTML(_) {}, innerText: '', textContent: '' }),
};

// _syncEditorFromDOM now dispatches save-side per-type hooks through the registry
// (B-phase-3). buildSync() assembles the function in a sandbox with a faithful
// lessonTypeMeta stub wired to the real extracted hook functions; non-hook types
// (vocab/word_forms/synonyms fixtures below) resolve to no save-side hooks — unchanged.
function buildSync(document, APP) {
  const stubMeta = `function lessonTypeMeta(type){
    const reg = {
      math:       { editorReadInputs: (ls, li) => _editorReadInputsMath(ls, li) },
      error_hunt: { editorAfterSync:  (ls, li) => _editorAfterSyncErrorHunt(ls, li) },
    };
    return reg[type] || {};
  }`;
  return new Function('document', 'APP',
    extract('splitWords') + '\n' + extract('_editorReadInputsMath') + '\n' +
    extract('_editorAfterSyncErrorHunt') + '\n' + stubMeta + '\n' +
    extract('_syncEditorFromDOM') + '\nreturn { _syncEditorFromDOM };')(document, APP);
}
const { _syncEditorFromDOM } = buildSync(document, APP);

// 1) Sync pulls all DOM edits into the in-memory lesson.
_syncEditorFromDOM(0);
const ls = APP.lessonData.lessons[0];
assert.strictEqual(ls.vocab[0].target, 'A-edited', 'vocab[0].target synced');
assert.strictEqual(ls.vocab[0].source, '1-edited', 'vocab[0].source synced');
assert.strictEqual(ls.vocab[1].target, 'b-edited', 'vocab[1].target synced');
assert.strictEqual(ls.vocab[2].target, 'c', 'unchanged vocab kept');
assert.ok(ls.vocab[0].editedAt, 'changed item stamped editedAt');
assert.strictEqual(ls.sentences[0].target, 'brand new words here', 'sentence target synced');
assert.deepStrictEqual(ls.sentences[0].words, ['brand', 'new', 'words', 'here'], 'sentence words regenerated');
assert.strictEqual(ls.grammar[0].plural, 'Hauser-edited', 'grammar field synced');
console.log('  sync reads DOM → memory: OK');

// 2) The item-3 guarantee: deleting vocab[0] (as deleteEditorItem does, AFTER sync)
//    preserves the edits made to the OTHER entries.
ls.vocab = ls.vocab.filter((_, i) => i !== 0);
assert.strictEqual(ls.vocab.length, 2, 'one entry removed');
assert.strictEqual(ls.vocab[0].target, 'b-edited', 'edit on a surviving entry preserved across delete');
assert.strictEqual(ls.sentences[0].target, 'brand new words here', 'unrelated sentence edit preserved across delete');
assert.strictEqual(ls.grammar[0].plural, 'Hauser-edited', 'grammar edit preserved across delete');
console.log('  edits survive a delete: OK');

// 3) persist flag (saveLessonEdits path): a pending icon pick is CONSUMED only
//    when persisting; the default (re-render) path keeps it for a later save.
function freshLesson() {
  return { lessonData: { lessons: [{ type: 'vocab', vocab: [{ target: 'x', source: 'y' }], _iconPick: '🚀' }] } };
}
function run(persist) {
  const app = freshLesson();
  const inps = [inp('vocab', { li: '0', fi: '0', field: 'target' }, 'x2')];
  const docStub = { getElementById: id => (id === 'lesson-editor' ? { querySelectorAll: () => inps } : null),
    createElement: () => ({ set innerHTML(_) {}, innerText: '', textContent: '' }) };
  const { _syncEditorFromDOM: fn } = buildSync(docStub, app);
  fn(0, persist ? { persist: true } : undefined);
  return app.lessonData.lessons[0];
}
const kept = run(false);
assert.strictEqual(kept.icon, '🚀', 'non-persist applies the pending icon pick');
assert.strictEqual(kept._iconPick, '🚀', 'non-persist KEEPS _iconPick for a later save');
assert.strictEqual(kept.vocab[0].target, 'x2', 'non-persist still syncs fields');
const saved = run(true);
assert.strictEqual(saved.icon, '🚀', 'persist applies the pending icon pick');
assert.strictEqual(saved._iconPick, undefined, 'persist CONSUMES _iconPick');
console.log('  persist flag consumes icon pick (save) vs keeps it (re-render): OK');

// 4) word_forms editor sync: sentence / translation / choice / correctIndex.
function wfApp() {
  return { lessonData: { lessons: [{ type: 'word_forms', items: [
    { sentence: 'Seven ___ his head.', translation: 'old', choices: ['shake', 'shakes', 'shook', 'shaking'], correctIndex: 2 },
  ] }] } };
}
const wfInps = [
  inp('wf', { li: '0', fi: '0', field: 'sentence' }, 'Seven ___ the door.'),
  inp('wf', { li: '0', fi: '0', field: 'translation' }, 'new translation'),
  inp('wf', { li: '0', fi: '0', field: 'explanation' }, 'past tense'),
  inp('wf', { li: '0', fi: '0', field: 'choice', ci: '0' }, 'open'),
  // correctIndex radios: only the checked one applies
  { dataset: { li: '0', type: 'wf', fi: '0', field: 'correct', ci: '1' }, checked: false },
  { dataset: { li: '0', type: 'wf', fi: '0', field: 'correct', ci: '3' }, checked: true },
];
const wfAppState = wfApp();
const wfDoc = { getElementById: id => (id === 'lesson-editor' ? { querySelectorAll: () => wfInps } : null),
  createElement: () => ({ set innerHTML(_) {}, innerText: '', textContent: '' }) };
const { _syncEditorFromDOM: wfSync } = buildSync(wfDoc, wfAppState);
wfSync(0, { persist: true });
const wfIt = wfAppState.lessonData.lessons[0].items[0];
assert.strictEqual(wfIt.sentence, 'Seven ___ the door.', 'wf sentence synced');
assert.strictEqual(wfIt.translation, 'new translation', 'wf translation synced');
assert.strictEqual(wfIt.explanation, 'past tense', 'wf explanation synced');
assert.strictEqual(wfIt.choices[0], 'open', 'wf choice[0] synced');
assert.strictEqual(wfIt.correctIndex, 3, 'wf correctIndex from checked radio');
console.log('  word_forms editor sync: OK');

// 5) synonyms editor sync: base / gloss / sentence (no data-cat) + a category row.
const synApp = { lessonData: { lessons: [{ type: 'synonyms', words: [
  { base: 'klein', gloss: 'small', sentence: 'old', synonyms: [{ w: 'winzig', g: 'tiny' }], antonyms: [], homophones: [] },
] }] } };
const synInps = [
  inp('syn', { li: '0', wi: '0', field: 'base' }, 'gross'),
  inp('syn', { li: '0', wi: '0', field: 'gloss' }, 'big'),
  inp('syn', { li: '0', wi: '0', field: 'sentence' }, 'Das Haus war gross.'),
  inp('syn', { li: '0', wi: '0', cat: 'synonyms', ri: '0', field: 'w' }, 'riesig'),
  inp('syn', { li: '0', wi: '0', cat: 'synonyms', ri: '0', field: 'g' }, 'huge'),
];
const synDoc = { getElementById: id => (id === 'lesson-editor' ? { querySelectorAll: () => synInps } : null),
  createElement: () => ({ set innerHTML(_) {}, innerText: '', textContent: '' }) };
const { _syncEditorFromDOM: synSync } = buildSync(synDoc, synApp);
synSync(0, { persist: true });
const sw = synApp.lessonData.lessons[0].words[0];
assert.strictEqual(sw.base, 'gross', 'syn base synced');
assert.strictEqual(sw.gloss, 'big', 'syn gloss synced');
assert.strictEqual(sw.sentence, 'Das Haus war gross.', 'syn context sentence synced');
assert.strictEqual(sw.synonyms[0].w, 'riesig', 'syn category word synced');
assert.strictEqual(sw.synonyms[0].g, 'huge', 'syn category gloss synced');
console.log('  synonyms editor sync (incl. context sentence): OK');

console.log('unit-editor-sync: ALL PASSED');
