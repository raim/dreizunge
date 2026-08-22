// v47 — Japanese furigana: paste-time <ruby> normalization, katakana-reading display,
// and the shared kanji/katakana tokenizer used by sentence-order lessons. Pure helpers
// extracted from index.html / server.js (the live DOM/TTS paths are browser-owed).
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

function extractFrom(src, name) {
  const at = src.indexOf('function ' + name + '(');
  assert.ok(at >= 0, 'missing fn ' + name + ' in source');
  const b = src.indexOf('{', at);
  let d = 0, i = b;
  for (; i < src.length; i++) { const c = src[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(at, i);
}

// ── rubyToBracket: <ruby> markup → internal kanji[reading] bracket form ──────────────
const { rubyToBracket } = new Function(extractFrom(html, 'rubyToBracket') + '\nreturn { rubyToBracket };')();

const rubyStory =
  '「ぼくの<ruby>ボール<rt aria-hidden="true">ぼーる</rt></ruby>がない！」' +
  '<ruby>犬<rt aria-hidden="true">いぬ</rt></ruby>は、' +
  '<ruby>大好<rt aria-hidden="true">だいす</rt></ruby>きな<ruby>丸<rt aria-hidden="true">まる</rt></ruby>い' +
  '<ruby>ボール<rt aria-hidden="true">ぼーる</rt></ruby>を<ruby>探<rt aria-hidden="true">さが</rt></ruby>しに' +
  '<ruby>町<rt aria-hidden="true">まち</rt></ruby>へ<ruby>出<rt aria-hidden="true">で</rt></ruby>かけます。';
const bracketStory =
  '「ぼくのボール[ぼーる]がない！」犬[いぬ]は、大好[だいす]きな丸[まる]いボール[ぼーる]を探[さが]しに町[まち]へ出[で]かけます。';

assert.strictEqual(rubyToBracket(rubyStory), bracketStory, 'ruby story → bracket form');
assert.strictEqual(rubyToBracket(bracketStory), bracketStory, 'already-bracket text passes through unchanged');
assert.strictEqual(rubyToBracket('東京<ruby>都<rp>(</rp><rt>と</rt><rp>)</rp></ruby>'), '東京都[と]',
  '<rp> parenthesis fallback dropped');
assert.strictEqual(rubyToBracket('Hello world'), 'Hello world', 'non-Japanese untouched');
assert.strictEqual(rubyToBracket(''), '', 'empty string safe');
assert.strictEqual(rubyToBracket(undefined), '', 'undefined → empty string');
console.log('  rubyToBracket: ruby/rp/passthrough/empty: OK');

// ── furiHtml: katakana readings kept; hiragana-only annotations stripped ─────────────
const APP = { showFurigana: true };
const furiHtml = new Function('APP', 'escHtml',
  extractFrom(html, '_furiParts') + '\n' + extractFrom(html, 'furiHtml') + '\nreturn furiHtml;'
)(APP, s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));

assert.strictEqual(furiHtml('犬[いぬ]'), '<ruby>犬<rt>いぬ</rt></ruby>', 'kanji reading rendered');
assert.strictEqual(furiHtml('ボール[ぼーる]'), '<ruby>ボール<rt>ぼーる</rt></ruby>', 'katakana reading kept (loanword)');
assert.strictEqual(furiHtml('まる[まる]いもの'), 'まるいもの', 'reading after lone hiragana stripped as a mistake');
APP.showFurigana = false;
assert.strictEqual(furiHtml('犬[いぬ]'), '犬', 'furigana off → base only');
assert.strictEqual(furiHtml('ボール[ぼーる]'), 'ボール', 'furigana off → katakana base only');
console.log('  furiHtml: kanji + katakana readings, hiragana-mistake strip, on/off: OK');

// ── v82_c: the REVERSE-direction defect — measured against the live default model
// (qwen3.6:35b-a3b), asked to add furigana. It reliably attaches a KANJI SPELLING in brackets
// after a word it already knows the kanji for, backwards from what a reading is: ぼく[僕],
// ボール[球]. A base-character check alone can't catch the katakana case — ボール genuinely IS a
// valid furigana base (ボール[ぼーる] above must keep working) — so the guard has to look at the
// READING's own script instead: a genuine reading is pure kana, a kanji-content "reading" never is.
APP.showFurigana = true;
assert.strictEqual(furiHtml('ぼく[僕]'), 'ぼく', 'kanji spelling in brackets after HIRAGANA is stripped, base kept');
assert.strictEqual(furiHtml('ボール[球]'), 'ボール', 'kanji spelling in brackets after KATAKANA is stripped too — the actual reported defect');
assert.strictEqual(furiHtml('大好[だいす]き[好]な'), '<ruby>大好<rt>だいす</rt></ruby>きな',
  'a genuine pair right next to a malformed one: the good pair renders, the bad one is dropped to its bare base');
console.log('  furiHtml: reverse-direction kanji-as-reading defect stripped on both kanji and katakana bases: OK');

// Mutation check: WITHOUT the reading-is-kana guard (i.e. any bracket after a valid base is
// accepted, matching the pre-v82_c behaviour), ボール[球] would wrongly render as ruby — proving
// the guard above is actually load-bearing, not passing by coincidence.
{
  const naive = new Function('APP', 'escHtml',
    "function furiHtml(text){ if(!text) return ''; const re=/([\\u4e00-\\u9fff\\u3400-\\u4dbf々〆〇\\u30a0-\\u30ff]+)\\[([^\\]]+)\\]/g; " +
    "return text.replace(re, (m,b,r)=> APP.showFurigana ? `<ruby>${b}<rt>${r}</rt></ruby>` : b); }\nreturn furiHtml;"
  )(APP, s => s);
  assert.strictEqual(naive('ボール[球]'), '<ruby>ボール<rt>球</rt></ruby>',
    'without the reading-is-kana guard, the same input wrongly renders — confirms the fix is load-bearing');
}
console.log('  mutation check: without the reading-is-kana guard, the defect reproduces — guard is load-bearing: OK');

// ── jaTokenize: keeps each BASE[reading] group whole; client == server ───────────────
const jaClient = new Function(extractFrom(html, 'jaTokenize') + '\nreturn jaTokenize;')();
const jaServer = new Function(extractFrom(server, 'jaTokenize') + '\nreturn jaTokenize;')();

const sentence = '犬[いぬ]は、大好[だいす]きなボール[ぼーる]を探[さが]しに町[まち]へ出[で]かけます。';
const expected = ['犬[いぬ]', 'は', '大好[だいす]', 'きな', 'ボール[ぼーる]', 'を', '探[さが]', 'しに', '町[まち]', 'へ', '出[で]', 'かけます'];

assert.deepStrictEqual(jaClient(sentence), expected, 'client tokenizer keeps groups intact');
assert.deepStrictEqual(jaServer(sentence), expected, 'server tokenizer keeps groups intact');
assert.deepStrictEqual(jaClient(sentence), jaServer(sentence), 'client/server tokenizers agree');

// The key regression this guards: a katakana group after a hiragana run must NOT merge in.
assert.ok(jaClient('きなボール[ぼーる]').includes('ボール[ぼーる]'),
  'katakana+reading after hiragana stays its own token (not merged into the kana run)');
// And a bare-kana run with no annotation still splits normally.
assert.deepStrictEqual(jaClient('これはペンです'), ['これはペンです'], 'plain kana run is one token');
console.log('  jaTokenize: group-preserving, client/server parity, katakana-after-hiragana: OK');

console.log('unit-furigana: ALL PASSED');
