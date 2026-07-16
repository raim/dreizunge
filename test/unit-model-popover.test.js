// unit-model-popover.test.js
// v55_o — the model pickers collapse into the backend pill (click → popover).
// Client-only; the real proof is LIVE-TEST §83 (browser). What CAN be asserted headlessly is the
// structural contract — which is where this project's UI bugs have actually lived:
//   • the popover markup exists and #bmodels is INSIDE it (not orphaned in the backend row)
//   • the picker no longer owns visibility via box.style.display (the popover does), so a
//     re-render can't force the popover open/closed underneath the user
//   • renderPill preserves the `clickable` class (it rebuilds className; without this the
//     affordance silently died whenever renderPill ran without renderModelPicker after it)
//   • open/close listeners are symmetric (every addEventListener has a matching remove) — an
//     outside-click listener left attached would fire forever
//   • the pill is only clickable under Ollama (never in the static build, where /api/models 404s)
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const client = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// ── 1. Markup: pill + popover live in one positioned wrapper; #bmodels is inside the popover ──
assert.ok(/id="bpill-wrap"[\s\S]{0,400}id="bmodels-pop"/.test(client), 'the popover lives inside the pill wrapper');
const wrap = client.slice(client.indexOf('id="bpill-wrap"'), client.indexOf('id="bmodel"', client.indexOf('id="bpill-wrap"')));
assert.ok(/id="bpill"/.test(wrap), 'the pill is inside the wrapper (the positioning context)');
assert.ok(/id="bmodels-pop"[\s\S]{0,200}id="bmodels"/.test(wrap), '#bmodels is nested INSIDE #bmodels-pop');
assert.ok(/id="bpill-caret"/.test(wrap), 'the pill carries a caret affordance');
assert.ok(/\.bpill-wrap\{[^}]*position:relative/.test(client), '.bpill-wrap is the positioning context');
assert.ok(/\.bmodels-pop\{[^}]*position:absolute/.test(client), '.bmodels-pop is absolutely positioned');
assert.ok(/@media\(max-width:520px\)\{\.bmodels-pop/.test(client), 'the popover has a small-screen fallback');

// ── 2. The popover owns visibility — the picker must not set box.style.display ───
const rmp = (() => {
  const at = client.indexOf('async function renderModelPicker()');
  assert.ok(at > 0, 'renderModelPicker found');
  const b = client.indexOf('{', at);
  let d = 0, i = b;
  for (; i < client.length; i++) { const c = client[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return client.slice(at, i);
})();
assert.ok(!/box\.style\.display/.test(rmp),
  'renderModelPicker must NOT toggle #bmodels visibility — the popover owns open/closed state');
assert.ok(/closeModelPop\(\)/.test(rmp), 'the picker closes the popover when there is no usable backend');
assert.ok(/setPillClickable\(false\)/.test(rmp) && /setPillClickable\(true\)/.test(rmp),
  'the pill affordance is enabled only when models are actually available');
// Only clickable under Ollama: the non-ollama and fetch-fail paths both disable it.
assert.ok(/backend!=='ollama'\)\{ closeModelPop\(\); box\.innerHTML=''; setPillClickable\(false\)/.test(rmp),
  'no Ollama backend (e.g. static build) → pill not clickable, popover closed');
assert.ok(/catch\(_\)\{ closeModelPop\(\); setPillClickable\(false\); return; \}/.test(rmp),
  'an /api/models failure disables the affordance rather than leaving a dead pill');

// ── 3. renderPill preserves the clickable class (no call-order coupling) ────────
const rp = (() => {
  const at = client.indexOf('function renderPill()');
  const b = client.indexOf('{', at);
  let d = 0, i = b;
  for (; i < client.length; i++) { const c = client[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return client.slice(at, i);
})();
assert.ok(/classList\.contains\('clickable'\)/.test(rp), 'renderPill reads the existing clickable state');
assert.ok(/wasClickable\?' clickable':''/.test(rp), 'renderPill re-applies it when rebuilding className');

// ── 4. Listener symmetry: what is added on open is removed on close ─────────────
const openFn = client.slice(client.indexOf('function openModelPop()'), client.indexOf('function closeModelPop()'));
const closeFn = client.slice(client.indexOf('function closeModelPop()'), client.indexOf('function toggleModelPop('));
for (const [evt, handler] of [['click', '_modelPopOutside'], ['keydown', '_modelPopEsc']]) {
  assert.ok(new RegExp(`addEventListener\\('${evt}',${handler}\\)`).test(openFn), `open adds the ${evt} listener`);
  assert.ok(new RegExp(`removeEventListener\\('${evt}',${handler}\\)`).test(closeFn), `close removes the ${evt} listener`);
}
assert.ok(/setTimeout\(\(\)=>\{ document\.addEventListener\('click',_modelPopOutside\)/.test(openFn),
  'the outside-click listener is attached on the NEXT tick, so the opening click cannot close it');
assert.ok(/wrap && !wrap\.contains\(e\.target\)/.test(client), 'outside-click checks containment against the wrapper');

// ── 5. Switching a role must not be broken by the popover ───────────────────────
// switchModel re-renders pill + picker; neither may force the popover shut (the user is mid-edit).
const sm = client.slice(client.indexOf('async function switchModel(role, model)'), client.indexOf('async function switchTimeout('));
assert.ok(!/closeModelPop\(\)/.test(sm), 'switching a model does NOT close the popover');
assert.ok(/renderPill\(\);/.test(sm) && /renderModelPicker\(\)/.test(sm), 'switching still refreshes the pill + picker');

console.log('  model popover: markup nesting, visibility ownership, class preservation, listener symmetry: OK');
console.log('unit-model-popover: ALL PASSED');
