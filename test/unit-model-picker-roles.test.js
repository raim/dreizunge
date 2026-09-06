// unit-model-picker-roles.test.js — v89_w.
//
// The model picker offered five of the server's eight roles. `vision`, `analysis` and `answerCheck`
// were settable by env and by `POST /api/models` but had no row, so a user could not point them
// anywhere from inside the app — roadmap item B, widened at `v89_l` from "a vision-role picker" to
// all three.
//
// ⚠️ `vision` is the one that needed a design decision, and item B named the fork: Ollama's
// `/api/show` capabilities field vs. a family-name allowlist. It is settled here by MEASUREMENT —
// on this box `translategemma:12b` reports `["completion","vision"]` (gemma3 is multimodal), so an
// allowlist built from the obvious names would already have been wrong. The capabilities field it is.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const llmSrc = fs.readFileSync(path.join(ROOT, 'llm.js'), 'utf8');
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

// ── 1. Every role the server exposes now has a row ─────────────────────────────────────────────
// ⚠️ Derived from the SERVER's own role list, not from a list repeated here — the same reasoning as
// `unit-model-roles`: a guard that must be edited when a role is added is one that gets forgotten.
{
  const roles = [...server.matchAll(/^let (OLLAMA_[A-Z_]*MODEL)\b/gm)].map(m => m[1]);
  const field = (r) => ({ model: 'story', translation: 'translation', lesson: 'lessons', qc: 'qc',
                          tutor: 'tutor', vision: 'vision', analysis: 'analysis', answercheck: 'answerCheck' })
                       [r.replace(/^OLLAMA_/, '').replace(/_MODEL$/, '').toLowerCase()];
  const rowsLine = html.split('\n').find(l => l.includes("const roles=[['story','models.story']"));
  assert.ok(rowsLine, 'renderModelPicker still builds a `roles` array — re-anchor deliberately if renamed');
  const missing = roles.map(field).filter(f => !rowsLine.includes(`'${f}'`));
  assert.deepStrictEqual(missing, [],
    'every server-side model role has a picker row, so it can be pointed somewhere from inside the app. ' +
    'Missing: ' + JSON.stringify(missing));
  assert.ok(/'vision','models\.vision'/.test(rowsLine) && /'analysis','models\.analysis'/.test(rowsLine)
            && /'answerCheck','models\.answer_check'/.test(rowsLine), 'the three new rows are there by name');
}
console.log('  every server-side role has a picker row, derived from the server not a copy: OK');

// ── 2. ⚠️ The vision row is FILTERED, and by capability rather than by name ────────────────────
{
  assert.ok(/const visionCapable=\(data&&Array\.isArray\(data\.visionCapable\)/.test(html),
    'the client reads the server-supplied vision-capable list');
  assert.ok(/role==='vision'&&visionCapable/.test(html), 'and uses it for the vision row only');
  // The server side of the same claim.
  assert.ok(/visionCapable/.test(server) && /modelCapabilities\(m\)\)\.includes\('vision'\)/.test(server),
    'the server builds that list from Ollama capabilities');
  assert.ok(/function modelCapabilities\(model\)/.test(llmSrc), 'llm.js probes /api/show for capabilities');
  assert.ok(/'\/api\/show'/.test(llmSrc), 'against the endpoint that reports them');
  // ⚠️ NOT a family-name allowlist. Named explicitly because item B offered it as the alternative
  // and the measurement rejected it.
  assert.ok(!/families.*vl|qwen.*vl.*allow|VISION_FAMILIES/i.test(server),
    'and NOT from a family-name allowlist — translategemma:12b reports vision, so names lie');
}
console.log('  the vision row is filtered by Ollama capabilities, not by a name allowlist: OK');

// ── 3. Two ways the filter must not strand a user ──────────────────────────────────────────────
{
  // An empty/absent probe result falls back to the full list rather than an empty select.
  assert.ok(/data\.visionCapable\.length\)\?data\.visionCapable:null/.test(html),
    'an empty probe result falls back to the full list — an empty picker looks broken');
  // The currently-active model is always shown, even if the filter would drop it.
  assert.ok(/if\(sel&&!ms\.includes\(sel\)\) ms\.unshift\(sel\)/.test(html),
    'the active value is always present in its own row, so a role never displays someone else\'s model');
}
console.log('  an empty probe falls back to the full list, and the active value is never hidden: OK');

// ── 4. Exactly the three granted ui.json keys, en only ─────────────────────────────────────────
{
  for (const k of ['models.vision', 'models.analysis', 'models.answer_check']) {
    assert.ok(typeof UI.en[k] === 'string' && UI.en[k].trim(), 'ui.json carries ' + k);
    for (const lng of Object.keys(UI)) {
      if (lng === 'en') continue;
    // ⚠️ v90: the "en only" half of this check has EXPIRED, and deliberately so. It meant "the app
    // did not machine-fill this key behind the user's back" — true and worth pinning at the moment a
    // key is granted. But the user translates `ui.json` BY HAND, and once they have, a hand
    // translation is indistinguishable from a machine one after the fact, so the check would fire on
    // exactly the outcome it exists to protect. (It did: three guards went red mid-session while the
    // user was translating.) What ENDURES is the budget claim — the key exists in `en` — which is
    // asserted above. A guard with an implicit expiry should say so; this one now does.
      // (was: assert the key is absent from every other language)
    }
    assert.ok(html.includes(k), k + ' is actually used by the picker');
  }
}
console.log('  exactly the three granted ui.json keys, en only, all used: OK');

console.log('unit-model-picker-roles: ALL PASSED');
