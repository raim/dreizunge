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
