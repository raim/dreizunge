// unit-answer-check.test.js — v89_j.
//
// "Sometimes the wrong answer is actually also correct" (user report: a nl→de read_translate marked
// KOSTENLOS wrong in favour of UMSONST). The answer-time re-check asks a live model whether the
// learner's rejected choice was in fact acceptable, and SHOWS the verdict.
//
// Two properties carry this feature, and both are safety properties rather than features:
//   1. It is OFF unless the learner switched it on, and it never runs on a correct answer.
//   2. ⚠️ It REPORTS, it does not GRADE. Nothing may touch markSolved / the ledger / hearts / BKT —
//      a model deciding the learner was right after all would write PROGRESS state, so a bad verdict
//      would corrupt their history rather than one feedback panel.
// Everything below is written against those two.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

// ── 1. The parser's asymmetry, which is the whole safety property (server.js) ──────────────────
// Failing to spot a synonym costs a learner nothing. Telling them a genuine mistake was fine
// teaches them the mistake, and they cannot tell that the model was guessing. So ONLY an explicit
// "also acceptable" counts; every other reply — wrong shape, empty, unknown verdict word — must
// come back as something the client will not show.
{
  const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const at = src.indexOf('function parseAnswerCheck(');
  assert.ok(at > -1, 'server.js defines parseAnswerCheck');
  let d = 0, i = src.indexOf('{', at);
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (!d) { i++; break; } } }
  const parse = new Function(src.slice(at, i) + '\nreturn parseAnswerCheck;')();

  assert.strictEqual(parse('VERDICT: also acceptable — "kostenlos" ist ebenso richtig.').verdict, 'also_acceptable',
    'the one shape the prompt asks for');
  assert.strictEqual(parse('VERDICT: also acceptable — "kostenlos" ist ebenso richtig.').note,
    '"kostenlos" ist ebenso richtig.', 'and the note after the dash is carried through for the learner');
  assert.strictEqual(parse('VERDICT:   Also Acceptable  -  because x').verdict, 'also_acceptable',
    'case and spacing vary between replies; a hyphen is as good as an em dash');
  assert.strictEqual(parse('VERDICT: also acceptable').verdict, 'also_acceptable', 'a verdict with no note is still a verdict');
  assert.strictEqual(parse('VERDICT: wrong — "umsonst" bedeutet hier etwas anderes.').verdict, 'wrong', 'the negative verdict');

  // ⚠️ Everything else is NOT "also acceptable". Each of these is a real thing a local model does.
  for (const [reply, what] of [
    ['I think it is fine actually!', 'prose with no VERDICT line'],
    ['', 'an empty reply'],
    ['VERDICT: maybe — unsure', 'a verdict word the prompt never offered'],
    ['VERDICT: also correct — x', 'a near-miss on the exact words asked for'],
    ['VERDICT: probably also acceptable-ish', 'a hedge'],
  ]) {
    assert.notStrictEqual(parse(reply).verdict, 'also_acceptable',
      `${what} must NOT read as also-acceptable (got ${parse(reply).verdict})`);
  }
  // Non-vacuity: the parser is not simply returning 'unknown' for everything.
  assert.strictEqual(parse('VERDICT: also acceptable — y').verdict, 'also_acceptable', 'sanity: the positive path still works');
}
console.log('  parser: only an explicit "also acceptable" counts; every other reply is a no: OK');

// ── 2. ⚠️ The route REPORTS, it does not GRADE ────────────────────────────────────────────────
// The claim is about a body of code, so it is asserted over that body: the handler must not touch
// any progress-writing name. A source scan is the honest instrument here — the alternative would be
// asserting that a function nobody calls was not called.
{
  const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const at = src.indexOf("url.pathname === '/api/answer-check'");
  assert.ok(at > -1, 'the route exists');
  const body = src.slice(at, src.indexOf("url.pathname === '/api/writing-feedback'", at));
  for (const forbidden of ['saveStore', 'markSolved', 'store.topics', 'progress']) {
    assert.ok(!body.includes(forbidden),
      `the answer-check route must not mention \`${forbidden}\` — it is a second opinion, not a grader`);
  }
  assert.ok(/runAsJob\(/.test(body), 'it is a listed, cancellable job like every model-backed route since v88_al');
  assert.ok(/callLLMLesson\(/.test(body), 'and uses the lesson model, for the reason writing-feedback records');
}
console.log('  the route touches no progress-writing name, and is a cancellable job: OK');

// ── 3. The client gate: OFF by default, and every reason it stays shut ─────────────────────────
function open(extra) {
  const C = loadClient({ quiet: true });
  C.run(`UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.info = { backend:'ollama', canGenerate:true };
    APP.lang = 'nl'; APP.srcLang = 'de';
    APP.lessonData = { lang:'nl', srcLang:'de' };
    ${extra || ''}
    true;`, 'open');
  return C;
}
const EX = { type: 'read_translate', target: 'Het is kosteloos.', correct: 'UMSONST' };
const eligible = (C, ex, picked) =>
  C.run(`_answerCheckEligible(${JSON.stringify(ex)}, ${JSON.stringify(picked)})`);
{
  // ⚠️ THE DEFAULT. The user's ruling was explicit: "default NOT active", because it is live-only
  // and slow on their laptop.
  const off = open();
  assert.strictEqual(off.run(`APP.answerCheck`), false, 'the flag is OFF on a fresh client');
  assert.strictEqual(eligible(off, EX, 'KOSTENLOS'), false, 'and nothing is eligible while it is off');

  const on = open(`APP.answerCheck = true;`);
  assert.strictEqual(eligible(on, EX, 'KOSTENLOS'), true, 'switched on, the reported instance IS eligible');

  // Each remaining guard, one at a time, so a failure names which one broke.
  assert.strictEqual(eligible(open(`APP.answerCheck = true; APP.info.canGenerate = false;`), EX, 'KOSTENLOS'), false,
    'no live backend: nothing could answer, so nothing is asked');
  assert.strictEqual(eligible(on, { ...EX, type: 'mcq_article' }, 'der'), false,
    '⚠️ a GRAMMAR type is out of scope by ruling — a second correct article means the lesson is broken differently, and that is worth seeing');
  assert.strictEqual(eligible(on, { ...EX, type: 'inflection_form' }, 'Präteritum'), false,
    'and so is inflection_form, which the user chose not to include in this cut');
  assert.strictEqual(eligible(on, EX, 'UMSONST'), false, 'the picked answer being the correct one is not a disagreement');
  assert.strictEqual(eligible(on, EX, '  umsonst '), false, 'nor is it once case and padding are normalised');
  assert.strictEqual(eligible(on, EX, ''), false, 'an empty pick asks nothing');
  assert.strictEqual(eligible(on, { ...EX, correct: '' }, 'KOSTENLOS'), false, 'nor does a missing correct answer');
  assert.strictEqual(eligible(on, { type: 'syn_select', target: 'x', correct: ['a', 'b'] }, 'a'), false,
    'a select-ALL question is a different shape and is not judged as one pick');

  // All four in-scope types are actually in scope — otherwise the ruling would be half-applied.
  for (const type of ['mcq_target_source', 'mcq_source_target', 'read_translate', 'listen_mcq']) {
    assert.strictEqual(eligible(on, { type, target: 'x', source: 'y', correct: 'A' }, 'B'), true, type + ' is in scope');
  }
}
console.log('  the gate is off by default, and each guard shuts it for its own reason: OK');

// ── 4. Which way round the question ran ────────────────────────────────────────────────────────
// Three of the four types ask {L}→{S}; mcq_source_target alone runs the other way. Sending the
// direction is what lets the server judge generically without knowing the four types' field shapes.
{
  const C = open(`APP.answerCheck = true;`);
  const dir = (ex) => JSON.parse(C.run(`JSON.stringify(_answerCheckDirection(${JSON.stringify(ex)}, 'nl', 'de'))`));
  assert.deepStrictEqual(dir({ type: 'read_translate', target: 'Het is kosteloos.', source: 'Es ist umsonst.' }),
    { prompt: 'Het is kosteloos.', promptLang: 'nl', answerLang: 'de' },
    'read_translate shows the TARGET-language sentence and wants a source-language answer');
  assert.deepStrictEqual(dir({ type: 'mcq_source_target', target: 'kosteloos', source: 'umsonst' }),
    { prompt: 'umsonst', promptLang: 'de', answerLang: 'nl' },
    '⚠️ mcq_source_target runs the OTHER way — the one type that would be wrong if the direction were assumed');
  for (const type of ['mcq_target_source', 'listen_mcq']) {
    assert.strictEqual(dir({ type, target: 'kosteloos', source: 'umsonst' }).promptLang, 'nl', type + ' shows the target-language item');
  }
}
console.log('  the question direction is derived per type, including the one that runs backwards: OK');

// ── 5. A late verdict never lands on the NEXT question ─────────────────────────────────────────
// ⚠️ The model is slow — that is the whole reason this is opt-in — so the learner can press Continue
// while it is thinking. Attaching a verdict about the PREVIOUS answer to the question now on screen
// would be worse than showing nothing.
{
  const C = open(`APP.answerCheck = true;
    APP.cur = { cur: 3 };
    document.getElementById('fb').innerHTML = '<div class="fb-head">x</div><div class="fb-body">Not quite</div>';`);
  // ⚠️ Read through `children`, not `querySelectorAll`: the harness tracks appended nodes but its
  // selector engine only sees what came from the innerHTML it parsed. Asserting the way the product
  // itself now checks is both honest and the only thing observable here.
  const added = () => JSON.parse(C.run(`JSON.stringify((function(){
    var b = document.getElementById('fb').querySelector('.fb-body');
    return [].slice.call(b.children).filter(function(k){ return k.className === 'answer-also-ok'; })
             .map(function(k){ return k.innerHTML; });
  })())`));

  C.run(`_answerCheckShow('weil beides passt', 3); true;`, 'in-place');
  assert.strictEqual(added().length, 1, 'a verdict for the question still on screen is shown');
  assert.ok(/Your answer is also acceptable/.test(added()[0]),
    'with the granted ui.json headline: ' + added()[0]);
  assert.ok(/weil beides passt/.test(added()[0]),
    "and the model's own sentence, which is already in the learner's language");

  C.run(`_answerCheckShow('zweimal', 3); true;`, 'twice');
  assert.strictEqual(added().length, 1, 'never twice for one answer');
  assert.ok(!/zweimal/.test(added().join(' ')), 'and the second call left no trace at all');

  // ⚠️ WRITTEN THIS WAY BECAUSE THE FIRST VERSION WAS VACUOUS. It called _answerCheckShow(…, 4)
  // with APP.cur.cur already 4 — the indices MATCHED, so the stale-index guard was never the thing
  // rejecting it; the dedupe above was. Removing the guard entirely left the mutation GREEN.
  // The real case is a verdict for question 3 arriving after the learner is on 4, into the FRESH
  // panel that question 4 rendered.
  C.run(`document.getElementById('fb').innerHTML = '<div class="fb-head">x</div><div class="fb-body">Not quite</div>';
         APP.cur.cur = 4; true;`, 'next-question');
  assert.strictEqual(added().length, 0, 'the new question starts with a clean panel');
  C.run(`_answerCheckShow('too late', 3); true;`, 'stale');
  assert.strictEqual(added().length, 0,
    '⚠️ a verdict for the PREVIOUS question is dropped — the index is re-checked at render time');
  assert.ok(!/too late/.test(added().join(' ')), 'and its text never reaches the panel');
  // Non-vacuity: the same fresh panel DOES accept a verdict for the question actually on screen.
  C.run(`_answerCheckShow('passt', 4); true;`, 'fresh-in-place');
  assert.strictEqual(added().length, 1, 'so the drop above was the INDEX talking, not the panel state');
}
console.log('  a verdict that arrives after the learner moved on is dropped, and never shown twice: OK');

// ── 6. Exactly the three ui.json keys that were granted, en only ───────────────────────────────
// The user translates ui.json by hand and granted a budget of three. Spending a fourth silently is
// the thing this asserts against.
{
  for (const k of ['settings.answer_check', 'settings.answer_check_title', 'check.also_correct']) {
    assert.ok(typeof UI.en[k] === 'string' && UI.en[k].trim(), 'ui.json carries ' + k);
    for (const lng of Object.keys(UI)) {
      if (lng === 'en') continue;
      assert.ok(!(k in UI[lng]), `${k} is en-only — ${lng} must not carry a machine-written copy`);
    }
  }
  const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const used = [...src.matchAll(/t\('((?:settings\.answer_check|check\.also_correct)[^']*)'\)/g)].map(m => m[1]);
  assert.deepStrictEqual([...new Set(used)].sort(),
    ['check.also_correct', 'settings.answer_check', 'settings.answer_check_title'],
    'the client uses all three and no fourth: ' + JSON.stringify(used));
}
console.log('  exactly the three granted ui.json keys, en only, all three used: OK');

console.log('unit-answer-check: ALL PASSED');
