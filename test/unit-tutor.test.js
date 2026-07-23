// unit-tutor.test.js
// v61 — end-of-chapter comprehension tutor (Stage 1 of the persistent-tutor arc).
// Contract under test:
//   • Its own model role (OLLAMA_TUTOR_MODEL, defaults to the story model), settable at runtime,
//     exposed via /api/info + /api/models, with its own reasoning toggle (think.tutor).
//   • POST /api/tutor is STATELESS: the client sends the chapter story + the words the learner got
//     wrong / knows + the conversation so far; the server returns ONE reply. 503 without a backend.
//   • All untrusted input is capped (story, word arrays, history turns/length) so a hostile or
//     buggy client can't blow up the prompt.
//   • History is flattened into the single user message (the llm layer is system+user only).
//   • The prompt focuses the tutor on the learner's ERRORS and bounds it to known vocabulary.
//   • Client: the panel appears only with a backend + a story, never for a drill; the context
//     gatherer unions this round's wrong answers with the ledger's wrong-count words.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const prompts = JSON.parse(fs.readFileSync(path.join(ROOT, 'prompts.json'), 'utf8'));

function extFn(src, name) {
  const at = src.indexOf('function ' + name + '(');
  assert.ok(at >= 0, `found ${name}`);
  const b = src.indexOf('{', at);
  let d = 0, i = b;
  for (; i < src.length; i++) { const c = src[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(at, i);
}

// ── 1. The tutor model role ───────────────────────────────────────────────────
{
  assert.ok(/let OLLAMA_TUTOR_MODEL\s+= process\.env\.OLLAMA_TUTOR_MODEL\s+\|\| OLLAMA_MODEL;/.test(server),
    'tutor has its own role, defaulting to the story model (both produce prose)');
  const cm = extFn(server, 'currentModels');
  assert.ok(/tutor: OLLAMA_TUTOR_MODEL/.test(cm), 'currentModels exposes the tutor model');
  assert.ok(/tutor: OLLAMA_THINK\.tutor/.test(cm), 'currentModels exposes the tutor reasoning flag');
  const srm = extFn(server, 'setRuntimeModels');
  assert.ok(/tutor = pick\(next\.tutor\) \|\| all/.test(srm) && /if \(tutor\)\s+OLLAMA_TUTOR_MODEL\s+= tutor;/.test(srm),
    'setRuntimeModels can switch the tutor model');
  assert.ok(/typeof next\.think\.tutor === 'boolean'/.test(srm), 'setRuntimeModels accepts think.tutor');
  assert.ok(/ollamaTutorModel: OLLAMA_TUTOR_MODEL/.test(server), '/api/info exposes the tutor model');
  // The role wrapper routes through thinkOpts so the reasoning toggle + budget bump apply.
  const w = extFn(server, 'callLLMTutor');
  assert.ok(/thinkOpts\('tutor', maxTokens\)/.test(w), 'callLLMTutor applies the tutor reasoning policy');
  assert.ok(/_callLLM\(OLLAMA_TUTOR_MODEL, system, userMsg, pol\.tokens, \{ stop: _TUTOR_STOP, \.\.\.pol, \.\.\.opts \}\)/.test(w),
    'callLLMTutor uses the tutor model, the (possibly bumped) budget, and stop-sequences (v66.1)');
}
console.log('  tutor model role: own model, runtime-switchable, reasoning-capable, exposed: OK');

// ── 1c. The tutor must never speak for the student (v66.1 regression) ────────
// Reported: the tutor generated whole fake exchanges, inventing the learner's answers, because the
// prompt hands it a "Student: / Tutor:" transcript and models continue the pattern. Three defences;
// the sanitizer is the only guarantee, so it is tested behaviourally.
{
  const san = new Function(extFn(server, 'sanitizeTutorReply') + '\nreturn sanitizeTutorReply;')();
  const runaway = 'Gut gemacht!\nLass uns weitermachen.\nStudent: erfundene Antwort\nTutor: erfundenes Lob';
  const cleaned = san(runaway);
  assert.ok(!/Student:/i.test(cleaned), 'an invented student turn is cut away');
  assert.ok(!/Tutor:/.test(cleaned), 'an invented tutor turn is cut away');
  assert.ok(cleaned.startsWith('Gut gemacht!'), 'the tutor\'s own first turn survives intact');
  assert.strictEqual(san('Tutor: Hallo!'), 'Hallo!', 'a leading self-label is stripped');
  assert.strictEqual(san('Beispiel: das Haus ist groß.'), 'Beispiel: das Haus ist groß.',
    'a colon in ordinary prose is NOT treated as a speaker label');
  for (const marker of ['STUDENT: x', 'Studente: x', 'Schüler: x', 'Learner: x']) {
    assert.ok(!san('Ja!\n' + marker).includes('x'), `the ${marker.split(':')[0]} marker is handled`);
  }
  // Stop-sequences are also sent, so generation usually halts before the sanitizer is needed.
  assert.ok(/const _TUTOR_STOP = \[/.test(server), 'stop sequences are defined');
  assert.ok(/stop: _TUTOR_STOP/.test(server), 'stop sequences are passed to the model');
  // …and the prompt forbids it in words.
  const prompts = JSON.parse(fs.readFileSync(path.join(ROOT, 'prompts.json'), 'utf8'));
  assert.ok(/NEVER write the student's turn/i.test(prompts.tutor.system), 'the prompt forbids writing the student turn');
  assert.ok(/CHECK IT/.test(prompts.tutor.system), 'the prompt requires checking the learner\'s target-language production');
}
console.log('  tutor never speaks for the student; target-language checking required (v66.1): OK');


// ── 1b. /api/models must RECOGNISE a tutor change (v62.1 regression) ─────────
// Bug: the tutor was wired into setRuntimeModels but omitted from the route's "what changed?"
// detection, so selecting a tutor model returned 400 "Nothing to set". The bug is invisible
// without a live Ollama (the route 503s first), so pin the predicates in source.
{
  const at = server.indexOf("const requested = [body.model");
  assert.ok(at > 0, 'the requested-fields detection exists');
  const guard = server.slice(at, server.indexOf('return json(res, 400', at) + 200);
  assert.ok(/body\.tutor/.test(guard),
    'a tutor MODEL change is recognised (else: 400 "Nothing to set")');
  assert.ok(/typeof body\.think\.tutor === 'boolean'/.test(guard),
    'a tutor REASONING toggle is recognised on its own');
  // Every role the menu offers must be detectable, or selecting it silently fails.
  for (const role of ['model', 'story', 'translation', 'lessons', 'qc', 'tutor']) {
    assert.ok(new RegExp('body\\.' + role + '\\b').test(guard), `the ${role} role is detectable`);
  }
  // …and a truly empty body is still rejected.
  assert.ok(/!requested\.length && !hasTimeout && !hasThink/.test(guard), 'an empty body is still rejected');
}
console.log('  /api/models recognises every role incl. tutor (v62.1 regression): OK');


// ── 2. The /api/tutor route: statelessness, guards, caps ──────────────────────
{
  const at = server.indexOf("url.pathname === '/api/tutor'");
  assert.ok(at > 0, 'the /api/tutor route exists');
  const route = server.slice(at, server.indexOf("url.pathname === '/api/story-qc'", at));

  assert.ok(/if \(active === 'none'\) return json\(res, 503/.test(route), '503 without an LLM backend');
  assert.ok(!/if \(!story\.trim\(\)\) return json\(res, 400/.test(route),
    'v62: a chapter story is NOT required — the tutor answers from anywhere, including the landing page');
  // Input caps — every untrusted field is bounded.
  assert.ok(/clip\(body\.story, 4000\)/.test(route), 'story capped at 4000 chars');
  assert.ok(/arr\(body\.wrongWords, 40, 60\)/.test(route), 'wrongWords capped (40 × 60 chars)');
  assert.ok(/arr\(body\.knownWords, 200, 60\)/.test(route), 'knownWords capped (200 × 60 chars)');
  assert.ok(/\.slice\(-20\)/.test(route), 'history capped to the last 20 turns');
  assert.ok(/clip\(m && m\.text, 800\)/.test(route), 'each history turn capped at 800 chars');
  // Roles in history are normalized to the two we understand (no prompt-injection via role).
  assert.ok(/m\.role === 'student' \? 'student' : 'tutor'/.test(route), 'history roles normalized');
  // Stateless: nothing is persisted — no upsert/saveStore in the route.
  assert.ok(!/upsert\(|saveStore\(/.test(route), 'the tutor route persists nothing (stateless by design)');
  // History is flattened into the single user message (llm layer is system+user only).
  assert.ok(/Conversation so far:/.test(route) && /Reply as the tutor \(one short turn\)\./.test(route),
    'history is flattened into the user turn');
  assert.ok(/body\.opening \|\| history\.length === 0/.test(route), 'an opening turn starts the conversation');
  // One reply out, with token counts; an empty reply is an error, not an empty bubble.
  assert.ok(/return json\(res, 200, \{ reply, promptTokens, completionTokens \}\)/.test(route),
    'returns one reply plus token usage');
  assert.ok(/Tutor returned an empty reply/.test(route), 'an empty model reply is reported, not shown blank');
}
console.log('  /api/tutor: stateless, guarded, all untrusted input capped: OK');

// ── 3. The prompt focuses on errors and bounds vocabulary ────────────────────
{
  assert.ok(prompts.tutor && prompts.tutor.system && prompts.tutor.opening, 'prompts.json carries the tutor prompt');
  const sys = prompts.tutor.system;
  for (const v of ['{S}', '{L}', '{story}', '{wrongWords}', '{knownWords}', '{scope}', '{retrieved}']) {
    assert.ok(sys.includes(v), `tutor prompt takes ${v}`);
  }
  assert.ok(/WRONG/.test(sys), 'the prompt directs attention to the words the learner got wrong');
  assert.ok(/ONE focused comprehension, vocabulary or grammar question at a time/i.test(sys), 'one question at a time');
  assert.ok(/NEVER reveal what happens in a story the student has not finished/i.test(sys),
    'the prompt states the spoiler rule (belt-and-braces alongside the retrieval whitelist)');
  assert.ok(/Do NOT introduce unrelated new vocabulary/i.test(sys), 'bounded to known vocabulary (no spoilers/overreach)');
  assert.ok(/hint or a follow-up question over immediately giving the full answer/i.test(sys),
    'encourages discovery over answer-giving (the spec philosophy)');
  // The route fills exactly these variables.
  const route = server.slice(server.indexOf("url.pathname === '/api/tutor'"));
  assert.ok(/fillPrompt\(PROMPTS\.tutor\.system, \{[\s\S]{0,1200}wrongWords:/.test(route), 'the route fills the tutor prompt');
  assert.ok(/retrieved: retrieved\.text \|\|/.test(route), 'the route injects retrieved context');
  assert.ok(/scope: scope\.label \?/.test(route), 'the route tells the tutor where the learner is');
  assert.ok(/'\(none recorded\)'/.test(route), 'empty word lists degrade gracefully');
}
console.log('  tutor prompt: error-focused, one question, vocabulary-bounded: OK');

// ── 4. Client: the floating widget + one continuous thread (v62) ─────────────
{
  // The widget is global (mounted beside the toast), not bound to the completion card.
  assert.ok(/id="tutor-fab"/.test(html) && /id="tutor-widget"/.test(html), 'a global floating widget exists');
  assert.ok(!/id="comp-tutor"/.test(html), 'the completion-card-bound panel is gone (superseded by the widget)');
  const ra = extFn(html, 'refreshTutorAvailability');
  assert.ok(/APP\.info\?\.canGenerate/.test(ra), 'the widget requires a live backend');
  // It follows the learner: show() is the single screen-switch choke point.
  assert.ok(/try\{ refreshTutorAvailability\(\); \}catch\(_\)\{\}/.test(html), 'the widget refreshes on every screen change');

  // ONE continuous thread, persisted across navigation AND reload.
  assert.ok(/const _TUTOR_KEY = 'dz_tutor_thread'/.test(html), 'the thread has a storage key');
  const ld = extFn(html, '_tutorLoadThread'), sv = extFn(html, '_tutorSaveThread');
  assert.ok(/localStorage\.getItem\(_TUTOR_KEY\)/.test(ld), 'the thread is restored at boot');
  assert.ok(/localStorage\.setItem\(_TUTOR_KEY/.test(sv), 'the thread is persisted');
  assert.ok(/slice\(-_TUTOR_MAX_TURNS\)/.test(sv), 'the stored thread is bounded');
  assert.ok(/_tutorLoadThread\(\); refreshTutorAvailability\(\)/.test(html), 'boot loads the thread and mounts the widget');

  // Scope: derived from the active screen, sent with every turn.
  const sc = extFn(html, '_tutorScope');
  for (const k of ['lesson', 'chapter', 'storyline', 'global']) {
    assert.ok(new RegExp("kind:'" + k + "'").test(sc), `scope covers ${k}`);
  }
  assert.ok(/document\.querySelector\('\.screen\.active'\)/.test(sc), 'scope is derived from the active screen');

  // Context: error-focused, and carries the COMPLETED whitelist for spoiler-safe retrieval.
  const gc = extFn(html, '_tutorGatherContext');
  assert.ok(/r\.wrong > 0/.test(gc) && /\(b\[1\]\.wrong\|\|0\) - \(a\[1\]\.wrong\|\|0\)/.test(gc),
    'wrong words lead the focus list, hardest first');
  assert.ok(/APP\.cur\?\._wrongTargets/.test(gc), "the live round's mistakes take priority");
  assert.ok(/APP\.progress\?\.completed/.test(gc) && /completed/.test(gc),
    'the completed-chapter whitelist is sent (spoiler safety)');

  const snd = extFn(html, '_tutorSend');
  assert.ok(/fetch\('\/api\/tutor'/.test(snd), 'posts to /api/tutor');
  assert.ok(/_tutorState\.busy = false;/.test(snd), 'the busy flag always clears (no stuck spinner)');
  const sm = extFn(html, 'sendTutorMessage');
  assert.ok(/_tutorSaveThread\(\); _tutorRender\(\)/.test(sm), 'the student turn is persisted immediately');

  const ui = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
  for (const k of ['models.tutor', 'tutor.open', 'tutor.placeholder', 'tutor.thinking', 'tutor.failed',
                   'tutor.title', 'tutor.clear', 'tutor.clear_confirm', 'tutor.empty', 'tutor.scope_global']) {
    assert.ok(ui.en[k], `ui.json en has ${k}`);
  }
}
console.log('  client: global widget, continuous persisted thread, scope, spoiler-safe context: OK');

// ── 4b. Tutor markdown rendering (v62.2) ─────────────────────────────────────
// The tutor writes markdown; literal ** looked broken. Rendering model output as HTML is a
// security-relevant change, so the escape-then-format order is pinned behaviourally.
{
  const escHtml = x => (x || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const md = new Function('escHtml', extFn(html, '_tutorMd') + '\nreturn _tutorMd;')(escHtml);

  assert.strictEqual(md('You showed **fear** there.'), 'You showed <strong>fear</strong> there.', 'bold renders');
  assert.strictEqual(md('The word *Angst* here'), 'The word <em>Angst</em> here', 'italic renders');
  assert.ok(/<code[^>]*>der Hund<\/code>/.test(md('Use `der Hund` now')), 'code spans render');
  // Things that must NOT become emphasis.
  assert.strictEqual(md('2 * 3 * 4 is math'), '2 * 3 * 4 is math', 'arithmetic asterisks are left alone');
  assert.strictEqual(md('snake_case_word stays'), 'snake_case_word stays', 'snake_case vocabulary survives');
  // SECURITY: model output must never inject markup — escape happens BEFORE formatting.
  for (const [inp, banned] of [
    ['<script>alert(1)</script>', '<script'],
    ['<img src=x onerror=alert(1)>', '<img'],
    ['**<b>x</b>**', '<b>'],
    ['`<script>bad</script>`', '<script'],
  ]) {
    assert.ok(!md(inp).includes(banned), `model output cannot inject ${banned}`);
  }
  assert.ok(md('<script>alert(1)</script>').includes('&lt;script&gt;'), 'dangerous markup is escaped, not stripped');
  // Only the TUTOR's text is formatted; the student's own text stays plain-escaped.
  assert.ok(/\(mine\?escHtml\(m\.text\):_tutorMd\(m\.text\)\)/.test(html),
    'markdown is applied to tutor replies only, not to the student\'s own message');
}
console.log('  tutor markdown: bold/italic/code render, escape-before-format holds (XSS-safe): OK');

// ── 4c. Per-question help (v63) — the answer is WITHHELD until answered ──────
// The tutor can help with the exercise on screen, but must not hand over the answer while the
// learner is still answering. That is enforced structurally (the answer is never sent), not by
// asking the model nicely — the same approach as the completed-chapters spoiler whitelist.
{
  const APPq = { cur: null };
  const cq = new Function('APP', extFn(html, '_tutorCurrentQuestion') + '\nreturn _tutorCurrentQuestion;')(APPq);
  // A leak = the answer identifiable as a LABELLED field. Appearing inside "Choices:" is fine:
  // the learner already sees every choice, and which one is correct stays unknown.
  const labelled = (text, ans) =>
    text.split(' · ').filter(b => !b.startsWith('Choices:')).join(' · ').includes(ans);

  const CASES = [
    { type:'mcq_source_target', source:'Meer', target:'zee',  correct:'zee',  choices:['zee','huis','boom'] },
    { type:'mcq_target_source', target:'zee',  source:'Meer', correct:'Meer', choices:['Meer','Haus','Baum'] },
    { type:'type_target',       source:'Meer', target:'zee',  correct:'zee' },
    { type:'cloze', sentence:'De ___ is blauw.', target:'zee', correct:'zee' },
    { type:'listen_mcq', target:'zee', correct:'Meer', choices:['Meer','Haus'] },
  ];
  for (const ex of CASES) {
    APPq.cur = { cur:0, answered:false, exercises:[ex] };
    const un = cq();
    assert.ok(un && un.text, `${ex.type}: a question description is produced`);
    assert.strictEqual(un.answered, false, `${ex.type}: reported as unanswered`);
    assert.ok(!labelled(un.text, String(ex.correct)),
      `${ex.type}: the answer is NOT identifiable while unanswered`);
    // Once answered, the answer is available so the tutor can explain.
    APPq.cur.answered = true;
    const an = cq();
    assert.strictEqual(an.answered, true, `${ex.type}: reported as answered`);
    assert.strictEqual(an.answer, String(ex.correct), `${ex.type}: the answer is available after answering`);
  }
  // No exercise → no question (the button hides rather than sending junk).
  APPq.cur = { cur: 9, answered:false, exercises: [] };
  assert.strictEqual(cq(), null, 'no current exercise → no question payload');

  // The scope gates the answer a second time, and the server gates it a third.
  const sc = extFn(html, '_tutorScope');
  assert.ok(/answer: \(q && q\.answered\) \? q\.answer : null/.test(sc),
    'the scope only carries the answer once answered');
  const at = server.indexOf("url.pathname === '/api/tutor'");
  const route = server.slice(at, server.indexOf("url.pathname === '/api/story-qc'", at));
  assert.ok(/answer: \(scopeIn\.answered === true\) \? \(clip\(scopeIn\.answer, 120\) \|\| null\) : null/.test(route),
    'the server refuses to carry an answer for an unanswered question');
  assert.ok(/never state the answer/i.test(route), 'the prompt instructs hint-only while unanswered');

  // The button exists, is wired, and follows the exercise.
  assert.ok(/id="ex-hint-btn"[^>]*onclick="askTutorAboutQuestion\(\)"/.test(html), 'the per-question help button exists');
  assert.ok(/try\{ refreshExHintBtn\(\); \}catch\(_\)\{\}/.test(html), 'the button refreshes with the exercise');
  const ask = extFn(html, 'askTutorAboutQuestion');
  assert.ok(/tutor\.hint_q.*tutor\.explain_q|q\.answered \? 'tutor\.explain_q' : 'tutor\.hint_q'/.test(ask),
    'it asks for a hint before answering and an explanation after');
  const ui = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
  for (const k of ['tutor.hint_title','tutor.hint_q','tutor.explain_q']) assert.ok(ui.en[k], `ui.json en has ${k}`);
}
console.log('  per-question help: answer withheld until answered, across all exercise shapes: OK');



// ── 5. Static build correctly excludes the tutor (no backend there) ──────────
{
  const docs = path.join(ROOT, 'docs', 'index.html');
  if (fs.existsSync(docs)) {
    const s = fs.readFileSync(docs, 'utf8');
    // maybeShowTutor may be baked in, but it gates on canGenerate which is false in static —
    // so the panel can never appear. Assert that gate survives the bake.
    if (s.includes('function refreshTutorAvailability')) {
      assert.ok(/APP\.info\?\.canGenerate/.test(s), 'static keeps the canGenerate gate (widget stays hidden)');
    }
    assert.ok(/canGenerate: false/.test(s), 'the static build declares no backend');
  }
}
console.log('  static build: tutor gated off (no backend): OK');

console.log('unit-tutor: ALL PASSED');
