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
// ⚠️ v91_c: RE-SCOPED, not deleted. This pinned `font-size:13px` — a real v49 ruling, replaced by a
// later user ruling ("decrease font size difference between the title and the subtitle"). Pinning
// one literal size cannot express that: the claim is about the RELATIONSHIP between the two, so it
// is asserted as a relationship and survives the next adjustment without going quiet.
{
  const _title = /\.app-name\{[^}]*font-size:(\d+)px/.exec(html);
  const _motto = /id="app-tagline"[^>]*font-size:(\d+)px/.exec(html);
  assert.ok(_title && _motto, 'both the title and the motto still declare a pixel size');
  const T = Number(_title[1]), M = Number(_motto[1]);
  assert.ok(M > 11, `the motto is bigger than the 11px version span it replaced (v49), got ${M}px`);
  assert.ok(M < T, `the motto stays SMALLER than the title — the hierarchy is reduced, not removed (${M} vs ${T})`);
  assert.ok(T / M < 2.2,
    `the title/motto size gap stays modest (v91_c, user): ratio ${(T / M).toFixed(2)} of a 2.2 ceiling — ` +
    'it was 34/13 = 2.6 when the user asked for it to come down');
}
assert.ok(!/id="app-version"/.test(html), 'old visible version span is gone');
// v91_c (user): "align the colors ... title, more blue, less green, and subtitle, a nice reddish tone".
{
  const _name = /\.app-name\{[^}]*\}/.exec(html);
  assert.ok(_name, '.app-name rule exists');
  assert.ok(/color:var\(--globe-blue\)/.test(_name[0]),
    'the title uses --globe-blue — the ocean colour SAMPLED from the rendered 🌍, so the title and ' +
    'the icon are the same blue rather than merely both bluish');
  assert.ok(!/color:var\(--green/.test(_name[0]), 'and no longer green — the half of the request a colour change alone could miss');
  const _tag = /id="app-tagline"[^>]*/.exec(html)[0];
  assert.ok(/color:var\(--red-soft\)/.test(_tag), 'the motto is the soft red, not the warning red');
  assert.ok(!/opacity:/.test(_tag), 'and carries no opacity — that washed the colour out to grey');
  assert.ok(/--red-soft:#[0-9a-f]{6}/i.test(html), '--red-soft is defined in the palette, not inlined as a raw hex');
  assert.ok(/--globe-blue:#[0-9a-f]{6}/i.test(html), 'and so is --globe-blue');
  // ⚠️ The globe has NO red, so the motto colour cannot be sampled and is derived instead — the
  // comment above the palette records both facts. Guard that the two are DIFFERENT colours, which is
  // the one thing a copy-paste slip would break silently.
  const _gb = /--globe-blue:(#[0-9a-f]{6})/i.exec(html)[1].toLowerCase();
  const _rs = /--red-soft:(#[0-9a-f]{6})/i.exec(html)[1].toLowerCase();
  assert.notStrictEqual(_gb, _rs, 'title and motto are distinct colours');
  assert.ok(parseInt(_gb.slice(5,7),16) > parseInt(_gb.slice(1,3),16), 'the title colour is blue-dominant (B > R)');
  assert.ok(parseInt(_rs.slice(1,3),16) > parseInt(_rs.slice(5,7),16), 'and the motto colour is red-dominant (R > B)');
}
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
