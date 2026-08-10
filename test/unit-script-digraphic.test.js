// unit-script-digraphic.test.js
// v78_g (user-reported) — script lessons for a DIGRAPHIC source language.
//
// User: "I generated a serbian-latin -> serbian-cyrillic lesson, sl_56647998, but I can't add script
// lessons to this. Script lessons would obviously fit such a script-focussed lesson."
//
// Cause: `needsIntroScript` computed the learner's readable scripts as `scriptsForLang(srcLang)` —
// EVERY script the source LANGUAGE admits. For sr->sr that is ["cyrillic-sr","latin"] on both
// sides, so every target script was already "readable" and the gate concluded no alphabet was
// needed. It was answering "which scripts CAN this language be written in" where the question is
// "which script is THIS pair actually written in" — a per-topic fact stored since v76_g/v76_h as
// `script` / `srcScript`.
//
// This bites ONLY when a side is digraphic, i.e. the languages in scripts.json `_scriptChoice`
// (["sr"] today). That is why it survived: the corpus had no digraphic-source chapter until the
// user built one. It now has one, so the test drives the REAL storyline rather than a fixture
// (v70_n: reproduce on the data that prompted the report).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const SCRIPTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts.json'), 'utf8'));
const LESSONS = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));

const C = loadClient({ quiet: true });
C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
       SCRIPTS_DATA = ${JSON.stringify(SCRIPTS)}; _scriptsData = SCRIPTS_DATA;
       APP.srcLang = 'en'; true;`, 'seed');
const call = (expr) => JSON.parse(C.run(`JSON.stringify(${expr})`, 'gate'));

// ── 0. The premise: sr really is digraphic, and it is the only one ──────────
// If this ever stops being true the rest of the file is asserting nothing, so it is checked rather
// than assumed (the corpus-coincidence trap that made a v78-cut test wrong).
{
  assert.deepStrictEqual(SCRIPTS._scriptChoice, ['sr'],
    'sr is the digraphic language this test is built around');
  assert.deepStrictEqual(SCRIPTS._langScript.sr, ['cyrillic-sr', 'latin'],
    'and it admits exactly the two scripts the bug confused');
  console.log('  premise holds: sr is digraphic with both scripts mapped');
}

// ── 1. The reported case, from the SHIPPED corpus ───────────────────────────
{
  const topic = LESSONS.topics.find(t => t.id === 'tp_17862984310970000000')
             || LESSONS.topics.find(t => t.lang === 'sr' && t.srcLang === 'sr');
  assert.ok(topic, 'the digraphic chapter is present in lessons.json');
  assert.strictEqual(topic.lang, 'sr');
  assert.strictEqual(topic.srcLang, 'sr');
  assert.ok(topic.script && topic.srcScript && topic.script !== topic.srcScript,
    `both scripts are stamped and differ (got ${topic.script} / ${topic.srcScript})`);

  assert.strictEqual(call(`scriptLessonAvailableForSet(${JSON.stringify(topic)})`), true,
    'the "add a script lesson" menu offers the option for the reported storyline');
  console.log(`  ${topic.script} <- ${topic.srcScript}: the menu now offers a script lesson`);
}

// ── 2. It is the SCRIPTS that decide, not the languages ─────────────────────
// The same sr->sr pair with the stamps REMOVED must fall back to the old answer. Without this, §1
// could be passing because something else about the topic turned the option on.
{
  const bare = { lang: 'sr', srcLang: 'sr' };
  assert.strictEqual(call(`scriptLessonAvailableForSet(${JSON.stringify(bare)})`), false,
    'with no stamps there is nothing to distinguish the sides — the gate falls back and says no');
  const stamped = { lang: 'sr', srcLang: 'sr', script: 'cyrillic-sr', srcScript: 'latin' };
  assert.strictEqual(call(`scriptLessonAvailableForSet(${JSON.stringify(stamped)})`), true,
    'the stamps are what flip it');
  console.log('  the per-topic stamps are what decide, not the language pair');
}

// ── 3. Same script on both sides is still NO ────────────────────────────────
// The narrowing must not turn into "always offer for a digraphic language".
{
  for (const scr of ['latin', 'cyrillic-sr']) {
    const same = { lang: 'sr', srcLang: 'sr', script: scr, srcScript: scr };
    assert.strictEqual(call(`scriptLessonAvailableForSet(${JSON.stringify(same)})`), false,
      `${scr} -> ${scr} teaches no new alphabet, so the option stays off`);
  }
  console.log('  an sr chapter written in the reader\'s own script offers nothing');
}

// ── 4. A stale or invented stamp falls back — PER SIDE ──────────────────────
// Not "an invalid stamp turns everything off": the sides are independent, so one bad stamp must not
// poison the other. The claim is that an ignored stamp leaves that side behaving exactly as if it
// had never been set. (First written as "bogus => false", which was wrong: with a VALID srcScript
// of latin, falling the target back to sr's full set correctly finds cyrillic-sr unreadable. The
// product was right and the assertion was not.)
{
  const bothBogus = { lang: 'sr', srcLang: 'sr', script: 'klingon', srcScript: 'klingon' };
  assert.strictEqual(call(`scriptLessonAvailableForSet(${JSON.stringify(bothBogus)})`),
    call(`scriptLessonAvailableForSet(${JSON.stringify({ lang: 'sr', srcLang: 'sr' })})`),
    'two invalid stamps behave exactly like no stamps at all');
  const oneBogus = { lang: 'sr', srcLang: 'sr', script: 'klingon', srcScript: 'latin' };
  assert.strictEqual(call(`scriptLessonAvailableForSet(${JSON.stringify(oneBogus)})`),
    call(`scriptLessonAvailableForSet(${JSON.stringify({ lang: 'sr', srcLang: 'sr', srcScript: 'latin' })})`),
    'an invalid target stamp leaves the VALID source stamp still doing its job');
  console.log('  an invalid stamp falls back on its own side only');
}

// ── 5. Every non-digraphic pair is UNCHANGED ────────────────────────────────
// The regression surface. The fix narrows a set that, for every monoscript language, has exactly
// one member — so nothing outside `_scriptChoice` may move. Swept over the whole corpus.
{
  const pairs = new Map();
  for (const t of LESSONS.topics) {
    if (!t.lang || !t.srcLang) continue;
    if (t.lang === 'sr' || t.srcLang === 'sr') continue;      // the digraphic case, covered above
    pairs.set(t.lang + '|' + t.srcLang, { lang: t.lang, srcLang: t.srcLang, script: t.script, srcScript: t.srcScript });
  }
  assert.ok(pairs.size >= 10, `the sweep covers a real spread of pairs (got ${pairs.size})`);
  let differed = 0;
  for (const [key, d] of pairs) {
    const withStamps = call(`scriptLessonAvailableForSet(${JSON.stringify(d)})`);
    const without = call(`scriptLessonAvailableForSet(${JSON.stringify({ lang: d.lang, srcLang: d.srcLang })})`);
    if (withStamps !== without) { differed++; console.log('    CHANGED:', key, without, '->', withStamps); }
  }
  assert.strictEqual(differed, 0,
    'no non-digraphic pair in the corpus changed answer — the narrowing is inert where a language has one script');
  console.log(`  ${pairs.size} non-digraphic corpus pairs: all unchanged`);
}

// ── 6. Gate and builder ask the SAME question (the silent-empty trap) ───────
// If the gate narrowed and the builder did not, a digraphic pair would pass the gate and then skip
// every script inside the loop — returning [] with no error. INTERNALS §2 is full of that shape, so
// it is asserted directly against the server's builder.
{
  const srv = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const fn = srv.slice(srv.indexOf('function buildArcIntroLessons'),
                       srv.indexOf('function buildArcIntroLessons') + 2000);
  assert.ok(/needsIntroScript\(lang, srcLang, opts\)/.test(fn),
    'the builder gates on the same opts it was given');
  assert.ok(!/for \(const scr of scriptsForLang\(lang\)\)/.test(fn),
    'and does NOT walk every script of the language while the gate looks at one');
  assert.ok(/_scriptSideOf\(lang, opts && opts\.script/.test(fn),
    'it narrows the target side through the same helper as the gate');
  assert.ok(/_scriptSideOf\(srcLang \|\| 'en', opts && opts\.srcScript/.test(fn),
    'and the source side too');
  console.log('  the arc builder narrows both sides through the same helper as the gate');
}

// ── 7. Client/server parity (DoD item 5) ────────────────────────────────────
// Two copies of needsIntroScript exist. They were identical before this change and must stay so, or
// the menu and the generator disagree about whether the option exists at all.
{
  const srv = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const cli = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const grab = (s) => {
    const at = s.indexOf('function _scriptSideOf');
    assert.ok(at > 0, '_scriptSideOf is present');
    const end = s.indexOf('\n}', s.indexOf('function needsIntroScript', at)) + 2;
    return s.slice(at, end).replace(/\s+/g, ' ').trim();
  };
  assert.strictEqual(grab(srv), grab(cli),
    'server and client carry byte-identical _scriptSideOf + needsIntroScript (modulo whitespace)');
  console.log('  server and client copies are identical');
}

// ── 8. Teaching LATIN to a Cyrillic-Serbian reader is honestly not possible yet ──
// The Latin table's `sounds` column is keyed by the READER's script and carries `cyrillic`
// (Russian-flavoured: "эй", "си") but not `cyrillic-sr`. Aliasing one to the other is a LANGUAGE
// judgement — Serbian Cyrillic has no э/ы/ё — and INTERNALS §4 puts that outside the code. So the
// direction stays unteachable until a real `cyrillic-sr` column exists, and this asserts the REASON:
// if someone adds the column, this flips deliberately rather than silently.
//
// Asserted on `needsIntroScript`, which is where teachability lives — NOT on the menu. The menu
// (`scriptLessonAvailable`) checks BOTH directions by design ("worth offering whenever a
// table-backed script is involved on either side"), so it correctly still offers the cyrillic-sr
// lesson for such a chapter. Two different questions; the first draft of this section asked the
// wrong one and called the right answer a failure.
{
  assert.ok(!(SCRIPTS.latin.soundsFor || []).includes('cyrillic-sr'),
    'latin has no cyrillic-sr sounds column yet (OWED: needs a native/model pass, not an alias)');
  assert.strictEqual(
    call(`needsIntroScript('sr','sr',{script:'latin',srcScript:'cyrillic-sr'})`), false,
    'a Latin primer is NOT generated for a Cyrillic-Serbian reader — its answers would be respelled ' +
    'in a Cyrillic they do not use');
  assert.strictEqual(
    call(`needsIntroScript('sr','sr',{script:'cyrillic-sr',srcScript:'latin'})`), true,
    'while the direction the user actually built IS teachable (cyrillic-sr has no soundsFor ' +
    'restriction) — otherwise the line above would pass for the wrong reason');
  console.log('  latin->cyrillic-sr reader withheld; cyrillic-sr->latin reader taught');
}

console.log('unit-script-digraphic: ALL PASSED');
