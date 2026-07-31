// unit-comprehension.test.js
// v71_l — reading-comprehension lesson type: multiple-choice questions ABOUT THE STORY (events,
// motives, implications), story-based, counted like any other lesson, offered only where a story
// exists.
//
// Unlike every other builder in the app this one derives nothing — the generator authors the
// questions against the story and they are stored verbatim. That shifts the risk: the builder's
// real job is REJECTING malformed questions, because a question whose answer is not among its
// options is unanswerable, and shipping it would hand the learner a round they cannot win.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');
const C = loadClient();
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

const seed = (questions) => C.run(`
  APP.lessonData = { topic:'CompT', lang:'de', srcLang:'en',
    story:'Eine Geschichte.', lessons:[{ id:'LC', type:'comprehension', questions:${JSON.stringify(questions)} }] };
  APP.lang='de'; APP.srcLang='en';
  APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
  APP.progress = { completed:{}, solved:{}, learned:{} }; APP.progress.solved['CompT'] = {};
  APP._teacherMode = false; APP.muted = false;
  if (typeof _invalidateQidUniverse === 'function') _invalidateQidUniverse(); true;`, 'seed');

const build = () => C.run(`(function(){ APP._derivingUniverse = true;
  const e = buildExercises(0); APP._derivingUniverse = false; return e; })()`);

const GOOD = { q: 'Warum geht Anna weg?', choices: ['Sie hat Angst', 'Sie ist müde', 'Sie hat Hunger', 'Sie ist krank'],
               correctIndex: 0, why: 'The story says she heard a noise and ran.' };

// ── 1. A well-formed question becomes a playable exercise ───────────────────
{
  seed([GOOD]);
  const ex = build();
  assert.strictEqual(ex.length, 1, 'one question → one exercise');
  assert.strictEqual(ex[0].type, 'comprehension_mcq', 'it is its own exercise kind');
  assert.strictEqual(ex[0].question, GOOD.q, 'the question is carried verbatim, not derived');
  assert.strictEqual(ex[0].correct, 'Sie hat Angst', 'correctIndex resolves to the option TEXT');
  assert.deepStrictEqual([...ex[0].choices].sort(), [...GOOD.choices].sort(), 'all options are offered');
  assert.strictEqual(ex[0].why, GOOD.why, 'the explanation survives for the answer reveal');
}

// ── 2. Malformed questions are dropped, not shipped ─────────────────────────
// Each of these would produce a round the learner cannot win, or a coin flip.
{
  const bad = [
    { name: 'no correct option marked', q: 'A?', choices: ['x', 'y', 'z'] },
    { name: 'correctIndex out of range', q: 'B?', choices: ['x', 'y', 'z'], correctIndex: 7 },
    { name: 'only one option',           q: 'C?', choices: ['x'], correctIndex: 0 },
    { name: 'no question text',          q: '',   choices: ['x', 'y'], correctIndex: 0 },
    { name: 'no options at all',         q: 'D?', choices: [], correctIndex: 0 },
  ];
  for (const b of bad) {
    seed([b]);
    assert.strictEqual(build().length, 0, `dropped: ${b.name}`);
  }
  // …and a good question alongside a bad one still plays.
  seed([GOOD, { q: 'Bad?', choices: ['a', 'b'] }]);
  assert.strictEqual(build().length, 1, 'one bad question does not take the good ones down with it');
}

// ── 3. An `answer` string is accepted where correctIndex is absent ──────────
// Models answer with the text about as often as with the index; the generator normalises, but
// hand-authored and imported lessons reach the builder directly.
{
  seed([{ q: 'Wer?', choices: ['Anna', 'Ben'], answer: 'ben' }]);
  const ex = build();
  assert.strictEqual(ex.length, 1, 'an answer string is usable');
  assert.strictEqual(ex[0].correct, 'Ben', 'matched case-insensitively, returning the stored casing');
}

// ── 4. Options are shuffled, but identity is not ───────────────────────────
// If the stored order were kept, a learner could answer by position on replay. qid must therefore
// ignore option order, or every reshuffle would look like a brand-new question and coverage could
// never be satisfied.
{
  seed([GOOD]);
  const orders = new Set();
  for (let i = 0; i < 30; i++) orders.add(build()[0].choices.join('|'));
  assert.ok(orders.size > 1, 'options are shuffled between plays');
  const qids = C.run(`(function(){ APP._derivingUniverse = true; const s = new Set();
    for (let i = 0; i < 30; i++) for (const e of buildExercises(0)) s.add(qid(e, 'LC'));
    APP._derivingUniverse = false; return [...s]; })()`);
  assert.strictEqual(qids.length, 1, 'yet the qid is stable across every shuffle');
  assert.ok(/^LC:comprehension_mcq:/.test(qids[0]), 'and is keyed by lesson + exercise kind');
  // Two questions sharing an answer are still two questions.
  seed([GOOD, { q: 'Andere Frage?', choices: GOOD.choices.slice(), correctIndex: 0 }]);
  const two = C.run(`(function(){ APP._derivingUniverse = true;
    const s = new Set(buildExercises(0).map(e => qid(e, 'LC'))); APP._derivingUniverse = false; return s.size; })()`);
  assert.strictEqual(two, 2, 'the question text is part of the identity, not just the answer');
}

// ── 5. It counts like any other lesson ─────────────────────────────────────
// The decision for this release: comprehension is normal coursework, not a bonus round.
{
  seed([GOOD, { q: 'Zweite?', choices: ['a', 'b', 'c'], correctIndex: 2 }]);
  const cov = C.run(`_lessonQidUniverse(0).size`);
  assert.strictEqual(cov, 2, 'both questions are in the coverage universe');
  const solved = C.run(`(function(){ APP._derivingUniverse = true;
    const e = buildExercises(0); APP._derivingUniverse = false;
    return markSolved(e[0]) !== ''; })()`);
  assert.strictEqual(solved, true, 'and answering one is recorded like any other question');
}

// ── 6. Flags reach comprehension questions ─────────────────────────────────
// Without _resolveExItem support a question would resolve to null and no flag, QC note or delete
// could ever touch it — the item would be uneditable and unflaggable in practice.
{
  seed([Object.assign({}, GOOD, { userFlag: { comment: 'wrong' } }), { q: 'Ok?', choices: ['a', 'b'], correctIndex: 0 }]);
  const ex = build();
  assert.strictEqual(ex.length, 1, 'a human-flagged question is withheld from the learner');
  assert.strictEqual(ex[0].question, 'Ok?', 'the clean one still plays');
  // A QC suggestion is a model opinion and must NOT withhold (the v71_l policy).
  seed([Object.assign({}, GOOD, { qc: { sug: 'maybe' } })]);
  assert.strictEqual(build().length, 1, 'a QC-suggested question is still asked');
}

// ── 7. Story-gated in the UI, and reachable end to end ─────────────────────
// The v68.1 failure mode was a picker offering a format that a clamp silently rewrote to
// 'standard' — a dead menu entry. Every clamp on the path must name it.
{
  assert.ok(/VALID_FORMATS=new Set\(\[[^\]]*'comprehension'/.test(html), 'client clamp accepts it');
  assert.strictEqual((server.match(/'word_forms','comprehension'\]\.includes\(lessonFormat\)/g) || []).length, 2,
    'BOTH server routes accept it — one of the two was the v68.1 bug');
  assert.ok(/lessonFormat === 'comprehension' \? \(\) => generateComprehension\(/.test(server), 'the route dispatches to it');
  assert.ok(/comprehension: \(c\) => generateComprehension\(/.test(server), 'so does the add-lesson registry');
  // Story gate: offered only where a story exists.
  assert.ok(/\$\{\(s && s\.story\) \? `<option value="comprehension"/.test(html),
    'the per-set menu offers it only for a chapter that HAS a story');
  assert.ok(/if \(!hasStory && _fmtSel\.value === 'comprehension'\) _fmtSel\.value = 'standard';/.test(html),
    'and a storyless chapter cannot leave it selected');
  assert.ok(/if \(!storyText\) throw new Error\('Comprehension lessons need a story/.test(server),
    'the generator refuses rather than inventing questions without a story');
  // i18n: en-only additions this release, per the batching plan.
  for (const k of ['lesson.type.comprehension', 'lesson.type.desc.comprehension',
                   'form.format.comprehension', 'ex.badge.comprehension']) {
    assert.ok(UI.en[k], `en string ${k} exists`);
  }
  assert.ok(/comprehension: \{ emoji: '🧠'/.test(html), 'the type is in the lesson registry');
}

// ── 8. Generator parsing survives what models actually return (v71_o) ──────
// Reported: every attempt failed with "JSON extract failed" on a reasoning model, and with
// thinking on the model returned nothing at all. Two separate causes, both fixed here.
{
  // (a) The parse must strip <think> BEFORE looking for JSON. The original hand-rolled version
  // matched the first `{` to the last `}` in the raw text — and on a reasoning model the first `{`
  // is usually inside the model's own reasoning, so every attempt failed on valid output.
  const { stripRaw, extractJSON, salvageArray } = require(path.join(ROOT, 'llm'));
  const good = '{"title":"T","desc":"d","icon":"🧠","questions":[{"q":"Warum?","choices":["a","b","c","d"],"correctIndex":1,"why":"w"}]}';
  const parse = (raw) => {
    let parsed = null;
    try { parsed = JSON.parse(stripRaw(raw)); }
    catch (_) {
      try { parsed = extractJSON(raw); }
      catch (_2) { try { const a = salvageArray(raw); if (Array.isArray(a)) parsed = { questions: a }; } catch (_3) {} }
    }
    if (parsed && !Array.isArray(parsed.questions) && Array.isArray(parsed)) parsed = { questions: parsed };
    return parsed;
  };
  const shapes = {
    plain: good,
    fenced: '```json\n' + good + '\n```',
    // The reported failure: reasoning text containing braces, then the real answer.
    thinkThenJson: '<think>Let me consider {the story} and pick {options}…</think>\n' + good,
    thinkWithJsonInside: '<think>{"scratch": true}</think>' + good,
    proseThenJson: 'Here are the questions:\n' + good + '\nHope this helps!',
    bareArray: '[{"q":"Warum?","options":["a","b","c"],"answer":"a"}]',
  };
  for (const [name, raw] of Object.entries(shapes)) {
    const parsed = parse(raw);
    assert.ok(parsed && Array.isArray(parsed.questions) && parsed.questions.length,
      `generator output shape "${name}" parses into questions`);
  }
  // The old naive matcher must be gone, not merely supplemented.
  // Literal substring, not a regex: escaping a pattern that is itself full of braces and
  // backslashes is how an assertion ends up matching something it did not mean to.
  assert.ok(!server.includes('const m = cleaned.match('),
    'the raw first-brace-to-last-brace match is gone');
  assert.ok(/try \{ parsed = JSON\.parse\(stripRaw\(raw\)\); \}/.test(server),
    'parsing goes through stripRaw, which removes <think> first');
  assert.ok(/catch\(_2\) \{[\s\S]{0,200}salvageArray\(raw\)/.test(server),
    'with a salvage path for a bare questions array');

  // (b) The empty-response half: a long chapter plus a reasoning model spent the whole budget on
  // reading and thinking. The story is now bounded and the base budget raised.
  assert.ok(/const MAX_STORY_CHARS = 6000;/.test(server), 'the story fed to the model is bounded');
  assert.ok(/storyForPrompt/.test(server) && !/fillPrompt\(P\.user, \{ story: storyText/.test(server),
    'and it is the bounded excerpt that reaches the prompt, not the whole chapter');
  assert.ok(/callLLMLesson\(sys, userMsg, 3200\)/.test(server),
    'the token budget leaves room to answer after reasoning');

  // Key-name tolerance: `choices` is asked for, but models say `options`/`answers` just as often.
  assert.ok(/Array\.isArray\(entry\.options\) \? entry\.options/.test(server), 'options is accepted');
  assert.ok(/entry\.q \?\? entry\.question \?\? entry\.prompt/.test(server), 'so are question/prompt');
}

// ── 9. Quiz language, story chain, and the "why" reveal (v71_o) ───────────
{
  const prompts = JSON.parse(fs.readFileSync(path.join(ROOT, 'prompts.json'), 'utf8'));
  const P = prompts.comprehension;

  // (a) Questions are in the LEARNER's language. The quiz tests comprehension of the story, not
  // the ability to decode the question — asking in {L} made the wording itself a second test.
  assert.ok(/written in \{S\}/.test(P.system), 'questions and options are written in {S}');
  assert.ok(!/Every question and every option is written in \{L\}/.test(P.system),
    'the old {L} instruction is gone, not merely supplemented');
  assert.ok(!/"q":"<\{L\}>"/.test(P.user), 'and the JSON template no longer asks for {L} questions');
  assert.ok(/"q":"<\{S\}>"/.test(P.user) && /"choices":\["<\{S\}>"/.test(P.user),
    'the template asks for {S} throughout');
  assert.ok(/The STORY is in \{L\}/.test(P.system), 'while the story itself stays in the target language');

  // (b) The whole chain up to this chapter, not one chapter in isolation.
  assert.ok(/function collectChainStory\(saved, maxChars\)/.test(server), 'the chain walker exists');
  assert.ok(/const _chainStory = collectChainStory\(saved\);/.test(server), 'add-lesson builds it');
  assert.ok(/chainStory: _chainStory\.text/.test(server), 'and passes it to the generator');
  assert.ok(/String\(chainStory \|\| story \|\| ''\)\.trim\(\)/.test(server),
    'the generator prefers the chain over the single chapter');
  // The current chapter must survive whole: it is the one the questions are about. Trimming from
  // the wrong end would silently drop it and ask about chapters the learner read long ago.
  assert.ok(/Always keep the current chapter whole/.test(server), 'the budget is spent from the OLDEST end');
  assert.ok(/\(!chainStory && storyText\.length > MAX_STORY_CHARS\)/.test(server),
    'and an already-budgeted chain is not re-trimmed by the generator cap');

  // (c) The reveal shows the reason, in the learner's language, and says it aloud.
  assert.ok(/const _why = \(ex\.type==='comprehension_mcq' && ex\.why\)/.test(html),
    'a comprehension question reveals its reason');
  assert.ok(/_wrongBody = _why[\s\S]{0,80}escHtml\(_why\)/.test(html),
    'the reason replaces the correct-answer restatement');
  assert.ok(/if\(_why\) speakLang\(_why, \(APP\.lessonData\?\.srcLang \|\| APP\.srcLang\)\);/.test(html),
    'and is read aloud in the SOURCE language — a target-language voice would mangle it');
  assert.ok(/function speakLang\(text, langCode, rate\)/.test(html), 'via a language-targeted speak');
  // Falls back when the model omitted a reason, rather than showing an empty reveal.
  assert.ok(/: \(_diff \|\| `\$\{t\('check\.correct_answer'\)\}/.test(html),
    'with the plain correct answer as the fallback when there is no reason');
}

console.log('unit-comprehension: ALL PASSED');
