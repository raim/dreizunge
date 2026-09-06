// unit-provenance-inherit.test.js — v89_aj.
//
// User ruling: "Source/provenance editing currently lives on chapter-level, however we usually want
// to edit this on story level. Please add a full editor for this on the storyline page. The entry is
// inherited on chapter level and a chapter level entry in lessons.json is only required if it
// differs from the inherited story-level provenance field."
//
// So a chapter's stored `source` MEANS "this chapter differs". Its absence means "inherit". Two
// things follow, and both are easy to get subtly wrong:
//   • Saving a chapter entry EQUAL to its storyline's must DELETE it, not store a duplicate —
//     a duplicate is not inert, it silently detaches that chapter from every later storyline edit.
//   • Every READ goes through the effective resolver, never off `topic.source` directly.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

function lift(name) {
  let at = server.indexOf('function ' + name + '(');
  assert.ok(at > -1, `server.js defines ${name}`);
  if (server.slice(Math.max(0, at - 6), at) === 'async ') at -= 6;
  let d = 0, i = server.indexOf('{', at);
  for (; i < server.length; i++) { if (server[i] === '{') d++; else if (server[i] === '}') { d--; if (!d) { i++; break; } } }
  return server.slice(at, i);
}
const S = new Function(lift('sourcesEqual') + '\n' + lift('effectiveSource')
  + '\nreturn { sourcesEqual, effectiveSource };')();

// ── 1. The equality that decides whether a chapter entry is stored at all ───────────────────────
{
  const a = { author: 'xkcd', url: 'https://xkcd.com/1', licence: '', note: '' };
  assert.ok(S.sourcesEqual(a, { author: 'xkcd', url: 'https://xkcd.com/1' }),
    '⚠️ absent and empty-string fields are the SAME value — otherwise a chapter saved through the ' +
    'editor (which sends all four keys) would never match a storyline entry that omits the blanks, ' +
    'and every chapter would keep a redundant copy');
  assert.ok(S.sourcesEqual(a, { url: 'https://xkcd.com/1', author: 'xkcd' }), 'key order is irrelevant');
  assert.ok(S.sourcesEqual(a, { author: ' xkcd ', url: 'https://xkcd.com/1' }), 'and surrounding space');
  assert.ok(S.sourcesEqual(null, null) && S.sourcesEqual(null, {}) && S.sourcesEqual(undefined, {}),
    'nothing equals nothing, however it is spelled');
  // ⚠️ Non-vacuity: a real difference in ANY of the four fields must be seen, or "only store if it
  // differs" degenerates into "never store".
  for (const diff of [{ author: 'other' }, { url: 'https://xkcd.com/2' }, { licence: 'CC BY' }, { note: 'n' }]) {
    assert.ok(!S.sourcesEqual(a, { ...a, ...diff }),
      `a difference in ${Object.keys(diff)[0]} is a real difference`);
  }
}
console.log('  sourcesEqual: blanks and absence are the same, but a real difference is seen: OK');

// ── 2. Inheritance: the chapter's own entry wins, else the storyline's ──────────────────────────
{
  const sl = { source: { author: 'Storyline Author', url: 'https://s.example/' } };
  assert.deepStrictEqual(S.effectiveSource({}, sl), sl.source, 'a chapter with no entry INHERITS');
  const own = { author: 'Chapter Author' };
  assert.deepStrictEqual(S.effectiveSource({ source: own }, sl), own, 'its own entry wins');
  assert.strictEqual(S.effectiveSource({}, null), null, 'neither: null, not {}');
  assert.strictEqual(S.effectiveSource({}, { source: {} }), null,
    '⚠️ an EMPTY storyline entry is not something to inherit — it would render an empty line');
  assert.strictEqual(S.effectiveSource({ source: {} }, sl), sl.source,
    'and an empty chapter entry falls through to the storyline rather than blanking it');
}
console.log('  effectiveSource: own wins, else inherited, empty is not a value: OK');

// ── 3. ⚠️ The routes actually apply the rule ────────────────────────────────────────────────────
{
  const chapRoute = server.slice(server.indexOf("url.pathname === '/api/topic-source'"));
  const chap = chapRoute.slice(0, chapRoute.indexOf('\n    if (M ==='));
  assert.ok(/sourcesEqual\(source, _sl && _sl\.source\)/.test(chap),
    '⚠️ the chapter route compares against the storyline before storing — without this a chapter ' +
    'keeps a duplicate and silently stops following later storyline edits');
  assert.ok(/else delete saved\.source/.test(chap), 'and an equal (or empty) entry is deleted');

  const slRoute = server.slice(server.indexOf("url.pathname === '/api/storyline-source'"));
  const sl = slRoute.slice(0, slRoute.indexOf('\n    if (M ==='));
  assert.ok(/for \(const cid of \(sl\.chapters \|\| \[\]\)\)/.test(sl) && /sourcesEqual\(t\.source, source\)/.test(sl),
    '⚠️ setting the storyline clears chapter entries that now merely repeat it — left behind, they ' +
    'would detach those chapters from every future edit, and the next chapter save might never come');
  assert.ok(/sl\.source = null/.test(sl) && /delete _st\.source/.test(sl),
    '⚠️ clearing works THROUGH upsertStoryline, which merges {...existing, ...sl} — a `delete` on ' +
    'the local object would be undone by that spread, so the key is dropped after the merge');
}
console.log('  both routes enforce "store only if it differs": OK');

// ── 4. ⚠️ `source` rides in the savedList whitelist ─────────────────────────────────────────────
// The FOURTH instance of the trap the projection's own comments record (v74_i, v79_n, v89_y): a
// field left out here works in the STATIC build (which ships whole topics) and is silently dead LIVE.
{
  const at = server.indexOf('lessonCount: (l.lessons || [])');
  assert.ok(at > -1, 'the savedList projection is where it was');
  const proj = server.slice(at - 2500, at + 2500);
  assert.ok(/\.\.\.\(l\.source && Object\.keys\(l\.source\)\.length \? \{ source: l\.source \} : \{\}\)/.test(proj),
    '⚠️ chapter `source` is in the savedList projection — the provenance line reads it from ' +
    'APP.savedList, so omitted it would work statically and show nothing live');
}
console.log('  chapter source rides in the savedList projection: OK');

// ── 5. The client resolves and renders the same way ─────────────────────────────────────────────
{
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.info = { backend:'ollama', canGenerate:true };
    APP.storylines = [{ id:'sl_1', chapters:['tp_a','tp_b'], source:{ author:'SL Author', url:'https://s.example/x' } }];
    true;`, 'seed');

  // A chapter with no entry inherits its storyline's — via APP.storylines, the same walk the server does.
  const inh = JSON.parse(C.run(`JSON.stringify(provEffective({ id:'tp_a' }))`));
  assert.strictEqual(inh.author, 'SL Author', 'the client inherits too');
  const own = JSON.parse(C.run(`JSON.stringify(provEffective({ id:'tp_a', source:{ author:'Mine' } }))`));
  assert.strictEqual(own.author, 'Mine', 'and its own entry still wins');
  assert.strictEqual(C.run(`provEffective({ id:'tp_zzz' })`), null, 'a chapter in no storyline: null');

  // ⚠️ The URL is a real, clickable link — the user asked for "author and URL … clickable".
  const html = C.run(`provCompactHtml({ author:'xkcd', url:'https://xkcd.com/3290/' })`);
  assert.ok(/<a href="https:\/\/xkcd\.com\/3290\/"/.test(html), 'the URL renders as a link');
  assert.ok(/target="_blank"/.test(html) && /rel="noopener"/.test(html), 'opening safely');
  assert.ok(/onclick="event\.stopPropagation\(\)"/.test(html),
    '⚠️ and the click does NOT fall through to the card behind it — these lines sit inside clickable ' +
    'storyline cards, so without this, following the link would also navigate');
  assert.ok(html.includes('xkcd'), 'the author is the visible label');
  assert.strictEqual(C.run(`provCompactHtml(null)`), '', 'nothing to show renders nothing');
  // A DOI is expanded, reusing _provSrcBits' existing rule rather than a second copy.
  assert.ok(/href="https:\/\/doi\.org\/10\.1000\/xyz"/.test(C.run(`provCompactHtml({ url:'10.1000/xyz' })`)),
    'a DOI is linked through doi.org, by the same helper the chapter line already used');
  // ⚠️ Escaping: an author name is user input and lands inside markup.
  assert.ok(!/<script>/.test(C.run(`provCompactHtml({ author:'<script>x</script>' })`)),
    'an author name cannot inject markup');
}
console.log('  the client inherits identically and renders a safe, clickable link: OK');

// ── 6. The three surfaces, and the editor ───────────────────────────────────────────────────────
{
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.info = { backend:'ollama', canGenerate:true }; APP._teacherMode = true;
    APP.storylines = [{ id:'sl_1', chapters:['tp_a'], source:{ author:'SL Author', url:'https://s.example/x' } }];
    APP._slScreen = { chainId:'sl_1' };
    TOASTS = []; showToast = function(m){ TOASTS.push(m); };
    renderSlProv(); true;`, 'render');
  // ⚠️ `sl-screen-src`, NOT `sl-screen-prov`: that id already belongs to the storyline page's
  // provenance/stats FOOTER (provLineForChapters). A first draft reused it, and the duplicate made
  // getElementById hand THIS node to the footer's renderer as well — silently breaking it. The
  // e2e's own ordering assertion is what caught it, which is why that check is worth its keep.
  const slLine = C.run(`document.getElementById('sl-screen-src').innerHTML`);
  assert.strictEqual(C.run(`document.querySelectorAll('#sl-screen-prov').length <= 1`), true,
    'and the footer keeps its own id to itself');
  assert.ok(slLine.includes('SL Author'), 'the storyline page shows the storyline entry');
  assert.ok(/openSlProvEdit\(\)/.test(slLine), 'with a pencil for the teacher-only editor');

  // The completion card shows the chapter's EFFECTIVE source (inherited here).
  C.run(`renderProvInto('comp-story-prov', provEffective({ id:'tp_a' }), null); true;`, 'comp');
  assert.ok(C.run(`document.getElementById('comp-story-prov').innerHTML`).includes('SL Author'),
    'the completion card shows the INHERITED entry, not nothing');

  // ⚠️ The editor posts the storyline id and all four fields.
  C.run(`SENT = null;
    fetch = async function(u,o){ SENT = { url:u, body: JSON.parse(o.body) };
      return { ok:true, json: async () => ({ ok:true, source:{}, freed:0 }) }; };
    loadSavedList = async function(){}; 
    openSlProvEdit();
    document.getElementById('slprov-in-author').value = 'New Author';
    document.getElementById('slprov-in-url').value = 'https://n.example/';
    saveSlProvEdit(null); true;`, 'save');
  const sent = JSON.parse(C.run(`JSON.stringify(SENT)`));
  assert.strictEqual(sent.url, '/api/storyline-source', 'the STORYLINE route, not the chapter one');
  assert.strictEqual(sent.body.slId, 'sl_1', 'with the storyline id');
  assert.deepStrictEqual(Object.keys(sent.body.source).sort(), ['author', 'licence', 'note', 'url'],
    'and all four fields, so clearing one really clears it');
  assert.strictEqual(sent.body.source.author, 'New Author', 'carrying what was typed');
}
console.log('  storyline page, completion card and the storyline editor all wired: OK');

console.log('unit-provenance-inherit: ALL PASSED');
