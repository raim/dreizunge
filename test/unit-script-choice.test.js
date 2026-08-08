// unit-script-choice.test.js
// v76_g — which languages have a SCRIPT CHOICE, and whether the corpus is stamped with it.
//
// Serbian is digraphic: Cyrillic and Latin are both official and a text is written in one OR the
// other. Nothing told the model which, so it chose per generation — measured on the bundled corpus,
// Serbian-as-target came back Latin and Serbian-as-source came back Cyrillic. `backfill-script.js`
// records what each topic actually uses so the choice becomes data.
//
// THE DISTINCTION THIS FILE EXISTS FOR: `scriptsForLang(x).length > 1` is NOT the test for "needs a
// script picker". It is equally true of Japanese, which mixes hiragana and katakana *inside one
// sentence* and has no choice to make. The gate is scripts.json `_scriptChoice`, and section 2
// checks that declaration against the corpus so a wrong entry fails loudly rather than silently
// offering a meaningless choice.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { ROOT } = require('./lib-dom');

const scripts = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts.json'), 'utf8'));
const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const CHOICE = scripts._scriptChoice || [];
const scriptsFor = (c) => {
  const m = (scripts._langScript || {})[c];
  return m ? (Array.isArray(m) ? m : [m]) : [];
};

// ── 1. The declaration is coherent with _langScript ──────────────────────────────────────────
{
  assert.ok(Array.isArray(CHOICE) && CHOICE.length >= 1,
    'scripts.json declares _scriptChoice (non-vacuity: an empty list makes every check below a no-op)');
  for (const code of CHOICE) {
    const s = scriptsFor(code);
    assert.ok(s.length > 1,
      `${code} is declared as having a script CHOICE, so _langScript must list more than one script for it (got ${JSON.stringify(s)})`);
    for (const name of s) {
      assert.ok(scripts[name] || name === 'latin',
        `${code}'s script "${name}" has a table in scripts.json`);
    }
  }
  assert.ok(scripts._scriptChoice_comment,
    'the declaration carries its own explanation — a tier-3 data file must state what it means');
  console.log(`  _scriptChoice: ${CHOICE.join(', ')}`);
}

// ── 2. Alternative vs CONCURRENT — the distinction, checked against the corpus ────────────────
// A language belongs in _scriptChoice only when its scripts PARTITION the text: a given passage is
// in one or the other. A language whose scripts CO-OCCUR (Japanese) has no choice to make.
{
  const RE = {
    latin: /\p{Script=Latin}/gu, cyrillic: /\p{Script=Cyrillic}/gu,
    'cyrillic-sr': /\p{Script=Cyrillic}/gu, hiragana: /\p{Script=Hiragana}/gu,
    katakana: /\p{Script=Katakana}/gu,
  };
  // Target-language text per topic, for one language.
  const textsFor = (code) => (store.topics || [])
    .filter(t => t.lang === code)
    .map(t => [t.story || '', ...(t.lessons || []).flatMap(l =>
      [l.story || '', ...(l.vocab || []).map(v => v.target || v.t || '')])].join(' '))
    .filter(s => s.trim());

  // How often do two scripts appear in the SAME text?
  const coOccurrence = (code) => {
    const names = scriptsFor(code).filter(n => RE[n]);
    if (names.length < 2) return null;
    const texts = textsFor(code);
    if (!texts.length) return null;
    let both = 0;
    for (const txt of texts) {
      const present = names.filter(n => (txt.match(RE[n]) || []).length > 3);
      if (present.length > 1) both++;
    }
    return { texts: texts.length, both, ratio: both / texts.length };
  };

  for (const code of CHOICE) {
    const co = coOccurrence(code);
    if (!co) { console.log(`  ${code}: no corpus text to check against (declaration unverified)`); continue; }
    assert.ok(co.ratio < 0.5,
      `${code} is declared as an ALTERNATIVE-script language, so its scripts should partition the `
      + `corpus rather than co-occur — but ${co.both} of ${co.texts} texts contain both. If its `
      + `scripts really are used together, it does not belong in _scriptChoice`);
    console.log(`  ${code}: scripts partition the corpus (${co.both}/${co.texts} texts mix them)`);
  }

  // The other direction, and the reason this file exists: a language with several scripts that are
  // used TOGETHER must NOT be in the list. Without this, _scriptChoice could just be "every
  // language with more than one script" and section 1 would still pass.
  const multi = Object.keys(scripts._langScript || {}).filter(c => scriptsFor(c).length > 1);
  assert.ok(multi.length > CHOICE.length,
    `there is at least one multi-script language that is NOT a script CHOICE — otherwise the `
    + `distinction is untested and _langScript[x].length > 1 would do (multi: ${multi.join(',')})`);
  const concurrent = multi.filter(c => !CHOICE.includes(c));
  for (const code of concurrent) {
    const co = coOccurrence(code);
    if (!co) continue;
    assert.ok(co.ratio > 0.5,
      `${code} has several scripts but is NOT declared a choice, so they should be used TOGETHER `
      + `— only ${co.both} of ${co.texts} texts contain both. If they actually partition, ${code} `
      + `may belong in _scriptChoice`);
    console.log(`  ${code}: several scripts, used concurrently (${co.both}/${co.texts}) — correctly not a choice`);
  }
}

// ── 3. Every stamped value is one the language actually uses ─────────────────────────────────
{
  let stampedCount = 0;
  for (const t of store.topics || []) {
    for (const [field, langKey] of [['script', 'lang'], ['srcScript', 'srcLang']]) {
      if (!t[field]) continue;
      stampedCount++;
      assert.ok(CHOICE.includes(t[langKey]),
        `${t.id} carries ${field} but its ${langKey} (${t[langKey]}) has no script choice — a stamp `
        + 'here means nothing and would be read as a real setting');
      assert.ok(scriptsFor(t[langKey]).includes(t[field]),
        `${t.id}'s ${field}="${t[field]}" is one of the scripts ${t[langKey]} is written in `
        + `(${scriptsFor(t[langKey]).join('/')})`);
    }
  }
  assert.ok(stampedCount > 0,
    'the corpus carries at least one stamped script (non-vacuity: with none, the loop above is a no-op)');
  console.log(`  ${stampedCount} stamped script field(s), all valid for their language`);
}

// ── 4. The corpus is fully stamped, per the real tool ────────────────────────────────────────
// Runs backfill-script.js in its REPORT mode rather than re-deriving detection here — a test that
// re-implements the code it tests cannot fail when that code is wrong (v71_u). Like
// unit-static-freshness, a failure here is the guard working: a newly generated Serbian chapter
// arrives unstamped, and the fix is to run `node backfill-script.js --write`.
{
  const out = execFileSync(process.execPath, [path.join(ROOT, 'backfill-script.js')],
                           { cwd: ROOT, encoding: 'utf8' });
  const m = /to stamp: (\d+)\s+already correct: (\d+)\s+ambiguous \(left alone\): (\d+)/.exec(out);
  assert.ok(m, `backfill-script.js reported its tally (got: ${out.slice(-200)})`);
  const [, toStamp, already, ambiguous] = m.map(Number);
  assert.ok(already > 0,
    'the tool sees the stamps that are already there (non-vacuity: if it detected nothing, '
    + '"nothing left to stamp" would be true for the wrong reason)');
  assert.strictEqual(toStamp, 0,
    `every topic in a script-choice language is stamped — ${toStamp} are not. `
    + 'Run `node backfill-script.js --write`.');
  assert.strictEqual(ambiguous, 0,
    `no topic mixes its language's two scripts — ${ambiguous} do, and a mixed passage means the `
    + 'generator was never told which script to use. Inspect before stamping.');
  console.log(`  backfill-script: ${already} stamped, 0 outstanding, 0 ambiguous`);
}

console.log('unit-script-choice: ALL PASSED');
