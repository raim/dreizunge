// unit-reasoning-toggle.test.js
// v60.7 — per-role reasoning ("thinking") toggle. Story and lessons can opt into reasoning; QC and
// translation never do. OFF by default (safe: avoids the empty-response/timeout failures a
// reasoning model hits on a small budget). When a role is ON, thinkOpts flips think:true AND bumps
// that call's token budget + timeout so the answer survives the <think> block. Contract:
//   • thinkOpts(role, base): off → {think:false, tokens:base}; on → {think:true, tokens:base*MULT,
//     timeoutMs: globalTimeout*MULT}.
//   • callLLMLesson applies the lessons policy centrally (all 6 lesson sites covered at once).
//   • story generation resolves via thinkOpts('story', …).
//   • setRuntimeModels accepts think:{story?,lessons?} (booleans only), currentModels exposes it.
//   • /api/models accepts a think-only POST (no model/timeout needed) and rejects a truly empty one.
//   • llm.js _callOllama sends think when it's a boolean (true OR false).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const llm = fs.readFileSync(path.join(ROOT, 'llm.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function extFn(src, name) {
  const at = src.indexOf('function ' + name + '(');
  assert.ok(at >= 0, `found ${name}`);
  const b = src.indexOf('{', at);
  let d = 0, i = b;
  for (; i < src.length; i++) { const c = src[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(at, i);
}

// ── 1. thinkOpts behavior (extracted, real) ───────────────────────────────────
{
  const OLLAMA_THINK = { story: false, lessons: false };
  const getRequestTimeout = () => 720000;
  const thinkOpts = new Function('OLLAMA_THINK', 'getRequestTimeout', 'THINK_TOKEN_MULT', 'THINK_TIMEOUT_MULT',
    extFn(server, 'thinkOpts') + '\nreturn thinkOpts;')(OLLAMA_THINK, getRequestTimeout, 2.5, 3);

  assert.deepStrictEqual(thinkOpts('story', 1200), { think: false, tokens: 1200 },
    'OFF → think:false, budget unchanged (safe default)');
  OLLAMA_THINK.story = true;
  const on = thinkOpts('story', 1200);
  assert.strictEqual(on.think, true, 'ON → think:true');
  assert.strictEqual(on.tokens, 3000, 'ON → tokens ×2.5 (1200→3000)');
  assert.strictEqual(on.timeoutMs, 2160000, 'ON → timeout ×3 (720s→2160s)');
  OLLAMA_THINK.story = false;
  assert.strictEqual(thinkOpts('story', 1200).think, false, 'toggling back OFF restores think:false');
  // A role that's never on (translation/qc aren't in OLLAMA_THINK) is treated as off.
  assert.strictEqual(thinkOpts('translation', 500).think, false, 'unknown/never-on role → off');
}
console.log('  thinkOpts: off=safe, on=think:true + bumped tokens & timeout: OK');

// ── 2. Wiring: story uses thinkOpts; callLLMLesson applies it centrally ────────
{
  const storyCall = server.slice(server.indexOf('const storySystem = sysStory('), server.indexOf('story = text.trim();'));
  assert.ok(/thinkOpts\('story', _baseStoryTokens\)/.test(storyCall), 'story call resolves reasoning via thinkOpts');
  const cll = extFn(server, 'callLLMLesson');
  assert.ok(/thinkOpts\('lessons', maxTokens\)/.test(cll),
    'callLLMLesson applies the lessons policy centrally (all 6 lesson sites covered at once)');
  assert.ok(/_callLLM\(OLLAMA_LESSON_MODEL, system, userMsg, pol\.tokens, \{ \.\.\.pol, \.\.\.opts \}\)/.test(cll),
    'callLLMLesson passes the bumped token budget + think, caller opts win last');
  // QC/translation are NOT given the toggle — they stay non-thinking.
  assert.ok(/callLLMQC\(sys, story,[\s\S]{0,80}\{ think: false \}\)/.test(server), 'story-QC stays think:false');
}
console.log('  wiring: story thinkOpts, callLLMLesson central policy, QC unchanged: OK');

// ── 3. Config: setRuntimeModels / currentModels ───────────────────────────────
{
  const srm = extFn(server, 'setRuntimeModels');
  assert.ok(/next\.think && typeof next\.think === 'object'/.test(srm), 'setRuntimeModels accepts think:{}');
  assert.ok(/typeof next\.think\.story === 'boolean'/.test(srm) && /typeof next\.think\.lessons === 'boolean'/.test(srm),
    'only boolean story/lessons think flags are applied (no other roles)');
  const cm = extFn(server, 'currentModels');
  assert.ok(/think: \{ story: OLLAMA_THINK\.story, lessons: OLLAMA_THINK\.lessons \}/.test(cm),
    'currentModels exposes think state to the client');
}
console.log('  config: setRuntimeModels applies think, currentModels exposes it: OK');

// ── 4. /api/models accepts a think-only POST ──────────────────────────────────
{
  const route = server.slice(server.indexOf("url.pathname === '/api/models'", server.indexOf("M === 'POST'")),
                             server.indexOf('return json(res, 200, { ok: true, active: activeModels }'));
  assert.ok(/const hasThink = body\.think && typeof body\.think === 'object'/.test(route),
    'a think change is detected');
  assert.ok(/!requested\.length && !hasTimeout && !hasThink/.test(route),
    'the "nothing to set" guard now includes think (so a think-only POST is accepted)');
  assert.ok(/\(requested\.length \|\| hasThink\) \? setRuntimeModels\(body\) : currentModels\(\)/.test(route),
    'a think-only POST still runs setRuntimeModels');
}
console.log('  /api/models: think-only POST accepted, empty POST still rejected: OK');

// ── 5. llm.js sends think for a boolean (true OR false) ───────────────────────
{
  assert.ok(/opts && typeof opts\.think === 'boolean' \? \{ think: opts\.think \} : \{\}/.test(llm),
    '_callOllama emits think when it is a boolean (v60.7: true enables, false disables)');
  assert.ok(/Number\.isFinite\(Number\(opts\.timeoutMs\)\)/.test(llm), 'per-call timeoutMs override honored (the bump)');
}
console.log('  llm.js: boolean think + per-call timeout override: OK');

// ── 6. Client menu: per-role checkboxes + switchThink ─────────────────────────
{
  const rmp = html.slice(html.indexOf('const thinkChk'), html.indexOf("`<span class=\"bmodel-field\"><label>${escHtml(t('models.timeout'))}"));
  assert.ok(/onchange="switchThink\('\$\{role\}',this\.checked\)"/.test(rmp), 'checkbox calls switchThink');
  assert.ok(/\(role==='story'\|\|role==='lessons'\)/.test(html), 'the checkbox is only rendered for story + lessons');
  const st = extFn(html, 'switchThink');
  assert.ok(/role!=='story' && role!=='lessons'/.test(st), 'switchThink guards to story|lessons only');
  assert.ok(/body\.think\[role\]=!!on/.test(st), 'switchThink posts think:{role:bool}');
  assert.ok(/renderModelPicker\(\)/.test(st), 'switchThink re-renders from the server state');
  const ui = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
  for (const k of ['models.think_hint', 'models.think_on', 'models.think_off']) assert.ok(ui.en[k], `ui.json en has ${k}`);
}
console.log('  client: story+lessons checkboxes, switchThink, i18n: OK');

console.log('unit-reasoning-toggle: ALL PASSED');
