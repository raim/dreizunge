// unit-script-pin-coverage.test.js
// v79_f — "pass the script information to ALL prompts that return target language text" (user).
//
// v79_a added `scriptPinNote` to the three VOCABULARY prompt families and the roadmap recorded that
// as closing the hole. It did not: conjugation, grammar, word_forms, synonyms, comprehension,
// error-hunt and the LLM math lesson all emit target-language text and none of them carried the
// pin. The corpus shows the consequence twice over — `tp_17863746762340000193` (vocabulary, the
// v79_a case) and now `tp_17864554460460000107`, a `cyrillic-sr` chapter whose CONJUGATION lesson
// is entirely Latin: `biti / ići / govoriti`, six forms each, not one Cyrillic character.
//
// Two failures, not one, and they need separate assertions:
//   (a) the prompt builder did not append the pin at all — conjugation, grammar, word_forms,
//       synonyms, comprehension, math;
//   (b) the pin was reachable but the SCRIPT never arrived, because two of the three
//       `sharedGenOpts` shapes did not carry it. Error-hunt is the pure case of (b): it already
//       took a `script` argument and used it for the language NAME, which v76_h established is not
//       the pin.
//
// This file is a SWEEP, not a list. A list of seven names would go stale the moment an eighth
// lesson type is added — and an eighth lesson type is exactly the event that reintroduces the bug.
// The sweep enumerates prompt-building functions from the source and requires each one to be
// classified, so a NEW generator fails this test until someone decides which side it is on.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

// ── The classification. Every generator that produces TARGET-language text needs the pin. ──────
// Anything in EXEMPT produces source-language text, or no text at all, and must state why.
const NEEDS_PIN = {
  sysLesson:            'vocabulary + example sentences in the target language',
  sysLessonFromText:    'vocabulary from a user-supplied text',
  sysLessonTable:       'the table-format variant of the same',
  sysStory:             'the chapter itself',
  sysErrorHunt:         'a corrupted copy of the story, in the story\'s script',
  sysGrammar:           'gender/plural drills spelled in the target language',
  sysConjugation:       'verb forms — the reported tp_17864554460460000107',
  generateWordForms:    'inflected forms of target words',
  generateInflections:  'lemma/form MCQs quoting surface-form words from the target-language story',
  generateSynonyms:     'synonyms, antonyms and homophones in the target language',
  generateComprehension: 'questions and answer choices in the target language',
  generateMathLLM:      'word problems are prose in the target language',
  generateStoryQc:      'returns a CORRECTED COPY of the story — target text',
  generateDialectStory: 'a story in a dialect of the target language',
  generateDialectStoryV2: 'the same, via a constrained rewrite',
};
// Delegates: they build no system prompt of their own, they call one of the NEEDS_PIN builders.
// Asserted below to actually do so, rather than taken on trust.
const DELEGATES = {
  generateErrorHunt:    'sysErrorHunt',
  generateGrammar:      'sysGrammar',
  generateConjugation:  'sysConjugation',
  generateOneLesson:    'sysLesson',
  generateArcLesson:    'ADD_LESSON_GENERATORS',
};
const EXEMPT = {
  sysMeta:              'topic metadata, written in the SOURCE language',
  sysTranslation:       'translates the story INTO the source language',
  sysSrcRepair:         'repairs source-language text',
  generateMath:         'no LLM at all — builds from digits',
  generateIntroScript:  'no LLM at all — builds from the script table',
  generateSummaryQc:    'proofreads the SOURCE-language summary',
  generateStorylineTitle:     'source language',
  generateStorylineSummary:   'source language',
  generateStorylineStoryboard: 'source language',
  generateChapterMeta:  'source language',
};

// ── 1. Every function that needs the pin actually appends it ───────────────────────────────────
// Read the function body from the source and require a scriptPinNote call inside it. This is a
// source assertion by necessity — there is no live model here — but it is anchored on the CALL,
// which cannot be satisfied by a comment (standing rule: a comment must not spell what a test
// sweeps for, and equally a test must not accept one).
function bodyOf(name) {
  const decl = new RegExp('(?:async )?function ' + name + '\\s*\\(');
  const m = decl.exec(src);
  assert.ok(m, `the source still defines ${name} — if it was renamed, this list needs updating`);
  // Brace-match from the opening { of the signature.
  let i = src.indexOf('{', m.index + m[0].length);
  assert.ok(i > 0, `found the body of ${name}`);
  let depth = 0, j = i;
  for (; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (!depth) break; }
  }
  return src.slice(i, j + 1);
}

// A delegate must really delegate — otherwise "it is covered by the builder it calls" is a claim
// nobody checked, which is how the conjugation prompt went three releases without the pin.
for (const [name, builder] of Object.entries(DELEGATES)) {
  const body = bodyOf(name);
  assert.ok(body.includes(builder),
    `${name} is classified as delegating to ${builder}, so it must actually call it`);
}

for (const [name, why] of Object.entries(NEEDS_PIN)) {
  const body = bodyOf(name);
  assert.ok(/scriptPinNote\s*\(/.test(body),
    `${name} must call scriptPinNote — it emits ${why}. Naming the script inside {L} is NOT the `
    + 'pin; that is what v76_h established and what left the conjugation lesson in Latin.');
  // The pin has to receive the TARGET language, not the source one — passing srcLang would make
  // hasScriptChoice() answer about the wrong language and the note would silently never fire.
  assert.ok(/scriptPinNote\s*\(\s*(?:lang|baseLang)\b/.test(body),
    `${name} passes the TARGET language to scriptPinNote, not the source language`);
}
console.log(`  ${Object.keys(NEEDS_PIN).length} target-text prompts all append the script pin: OK`);

// ── 2. No prompt builder escapes the classification ────────────────────────────────────────────
// Anything shaped like a generator or a sys* builder must be in one of the two lists above. This
// is the half that survives the next lesson type being added.
{
  const found = new Set();
  for (const m of src.matchAll(/(?:async )?function (sys[A-Z]\w*|generate[A-Z]\w*)\s*\(/g))
    found.add(m[1]);
  const unclassified = [...found].filter(n => !(n in NEEDS_PIN) && !(n in EXEMPT) && !(n in DELEGATES));
  assert.deepStrictEqual(unclassified, [],
    'every prompt builder must be classified as needing the script pin or exempt from it. '
    + 'A new lesson type is exactly the event that reintroduced this bug, so it fails here until '
    + 'someone decides which side it is on: ' + unclassified.join(', '));
  // Non-vacuity: the sweep must actually have found the functions, or it proves nothing.
  assert.ok(found.size >= Object.keys(NEEDS_PIN).length,
    `the sweep found ${found.size} prompt builders`);
  console.log(`  sweep: ${found.size} prompt builders, all classified: OK`);
}

// ── 3. The script REACHES those prompts — the other half of the bug ────────────────────────────
// `tp_17864554460460000107` was generated by a path whose opts DID carry the script; the prompt
// dropped it. But two of the three opt shapes did not carry it either, so both halves are pinned.
// Every construction of sharedGenOpts must include a script, or a whole generation path is blind
// again without anything failing.
{
  const shapes = [...src.matchAll(/sharedGenOpts:?\s*[:=]?\s*\{/g)];
  // Only the CONSTRUCTIONS (an object literal), not the reads.
  const constructions = [];
  for (const m of shapes) {
    let i = src.indexOf('{', m.index), depth = 0, j = i;
    for (; j < src.length; j++) {
      if (src[j] === '{') depth++;
      else if (src[j] === '}') { depth--; if (!depth) break; }
    }
    constructions.push(src.slice(i, j + 1));
  }
  assert.ok(constructions.length >= 3,
    `the source builds sharedGenOpts in ${constructions.length} places (expected at least 3: the `
    + 'arc path, the re-create path and the add-lessons path)');
  constructions.forEach((c, n) => {
    assert.ok(/\bscript\s*:/.test(c),
      `sharedGenOpts construction #${n + 1} must carry the chapter's script — without it every `
      + 'lesson generated on that path is blind to the script no matter how many prompts carry '
      + `the pin. Got: ${c.replace(/\s+/g, ' ').slice(0, 160)}`);
  });
  console.log(`  all ${constructions.length} sharedGenOpts shapes carry the chapter script: OK`);
}

// ── 4. The note itself only fires for a digraphic language ─────────────────────────────────────
// Non-vacuity in the other direction: if scriptPinNote returned text unconditionally, sections 1-3
// would pass while every monoscriptic prompt grew a meaningless paragraph.
{
  const body = bodyOf('scriptPinNote');
  assert.ok(/hasScriptChoice\s*\(\s*lang\s*\)/.test(body),
    'scriptPinNote stays silent for a language with no script choice');
  assert.ok(/if\s*\(\s*!script\b/.test(body),
    'and for a chapter with no script stamped');
}

console.log('unit-script-pin-coverage: ALL PASSED');
