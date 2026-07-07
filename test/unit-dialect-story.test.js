// unit-dialect-story.test.js
// M2 (redesigned): topic-driven dialect story generation + the approval gate. The generation needs
// Ollama (verified live), but the pure logic is testable: STORY/GERMAN block parsing, that topic +
// instructions reach the prompt, and the endpoint guards (approval requires a story; a new story
// resets approval; generation always marks aiGenerated + needsReview).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

function extAsync(src, n) {
  const at = src.indexOf('async function ' + n + '(');
  const b = src.indexOf('{', at); let d = 0, i = b;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(at, i);
}

(async () => {
  // ── generateDialectStory: parse STORY/GERMAN, and topic/instructions reach the prompt ──
  let lastPrompt = null;
  function build(reply) {
    const stubs = {
      langName: x => (x === 'de' ? 'German' : x),
      callLLMTranslation: async (sys, usr) => { lastPrompt = { sys, usr }; return { text: reply }; },
    };
    return new Function(...Object.keys(stubs), extAsync(server, 'generateDialectStory') + '\nreturn generateDialectStory;')(...Object.values(stubs));
  }
  const rows = [{ target: 'Gitsche', source: 'Mädchen' }, { target: 'heint', source: 'heute' }];
  let gen = build('STORY:\nHeint hon i a Gitsche gsegn. Es woar scheen.\n---\nGERMAN:\nHeute sah ich ein Mädchen. Es war schön.');
  let out = await gen(rows, 'de', { topic: 'a walk', instructions: 'Bavarian-style' });
  assert.ok(out && /Gitsche/.test(out.story), 'story parsed from STORY block');
  assert.ok(/Mädchen/.test(out.gloss), 'German rendering parsed from GERMAN block');
  assert.ok(/Topic: "a walk"/.test(lastPrompt.usr), 'topic reaches the prompt');
  assert.ok(/Bavarian-style/.test(lastPrompt.sys), 'instructions reach the prompt');
  assert.ok(/Gitsche = Mädchen/.test(lastPrompt.usr), 'glossary is few-shot in the prompt');
  console.log('  generateDialectStory: parses blocks; topic + instructions + glossary in prompt: OK');

  // Malformed reply → null (no crash).
  gen = build('just some text without the blocks');
  out = await gen(rows, 'de', {});
  assert.strictEqual(out, null, 'malformed reply → null');
  console.log('  malformed reply → null: OK');

  // ── Endpoint guards (static) ──
  assert.ok(/url\.pathname === '\/api\/dialect-story'/.test(server), 'story endpoint exists');
  assert.ok(/url\.pathname === '\/api\/dialect-curate'/.test(server), 'curate endpoint exists');
  // No leftover 403 gate on story generation (generation is the sample now).
  assert.ok(!/not approved for story generation yet/.test(server), 'no pre-generation 403 gate (generation is the review sample)');
  // Generation always marks aiGenerated + needsReview, and resets approval.
  assert.ok(/fresh\.aiGenerated = true;/.test(server), 'generated story marked aiGenerated');
  assert.ok(/needsReview: true, topic: storyTopic/.test(server), 'story marked needsReview + records topic');
  assert.ok(/fresh\._dialect\.curated = false;\s*\/\/ a NEW story resets approval/.test(server), 'a new story resets approval');
  // Approval requires a story.
  assert.ok(/if \(wantCurated && !\(topic\.story && topic\._dialect\.aiStory\)\)/.test(server),
    'approval requires a generated story to review');
  // Retired: no example generator/endpoint remain.
  assert.ok(!/generateDialectExample/.test(server), 'per-word example generator retired');
  assert.ok(!/\/api\/dialect-examples/.test(server), 'examples endpoint retired');
  console.log('  endpoint guards: generation marks/needs-review/resets-approval; approval needs story; examples retired: OK');

  console.log('unit-dialect-story: ALL PASSED');
})().catch(e => { console.error(e); process.exit(1); });

// ── V2: standard→dialect rewrite + coverage metric ──────────────────────────
(async () => {
  const serverSrc = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  function extPlain(src, n){
    const at = src.indexOf('function ' + n + '(');
    const b = src.indexOf('{', at); let d=0,i=b;
    for(;i<src.length;i++){ if(src[i]==='{')d++; else if(src[i]==='}'){d--; if(!d){i++;break;}} }
    return src.slice(at,i);
  }
  // dialectGlossaryCoverage: counts distinct glossary words present in a text.
  const cov = new Function(extPlain(serverSrc, 'dialectGlossaryCoverage') + '\nreturn dialectGlossaryCoverage;')();
  const rows = [{target:'Gitsche',source:'Mädchen'},{target:'heint',source:'heute'},{target:'Fock',source:'Schwein'}];
  let c = cov('I hon a Gitsche gsegn, heint.', rows);
  assert.strictEqual(c.used, 2, 'coverage counts Gitsche + heint (2)');
  assert.strictEqual(c.total, 3, 'coverage total = distinct glossary words');
  assert.ok(c.ratio > 0.6 && c.ratio < 0.7, 'ratio computed');
  c = cov('nothing here matches', rows);
  assert.strictEqual(c.used, 0, 'no glossary words → 0 used');
  console.log('  dialectGlossaryCoverage: counts distinct glossary words present: OK');

  // generateDialectStoryV2: two model calls (standard story → rewrite), returns coverage + source.
  let calls = 0;
  const stubs2 = {
    langName: x => (x==='de'?'German':x),
    callLLMTranslation: async (sys) => {
      calls++;
      // Order matters: the rewrite prompt also contains "Standard", so match it FIRST.
      if (/rewrite a Standard/i.test(sys)) return { text: 'STORY:\nHeint is schee. I hon a Gitsche gsegn.\n---\nGERMAN:\nHeute ist schön. Ich sah ein Mädchen.' };
      return { text: 'Heute ist schön. Ich sah ein Mädchen.' };
    },
  };
  const genV2 = new Function(...Object.keys(stubs2),
    extPlain(serverSrc, 'dialectGlossaryCoverage') + '\n' +
    'async ' + extAsyncName(serverSrc, 'generateDialectStoryV2') + '\nreturn generateDialectStoryV2;'
  )(...Object.values(stubs2));
  const out = await genV2([{target:'Gitsche',source:'Mädchen'}], 'de', { topic:'a walk' });
  assert.ok(out && out.method === 'rewrite', 'V2 returns method=rewrite');
  assert.strictEqual(calls, 2, 'V2 makes TWO model calls (standard story + rewrite)');
  assert.ok(/Gitsche/.test(out.story), 'V2 dialect story parsed');
  assert.ok(out.standardSource && /Mädchen/.test(out.standardSource), 'V2 keeps the Standard-German source');
  assert.ok(out.coverage && out.coverage.used >= 1, 'V2 attaches a coverage metric');
  console.log('  generateDialectStoryV2: two-step, returns story + source + coverage: OK');

  // Endpoint routes method:'rewrite' → V2.
  assert.ok(/method === 'rewrite'\s*\?\s*await generateDialectStoryV2/.test(serverSrc),
    'story endpoint routes method=rewrite to generateDialectStoryV2');
  console.log('  endpoint: method=rewrite routes to V2: OK');
  console.log('unit-dialect-story V2: ALL PASSED');
})().catch(e => { console.error(e); process.exit(1); });

// helper: extract an async function body keeping the async keyword, by name
function extAsyncName(src, n){
  const at = src.indexOf('async function ' + n + '(');
  const b = src.indexOf('{', at); let d=0,i=b;
  for(;i<src.length;i++){ if(src[i]==='{')d++; else if(src[i]==='}'){d--; if(!d){i++;break;}} }
  return src.slice(at + 'async '.length, i);
}
