// unit-story-panel-states.test.js
// v80_r — TRACK T step 2: ONE story panel renderer, three-state colouring, asked-span underline.
//
// `_highlightVocabHtml` gained two optional arguments: a Map of `_hlKey` → 'red'|'partial'|'green'
// and a Set of keys to underline. When neither is passed NOTHING changes, which is why they are
// extra parameters rather than a replacement — every existing caller still gets the v74_n two-shade
// behaviour.
//
// ⚠️ SCOPE, ruled at v80_s (option 3): the panel is on EVERY question card and starts COLLAPSED where
// the story would give the answer away — word_forms 203/336 (60.4%), error_hunt 44/47 (93.6%),
// synonyms 14/34 (41.2%), and the typed kinds, which leak the spelling. §5 pins both halves.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

const C = loadClient({ quiet: true });
C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`);

const hl = (html, words, strong, states, asked) => C.run(`(function(){
  var st = ${states ? 'new Map(' + JSON.stringify(Object.entries(states)) + ')' : 'null'};
  var ak = ${asked ? 'new Set(' + JSON.stringify(asked) + ')' : 'null'};
  var stKeyed = null;
  if (st) { stKeyed = new Map(); st.forEach(function(v,k){ stKeyed.set(_hlKey(k), v); }); }
  var akKeyed = null;
  if (ak) { akKeyed = new Set(); ak.forEach(function(k){ akKeyed.add(_hlKey(k)); }); }
  return _highlightVocabHtml(${JSON.stringify(html)}, ${JSON.stringify(words)}, ${JSON.stringify(strong || [])}, stKeyed, akKeyed);
})()`);

// ── 1. Without the new arguments, nothing changes ────────────────────────
{
  const out = hl('the cat sat on the mat', ['cat', 'mat'], ['cat']);
  assert.ok(/<mark class="story-vocab-hl solved">cat<\/mark>/.test(out), 'solved word keeps its shade');
  assert.ok(/<mark class="story-vocab-hl">mat<\/mark>/.test(out), 'unsolved word keeps its shade');
  assert.ok(!/wp-/.test(out), 'and no TRACK T class appears when no state map is passed');
  console.log('  existing two-shade behaviour is untouched');
}

// ── 2. With a state map, each word gets its own state ────────────────────
{
  const out = hl('the cat sat on the mat and the rug', ['cat', 'mat', 'rug'], [],
    { cat: 'green', mat: 'partial', rug: 'red' });
  // v80_t re-pinned these. The marks gained `wp-tap`, `role` and an `onclick` when tapping shipped,
  // so an exact-attribute match broke. The CLAIM is unchanged (rule 29): the word carries its state
  // class. Matched on the class list containing the state, with other classes allowed.
  const marked = (html, word, state) =>
    new RegExp('<mark class="[^"]*\\bwp-' + state + '\\b[^"]*"[^>]*>' + word + '<\\/mark>').test(html);
  assert.ok(marked(out, 'cat', 'green'), 'green word');
  assert.ok(marked(out, 'mat', 'partial'), 'partial word');
  assert.ok(marked(out, 'rug', 'red'), 'red word');
  console.log('  three states render distinctly');
}

// ── 3. A word missing from the map falls back to RED, not to unmarked ────
// Safe direction: an unknown word reads as "not done", never as done.
{
  const out = hl('the cat sat', ['cat'], [], { other: 'green' });
  assert.ok(/<mark class="[^"]*\bwp-red\b[^"]*"[^>]*>cat</.test(out), 'a word with no state entry is RED');
  console.log('  unknown words fall back to red');
}

// ── 4. The asked span is UNDERLINED on top of its colour ─────────────────
// T0: "underline additionally to the coloring" — so it must be BOTH classes, not a replacement.
{
  const out = hl('the cat sat on the mat', ['cat', 'mat'], [], { cat: 'green', mat: 'red' }, ['cat']);
  assert.ok(/<mark class="[^"]*\bwp-green\b[^"]*\bwp-asked\b[^"]*"[^>]*>cat</.test(out),
    'the asked word keeps its state class AND gains the underline class');
  assert.ok(!/<mark class="[^"]*\bwp-asked\b[^"]*"[^>]*>mat</.test(out),
    'and only the asked word is underlined');
  console.log('  the asked span is underlined in addition to its colour');
}

// ── 5. The panel is on EVERY question card and is NEVER collapsed ───────
// v80_u, user ruling superseding v80_s's option 3: *"Don't collapse the story text on some
// questions… we now want to keep the user's attention on the text throughout."* The leakage measured
// at v80_s is unchanged and now an ACCEPTED cost — scanning the text for the answer is reading
// practice, which is what TRACK T is for.
//
// Asserted by RENDERING, not by matching source: the v80_s version of this pinned
// `_open ? ' open' : ''` and could not fail when `_open` was mutated to a constant.
{
  const mk = (type) => C.run(`(function(){
    APP.lessonData = { topic:'T', lang:'fr', srcLang:'de',
      story:'Le chat dort. Le chien court vite.', lessons:[] };
    APP._teacherMode = false; APP.info = { canGenerate:false };
    return _exStoryPanelHtml({ type: ${JSON.stringify(type)}, target:'chat', correct:'chat' });
  })()`);
  const types = ['comprehension_mcq', 'word_form', 'syn_select', 'listen_type', 'type_plural',
                 'type_conjugation', 'error_hunt', 'mcq_source_target'];
  for (const ty of types) {
    const h = mk(ty);
    assert.ok(/id="ex-story-panel"/.test(h), `${ty}: the story panel is rendered (T0)`);
    assert.ok(/<details id="ex-story-panel" open/.test(h),
      `${ty}: and it is OPEN — the panel is never collapsed (v80_u)`);
  }
  console.log(`  panel rendered and open on all ${types.length} question types`);
}

// ── 5b. ⚠️ It renders even when the story is NOT unlocked ───────────────
// T0: the text is visible "even before the chapter text is unlocked". The old gate deferred to
// `storyUnlocked`, which passed in the app (a backend makes `canGenerate` true) and failed in the
// STATIC build — one rule, two environments, opposite outcomes, reported as a static-build bug.
{
  const h = C.run(`(function(){
    APP.lessonData = { topic:'T', lang:'fr', srcLang:'de', story:'Le chat dort.', lessons:[] };
    APP._teacherMode = false; APP.info = { canGenerate:false };
    storyUnlocked = function(){ return false; };      // explicitly locked
    return _exStoryPanelHtml({ type:'mcq_source_target', target:'chat', correct:'chat' });
  })()`);
  assert.ok(/id="ex-story-panel"/.test(h),
    'the panel renders with the story LOCKED, no teacher mode and no backend — the case the static ' +
    'build hit');
  console.log('  panel renders even when the story is locked (T0)');
}

// ── 5c. Elision: an apostrophe-final pronoun binds to the form ──────────
// French `j'` + `emporte` must be `j'emporte`. With a space the TTS reads the apostrophe aloud
// ("j apostrophe emporte"), which the user heard on a conjugation lesson.
{
  const j = (p_, f_) => C.run(`_joinPronoun(${JSON.stringify(p_)}, ${JSON.stringify(f_)})`);
  assert.strictEqual(j("j'", 'emporte'), "j'emporte", 'ASCII apostrophe binds directly');
  assert.strictEqual(j('j’', 'emporte'), 'j’emporte', 'typographic apostrophe too');
  assert.strictEqual(j('tu', 'emportes'), 'tu emportes', 'a normal pronoun keeps its space');
  assert.strictEqual(j('il/elle/on', 'emporte'), 'il/elle/on emporte', 'merged pronouns keep it');
  assert.strictEqual(j('', 'emporte'), 'emporte', 'no pronoun, no leading space');
  console.log('  elision joins without a space; other pronouns keep theirs');
}

// ── 6. The CSS for all four classes exists ───────────────────────────────
// A class the renderer emits but the stylesheet lacks is invisible: the word would render unmarked
// and the panel would silently look finished.
{
  const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  for (const cls of ['wp-red', 'wp-partial', 'wp-green', 'wp-asked']) {
    assert.ok(new RegExp('\\.story-vocab-hl\\.' + cls + '\\{').test(src),
      `.story-vocab-hl.${cls} has a style rule — an emitted class with no CSS renders as nothing`);
  }
  console.log('  every emitted state class has a style rule');
}

console.log('unit-story-panel-states: ALL PASSED');
