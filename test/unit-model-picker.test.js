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
assert.ok(/models\.story/.test(rmp) && /models\.lessons/.test(rmp) && /models\.translation/.test(rmp),
  'renderModelPicker renders all three per-role selectors');

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
for (const k of ['models.story', 'models.lessons', 'models.translation', 'models.switched', 'models.switch_failed']) {
  assert.ok(typeof en[k] === 'string' && en[k], `ui.json en has ${k}`);
}

console.log('  model-picker wiring + static-exclusion + i18n keys: OK');
