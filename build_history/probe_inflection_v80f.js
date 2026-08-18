// probe_inflection_v80f.js — THE INFLECTION SHARE.
//
// Why this exists. The text-focus design (roadmap: "TEXT-FOCUSED PROGRESS CARD") turns each taught
// word in the chapter text from red to green as its questions are solved. That only works for words
// the app can FIND in the text. Measured at the v80_e cut with the app's own matcher (a
// case-insensitive substring test): of 21.4 highlightable words per chapter, only 10.0 occur in the
// story — 47%. The other 53% is the question this probe answers:
//
//   Is a missed word ABSENT from the story, or PRESENT IN ANOTHER FORM?
//
// The difference decides the design. An absent word can never turn green no matter what matcher is
// used — that is a ceiling. A word present as an inflection is recoverable, by lemmatisation or by
// an LLM pass, and the size of that band is the payoff for building one.
//
// ⚠️ THIS IS A MEASURING INSTRUMENT FOR A HUMAN, NOT A VALIDATOR — the same standing as
// probe_word_forms_v79i.js. Its middle band is produced by EDIT DISTANCE AND SHARED PREFIX, which
// are not morphology. They are deliberately language-blind, because this codebase does not encode
// language knowledge (INTERNALS: "no language knowledge in the code"). So:
//   • the band is an UPPER BOUND on what a matcher could recover — a short word can land within
//     edit distance 2 of an unrelated token by accident;
//   • it is a LOWER BOUND for languages whose inflection is not suffixal (German ge- participles,
//     Semitic root templates, Hungarian agglutination stack up distance fast);
//   • for scripts written without spaces the token model does not apply AT ALL, so those chapters
//     are reported separately and MUST NOT be folded into the headline.
// Read the bands, not a single number. Nothing here asserts.
'use strict';
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require(path.join(__dirname, '..', 'test', 'lib-dom'));

const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI    = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

// Languages with no word separator: a token split on non-letters returns whole clauses, so "is this
// word a token" is meaningless. Reported apart rather than silently averaged in.
//
// ⚠️ Keyed on LANGUAGE, not on the topic's `script` stamp. The first version of this probe used the
// stamp and was wrong: only 19 of 324 topics carry one (it is stamped where a language has a script
// CHOICE, which is `sr`), so 13 Japanese chapters were scored with the token model — the exact
// error this block exists to prevent, committed by the block itself.
const NO_SPACE = new Set(['ja', 'zh', 'zh-TW', 'th', 'km', 'lo', 'my']);

const SAVED = store.topics.map(t => ({ id: t.id, topic: t.topic, lang: t.lang, srcLang: t.srcLang,
  story: t.story, lessons: t.lessons }));

const C = loadClient({ quiet: true });
C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
  APP.savedList = ${JSON.stringify(SAVED)};
  APP.storylines = ${JSON.stringify(store.storylines || [])};
  APP.info = { backend:'none', canGenerate:false, coverageThreshold:1 };
  APP._teacherMode = false; saveProg = function(){}; true;`);

// Levenshtein, capped — we only care whether it is <= 2.
function lev(a, b, cap) {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < best) best = cur[j];
    }
    if (best > cap) return cap + 1;
    prev = cur;
  }
  return prev[b.length];
}

const norm = s => String(s == null ? '' : s).toLowerCase().normalize('NFC').trim();
// A SECOND normaliser, used only to size one band: typographic apostrophes/quotes and dash variants
// folded to ASCII. A word that matches only under this is not an inflection at all — it is a free
// match the current matcher drops. Sized separately because the fix is one line, not a model call.
const fold = s => norm(s).replace(/[\u2018\u2019\u02BC\u2032]/g, "'").replace(/[\u2010-\u2015]/g, '-').replace(/\u00A0/g, ' ');

const band = { exact: 0, substr: 0, norm: 0, nearPre: 0, nearEdit: 0, absent: 0 };
const byScript = {};
const noSpace = { chapters: 0, words: 0, substr: 0 };
const examples = [], noise = [];
let chapters = 0, wordsTotal = 0;

for (const t of store.topics) {
  if (!(t.story || '').trim() || !(t.lessons || []).length) continue;

  // The highlight set the app renders today: vocab targets + every _storyWordSources word.
  // Taken from the PRODUCT, not re-derived, so this measures what the screen would show.
  const words = JSON.parse(C.run(`(function(){
    APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{}, storyShown:{} };
    APP.lessonData = ${JSON.stringify(t)};
    if (typeof _invalidateQidUniverse === 'function') _invalidateQidUniverse();
    var d = APP.lessonData;
    var v = (d.lessons||[]).flatMap(function(L){ return L.vocab||[]; }).map(function(x){ return x.target; });
    var e = _storyWordSources(d).map(function(s){ return s.word; });
    return JSON.stringify(Array.from(new Set(v.concat(e).filter(Boolean))));
  })()`));
  if (!words.length) continue;

  const script = t.lang || '?';
  const story = norm(t.story);
  const spaceless = NO_SPACE.has(t.lang);

  if (spaceless) {
    noSpace.chapters++;
    noSpace.words += words.length;
    noSpace.substr += words.filter(w => norm(w) && story.includes(norm(w))).length;
    continue;
  }

  chapters++;
  const toks = Array.from(new Set(story.split(/[^\p{L}\p{N}'’-]+/u).filter(Boolean)));
  const foldStory = fold(t.story);
  const foldToks = new Set(toks.map(fold));
  const tokSet = new Set(toks);
  const S = (byScript[script] = byScript[script] || { exact: 0, substr: 0, norm: 0, nearPre: 0, nearEdit: 0, absent: 0 });

  for (const raw of words) {
    const w = norm(raw);
    if (!w) continue;
    wordsTotal++;
    // A multi-word phrase is judged by substring only — token logic does not apply to it.
    const multi = /\s/.test(w);
    let cls;
    if (tokSet.has(w)) cls = 'exact';
    else if (story.includes(w)) cls = 'substr';
    else if (foldToks.has(fold(raw)) || foldStory.includes(fold(raw))) cls = 'norm';
    else if (multi) cls = 'absent';
    else {
      // The recoverable band: some token looks like a form of this word.
      const cap = w.length <= 4 ? 1 : 2;                       // short words: tighter, or noise wins
      const minPre = Math.max(4, Math.ceil(w.length * 0.6));
      // Split deliberately. A SHARED STEM is evidence of a common root; a bare edit distance on a
      // short word is mostly noise — the first run produced chaud->chaque, vois->fois, sais->mais.
      const pre = toks.find(tk => tk.length >= minPre && w.length >= minPre &&
        (tk.startsWith(w.slice(0, minPre)) || w.startsWith(tk.slice(0, minPre))));
      if (pre) {
        cls = 'nearPre';
        if (examples.length < 10) examples.push(`STEM  ${t.lang}  ${raw}  ->  ${pre}`);
      } else {
        const ed = toks.find(tk => lev(w, tk, cap) <= cap);
        if (ed) {
          cls = 'nearEdit';
          if (noise.length < 10) noise.push(`EDIT  ${t.lang}  ${raw}  ->  ${ed}`);
        } else cls = 'absent';
      }
    }
    band[cls]++; S[cls]++;
  }
}

const pc = (a, b) => b ? (100 * a / b).toFixed(1) + '%' : '—';
const tot = band.exact + band.substr + band.norm + band.nearPre + band.nearEdit + band.absent;
const today = band.exact + band.substr;

console.log('THE INFLECTION SHARE — measured at the v80_e cut\n');
console.log(`chapters measured (space-separated languages) : ${chapters}`);
console.log(`highlightable words in them                   : ${tot}\n`);
console.log('  EXACT     whole token in the story            : ' + String(band.exact).padStart(6) + '  ' + pc(band.exact, tot));
console.log('  SUBSTR    inside a token (compound)           : ' + String(band.substr).padStart(6) + '  ' + pc(band.substr, tot));
console.log('  --------  WHAT THE APP MATCHES TODAY          : ' + String(today).padStart(6) + '  ' + pc(today, tot));
console.log('  NORM      matches once apostrophes/dashes fold: ' + String(band.norm).padStart(6) + '  ' + pc(band.norm, tot) + '   <- FREE, one line, no model');
console.log('  NEAR/stem shares a stem with a token          : ' + String(band.nearPre).padStart(6) + '  ' + pc(band.nearPre, tot) + '   <- credible inflection');
console.log('  NEAR/edit only within edit distance           : ' + String(band.nearEdit).padStart(6) + '  ' + pc(band.nearEdit, tot) + '   <- mostly NOISE, see below');
console.log('  ABSENT    nothing resembles it                : ' + String(band.absent).padStart(6) + '  ' + pc(band.absent, tot) + '   <- CEILING: no matcher helps');
console.log('\n  credible ceiling  (today + norm + stem)      : ' + pc(today + band.norm + band.nearPre, tot));
console.log('  optimistic ceiling (+ edit distance too)     : ' + pc(today + band.norm + band.nearPre + band.nearEdit, tot));

console.log('\nby target language — inflection load differs enormously:');
Object.entries(byScript)
  .map(([k, v]) => [k, v, v.exact + v.substr + v.norm + v.nearPre + v.nearEdit + v.absent])
  .sort((a, b) => b[2] - a[2]).slice(0, 9)
  .forEach(([s, v, n]) => console.log(`  ${s.padEnd(6)} n=${String(n).padStart(5)}   today ${pc(v.exact + v.substr, n).padStart(6)}   +stem ${pc(v.nearPre, n).padStart(6)}   absent ${pc(v.absent, n).padStart(6)}`));

console.log('\nspace-less languages, reported APART (the token model does not apply):');
console.log(`  chapters ${noSpace.chapters}, words ${noSpace.words}, matched by substring today ${pc(noSpace.substr, noSpace.words)}`);

console.log('\nsample STEM pairs — the credible band:');
examples.forEach(e => console.log('  ' + e));
console.log('\nsample EDIT-only pairs — judge the noise yourself:');
noise.forEach(e => console.log('  ' + e));
console.log('\n(reported, not asserted — see the header)');
