// unit-translate-picker.test.js
// item AX (v88_i), client side — the "translate this storyline for a different source language"
// picker and its dispatch. The SERVER half (resolving a storyline to chunks, the three user
// rulings) is e2e-translate-storyline.
//
// User request: "Allow to generate lessons based on existing storylines and chapters, but for a
// different source language. This could be a drop-down menu in the generation interface, with the
// same choice as 'continue from'."
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const settle = ms => new Promise(r => setTimeout(r, ms || 30));

// Three storylines against a form set to nl←en: one is a candidate (nl, but written for de),
// one is already for en (the server refuses that — must NOT be offered), one is a different
// target language entirely.
const SAVED = [
  { id: 'tp_a', topic: 'K1', lang: 'nl', srcLang: 'de' },
  { id: 'tp_b', topic: 'K2', lang: 'nl', srcLang: 'de' },
  { id: 'tp_c', topic: 'E1', lang: 'nl', srcLang: 'en' },
  { id: 'tp_d', topic: 'I1', lang: 'it', srcLang: 'de' },
];
const SLS = [
  { id: 'sl_de', title: 'De Heide', chapters: ['tp_a', 'tp_b'] },
  { id: 'sl_en', title: 'Already English', chapters: ['tp_c'] },
  { id: 'sl_it', title: 'Italian target', chapters: ['tp_d'] },
];

function client() {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.info = { backend:'ollama', canGenerate:true };
    APP.lang = 'nl'; APP.srcLang = 'en'; APP.difficulty = 2; APP.lessonFormat = 'standard';
    APP.savedList = ${JSON.stringify(SAVED)};
    APP.storylines = ${JSON.stringify(SLS)};
    __posts = [];
    fetch = function(url, opts){
      __posts.push({ url:String(url), body: opts && opts.body ? JSON.parse(opts.body) : null });
      return Promise.resolve({ ok:true, status:200, json:function(){ return Promise.resolve({ bookId:'bk_1' }); } });
    };
    _pollBookJob = function(){};   // the poller is covered by its own tests
    true;`, 'seed');
  return C;
}

(async () => {
  let failed = false;
  try {

    // ── 1. The picker offers exactly the storylines that make sense ────────────────────────────
    {
      const C = client();
      C.run(`repopulateTranslateSelect(); true;`, 'populate');
      const vals = JSON.parse(C.run(
        `JSON.stringify([].map.call(document.getElementById('translate-select').options||[], function(o){ return o.value; }))`));
      // lib-dom does not parse innerHTML into real <option> nodes, so read the markup as the
      // authority (INTERNALS → harness limits) rather than the option list.
      const html = C.run(`document.getElementById('translate-select').innerHTML`);
      assert.ok(html.includes('value="sl_de"'),
        'a same-target, DIFFERENT-source storyline is offered — the whole point of the picker');
      assert.ok(!html.includes('value="sl_en"'),
        'a storyline ALREADY written for the selected source language is NOT offered (the server '
        + 'refuses it, so offering it would only produce an error the user cannot act on)');
      assert.ok(!html.includes('value="sl_it"'),
        'a storyline whose TARGET language differs is not offered — its text is not the text being reused');
      assert.ok(html.includes('data-n="2"'), 'the option carries its chapter count for the label/count');
      assert.ok(html.includes('De Heide'), 'and is labelled with the storyline title');
      console.log('  the picker offers same-target, different-source storylines only: OK');
    }

    // ── 2. With nothing to offer, the row hides itself ─────────────────────────────────────────
    // An empty picker is a question the learner cannot answer.
    {
      const C = client();
      // A target language NO storyline uses. (Setting srcLang='de' would NOT do it — `sl_en` is
      // nl←en, so translating it FOR German speakers is a perfectly valid offer. Getting that wrong
      // is how a "nothing qualifies" fixture ends up asserting on a populated picker.)
      C.run(`APP.lang='fr'; repopulateTranslateSelect(); true;`, 'none');
      const disp = C.run(`document.getElementById('translate-row').style.display`);
      assert.strictEqual(disp, 'none', 'the row is hidden when no storyline qualifies');
      console.log('  the row hides itself when nothing qualifies: OK');
    }

    // ── 3. Selecting a translation switches the input MODE and the chapter count ──────────────
    {
      const C = client();
      C.run(`repopulateTranslateSelect();
        document.getElementById('translate-select').value = 'sl_de';
        document.getElementById('translate-select').selectedOptions = [{ dataset: { n: '2' } }];
        true;`, 'select');
      assert.strictEqual(C.run(`_genInputMode()`), 'translate',
        'the mode becomes "translate" — it must win over leftover upload/paste state');
      assert.strictEqual(C.run(`_genChapterCount()`), 2, 'the count is the source storyline\'s chapter count');
      console.log('  selecting a storyline switches the input mode and chapter count: OK');
    }

    // ── 4. doGenerate() dispatches here, and sends the storyline id ───────────────────────────
    // The request is deliberately TINY: the server resolves the storyline to chunks, because the
    // client's savedList projection carries no story text at all.
    {
      const C = client();
      C.run(`repopulateTranslateSelect();
        document.getElementById('translate-select').value = 'sl_de';
        document.getElementById('gen-skip-lessons-cb').checked = true;
        doGenerate(); true;`, 'go');
      await settle(60);
      const posts = JSON.parse(C.run(`JSON.stringify(__posts)`));
      const book = posts.filter(p => p.url.indexOf('/api/generate-book') >= 0);
      assert.strictEqual(book.length, 1, 'exactly one generate-book request (got ' + book.length + ')');
      assert.strictEqual(book[0].body.translateFrom, 'sl_de', 'it names the SOURCE STORYLINE by id');
      assert.strictEqual(book[0].body.srcLang, 'en', 'and the NEW source language');
      assert.strictEqual(book[0].body.lang, 'nl', 'keeping the target language');
      assert.strictEqual(book[0].body.skipLessons, true,
        'and it reads the shared wizard lesson card like every other mode');
      assert.ok(!('chunks' in book[0].body),
        'no chunks are sent — the server resolves them, since savedList carries no story text');
      console.log('  doGenerate() dispatches to the translate path and sends the storyline id: OK');
    }

    // ── 5. Picking a translation clears "continue from" ───────────────────────────────────────
    // They are different acts (extend this story vs. re-teach it), and one supplies the chapters.
    {
      const C = client();
      C.run(`repopulateTranslateSelect();
        document.getElementById('continue-select').value = 'tp_a';
        document.getElementById('translate-select').value = 'sl_de';
        onTranslateSelectChange(); true;`, 'clear');
      assert.strictEqual(C.run(`document.getElementById('continue-select').value`), '',
        'choosing a translation clears the continuation, so the mode precedence is not a surprise');
      console.log('  picking a translation clears the continue-from selection: OK');
    }

  } catch (e) { failed = true; console.error(e); }
  console.log(failed ? 'unit-translate-picker: FAILED' : 'unit-translate-picker: ALL PASSED');
  process.exit(failed ? 1 : 0);
})();
