// Static (server-less) export: the client _clientBuildExport must render error_hunt +
// ai_error_hunt (strike wrong / green correct), word_forms/synonyms, and lesson meta —
// the same as the server export. (Bug: static export showed empty AI-error-hunt lists.)
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function extract(name){
  const at = html.indexOf('function ' + name + '(');
  assert.ok(at >= 0, 'missing ' + name);
  const b = html.indexOf('{', at); let d = 0, i = b;
  for(; i < html.length; i++){ if(html[i]==='{') d++; else if(html[i]==='}'){ d--; if(!d){ i++; break; } } }
  return html.slice(at, i);
}
const constLine = html.match(/const _CE_TYPE_LABEL = \{[^}]*\};/)[0];
const fns = ['escHtml','stripFuri','ehTokenize','ehLcsOps','_ceEhDiff','_ceLessonMeta',
  '_ceIndexes','_ceSlDoc','_ceResolveDocs','_ceChapterParts','_ceRenderMarkdown','_ceRenderHtml','_clientBuildExport'];
const src = constLine + '\n' + fns.map(extract).join('\n') + '\nreturn { _clientBuildExport };';
const { _clientBuildExport } = new Function(src)();

const store = { storylines: [], topics: [{
  id: 'tp_1', topic: 'Test', story: 'The cat sat on the mat and slept well.', difficulty: 2,
  lessons: [
    { type: 'error_hunt', title: 'EH', _arcMode: 'reinforce', corruptedStory: 'The cat sit on the mat and slept good.' },
    { type: 'ai_error_hunt', title: 'AEH', sentences: [
      { ai: 'He go home.', corrected: 'He goes home.', reason: 'verb agreement' },
      { ai: 'It is fine.', corrected: 'It is fine.', reason: '' } ] },
    { type: 'word_forms', title: 'WF', difficulty: 3, items: [
      { sentence: 'Yesterday I ___ it.', choices: ['see','saw','seen'], correctIndex: 1, translation: 'x' } ] },
    { type: 'synonyms', title: 'SYN', words: [{ base: 'big', synonyms: ['large','huge'], antonyms: ['small'] }] },
  ] }] };

const h = _clientBuildExport(store, { ids: ['tp_1'], html: true, lessons: true }).content;
assert.ok(/<del>sit<\/del>\s*<ins>sat<\/ins>/.test(h), 'static error_hunt diff');
assert.ok(/<del>go<\/del>\s*<ins>goes<\/ins>/.test(h), 'static ai_error_hunt NOT empty (was the bug)');
assert.ok(!/It is fine/.test(h), 'unchanged ai sentence skipped');
assert.ok(/verb agreement/.test(h), 'ai_error_hunt reason shown');
assert.ok(/<strong>Yesterday I ___ it\.<\/strong>.*saw/.test(h), 'word_forms not empty');
assert.ok(/<strong>big<\/strong>.*large, huge/.test(h), 'synonyms not empty');
assert.ok(/class="meta">Error hunt · difficulty 2 · reinforce/.test(h), 'lesson meta line');
console.log('  static HTML export renders eh/aeh/word_forms/synonyms + meta: OK');

const m = _clientBuildExport(store, { ids: ['tp_1'], html: false, lessons: true }).content;
assert.ok(/~~sit~~ \*\*sat\*\*/.test(m) && /~~go~~ \*\*goes\*\*/.test(m), 'static markdown diffs');
console.log('  static Markdown export: OK');
console.log('unit-client-export: ALL PASSED');
