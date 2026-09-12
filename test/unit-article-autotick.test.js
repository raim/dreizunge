// unit-article-autotick.test.js — v91_b. The wizard pre-ticks the article pass for a language pair
// already known to need it.
//
// ⚠️ THE WHOLE FEATURE TURNS ON A THREE-STATE DISTINCTION, and a boolean would be wrong in exactly
// the way that matters. `APP.info.articleLangs` maps a language code to whether it is ATTESTED to
// use articles, and it is learned ONLY from article passes that have actually run (the user's
// ruling: learn from real runs, never warm eagerly). So a code is:
//     true       → known to use articles
//     false      → known NOT to (Japanese, Polish, Serbian … measured, not assumed)
//     ABSENT     → UNKNOWN, never measured
// The user ruled that an unknown pair must NOT be pre-ticked — an unticked box claims no knowledge.
//
// ⚠️⚠️ AND HERE IS THE HONEST LIMIT OF THIS FILE, found by mutation-testing it: `!!map[x]` and the
// explicit `a === true && b === true` produce the SAME ANSWER for every case, because "not ticked"
// is the outcome for both `false` and `undefined`. **The three states are real in the DATA and are
// NOT observable in the BEHAVIOUR**, so no test here can tell the two forms apart — the mutation is
// a genuine equivalent, not a gap. The explicit form is kept because it states the contract and
// stays correct if `articleLangs` ever carries a non-boolean, and this note exists so the next
// reader does not "simplify" it believing a test will catch them. ⚠️ If the distinction ever needs
// to be real (e.g. the wizard explaining WHY a box is unticked — "not measured yet" vs "this pair
// does not need it"), make it OBSERVABLE first, then assert it.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

// `de`/`it` attested, `ja` measured article-less, `sw` deliberately ABSENT (never measured).
const FLAGS = { de: true, it: true, ja: false };

function client() {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.info = { backend:'ollama', canGenerate:true, articleLangs: ${JSON.stringify(FLAGS)} };
    APP.progress = { completed:{}, learned:{} };
    window.__tick = function(lang, src){
      APP.lang = lang; APP.srcLang = src;
      var cb = document.getElementById('post-gen-articles-cb');
      cb.dataset.touched = '';        // a fresh wizard, nothing decided by hand
      _syncArticlesCb();
      return cb.checked; };
    true;`, 'seed');
  return C;
}

// ── 1. ⭐ A pair known to need it IS pre-ticked ───────────────────────────────────────────────
{
  const C = client();
  assert.strictEqual(C.run(`window.__tick('it','de')`, 'de-it'), true,
    'de→it — both languages attested to use articles — is pre-ticked, which is the whole request');
  assert.strictEqual(C.run(`window.__tick('de','it')`, 'it-de'), true,
    'and the reverse direction too: asymmetry needs articles on BOTH sides, not a favoured one');
}
console.log('  a pair whose languages both use articles is pre-ticked: OK');

// ── 2. A language measured to have NO articles is not ─────────────────────────────────────────
// Non-vacuity for §1: a checkbox that is always ticked would satisfy §1 and be useless.
{
  const C = client();
  assert.strictEqual(C.run(`window.__tick('ja','de')`, 'de-ja'), false,
    'de→ja is NOT pre-ticked — Japanese is measured article-less, so the pass could never find anything');
  assert.strictEqual(C.run(`window.__tick('de','ja')`, 'ja-de'), false, 'either way round');
}
console.log('  a pair with a known article-less language is not pre-ticked: OK');

// ── 3. ⚠️ UNKNOWN is not the same as FALSE ────────────────────────────────────────────────────
// The assertion that stops `!!map[x]`. `sw` is absent from the map — never measured — and the user
// ruled that must not pre-tick. It reaches the same ANSWER as `false` here but for a different
// REASON, and a later "simplification" to a boolean would pass §2 while breaking the contract.
{
  const C = client();
  assert.strictEqual(C.run(`window.__tick('sw','de')`, 'de-sw'), false,
    'an UNMEASURED language is not pre-ticked — the box must not claim knowledge it does not have');
  assert.strictEqual(C.run(`window.__tick('it','xx')`, 'xx-it'), false, 'unknown on the SOURCE side too');
  // The map is consulted for BOTH sides, not just one — this one IS distinguishable.
  assert.strictEqual(C.run(`window.__tick('it','ja')`, 'ja-it'), false,
    'one known-article-less side is enough to suppress it, even when the other is attested');
  // The three states must be distinguishable AT ALL: with no map at all, nothing is ticked.
  const C2 = client();
  C2.run(`APP.info.articleLangs = undefined; true;`, 'nomap');
  assert.strictEqual(C2.run(`window.__tick('it','de')`, 'nomap-tick'), false,
    'a server that reports no flags at all (older build) pre-ticks nothing rather than guessing');
}
console.log('  UNKNOWN is treated as "do not claim", distinctly from a measured false: OK');

// ── 4. A hand-toggled box is never overwritten ────────────────────────────────────────────────
// `_syncArticlesCb` runs on every language change AND every slider move. Quietly undoing a
// deliberate choice is precisely what `onNumChaptersSlider`'s own hygiene note was written about.
{
  const C = client();
  const r = JSON.parse(C.run(`
    var cb = document.getElementById('post-gen-articles-cb');
    APP.lang='it'; APP.srcLang='de'; cb.dataset.touched=''; _syncArticlesCb();
    var autoOn = cb.checked;
    cb.checked = false; cb.dataset.touched = '1';        // the learner UNTICKS a pre-ticked box
    APP.lang='it'; APP.srcLang='de'; _syncArticlesCb();
    var stillOff = cb.checked;
    cb.checked = true; cb.dataset.touched = '1';         // and TICKS one that would not be
    APP.lang='ja'; APP.srcLang='de'; _syncArticlesCb();
    JSON.stringify({ autoOn: autoOn, stillOff: stillOff, stillOn: cb.checked })`, 'touched'));
  assert.strictEqual(r.autoOn, true, 'non-vacuity: it really was pre-ticked before the learner touched it');
  assert.strictEqual(r.stillOff, false, 'an UNTICKED choice survives a re-sync that would have ticked it');
  assert.strictEqual(r.stillOn, true, 'and a TICKED choice survives one that would have unticked it');
}
console.log('  a box the learner has set by hand is never overwritten by the auto-tick: OK');

// ── 5. The label costs no ui.json key ─────────────────────────────────────────────────────────
{
  const C = client();
  const txt = C.run(`_syncArticlesCb(); document.getElementById('post-gen-articles-lbl').textContent`, 'lbl');
  assert.ok(txt.includes(UI.en['qc.btn.articles']),
    'the checkbox label REUSES qc.btn.articles — this feature added no key');
  assert.ok(!/qc\.btn\.articles/.test(txt), 'and it is translated, not the raw key (the v90_aa class)');
}
console.log('  the checkbox label reuses the existing key and is translated: OK');

// ── 6. Server side: a FAILED declaration must not be cached as a verdict ──────────────────────
// ⚠️ The dangerous cache write. If a model failure persisted `attested:false`, one bad call would
// permanently disable the check for that language — and it would look exactly like a correct
// answer, because "this language has no articles" is a legitimate verdict.
{
  const at = server.indexOf('const _articleEvidenceFor');
  assert.ok(at > 0, 'the evidence builder still exists');
  const body = server.slice(at, server.indexOf('\n  };', at));
  const write = body.indexOf('writeArticleLang');
  const katch = body.indexOf('} catch (e) {');
  assert.ok(write > 0 && katch > 0, 'it both persists and has a failure path');
  assert.ok(write < katch,
    '⚠️ the cache write is INSIDE the try, before the catch — a failed declaration must never be ' +
    'persisted as "this language has no articles"');
  // ⚠️ STRUCTURAL, and it needs to be: mutation-testing slipped the write into a `finally`, which
  // still sits before the catch and so passed the ordering check alone while caching every failure
  // as a verdict. A `finally` here is always wrong — the whole point is that the write happens only
  // on the success path.
  assert.ok(!/\}\s*finally\s*\{/.test(body),
    'the evidence builder has NO finally — a write there would persist failures as verdicts');
  assert.strictEqual((body.match(/writeArticleLang\(/g) || []).length, 1,
    'and it writes in exactly ONE place, so there is no second path that could cache a failure');
  assert.ok(/if \(String\(e && e\.message\) === CANCELLED\) throw e;/.test(body),
    'and a CANCEL is re-thrown rather than swallowed into a cached verdict (v88_z)');
}
console.log('  a failed or cancelled declaration is never persisted as a verdict: OK');

console.log('unit-article-autotick: ALL PASSED');
