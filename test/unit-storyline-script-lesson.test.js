// unit-storyline-script-lesson.test.js
// v79_h (user report): "script lesson is not offered for 'add lessons' on an english->arabian
// storyline (sl_1567412712)".
//
// The gate was not wrong — the row did not exist. `scriptLessonAvailableForSet` answers TRUE for
// that storyline's chapters (lang `en`, srcLang `ar`: a Latin course for an Arabic reader, which is
// the case the v53 comment on that function describes). The per-chapter "add lesson" dropdown asks
// it and offers the option. The STORYLINE-level form renders from `ADD_LESSON_TYPES`, and
// `intro_script` was simply absent from that array — so no storyline could ever offer it, whatever
// its languages.
//
// It was absent on the SERVER too: `ARC_LESSON_TYPES` is the whitelist `sanitizeArcTypes` filters
// a storyline run against, and `intro_script` was not in it. Had only the client been fixed, the
// tick would have been dropped server-side with no error and the run would have quietly produced
// nothing — the silent-empty shape INTERNALS is full of. Both halves are asserted here, because
// either alone leaves the feature broken in a way that looks like success.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const SCRIPTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts.json'), 'utf8'));
const STORE = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const SERVER = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

// The reported storyline, taken from the corpus rather than invented — if it is ever removed the
// section says so instead of quietly testing a hypothetical.
const SL = (STORE.storylines || []).find(s => s.id === 'sl_1567412712');
const byId = Object.fromEntries(STORE.topics.filter(t => t.id).map(t => [t.id, t]));
const REPORTED = SL ? (SL.chapters || []).map(c => byId[c]).find(Boolean) : null;
assert.ok(REPORTED, 'the reported storyline sl_1567412712 is still in the corpus');
assert.strictEqual(REPORTED.lang, 'en', 'its chapters are learning English');
assert.strictEqual(REPORTED.srcLang, 'ar', 'from Arabic — the pair in the report');

function client() {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
         SCRIPTS_DATA = ${JSON.stringify(SCRIPTS)}; APP.srcLang = 'de'; true;`, 'seed');
  return C;
}
// Render the tick-list the storyline form uses, through the product function, and report the values
// it offers.
const offered = (C, opts) => JSON.parse(C.run(
  `(function(){ var el = document.getElementById('lt-pick-list');
     renderLessonTypeChecks(el, Object.assign({ cls:'lt-pick', checked:['standard'] }, ${JSON.stringify(opts || {})}));
     return JSON.stringify(Array.from(el.querySelectorAll('input')).map(function(i){ return i.value; }));
   })()`, 'render'));

// ── 1. The gate was always right — the row was missing ────────────────────────────────────────
{
  const C = client();
  const avail = C.run(`scriptLessonAvailableForSet(${JSON.stringify({
    lang: REPORTED.lang, srcLang: REPORTED.srcLang,
    script: REPORTED.script || null, srcScript: REPORTED.srcScript || null })})`);
  assert.strictEqual(avail, true,
    'scriptLessonAvailableForSet says this storyline DOES want a script course — the gate was '
    + 'never the bug, so a fix that changed it would have been the wrong fix');
}

// ── 2. The storyline form offers it for this storyline ────────────────────────────────────────
{
  const C = client();
  const vals = offered(C, { hasScript: true });
  assert.ok(vals.includes('intro_script'),
    `the storyline "add lessons" form offers the script lesson (got ${vals.join(', ')})`);
  // Non-vacuity: the list really is the shared one, not an empty container.
  assert.ok(vals.includes('standard') && vals.includes('grammar'),
    'and still offers the ordinary types');
}

// ── 3. It is HIDDEN when the languages do not call for it ─────────────────────────────────────
// Offering it for, say, de→en would produce a lesson with no script to teach. The row is gated,
// not merely added.
{
  const C = client();
  const vals = offered(C, { hasScript: false });
  assert.ok(!vals.includes('intro_script'),
    'and hides it when the set does not need a script course');
  assert.ok(vals.includes('standard'), 'without hiding anything else');
  // An UNASKED gate must not hide the row: a caller that knows nothing about scripts keeps its old
  // behaviour rather than silently losing an option.
  const unasked = offered(client(), {});
  assert.ok(unasked.includes('intro_script'),
    'an absent hasScript is "not asked", not "no" — the story gate above behaves the same way');
}

// ── 4. The caller actually ASKS, about a chapter of this storyline ────────────────────────────
// Section 2 proves the form CAN offer it. This proves the storyline handler passes the answer,
// rather than the option being permanently on.
{
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const fn = html.slice(html.indexOf('async function recreateStorylineLessons('),
                        html.indexOf('async function deleteCurrentStoryline('));
  assert.ok(fn.length > 0, 'found the storyline add-lessons handler');
  assert.ok(/_pickLessonTypes\([\s\S]{0,200}?hasScript:/.test(fn),
    'the storyline handler tells the picker whether this storyline needs a script course');
  assert.ok(/scriptLessonAvailableForSet\(/.test(fn),
    'and computes that from the SET, through the same helper the per-chapter dropdown uses — '
    + 'a second, hand-rolled answer to the same question is how the two menus would drift');
}

// ── 5. The server accepts it — the other half, and the one that fails silently ────────────────
{
  const m = /const ARC_LESSON_TYPES = \[([\s\S]*?)\];/.exec(SERVER);
  assert.ok(m, 'server.js declares ARC_LESSON_TYPES');
  assert.ok(/'intro_script'/.test(m[1]),
    'ARC_LESSON_TYPES admits intro_script — sanitizeArcTypes filters a storyline run against this '
    + 'list, so a client-only fix would have had the tick DROPPED here with no error and the run '
    + 'would have produced nothing');
  // Non-vacuity: the generator it dispatches to has to exist, or the whitelist entry is a promise
  // nothing keeps.
  assert.ok(/intro_script:\s*\(c\)\s*=>\s*generateIntroScript\(/.test(SERVER),
    'and ADD_LESSON_GENERATORS can actually build one');
}

// ── 6. The script it would teach is the right one for this pair ───────────────────────────────
// en→ar is the interesting direction: the LEARNER reads Arabic and is learning English, so the
// course to offer is LATIN, not Arabic. Checked through the server's own helper so the test cannot
// disagree with the code about what `scriptsForLang` means.
{
  const ext = n => {
    const at = SERVER.indexOf('function ' + n + '('); const b = SERVER.indexOf('{', at);
    let d = 0, i = b;
    for (; i < SERVER.length; i++) { if (SERVER[i] === '{') d++; else if (SERVER[i] === '}') { d--; if (!d) { i++; break; } } }
    return SERVER.slice(at, i);
  };
  const scriptsForLang = new Function('_scriptsData', ext('scriptsForLang') + '\nreturn scriptsForLang;')(SCRIPTS);
  const srcScripts = scriptsForLang(REPORTED.srcLang);
  const wanted = scriptsForLang(REPORTED.lang).filter(s => !srcScripts.includes(s));
  assert.deepStrictEqual(wanted, ['latin'],
    'for an Arabic reader learning English the course is the LATIN alphabet, not the Arabic one — '
    + 'the direction is easy to read backwards and the generator gets it right');
  assert.ok(SCRIPTS.latin && Array.isArray(SCRIPTS.latin.letters) && SCRIPTS.latin.letters.length,
    'and scripts.json carries a Latin table to build it from');
}

console.log('  gate was right, row was missing: storyline form now offers intro_script: OK');
console.log('  hidden when not needed, unasked means not-asked: OK');
console.log('  server whitelist + generator + correct script for en<-ar: OK');
console.log('unit-storyline-script-lesson: ALL PASSED');
