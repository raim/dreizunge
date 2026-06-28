// v48 — Intro "learn the script" course (LLM-free). Guards: scripts.json table integrity,
// the script-for-language / needs-intro gating, and that the client and server exercise
// builders produce the same exercise set (so static and live builds agree). Pure helpers
// extracted from index.html / server.js.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const scripts = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts.json'), 'utf8'));

function ext(src, n) {
  const at = src.indexOf('function ' + n + '(');
  assert.ok(at >= 0, 'missing fn ' + n);
  const b = src.indexOf('{', at);
  let d = 0, i = b;
  for (; i < src.length; i++) { const c = src[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(at, i);
}

// ── Table integrity ──────────────────────────────────────────────────────────
const langScript = scripts._langScript || {};
assert.ok(Object.keys(langScript).length > 0, '_langScript map present');
for (const [lang, scr] of Object.entries(langScript)) {
  const arr = Array.isArray(scr) ? scr : [scr];
  for (const s of arr) {
    assert.ok(scripts[s], `_langScript ${lang} → ${s}: script key must exist (stub or full)`);
  }
}
// Phase-1: cyrillic must be a complete, well-formed table.
const cyr = scripts.cyrillic;
assert.ok(cyr && Array.isArray(cyr.letters) && cyr.letters.length >= 30, 'cyrillic has a full letter table');
cyr.letters.forEach((L, i) => {
  assert.ok(L.ch, `cyrillic[${i}] has ch`);
  assert.ok(L.translit !== undefined || L.name, `cyrillic[${i}] has translit or name`);
});
// No duplicate glyphs.
const chs = cyr.letters.map(L => L.ch);
assert.strictEqual(new Set(chs).size, chs.length, 'cyrillic glyphs are unique');
console.log('  scripts.json: _langScript resolves, cyrillic table complete + unique: OK');

// ── scriptsForLang / needsIntroScript gating ─────────────────────────────────
const SCRIPTS_DATA = scripts;
const scriptsForLang = new Function('SCRIPTS_DATA', ext(html, 'scriptsForLang') + '\nreturn scriptsForLang;')(SCRIPTS_DATA);
const scriptHasTable = new Function('SCRIPTS_DATA', ext(html, 'scriptHasTable') + '\nreturn scriptHasTable;')(SCRIPTS_DATA);
const needsIntroScript = new Function('SCRIPTS_DATA', 'scriptsForLang', 'scriptHasTable',
  ext(html, 'needsIntroScript') + '\nreturn needsIntroScript;')(SCRIPTS_DATA, scriptsForLang, scriptHasTable);

assert.deepStrictEqual(scriptsForLang('ja'), ['hiragana', 'katakana'], 'ja → two scripts');
assert.deepStrictEqual(scriptsForLang('ru'), ['cyrillic'], 'ru → cyrillic');
assert.deepStrictEqual(scriptsForLang('it'), [], 'it (Latin) → no script entry');
assert.strictEqual(scriptHasTable('cyrillic'), true, 'cyrillic table is usable');
assert.strictEqual(scriptHasTable('hiragana'), true, 'hiragana table is filled');
assert.strictEqual(scriptHasTable('katakana'), true, 'katakana table is filled');
assert.strictEqual(scriptHasTable('arabic'), true, 'arabic table is filled');
assert.strictEqual(scriptHasTable('greek'), true, 'greek table is filled');
assert.strictEqual(scriptHasTable('hangul'), true, 'hangul table is filled');
assert.strictEqual(scriptHasTable('hebrew'), true, 'hebrew table is filled');
assert.strictEqual(scriptHasTable('thai'), false, 'thai is still a stub (empty)');

assert.strictEqual(needsIntroScript('ru', 'en'), true,  'en→ru: new script with a table');
assert.strictEqual(needsIntroScript('it', 'en'), false, 'en→it: Latin, no intro');
assert.strictEqual(needsIntroScript('ru', 'ru'), false, 'ru→ru: same script, no intro');
assert.strictEqual(needsIntroScript('uk', 'ru'), false, 'ru→uk: both cyrillic, no intro');
assert.strictEqual(needsIntroScript('ja', 'en'), true,  'en→ja: kana tables filled → offered');
assert.strictEqual(needsIntroScript('ar', 'en'), true,  'en→ar: arabic table filled → offered');
assert.strictEqual(needsIntroScript('el', 'en'), true,  'en→el: greek table filled → offered');
assert.strictEqual(needsIntroScript('ko', 'en'), true,  'en→ko: hangul table filled → offered');
assert.strictEqual(needsIntroScript('he', 'en'), true,  'en→he: hebrew table filled → offered');
assert.strictEqual(needsIntroScript('th', 'en'), false, 'en→th: thai still a stub → hidden');
console.log('  scriptsForLang / scriptHasTable / needsIntroScript gating: OK');

// ── Filled tables: integrity + unambiguous transliterations ──────────────────
for (const [name, min] of [['hiragana', 46], ['katakana', 46], ['arabic', 28],
                           ['greek', 24], ['hebrew', 22], ['hangul', 24]]) {
  const tbl = scripts[name];
  assert.ok(tbl && Array.isArray(tbl.letters) && tbl.letters.length >= min, `${name} has ${min}+ letters`);
  tbl.letters.forEach((L, i) => {
    assert.ok(L.ch, `${name}[${i}] has ch`);
    assert.ok(L.translit !== undefined || L.name, `${name}[${i}] has translit or name`);
  });
  const g = tbl.letters.map(L => L.ch);
  assert.strictEqual(new Set(g).size, g.length, `${name} glyphs unique`);
  // Distinct transliterations matter: a whole script becomes one lesson, so a repeated
  // sound would make the sound→glyph question ambiguous (two correct glyphs).
  const tr = tbl.letters.map(L => (L.translit || L.name));
  assert.strictEqual(new Set(tr).size, tr.length, `${name} transliterations unique (no ambiguous sound→glyph)`);
}
assert.strictEqual(scripts.arabic.rtl, true, 'arabic table is RTL');
assert.strictEqual(scripts.hebrew.rtl, true, 'hebrew table is RTL');
assert.strictEqual(scripts.greek.rtl, false, 'greek table is LTR');
console.log('  filled tables (hiragana/katakana/arabic): integrity + unique translits: OK');

// ── Content-aware script/letter detection (v47.x) ────────────────────────────
const detectSrc = ['scriptHasTable', '_scriptCharSet', '_lessonSetTargetText',
  'scriptsUsedInLessonSet', 'makeParentResolver', 'priorLessonSets', '_lettersInSets',
  'lettersSeenInLessonSet', 'introLetterScope'].map(n => ext(html, n)).join('\n');
const _APP = { savedList: [] };
const D = new Function('SCRIPTS_DATA', 'scriptsForLang', 'APP', 'allSaved',
  detectSrc + '\nreturn { scriptsUsedInLessonSet, introLetterScope, priorLessonSets };'
)(SCRIPTS_DATA, scriptsForLang, _APP, () => _APP.savedList);

const jaHira = { lang: 'ja', story: 'いぬは まちへ でかけます', lessons: [{ vocab: [{ target: 'いぬ' }] }] };
const jaKata = { lang: 'ja', story: 'ぼくの ボール が ない', lessons: [] };
assert.deepStrictEqual(D.scriptsUsedInLessonSet(jaHira), ['hiragana'],
  'JA set with no katakana → hiragana only (no katakana lesson)');
assert.deepStrictEqual(D.scriptsUsedInLessonSet(jaKata), ['hiragana', 'katakana'],
  'JA set containing katakana → both');
assert.deepStrictEqual(D.scriptsUsedInLessonSet({ lang: 'ja', lessons: [] }), ['hiragana', 'katakana'],
  'empty JA set → fall back to all scripts');
assert.deepStrictEqual(D.scriptsUsedInLessonSet({ lang: 'ar', story: 'يوسف له قطة', lessons: [] }), ['arabic'],
  'Arabic set → arabic');
const withIntro = { lang: 'ja', lessons: [{ type: 'intro_script', letters: scripts.katakana.letters }] };
assert.deepStrictEqual(D.scriptsUsedInLessonSet(withIntro), ['hiragana', 'katakana'],
  'a set whose only content is an intro lesson → fall back to all (not seeded by the intro)');

// Storyline-aware reinforce/extend: ch1 (prior) introduces some letters, ch2 (current) adds new
// ones. reinforce → letters from earlier chapters; extend → letters new to this chapter.
const ch1 = { id: 'c1', lang: 'ar', srcLang: 'en', topic: 'ch1', story: 'يوسف له', lessons: [] };
const ch2 = { id: 'c2', lang: 'ar', srcLang: 'en', topic: 'ch2', continuedFromId: 'c1', story: 'قطة اسمها لولو وكان', lessons: [] };
_APP.savedList = [ch1, ch2];
assert.deepStrictEqual(D.priorLessonSets(ch2).map(c => c.id), ['c1'], 'ch2 prior chapter is c1');
const rev = D.introLetterScope(ch2, 'arabic', 'reinforce');
const ext2 = D.introLetterScope(ch2, 'arabic', 'extend');
assert.ok(rev.scoped && rev.letters.length >= 4, 'reinforce scoped to earlier-chapter letters');
assert.ok(rev.letters.every(L => 'يوسف له'.includes(L.ch)), 'reinforce letters all came from chapter 1');
assert.ok(ext2.scoped && ext2.letters.length >= 4, 'extend scoped to new letters this chapter');
assert.ok(ext2.letters.every(L => 'قطةاسمهالولووكان'.includes(L.ch) && !'يوسف له'.includes(L.ch)),
  'extend letters are new to chapter 2 (not in chapter 1)');
assert.strictEqual(D.introLetterScope(ch2, 'arabic', 'neutral').letters.length, scripts.arabic.letters.length,
  'neutral → full alphabet');
// First chapter (no prior) reinforce/extend has nothing to scope from → falls back to full.
assert.strictEqual(D.introLetterScope(ch1, 'arabic', 'reinforce').scoped, false,
  'first chapter reinforce → no prior letters → full alphabet');
console.log('  storyline-aware reinforce (prior chapters) / extend (new this chapter): OK');

// ── Client/server exercise builders agree (structure, ignoring choice order) ─
const shuffleIdentity = a => a;
const clientFrom = new Function('shuffle', 'SCRIPTS_DATA',
  ext(html, 'introScriptExercisesFrom') + '\nreturn introScriptExercisesFrom;')(shuffleIdentity, SCRIPTS_DATA);
const serverEx = new Function(ext(server, 'introScriptExercises') + '\nreturn introScriptExercises;')();

const cl = clientFrom(cyr.letters);
const sv = serverEx(cyr.letters, { rnd: () => 0 });
assert.strictEqual(cl.length, sv.length, 'client and server produce the same exercise count');
// Expect: one glyph→sound + one sound→glyph per letter, plus up to 5 listen.
const kinds = (arr) => arr.reduce((m, e) => (m[e._intro] = (m[e._intro] || 0) + 1, m), {});
const ck = kinds(cl);
assert.strictEqual(ck.glyph_sound, cyr.letters.length, 'one glyph→sound per letter');
assert.strictEqual(ck.sound_glyph, cyr.letters.length, 'one sound→glyph per letter');
assert.ok(ck.listen_glyph >= 1 && ck.listen_glyph <= 5, 'a few listen→glyph items');
assert.deepStrictEqual(kinds(cl), kinds(sv), 'client/server kind histograms match');

// Each exercise reuses an existing renderer type and has a correct answer in its choices.
const okTypes = new Set(['mcq_source_target', 'mcq_target_source', 'listen_mcq']);
cl.forEach((e, i) => {
  assert.ok(okTypes.has(e.type), `ex[${i}] uses an existing renderer (${e.type})`);
  assert.ok(e.choices.includes(e.correct), `ex[${i}] choices include the correct answer`);
  assert.ok(e.choices.length >= 3, `ex[${i}] has ≥3 choices`);
});
// REGRESSION GUARD (v47.x): a glyph→glyph or answer-revealing question. Both MCQ directions
// must use mcq_source_target, which renders ex.source as the prompt + ex.choices as buttons.
// mcq_target_source would render ex.target (the glyph = the answer) plus a "tap to listen"
// block, turning sound→glyph into "show غ, pick غ". So:
cl.filter(e => e._intro === 'sound_glyph').forEach((e, i) => {
  assert.strictEqual(e.type, 'mcq_source_target', `sound_glyph[${i}] must be mcq_source_target (show sound, pick glyph)`);
  // The prompt (ex.source = the sound/name) must NOT be the glyph answer.
  assert.notStrictEqual(e.source, e.correct, `sound_glyph[${i}] prompt must not equal the glyph answer`);
});
cl.filter(e => e._intro === 'glyph_sound').forEach((e, i) => {
  assert.strictEqual(e.type, 'mcq_source_target', `glyph_sound[${i}] is mcq_source_target`);
  assert.notStrictEqual(e.source, e.correct, `glyph_sound[${i}] prompt (glyph) must not equal the sound answer`);
});
// No MCQ renders its own answer in the prompt field.
cl.filter(e => e.type !== 'listen_mcq').forEach((e, i) => {
  assert.notStrictEqual(e.source, e.correct, `mcq[${i}] (${e._intro}) does not reveal its answer in the prompt`);
});
// Listen items must carry _intro (so tLMcq hides the spoken glyph instead of revealing it) and
// a pron (so the muted / no-audio fallback can show the transliteration as the prompt).
cl.filter(e => e.type === 'listen_mcq').forEach((e, i) => {
  assert.strictEqual(e._intro, 'listen_glyph', `listen item ${i} marked _intro=listen_glyph`);
  assert.ok(e.pron, `listen item ${i} has a pron for the no-audio fallback`);
  assert.notStrictEqual(e.pron, e.correct, `listen item ${i}: pron != glyph (audio is the cue)`);
});
console.log('  intro exercises: parity, no answer-reveal, sound↔glyph wiring, listen gating: OK');

// ── Difficulty cap + distractor pool (v47.x) ─────────────────────────────────
const introMaxLetters = new Function(ext(html, 'introMaxLetters') + '\nreturn introMaxLetters;')();
const introSelectLetters = new Function('shuffle', 'introMaxLetters',
  ext(html, 'introSelectLetters') + '\nreturn introSelectLetters;')(a => [...a], introMaxLetters);
assert.ok(introMaxLetters(1) < introMaxLetters(3), 'higher difficulty quizzes more letters');
const arAll = scripts.arabic.letters;                 // 28
for (const diff of [1, 2, 3]) {
  const sel = introSelectLetters(arAll, diff);
  assert.strictEqual(sel.length, introMaxLetters(diff), `difficulty ${diff} caps to ${introMaxLetters(diff)} letters`);
  assert.ok(sel.length < arAll.length, `difficulty ${diff} is a subset of the 28-letter alphabet`);
}
// A small scoped set (≤ cap) is returned unchanged.
assert.strictEqual(introSelectLetters(arAll.slice(0, 5), 3).length, 5, 'a set smaller than the cap is unchanged');
// Distractors still come from the full alphabet even for a short quiz set. (Use a real shuffle
// here — with the identity shuffle used above, slice(0,3) would always take the first letters.)
const clientFromShuf = new Function('shuffle', 'SCRIPTS_DATA',
  ext(html, 'introScriptExercisesFrom') + '\nreturn introScriptExercisesFrom;'
)(a => { const b=[...a]; for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];} return b; }, SCRIPTS_DATA);
const shortSet = arAll.slice(0, 6);
const glyphChoices = new Set();
// Aggregate over a few builds to avoid rare all-inside-subset draws.
for (let r = 0; r < 8; r++) {
  clientFromShuf(shortSet, { distractorPool: arAll })
    .filter(e => e._intro === 'sound_glyph')
    .forEach(e => e.choices.forEach(c => glyphChoices.add(c)));
}
const shortGlyphs = new Set(shortSet.map(L => L.ch + (L.lower && L.lower !== L.ch ? ' ' + L.lower : '')));
const fromOutside = [...glyphChoices].some(c => !shortGlyphs.has(c));
assert.ok(fromOutside, 'distractors are drawn from the full alphabet, not just the quizzed subset');
console.log('  difficulty cap + full-alphabet distractor pool: OK');

// ── Editor: intro_script lessons are editable (letters table) ────────────────
// The registry must route intro_script to its own editor branch (not the vocab one), and the
// generic move/delete/sync/flag helpers must know the `letter` → ls.letters mapping.
assert.ok(/intro_script:\s*\{[^}]*editorBranch:[^}]*_editorBranchIntroScript/.test(html),
  'intro_script registry uses _editorBranchIntroScript');
assert.ok(html.includes('function _editorBranchIntroScript'), 'intro editor branch exists');
// letter mapping present in the four helpers that dispatch by type
assert.ok(/_editorItem[\s\S]*?type===['"]letter['"]\?ls\.letters/.test(html), '_editorItem maps letter→letters');
assert.ok(/moveEditorItem[\s\S]*?type===['"]letter['"]\s*\?\s*ls\.letters/.test(html), 'moveEditorItem maps letter→letters');
assert.ok(/letter:['"]letters['"]/.test(html), 'deleteEditorItem soft-delete map includes letter→letters');
assert.ok(/type === ['"]letter['"][\s\S]*?ls\.letters\[fi\]/.test(html), '_syncEditorFromDOM writes letter fields back');
// editing/deleting a letter clears baked exercises so they re-derive
assert.ok(/type === ['"]letter['"][\s\S]*?delete ls\.exercises/.test(html), 'letter edits clear baked exercises');
console.log('  intro_script editor: branch wired + letter array mapping in move/delete/sync: OK');

// ── Registry + wiring guards ─────────────────────────────────────────────────
assert.ok(/intro_script:\s*\{[^}]*build:\s*\(l\)\s*=>\s*buildIntroScriptExercises\(l\)/.test(html),
  'intro_script registered in LESSON_TYPE_META with its builder');
assert.ok(/intro_script:\s*\(c\)\s*=>\s*generateIntroScript/.test(server),
  'intro_script registered in ADD_LESSON_GENERATORS');
assert.ok(/url\.pathname === '\/api\/scripts'/.test(server), '/api/scripts route present');
assert.ok(/window\.SCRIPTS_DATA=/.test(fs.readFileSync(path.join(ROOT, 'build-static.js'), 'utf8')),
  'static build bakes SCRIPTS_DATA');
console.log('  registry + route + static-bake wiring: OK');

console.log('unit-intro-script: ALL PASSED');
