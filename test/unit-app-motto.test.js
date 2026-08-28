// unit-app-motto.test.js
// v49: the main-page title is lowercase "dreizunge" and the visible version number is
// replaced by a localized motto (new en-only ui key `app.motto`, rendered slightly
// larger). v49 kept the running version reachable via the motto span's tooltip (title
// attribute); v85_t (user, direct request) removed that too — the version is no longer
// surfaced in the UI at all, in either build. `APP.info.version` itself is unchanged
// (still populated by both builds) — it simply has no client-side reader left.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const staticJs = fs.readFileSync(path.join(root, 'build-static.js'), 'utf8');
const ui = JSON.parse(fs.readFileSync(path.join(root, 'ui.json'), 'utf8'));

// Title is lowercase (landing header + document title).
assert.ok(/<div class="app-name">dreizunge<\/div>/.test(html), 'app-name is lowercase');
assert.ok(/<title>dreizunge<\/title>/.test(html), 'document title is lowercase');
assert.ok(!/>Dreizunge</.test(html.replace(/<!--[\s\S]*?-->/g, '')),
  'no capitalized Dreizunge rendered in markup');

// Motto span replaces the version span; localized via app.motto; bigger than the old 11px.
assert.ok(/id="app-tagline"[^>]*font-size:13px/.test(html), 'motto span exists at 13px');
assert.ok(!/id="app-version"/.test(html), 'old visible version span is gone');
assert.ok(/_setText\('app-tagline', t\('app\.motto'\)\)/.test(html),
  'applyUIStrings localizes the motto');

// ui.json: en present; app.motto is now translated by the user's translate pass (was en-only
// when introduced). Guard that en holds and the bulk of languages carry it.
assert.strictEqual(ui.en['app.motto'], 'we are the world', 'en app.motto value');
const _motLangs = Object.keys(ui).filter(l => l !== 'en');
const _motHave = _motLangs.filter(l => ui[l]['app.motto'] !== undefined).length;
assert.ok(_motHave >= _motLangs.length - 3, 'app.motto translated across (nearly) all languages');

// v85_t: the version tooltip is GONE in both builds — checked as an absence, not just an
// unasserted omission, so a future re-add (echoing v49's own compromise) has to pass here
// deliberately rather than slip back in unnoticed.
assert.ok(!/getElementById\('app-tagline'\).*\.title\s*=/.test(html),
  'server client no longer writes anything into the motto tooltip');
assert.ok(!/getElementById\('app-tagline'\).*\.title\s*=/.test(staticJs),
  'static build no longer writes anything into the motto tooltip');

console.log('  lowercase title + app.motto tagline (version no longer surfaced anywhere): OK');
console.log('unit-app-motto: ALL PASSED');
