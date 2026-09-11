// unit-bar-toggles.test.js
// v90_x — every control in the bottom bar opens AND closes from its own button, and the two modals
// close on a backdrop press.
//
// ⚠️ USER REQUEST, and the inconsistency it names is real: the jobs pill has toggled since it was
// built (`toggleJobsPop`) and the tutor widget toggles too, but login and settings only ever
// OPENED — pressing the pill again re-opened an already-open modal, which does nothing visible and
// reads as a dead button. And the tutor FAB HID itself while its widget was open, so the tutor was
// the one bar control you could not press twice.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const client = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const flat = client.replace(/\s+/g, ' ');

function ext(name) {
  let at = client.indexOf('\nfunction ' + name + '(') + 1;
  if (at < 1) at = client.indexOf('\nasync function ' + name + '(') + 1;
  assert.ok(at >= 1, `found ${name}`);
  const b = client.indexOf('{', at);
  let d = 0, i = b;
  for (; i < client.length; i++) { if (client[i] === '{') d++; else if (client[i] === '}') { d--; if (!d) { i++; break; } } }
  return client.slice(at, i);
}

// ── 1. The two pills invoke TOGGLES, not openers ─────────────────────────────
{
  assert.ok(/id="acct-btn" onclick="toggleAccount\(\)"/.test(flat),
    'the login pill toggles (it called openAccount(), which could only ever open)');
  assert.ok(/id="settings-pill" onclick="toggleSettings\(\)"/.test(flat),
    'the settings pill toggles');
  // ⚠️ And the jobs pill, which already did — pinned so a later tidy-up cannot make it the odd one.
  assert.ok(/id="jobs-pill" onclick="toggleJobsPop\(event\)"/.test(flat),
    'the jobs pill still toggles, as it always has');
  console.log('  login, settings and jobs all open AND close from their own pill: OK');
}

// ── 2. ⚠️ THE TOGGLES WRAP THE OPENERS, THEY DO NOT REPLACE THEM ─────────────
// `openAccount`/`openSettings` do real setup on every open — the TLS warning, the overrule-language
// checkbox sync, the answer-check row — and both are still called programmatically after login and
// logout. Reimplementing the open inside a toggle would have silently dropped that setup.
{
  for (const [t, open, close] of [['toggleAccount', 'openAccount', 'closeAccount'],
                                  ['toggleSettings', 'openSettings', 'closeSettings']]) {
    const body = ext(t);
    assert.ok(body.includes(open + '()'), `${t} delegates to ${open}`);
    assert.ok(body.includes(close + '()'), `${t} delegates to ${close}`);
  }
  assert.ok(/function openAccount\(\)/.test(client) && /function openSettings\(\)/.test(client),
    'both openers still exist, unrenamed');
  // The setup work is still inside the opener, which is what makes the delegation worth having.
  assert.ok(/acct-tls-warn/.test(ext('openAccount')), 'openAccount still does its TLS-warning setup');
  assert.ok(/overrule-sl-lang-cb/.test(ext('openSettings')), 'openSettings still syncs its checkbox');
  console.log('  the toggles delegate; the openers keep their per-open setup: OK');
}

// ── 3. ⚠️ THE BACKDROP TEST IS `target === currentTarget`, AND IT MATTERS ────
// The backdrop IS the modal element, so a press that originated on the card — or on any control
// inside it — has a different target and must be ignored. Without that test, typing a password and
// pressing a button inside the card would dismiss the dialog.
{
  assert.ok(/id="acct-modal" onclick="modalBackdropClose\(event, closeAccount\)"/.test(flat),
    'the account modal closes on a backdrop press');
  assert.ok(/id="settings-modal" onclick="modalBackdropClose\(event, closeSettings\)"/.test(flat),
    'the settings modal too');
  const body = ext('modalBackdropClose');
  assert.ok(/e\.target === e\.currentTarget/.test(body),
    '⚠️ and only when the press ORIGINATED on the backdrop — otherwise a click inside the card closes it');
  // Driven, not just read: prove both branches.
  const fn = new Function(ext('modalBackdropClose') + '\nreturn modalBackdropClose;')();
  let closed = 0; const closer = () => closed++;
  const backdrop = {};
  fn({ target: backdrop, currentTarget: backdrop }, closer);
  assert.strictEqual(closed, 1, 'a press on the backdrop closes');
  fn({ target: {}, currentTarget: backdrop }, closer);
  assert.strictEqual(closed, 1, 'a press that bubbled up from the card does NOT close');
  fn(null, closer);
  assert.strictEqual(closed, 1, 'and a missing event is a no-op rather than a throw');
  console.log('  backdrop closes, card does not, missing event is safe: OK');
}

// ── 4. ⚠️ THE TUTOR FAB STAYS VISIBLE WHILE ITS WIDGET IS OPEN ──────────────
// It used to hide itself, leaving the widget with only its own ✕ and making the tutor the one bar
// control you could not press twice.
{
  const body = ext('refreshTutorAvailability');
  assert.ok(!/fab\.style\.display\s*=\s*_tutorState\.open\s*\?/.test(body),
    '⚠️ the FAB is no longer hidden on open — that is the whole change');
  assert.ok(/fab\.style\.display\s*=\s*''/.test(body),
    'it is shown whenever the tutor is available at all');
  // The widget itself still follows the open state — the FAB and the widget are not the same thing.
  assert.ok(/w\.style\.display\s*=\s*_tutorState\.open \? 'flex' : 'none'/.test(body),
    'while the WIDGET still opens and closes with the state');
  // And the unavailable case still hides both, so a backend-less build shows no tutor at all.
  assert.ok(/if\(!ok\)\{ fab\.style\.display='none'; w\.style\.display='none'; return; \}/.test(body.replace(/\s+/g, ' ')),
    'with no backend, both are still hidden — the FAB must not become unconditionally visible');
  console.log('  the tutor FAB stays visible when open, and still hides with no backend: OK');
}

console.log('unit-bar-toggles: ALL PASSED');
