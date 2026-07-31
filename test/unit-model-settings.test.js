// unit-model-settings.test.js
// v71_q — tutor reasoning on by default, a CPU-thread setting, and two reveal-text fixes.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const llm = fs.readFileSync(path.join(ROOT, 'llm.js'), 'utf8');
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

// ── 1. The tutor reasons by default; the generators still do not ────────────
// The tutor answers open questions about the learner's own sentences, where reasoning demonstrably
// helps. Story and lesson generation emit structured JSON on a token budget, where it starves the
// answer — the v60.5 finding, and the cause of the v71_o empty-response bug. So this is a
// per-role default, and the asymmetry is the point.
{
  assert.ok(/const OLLAMA_THINK = \{ story: false, lessons: false, tutor: true \};/.test(server),
    'tutor reasoning defaults ON, story and lessons default OFF');
}

// ── 2. num_thread reaches Ollama, and only when set ────────────────────────
{
  assert.ok(/let NUM_THREAD = null;/.test(llm), 'the thread count is a module-level setting');
  assert.ok(/function setNumThread\(n\)/.test(llm) && /function getNumThread\(\)/.test(llm),
    'with a setter and getter');
  assert.ok(/setNumThread, getNumThread \};/.test(llm), 'both exported');
  // Unset must mean ABSENT from the options object, not 0 or a guessed number — otherwise the app
  // pins Ollama to a value it invented rather than leaving Ollama's own default alone.
  const guarded = (llm.match(/\.\.\.\(Number\.isInteger\(NUM_THREAD\) && NUM_THREAD > 0 \? \{ num_thread: NUM_THREAD \} : \{\}\)/g) || []).length;
  assert.strictEqual(guarded, 2, 'both call paths pass num_thread only when it is set');
  // Behavioural: the setter normalises junk to null rather than to a number.
  // Slice to the END of getNumThread's body, not a fixed offset — a fixed offset cuts mid-function
  // and the extracted source no longer parses.
  const from = llm.indexOf('let NUM_THREAD = null;');
  const to = llm.indexOf('\n', llm.indexOf('function getNumThread()'));
  const m = new Function(llm.slice(from, to) + '\nreturn { setNumThread, getNumThread };')();
  assert.strictEqual(m.setNumThread(8), 8, 'a positive integer is kept');
  assert.strictEqual(m.setNumThread(0), null, '0 means auto');
  assert.strictEqual(m.setNumThread(''), null, 'empty means auto');
  assert.strictEqual(m.setNumThread('abc'), null, 'junk means auto, not NaN');
  assert.strictEqual(m.setNumThread(-4), null, 'negatives mean auto');
}

// ── 3. The endpoint and the menu ───────────────────────────────────────────
{
  assert.ok(/const hasThreads = body\.numThread != null && Number\.isFinite\(parseInt\(body\.numThread, 10\)\);/.test(server),
    'the endpoint accepts numThread');
  assert.ok(/if \(hasThreads\) setNumThread\(body\.numThread\);/.test(server), 'and applies it');
  assert.ok(/numThread: getNumThread\(\)/.test(server), 'and reports it back so the menu can show it');
  // A threads-only POST must not be rejected as "nothing to set".
  assert.ok(/if \(!requested\.length && !hasTimeout && !hasThink && !hasThreads\)/.test(server),
    'a threads-only request is a valid request');
  assert.ok(/id="bmodel-threads"[^>]*onchange="switchThreads\(this\.value\)"/.test(html),
    'the model menu has the control');
  assert.ok(/placeholder="auto"/.test(html), 'shown blank as "auto" rather than a guessed number');
  assert.ok(/async function switchThreads\(n\)/.test(html), 'with a handler');
  assert.ok(/const val = raw === '' \? 0 : parseInt\(raw, 10\);/.test(html),
    'where clearing the field means auto, not an error');
  for (const k of ['models.threads', 'models.threads_hint', 'models.threads_set', 'models.threads_auto']) {
    assert.ok(UI.en[k], `en string ${k} exists`);
  }
}

// ── 4. Reveal text (v71_q) ─────────────────────────────────────────────────
{
  // A synonym reveal is a list of words with glosses; "Correct answer:" said nothing the list did
  // not, and the <strong> wrapper fought its own layout.
  assert.ok(/: ex\.type==='syn_select'\s*\n\s*\? _wrongCorrect/.test(html),
    'a synonym reveal is shown bare, without the redundant label');
  // Provenance: both lines rendered as "von" in German because the English source said "by" and
  // "from". Labelling them at the source is the fix; the stale translations were dropped so the
  // next pass refills them against the new English rather than keeping the old wording.
  assert.strictEqual(UI.en['prov.by'], 'User: {user}', 'the author line is labelled');
  assert.strictEqual(UI.en['prov.from'], 'Source', 'and the origin line is labelled');
  const stale = Object.keys(UI).filter(l => l !== 'en' &&
    ('prov.by' in UI[l] || 'prov.from' in UI[l]));
  assert.deepStrictEqual(stale, [],
    'no language still holds a translation of the OLD wording — they were dropped for refill');
}

console.log('unit-model-settings: ALL PASSED');
