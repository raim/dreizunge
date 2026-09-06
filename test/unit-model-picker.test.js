// Model-picker client wiring (increment 3). The picker is a LIVE-only feature (needs the
// server's /api/models), so it must live inside the @static-exclude region and never be
// referenced from the static build. This guards its presence, its wiring, and its correct
// placement, plus the en-only i18n keys — all headlessly (the DOM behavior itself is LIVE-TEST §59).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const ui = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ui.json'), 'utf8'));

// ── The picker markup + functions exist ─────────────────────────────────────────
assert.ok(/id="bmodels"/.test(html), 'backend row has the #bmodels picker container');
assert.ok(/async function renderModelPicker\(\)/.test(html), 'renderModelPicker defined');
assert.ok(/async function switchModel\(role, ?model\)/.test(html), 'switchModel defined');

// ── Wiring: gated on ollama, talks to /api/models, re-renders the pill ───────────
const rmp = html.slice(html.indexOf('async function renderModelPicker()'),
                       html.indexOf('async function switchModel('));
assert.ok(/APP\.info\.backend\s*!==\s*'ollama'/.test(rmp), 'renderModelPicker gates on an ollama backend');
assert.ok(/fetch\('\/api\/models'\)/.test(rmp), 'renderModelPicker GETs /api/models');
assert.ok(/onchange="switchModel\(/.test(rmp), 'each role select calls switchModel on change');
assert.ok(/models\.story/.test(rmp) && /models\.lessons/.test(rmp) && /models\.translation/.test(rmp) && /models\.qc/.test(rmp),
  'renderModelPicker renders all four per-role selectors (incl. QC)');

const sw = html.slice(html.indexOf('async function switchModel('),
                      html.indexOf('async function switchModel(') + 900);
assert.ok(/method:'POST'/.test(sw) && /'\/api\/models'/.test(sw), 'switchModel POSTs /api/models');
assert.ok(/renderPill\(\)/.test(sw), 'switchModel re-renders the pill after a switch');

// init() wires the picker in.
assert.ok(/renderPill\(\);\s*\n\s*renderModelPicker\(\);/.test(html), 'init() calls renderModelPicker after renderPill');

// ── It must sit INSIDE the static-exclude region (live-only), and the static build
//    must not reference it (its only caller, the live init(), is excluded too). ───
const lines = html.split('\n');
const lineOf = (marker) => lines.findIndex(l => l.trim().startsWith(marker));
const exclStart = lineOf('// @static-exclude-start');
const exclEnd   = lineOf('// @static-exclude-end');
const rmpLine   = lines.findIndex(l => l.includes('async function renderModelPicker()'));
const swLine    = lines.findIndex(l => l.includes('async function switchModel('));
assert.ok(exclStart >= 0 && exclEnd > exclStart, 'exclude markers present and ordered');
assert.ok(rmpLine > exclStart && rmpLine < exclEnd, 'renderModelPicker is inside the static-exclude region (live-only)');
assert.ok(swLine  > exclStart && swLine  < exclEnd, 'switchModel is inside the static-exclude region (live-only)');

// If a built static page exists, it must NOT reference the live-only picker functions.
const docsPath = path.join(__dirname, '..', 'docs', 'index.html');
if (fs.existsSync(docsPath)) {
  const docs = fs.readFileSync(docsPath, 'utf8');
  assert.ok(!/renderModelPicker|switchModel\(/.test(docs),
    'static build must not reference the live-only picker functions');
  assert.ok(/id="bmodels"/.test(docs), 'static build keeps the (hidden) container markup — harmless');
}

// ── en-only i18n keys present ───────────────────────────────────────────────────
const en = ui.en || ui;
for (const k of ['models.story', 'models.lessons', 'models.translation', 'models.qc', 'models.switched', 'models.switch_failed',
                 'models.timeout', 'models.timeout_hint', 'models.timeout_set',
                 'models.warn.weak', 'models.warn.roles_story_lessons', 'models.warn.roles_lessons', 'models.warn.roles_story']) {
  assert.ok(typeof en[k] === 'string' && en[k], `ui.json en has ${k}`);
}

// ── Timeout input + switchTimeout wiring ─────────────────────────────────────────
assert.ok(/id="bmodel-timeout"/.test(rmp), 'picker renders the timeout input');
assert.ok(/onchange="switchTimeout\(this\.value\)"/.test(rmp), 'timeout input calls switchTimeout');
assert.ok(/async function switchTimeout\(sec\)/.test(html), 'switchTimeout defined');
{
  const st = html.slice(html.indexOf('async function switchTimeout('), html.indexOf('async function switchTimeout(') + 600);
  assert.ok(/timeoutMs:\s*ms/.test(st) && /'\/api\/models'/.test(st), 'switchTimeout POSTs timeoutMs to /api/models');
  assert.ok(/parseFloat\(sec\)\s*\*\s*1000/.test(st), 'switchTimeout converts seconds → ms');
}

// ── Generate-time model-suitability warning ──────────────────────────────────────
assert.ok(/function modelSuitabilityWarning\(lang, uploaded\)/.test(html), 'modelSuitabilityWarning defined');
assert.ok(/LOW_RESOURCE_TARGET_LANGS = new Set\(\['lb'\]\)/.test(html), 'low-resource target set seeded with lb');
{
  const mw = html.slice(html.indexOf('function modelSuitabilityWarning'), html.indexOf('function modelSuitabilityWarning') + 900);
  assert.ok(/isTranslategemmaModel\(APP\.info\.ollamaLessonModel\)/.test(mw), 'checks the lessons role');
  assert.ok(/uploaded/.test(mw) && /ollamaModel/.test(mw), 'skips the story role when the learner uploaded a story');
  // ⚠️ v90_b: what stood here called itself "replay the helper logic" and was not a replay — it
  // defined its OWN copy of the decision table, four lines of it, and asserted against the copy.
  // The app's modelSuitabilityWarning was never called, so emptying its body to `return ''` left
  // all 360 checks green while the warning silently stopped firing. Found by the mutation audit
  // (the same shape turned up in unit-word-count). Lift the REAL function and run it.
  const _mwSrc = html.slice(html.indexOf('const LOW_RESOURCE_TARGET_LANGS'),
                            html.indexOf('async function doGenerate('));
  const _mkWarn = new Function('APP', 't', 'localizedLangName',
    _mwSrc + '\nreturn modelSuitabilityWarning;');
  // t() is stubbed to echo its key, so the returned string names the roles branch that was taken —
  // the assertions below read the app's decision, not a re-statement of it.
  const warn = (lang, uploaded, story, lessons) => {
    const APP = { info: { backend: 'ollama', ollamaModel: story, ollamaLessonModel: lessons }, uiLang: 'en' };
    const t = (k, vars) => (k === 'models.warn.weak' ? vars.roles : k);
    const out = _mkWarn(APP, t, () => lang)(lang, uploaded);
    return out === '' ? '' : ({ 'models.warn.roles_story_lessons': 'story+lessons',
                                'models.warn.roles_lessons': 'lessons',
                                'models.warn.roles_story': 'story' }[out] || ('UNMAPPED:' + out));
  };
  assert.strictEqual(warn('lb', false, 'qwen2.5:7b', 'qwen2.5:7b'), 'story+lessons', 'lb + qwen both → warn story+lessons');
  assert.strictEqual(warn('lb', false, 'translategemma', 'translategemma'), '', 'lb + translategemma both → no warning');
  assert.strictEqual(warn('lb', true, 'qwen2.5:7b', 'qwen2.5:7b'), 'lessons', 'lb uploaded → only lessons matters');
  assert.strictEqual(warn('de', false, 'qwen2.5:7b', 'qwen2.5:7b'), '', 'major target → no warning');
  assert.strictEqual(warn('lb', false, 'qwen2.5:7b', 'translategemma'), 'story', 'weak story model alone → story');
  // the backend gate — a branch the hand-written copy did not have at all
  {
    const t = (k, vars) => (k === 'models.warn.weak' ? vars.roles : k);
    const off = _mkWarn({ info: { backend: 'lmstudio', ollamaModel: 'qwen2.5:7b', ollamaLessonModel: 'qwen2.5:7b' } },
                        t, () => 'lb')('lb', false);
    assert.strictEqual(off, '', 'a non-ollama backend is never warned about (the model names are not ours)');
  }
}
// It fires at generate time, non-blocking.
assert.ok(/const _w = modelSuitabilityWarning\(APP\.lang,/.test(html), 'warning computed inside doGenerate from APP.lang');
assert.ok(/if\(_w\) showToast\(_w\)/.test(html), 'warning shown as a non-blocking toast');

// ── switchTimeout actually sends the seconds it was given ────────────────────────
// ⚠️ v90_b: the three checks above are source text — the input is wired, the function is declared,
// and the strings `timeoutMs: ms` and `parseFloat(sec)*1000` appear near it. None of them runs the
// conversion: the mutation `sec = 999` at the top of the body left all 360 checks green, so the
// learner's timeout would have been silently replaced by a constant. Run it against a stub fetch.
// Async, and therefore LAST — this file is CommonJS with no top-level await, so the closing log
// lives inside the IIFE rather than printing before these assertions have settled.
(async () => {
  const _ext = (name) => {
    const at = html.indexOf(name); assert.ok(at >= 0, 'missing fn ' + name);
    const b = html.indexOf('{', at); let d = 0, i = b;
    for (; i < html.length; i++) { if (html[i] === '{') d++; else if (html[i] === '}') { d--; if (!d) { i++; break; } } }
    return html.slice(at, i);
  };
  const run = async (typed, reply = { active: { timeoutMs: 45000 } }, ok = true) => {
    const sent = []; const toasts = []; const APP = { info: {} };
    const fetchStub = async (url, opts) => { sent.push({ url, body: JSON.parse(opts.body) });
      return { ok, json: async () => reply }; };
    const fn = new Function('fetch', 'APP', 't', 'showToast',
      _ext('async function switchTimeout(sec)') + '\nreturn switchTimeout;')(
      fetchStub, APP, (k) => k, (m) => toasts.push(m));
    await fn(typed);
    return { sent, toasts, APP };
  };

  const r = await run('90');
  assert.strictEqual(r.sent.length, 1, 'a typed timeout posts once');
  assert.strictEqual(r.sent[0].url, '/api/models', 'to the models endpoint');
  assert.deepStrictEqual(r.sent[0].body, { timeoutMs: 90000 }, 'seconds converted to ms, not a constant');

  const half = await run('2.5');
  assert.deepStrictEqual(half.sent[0].body, { timeoutMs: 2500 }, 'a fractional value is not truncated to seconds');

  const bad = await run('abc');
  assert.deepStrictEqual(bad.sent, [], 'a non-number never reaches the server');

  assert.strictEqual(r.APP.info.ollamaTimeoutMs, 45000,
    "the server's answer, not the typed value, updates APP.info");
  assert.deepStrictEqual(r.toasts, ['models.timeout_set'], 'and it confirms');

  const failed = await run('90', { error: 'nope' }, false);
  assert.deepStrictEqual(failed.toasts, ['nope'], "a rejected change reports the server's reason");

  console.log('  switchTimeout converts and sends the value it was given: OK');
  console.log('  timeout input + switchTimeout + suitability warning: OK');
})();
