// unit-lang-menu-coverage.test.js
// v76_b — every language in languages.json must be offered in BOTH language menus.
//
// User-reported: `sr` and `hr` were added to `languages.json` in v75_g — they resolved, they got a
// script table, they got TTS codes, they passed every existing test — and they did not appear in
// either drop-down, because the menus are hand-written <option> markup in index.html rather than
// generated from the data. Adding a language was a TWO-file change and only one file had a guard.
//
// Why a test rather than generating the options: the two menus are deliberately ordered
// differently (`lang-select` leads with Italian, `src-lang-select` with English), so generating
// them from `languages.json` would silently reorder a user-visible menu. Generation is the better
// end state and is noted in the roadmap; this guard is what makes the duplication safe meanwhile,
// and it would keep working if the markup were later replaced by generation.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./lib-dom');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const codes = Object.keys(LANGS).filter(k => !k.startsWith('_'));

assert.ok(codes.length >= 25,
  `languages.json parsed ${codes.length} codes — too few for this check to mean anything`);

const MENUS = ['src-lang-select', 'lang-select'];
for (const id of MENUS) {
  const m = new RegExp('<select[^>]*id="' + id + '"[^>]*>([\\s\\S]*?)</select>').exec(html);
  assert.ok(m, `the #${id} menu exists in index.html`);
  const opts = [...m[1].matchAll(/<option value="([^"]+)"/g)].map(x => x[1]);

  // Non-vacuity, evaluated on the option list the assertions below actually run against: if the
  // markup changed shape and this stopped matching options, "nothing is missing" would be true of
  // an empty list.
  assert.ok(opts.length >= 25,
    `#${id} yielded ${opts.length} options — the markup shape changed and this check is now blind`);

  const missing = codes.filter(c => !opts.includes(c));
  assert.deepStrictEqual(missing, [],
    `#${id} offers every language in languages.json; missing: ${missing.join(', ')}`);

  // The reverse, too: an option for a language that no longer exists in the data would render a
  // dead entry that selects a language the app cannot resolve.
  const known = new Set(codes);
  const SPECIAL = new Set(['all']);   // the 🌐 "any language" filter entry
  const orphans = opts.filter(o => !known.has(o) && !SPECIAL.has(o));
  assert.deepStrictEqual(orphans, [],
    `#${id} offers no language absent from languages.json; orphans: ${orphans.join(', ')}`);
}

// Every offered language needs the fields the menu and the app read off it. `names` is NOT required
// — it falls back to `name`, and a newly added language legitimately has only `names.en` until the
// translate pass runs (v76_b: `sr`/`hr` are in exactly that state).
for (const c of codes) {
  const e = LANGS[c];
  assert.ok(e && typeof e.name === 'string' && e.name,
    `${c} has a display name (the fallback every menu label resolves through)`);
  assert.ok(typeof e.flag === 'string' && e.flag, `${c} has a flag for the menu label`);
  assert.ok(typeof e.tts === 'string' && /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(e.tts),
    `${c} has a well-formed TTS code (got ${JSON.stringify(e.tts)})`);
}

console.log(`  ${codes.length} languages, both menus: none missing, none orphaned`);
console.log('  every language has name, flag and a well-formed tts code');


// ── v76_b: `--langnames` must not destroy languages.json ─────────────────────────────────────
// The mode fills the `names` matrix (32x32 = 1024 cells; 151 were empty when it was written, and
// not only for the new `sr`/`hr` — the `lb` column had been empty since Luxembourgish was added).
// It re-emits the file rather than JSON.stringify-ing it, because stringify reflows 67 hand-written
// lines into ~1100 and makes every later diff unreadable. That serializer writes a file the app
// cannot start without, so it is pinned here: same data in, same data out, same shape.
{
  const src = fs.readFileSync(path.join(ROOT, 'translate-ui.js'), 'utf8');
  const m = /function _serializeLangs\(obj\) \{[\s\S]*?\n\}/.exec(src);
  assert.ok(m, 'translate-ui.js still defines _serializeLangs (the --langnames writer)');
  const serialize = new Function('return ' + m[0])();

  const before = fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8');
  const out = serialize(JSON.parse(before));

  let reparsed;
  assert.doesNotThrow(() => { reparsed = JSON.parse(out); },
    're-emitted languages.json is valid JSON');
  assert.strictEqual(JSON.stringify(reparsed), JSON.stringify(JSON.parse(before)),
    're-emitting languages.json changes no data — every code, name, flag, tts and names cell survives');
  assert.strictEqual(out.split('\n').length, before.split('\n').length,
    'and keeps the hand-written line shape (a reflow makes every future diff unreadable)');
  // Non-vacuity: a serializer that returned its input unchanged would pass all three above.
  const grown = JSON.parse(before);
  grown[codes[0]].names = { ...grown[codes[0]].names, zz: 'Testish' };
  assert.ok(serialize(grown).includes('"zz":"Testish"'),
    'the serializer actually emits added names — otherwise the checks above prove nothing');
}
console.log('  --langnames serializer round-trips languages.json without reflowing it');
console.log('unit-lang-menu-coverage: ALL PASSED');
