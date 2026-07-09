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
const scriptTeachable = new Function('SCRIPTS_DATA', 'scriptHasTable',
  ext(html, 'scriptTeachable') + '\nreturn scriptTeachable;')(SCRIPTS_DATA, scriptHasTable);
const needsIntroScript = new Function('SCRIPTS_DATA', 'scriptsForLang', 'scriptTeachable',
  ext(html, 'needsIntroScript') + '\nreturn needsIntroScript;')(SCRIPTS_DATA, scriptsForLang, scriptTeachable);

assert.deepStrictEqual(scriptsForLang('ja'), ['hiragana', 'katakana'], 'ja → two scripts');
assert.deepStrictEqual(scriptsForLang('ru'), ['cyrillic'], 'ru → cyrillic');
// v53: Latin is a script like any other, and EVERY language must be mapped — an unmapped code
// reads as "no script", which wrongly makes a Latin course look teachable to its speakers.
assert.deepStrictEqual(scriptsForLang('it'), ['latin'], 'it → latin');
assert.deepStrictEqual(scriptsForLang('zh'), ['han'], 'zh → han (not Latin)');
const _allLangs = Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8')))
  .filter(k => !k.startsWith('_'));
_allLangs.forEach(l => assert.ok(scriptsForLang(l).length, `${l} is mapped in _langScript`));
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
assert.strictEqual(needsIntroScript('hi', 'en'), true,  'en→hi: devanagari table filled → offered');
assert.strictEqual(needsIntroScript('th', 'en'), false, 'en→th: thai still a stub → hidden');

// Reverse direction: a script lesson is available (manual add) when the non-Latin script is on the
// SOURCE side too — ar→en / ja→en / hi→en — via scriptLessonAvailable (either side), while
// auto-generation's needsIntroScript stays target-only.
const scriptLessonAvailable = new Function('needsIntroScript',
  ext(html, 'scriptLessonAvailable') + '\nreturn scriptLessonAvailable;')(needsIntroScript);
assert.strictEqual(scriptLessonAvailable('en', 'ar'), true,  'ar→en (Arabic source) offers a script lesson');
assert.strictEqual(scriptLessonAvailable('en', 'ja'), true,  'ja→en (Japanese source) offers a script lesson');
assert.strictEqual(scriptLessonAvailable('en', 'hi'), true,  'hi→en (Hindi source) offers a script lesson');
assert.strictEqual(scriptLessonAvailable('ar', 'en'), true,  'en→ar still offered (target side)');
assert.strictEqual(scriptLessonAvailable('en', 'fr'), false, 'en→fr / fr→en: both Latin → not offered');
console.log('  reverse-direction (source-side) script lessons available via scriptLessonAvailable: OK');

// ── v53: script courses run in BOTH directions ───────────────────────────────
// Before v53 `needsIntroScript` bailed whenever the TARGET was Latin, so an Arabic speaker
// learning English was never taught the Latin alphabet (they were offered Arabic — a script
// they already read). `latin` is now a table, so the gate is symmetric.
assert.strictEqual(needsIntroScript('en', 'ar'), true,  'ar→en: Arabic reader is taught the Latin alphabet');
assert.strictEqual(needsIntroScript('en', 'ru'), true,  'ru→en: Cyrillic reader is taught Latin');
assert.strictEqual(needsIntroScript('en', 'ja'), true,  'ja→en: kana reader is taught Latin');
assert.strictEqual(needsIntroScript('en', 'ko'), true,  'ko→en: Hangul reader is taught Latin');
assert.strictEqual(needsIntroScript('de', 'he'), true,  'he→de: Hebrew reader is taught Latin');
assert.strictEqual(needsIntroScript('en', 'de'), false, 'de→en: both Latin → no Latin course');
assert.strictEqual(needsIntroScript('it', 'en'), false, 'en→it: both Latin → no Latin course');
// A Latin course is only teachable where we have a `sounds` column for the learner's script.
// zh maps to the `han` stub, which latin.soundsFor does NOT list → gated off rather than
// falling back to Latin translit answers (which would be circular).
assert.strictEqual(needsIntroScript('en', 'zh'), false, 'zh→en: no han sounds column yet → gated off');
assert.strictEqual(scriptTeachable('latin', ['arabic']), true,  'latin teachable to an Arabic reader');
assert.strictEqual(scriptTeachable('latin', ['latin']),  false, 'latin NOT teachable to a Latin reader');
assert.strictEqual(scriptTeachable('latin', ['han']),    false, 'latin not yet teachable to a Han reader');
assert.strictEqual(scriptTeachable('arabic', ['latin']), true,  'legacy tables (no soundsFor) stay teachable');
assert.strictEqual(scriptTeachable('thai', ['arabic']),  false, 'empty stub table is never teachable');
console.log('  v53 symmetric gating: Latin taught to non-Latin readers, gated by sounds column: OK');
console.log('  scriptsForLang / scriptHasTable / scriptTeachable / needsIntroScript gating: OK');

// ── Filled tables: integrity + unambiguous transliterations ──────────────────
for (const [name, min] of [['hiragana', 46], ['katakana', 46], ['arabic', 28],
                           ['greek', 24], ['hebrew', 22], ['hangul', 24], ['devanagari', 44]]) {
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
assert.strictEqual(scripts.devanagari.rtl, false, 'devanagari table is LTR');
console.log('  filled tables (hiragana/katakana/arabic/greek/hebrew/hangul/devanagari): integrity + unique translits: OK');

// ── Content-aware script/letter detection (v47.x) ────────────────────────────
const detectSrc = ['scriptHasTable', 'scriptTeachable', '_scriptCharSet', '_lessonSetTargetText',
  '_lessonSetSourceText', 'scriptsUsedInLessonSet', 'makeParentResolver', 'priorLessonSets',
  '_lettersInSets', 'lettersSeenInLessonSet', 'introLetterScope'].map(n => ext(html, n)).join('\n');
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
// Reverse direction: ar→en set with Arabic on the SOURCE side (glosses) → arabic still detected,
// so a manual script lesson can teach the source script. v53: `latin` is offered TOO — an Arabic
// reader learning English needs the Latin alphabet, which was the whole gap. Additive: arabic
// (the pre-v53 offer) is untouched.
assert.deepStrictEqual(
  D.scriptsUsedInLessonSet({ lang: 'en', srcLang: 'ar', lessons: [{ type: 'vocab', vocab: [{ target: 'cat', source: 'قطة' }] }] }),
  ['latin', 'arabic'],
  'ar→en → Latin course offered (the v53 fix) alongside the source-side Arabic course');
// A Latin reader is never offered a Latin course (no `sounds.latin` column).
assert.deepStrictEqual(
  D.scriptsUsedInLessonSet({ lang: 'en', srcLang: 'de', lessons: [{ type: 'vocab', vocab: [{ target: 'cat', source: 'Katze' }] }] }),
  [],
  'de→en (both Latin) → no script course offered');
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
// Seam fix: extend on a set with NO prior chapters must also fall back to the full alphabet
// (extend is defined relative to earlier chapters; with none there's nothing to scope against).
const standalone = { id: 'solo', lang: 'ar', srcLang: 'en', topic: 'solo', story: 'يوسف له قطة', lessons: [] };
_APP.savedList = [standalone];
assert.strictEqual(D.introLetterScope(standalone, 'arabic', 'extend').scoped, false,
  'standalone extend → full alphabet (no prior chapters)');
assert.strictEqual(D.introLetterScope(standalone, 'arabic', 'reinforce').scoped, false,
  'standalone reinforce → full alphabet (no prior chapters)');
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

// ── v53: the Latin course, taught to a non-Latin reader ──────────────────────
// The pre-v53 builder answered every question with the Latin `translit`. That is fine when the
// learner reads Latin (ا → "ā"), but a LATIN course answered that way is circular: "show A a,
// pick a" requires already reading the alphabet being taught. `sounds` fixes it by rendering
// the answer in the learner's own script; `srcScripts` selects the column.
{
  const lat = scripts.latin;
  assert.ok(lat && lat.letters.length === 26, 'latin table has 26 letters');
  assert.strictEqual(lat.rtl, false, 'latin table is LTR');
  assert.ok(Array.isArray(lat.soundsFor) && lat.soundsFor.length, 'latin declares soundsFor');
  const gl = lat.letters.map(L => L.ch);
  assert.strictEqual(new Set(gl).size, gl.length, 'latin glyphs unique');
  // Every declared source script needs a COMPLETE and COLLISION-FREE column: a repeated value
  // would make sound→glyph ambiguous (two correct glyphs), exactly as for `translit`.
  // (The general form of this check, applied to EVERY table, is the `sounds` invariants block below.)
  for (const s of lat.soundsFor) {
    const col = lat.letters.map(L => L.sounds && L.sounds[s]);
    assert.ok(col.every(Boolean), `latin.sounds.${s} covers all 26 letters`);
    assert.strictEqual(new Set(col).size, col.length, `latin.sounds.${s} values unique (no ambiguous sound→glyph)`);
    assert.ok(col.every(v => !/[A-Za-z]/.test(v)), `latin.sounds.${s} never answers in Latin script`);
  }

  const HAS_LATIN = /[A-Za-z]/;
  const arLetters = lat.letters.slice(0, 8);
  const forArabic = clientFrom(arLetters, { distractorPool: lat.letters, srcScripts: ['arabic'] });
  assert.ok(forArabic.length, 'a Latin course is built for an Arabic reader');
  forArabic.filter(e => e._intro === 'glyph_sound').forEach(e => {
    assert.ok(!HAS_LATIN.test(e.correct), `glyph→sound answer is Arabic, not Latin (${e.correct})`);
    assert.ok(e.choices.every(c => !HAS_LATIN.test(c)), 'every glyph→sound choice is Arabic');
    assert.ok(e.choices.includes(e.correct) && e.source !== e.correct, 'answerable, non-revealing');
  });
  forArabic.filter(e => e._intro === 'sound_glyph').forEach(e => {
    assert.ok(!HAS_LATIN.test(e.source), `sound→glyph prompt is Arabic, no "(bee)" hint leak (${e.source})`);
    assert.ok(HAS_LATIN.test(e.correct), 'sound→glyph answer is the Latin glyph being taught');
  });
  forArabic.filter(e => e.type === 'listen_mcq').forEach(e => {
    assert.ok(!HAS_LATIN.test(e.pron), `listen fallback pron is Arabic (${e.pron})`);
  });
  // Other reader scripts pick their own column.
  const forHangul = clientFrom(arLetters, { distractorPool: lat.letters, srcScripts: ['hangul'] });
  assert.ok(forHangul.filter(e => e._intro === 'glyph_sound').every(e => /[\uAC00-\uD7A3]/.test(e.correct)),
    'a Korean reader is answered in Hangul');
  // ja → hiragana has no column, katakana does: the resolver walks the learner's scripts in order.
  const forJa = clientFrom(arLetters, { distractorPool: lat.letters, srcScripts: ['hiragana', 'katakana'] });
  assert.ok(forJa.filter(e => e._intro === 'glyph_sound').every(e => /[\u30A0-\u30FF]/.test(e.correct)),
    'a Japanese reader falls through hiragana to the katakana column');

  // REGRESSION GUARD: existing pairs must be byte-identical. Arabic letters carry no `sounds`,
  // so a Latin-reading learner still gets the Latin translit answers they got before v53.
  const before = serverEx(scripts.arabic.letters, { rnd: () => 0 });
  const after  = serverEx(scripts.arabic.letters, { rnd: () => 0, srcScripts: ['latin'] });
  assert.deepStrictEqual(after, before, 'en→ar unchanged by v53 (no sounds column → translit fallback)');

  // Client/server parity WITH a sounds column (choice order aside; listen items are a random subset).
  const key = e => `${e._intro}|${e.source || ''}|${e.target}|${e.correct}`;
  const cKeys = clientFrom(arLetters, { distractorPool: lat.letters, srcScripts: ['arabic'] })
    .filter(e => e._intro !== 'listen_glyph').map(key).sort();
  const sKeys = serverEx(arLetters, { distractorPool: lat.letters, srcScripts: ['arabic'], rnd: () => 0 })
    .filter(e => e._intro !== 'listen_glyph').map(key).sort();
  assert.deepStrictEqual(cKeys, sKeys, 'client/server agree on the localized Latin course');

  // And the gate that keeps the circular case from ever being generated.
  assert.strictEqual(scriptTeachable('latin', ['latin']), false, 'Latin reader never gets a Latin course');
}
console.log('  v53 Latin course: localized answers, no Latin leak, parity, legacy pairs unchanged: OK');

// ── `sounds` / `soundsFor` invariants — enforced for EVERY table, present and future ─────────
// Only `latin` carries `sounds` today. Extending the mechanism to the other tables (so a Russian
// reader learning Arabic sees `алиф`, not the Latin translit `ā`) is pure DATA — the builder's
// localSound() already resolves any column via opts.srcScripts. These checks exist so the next
// column added cannot quietly break the two things that make a column usable.
{
  const tables = Object.keys(scripts).filter(k => !k.startsWith('_') && Array.isArray(scripts[k].letters));
  // Compare by Unicode SCRIPT PROPERTY, not by the table's own glyph list: the hangul table stores
  // jamo (ㄱ) while its answers are composed syllables (에이), which share no codepoints — a charset
  // comparison would wrongly report "not written in hangul". The property also catches Latin letters
  // outside a-z (ā, ṣ) that a raw A–Z charset would miss.
  const SCRIPT_PROP = {
    latin: 'Latin', cyrillic: 'Cyrillic', greek: 'Greek', hebrew: 'Hebrew', arabic: 'Arabic',
    devanagari: 'Devanagari', hangul: 'Hangul', hiragana: 'Hiragana', katakana: 'Katakana',
    thai: 'Thai', han: 'Han',
  };
  const inScript = (s, str) => new RegExp(`\\p{Script=${SCRIPT_PROP[s]}}`, 'u').test(str);
  let columnsChecked = 0;

  for (const name of tables) {
    const tbl = scripts[name];
    assert.ok(SCRIPT_PROP[name], `${name}: needs a Unicode script property (add it when adding a table)`);
    if (!tbl.letters.length) {                       // stub (thai, han): no columns, no gate
      assert.ok(!tbl.soundsFor, `${name}: an empty stub must not declare soundsFor`);
      continue;
    }

    // (1) THE GATE. `soundsFor` restricts who a table may be taught to. It belongs on exactly those
    // tables whose translit FALLBACK is written in their own script — i.e. where the fallback answer
    // restates the glyph ("show A a, pick a"). Deriving the expectation from the data, rather than
    // hardcoding "latin", means a future table gets the right treatment automatically. Putting
    // soundsFor on a legacy table (e.g. arabic) would narrow its teachability and break en→ar.
    const fallbackIsCircular = tbl.letters.every(L => inScript(name, L.translit || L.name || ''));
    assert.strictEqual(!!tbl.soundsFor, fallbackIsCircular,
      `${name}: declare soundsFor iff its translit fallback is circular (${name} circular=${fallbackIsCircular})`);

    if (tbl.soundsFor) {
      assert.ok(Array.isArray(tbl.soundsFor) && tbl.soundsFor.length, `${name}.soundsFor is a non-empty array`);
      for (const s of tbl.soundsFor) {
        assert.ok(scripts[s], `${name}.soundsFor names a real script (${s})`);
        assert.ok(tbl.letters.every(L => L.sounds && L.sounds[s]),
          `${name}.soundsFor lists ${s}, so every letter must have a sounds.${s} value`);
      }
    }

    // (2) THE COLUMNS. Every column that exists anywhere on this table must be complete, unique,
    // and written in the READER's script rather than the one being taught.
    const cols = new Set();
    tbl.letters.forEach(L => { if (L.sounds) Object.keys(L.sounds).forEach(s => cols.add(s)); });
    for (const s of cols) {
      columnsChecked++;
      assert.ok(scripts[s], `${name}.sounds.${s} keys a real script`);
      assert.notStrictEqual(s, name, `${name}.sounds.${s}: a table never answers in its own script`);
      const col = tbl.letters.map(L => L.sounds && L.sounds[s]);
      assert.ok(col.every(Boolean), `${name}.sounds.${s} covers all ${tbl.letters.length} letters (partial columns silently fall back to translit)`);
      assert.strictEqual(new Set(col).size, col.length,
        `${name}.sounds.${s} values unique (a repeat makes sound→glyph ambiguous — two correct glyphs)`);
      // The answer must not be written in the script being taught, or it reveals/restates the glyph.
      assert.ok(col.every(v => !inScript(name, v)),
        `${name}.sounds.${s} never answers in ${name} (the script it teaches)`);
      // …and it must actually be written in the reader's script.
      assert.ok(col.every(v => inScript(s, v)), `${name}.sounds.${s} is written in ${s}`);
    }
  }
  assert.ok(columnsChecked >= 8, `sounds columns checked (${columnsChecked})`);
  console.log(`  sounds/soundsFor invariants across ${tables.length} tables, ${columnsChecked} column(s): OK`);
}

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

// ── Play-time question cap (script lessons): introMaxLetters used a SECOND time, capping how
// many of the generated questions are actually presented per play (random subset). ──
{
  const shuf = a => { const b=[...a]; for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];} return b; };
  const APP = { lessonData: { lang: 'ar', srcLang: 'en' }, lang: 'ar', srcLang: 'en' };
  const ttsVoiceAvailableFor = () => false;   // no voice → isolates the MCQ cap from listen drop
  const build = new Function('APP','SCRIPTS_DATA','shuffle','ttsVoiceAvailableFor','introMaxLetters','introScriptExercisesFrom','scriptsForLang',
    ext(html, 'buildIntroScriptExercises') + '\nreturn buildIntroScriptExercises;'
  )(APP, scripts, shuf, ttsVoiceAvailableFor, introMaxLetters, clientFrom, scriptsForLang);
  for (const diff of [1, 2, 3]) {
    const letters = scripts.arabic.letters.slice(0, introMaxLetters(diff));   // stored capped letters
    const played = build({ script: 'arabic', letters, difficulty: diff });
    assert.strictEqual(played.length, introMaxLetters(diff),
      `difficulty ${diff} presents exactly ${introMaxLetters(diff)} questions (not ~2×letters+5)`);
  }
  // A bigger stored letter set still caps the questions to the difficulty number.
  const big = build({ script: 'arabic', letters: scripts.arabic.letters, difficulty: 2 });
  assert.strictEqual(big.length, introMaxLetters(2), 'cap applies regardless of how many letters are stored');
  console.log('  play-time question cap (script lessons, difficulty-scaled random subset): OK');
}

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

// ── Result/completion card handles script lessons (was vocab-centric) ────────
// (a) the "next" button labels a script lesson by its own title, not "Vocabulary"; (b) the
// "words from this lesson" box has an intro_script branch (letters), not an empty box; (c) the
// next-lesson search respects the hidden-lesson rule.
assert.ok(/L\.type === 'intro_script' && L\.title\) \? L\.title/.test(html),
  'completion next button labels intro_script by its title');
assert.ok(/lesson\?\.type === 'intro_script'[\s\S]*?lesson\.letters\|\|\[\]\)\.map/.test(html),
  'completion card shows letters for intro_script lessons');
assert.ok(/findIndex\(\(L, i\) => i !== C\.lessonIdx && !done\[L\.id\] && _counts\(L\)\)/.test(html),
  'completion next-lesson search skips hidden lessons (non-teacher)');
console.log('  completion card: script-lesson next-label + letters + hidden-skip: OK');

// Completion card handles a MIXED lesson: (a) it has a words branch (was empty — falls through
// vocab/words/items), (b) the story-unlock panel uses the _counts filter so finishing the mixed
// lesson unlocks the story (was allLessons.every, which counted the hidden siblings → never true).
assert.ok(/lesson\?\.type === 'mixed'[\s\S]*?for \(const e of \(C\.exercises/.test(html),
  'mixed lesson shows the words actually played on the result card');
assert.ok(/_allDone2 = setComplete\(APP\.lessonData\)/.test(html),
  'result-card story-unlock uses the shared setComplete (mixed-only / hidden aware)');
assert.ok(!/_allDone2 = allLessons\.(every|filter)/.test(html),
  'the old allLessons-based story-unlock check is gone');
console.log('  completion card: mixed-lesson words + story-unlock via _counts: OK');

// ── Server arc script-teaching (Plan B): extend letters new to a chapter, prepend per chapter ──
{
  const _scriptsData = SCRIPTS_DATA;
  let SAVED = {};
  const findSavedById = id => SAVED[id] || null;
  const findSaved = name => Object.values(SAVED).find(t => t.topic === name) || null;
  const sIntroMax = new Function(ext(server, 'introMaxLetters') + '\nreturn introMaxLetters;')();
  const sScriptsFor = new Function('_scriptsData', ext(server, 'scriptsForLang') + '\nreturn scriptsForLang;')(_scriptsData);
  const sHasTable = new Function('_scriptsData', ext(server, 'scriptHasTable') + '\nreturn scriptHasTable;')(_scriptsData);
  const sTeachable = new Function('_scriptsData', 'scriptHasTable', ext(server, 'scriptTeachable') + '\nreturn scriptTeachable;')(_scriptsData, sHasTable);
  const sNeeds = new Function('scriptsForLang', 'scriptTeachable', ext(server, 'needsIntroScript') + '\nreturn needsIntroScript;')(sScriptsFor, sTeachable);
  const sCharSet = new Function('_scriptsData', ext(server, '_scriptCharSet') + '\nreturn _scriptCharSet;')(_scriptsData);
  const sChainGlyphs = new Function('_scriptCharSet', 'findSavedById', 'findSaved', ext(server, 'chainGlyphSet') + '\nreturn chainGlyphSet;')(sCharSet, findSavedById, findSaved);
  const sExtend = new Function('_scriptsData', 'chainGlyphSet', 'introMaxLetters', ext(server, 'introExtendLetters') + '\nreturn introExtendLetters;')(_scriptsData, sChainGlyphs, sIntroMax);
  const sExs = new Function(ext(server, 'introScriptExercises') + '\nreturn introScriptExercises;')();
  const sBuild = new Function('needsIntroScript', 'scriptsForLang', 'scriptTeachable', '_scriptsData', 'introExtendLetters', 'introScriptExercises',
    ext(server, 'buildArcIntroLessons') + '\nreturn buildArcIntroLessons;')(sNeeds, sScriptsFor, sTeachable, _scriptsData, sExtend, sExs);

  // Chapter 1, no prior: letters new = all arabic letters appearing in the story (capped).
  const ch1 = sBuild('ar', 'en', 'يوسف له قطة اسمها لولو وكان سعيدا جدا في البيت الكبير', null, 2);
  assert.strictEqual(ch1.length, 1, 'arc builds one intro lesson for en→ar');
  assert.strictEqual(ch1[0].type, 'intro_script', 'arc intro lesson type');
  assert.strictEqual(ch1[0]._arcMode, 'extend', 'arc intro lesson is extend mode');
  assert.ok(ch1[0].letters.length >= 4 && ch1[0].letters.length <= sIntroMax(2), 'ch1 extend letters within cap');

  // Chapter 2 with a prior chapter: only letters NOT seen in chapter 1.
  SAVED['tp_c1'] = { id: 'tp_c1', topic: 'ch1', lang: 'ar', story: 'يوسف له قطة', lessons: [{ type: 'intro_script' }, { vocab: [{ target: 'يوسف' }] }] };
  const priorGlyphs = new Set('يوسف له قطة');
  const ch2 = sBuild('ar', 'en', 'ذهب الى الغابة و رأى ثعلبا كبيرا خلف الشجرة العالية', 'tp_c1', 2);
  if (ch2.length) {
    assert.ok(ch2[0].letters.every(L => !priorGlyphs.has(L.ch)), 'ch2 extend letters are new (not in chapter 1)');
  }
  // Same-script pair (en→de) and Latin target → no arc intro lessons.
  assert.strictEqual(sBuild('de', 'en', 'Der Hund läuft schnell nach Hause', null, 2).length, 0, 'en→de: no script primer');
  // A chapter with too few new letters (<4) yields nothing to teach.
  SAVED['tp_c3'] = { id: 'tp_c3', topic: 'c3', lang: 'ar', story: 'يوسف له قطة اسمها لولو وذهب الى الغابة ورأى ثعلبا وأرنبا وطيورا كثيرة', lessons: [] };
  const ch4 = sBuild('ar', 'en', 'قطة', 'tp_c3', 2);   // only letters already seen
  assert.strictEqual(ch4.length, 0, 'chapter with no genuinely-new letters → no primer');
  console.log('  server arc script-teaching: extend-per-chapter + gating + cap: OK');
}

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
