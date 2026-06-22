// Unit tests for the TTS voice-quality helpers (item 1): browser/OS detection,
// Ecosia link building, and the "nice voice" heuristic. Extracts the live
// functions from index.html via brace-matching.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function extract(name) {
  const at = html.indexOf('function ' + name + '(');
  assert.ok(at >= 0, 'missing function: ' + name);
  const bs = html.indexOf('{', at);
  let d = 0, i = bs;
  for (; i < html.length; i++) { const c = html[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return html.slice(at, i);
}
const src = ['detectBrowser', 'detectOS', 'buildEcosiaQuery', 'ttsVoiceIsRobotic', 'ttsHasNiceVoice'].map(extract).join('\n');
const M = new Function(src + '\nreturn { detectBrowser, detectOS, buildEcosiaQuery, ttsVoiceIsRobotic, ttsHasNiceVoice };')();

// ── detectBrowser ──
const FF = 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0';
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const EDGE = 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 Edg/126.0';
const SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const OPERA = 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 OPR/110.0';
assert.strictEqual(M.detectBrowser(FF), 'Firefox', 'Firefox');
assert.strictEqual(M.detectBrowser(CHROME), 'Chrome', 'Chrome (not Safari)');
assert.strictEqual(M.detectBrowser(EDGE), 'Edge', 'Edge (not Chrome)');
assert.strictEqual(M.detectBrowser(SAFARI), 'Safari', 'Safari (Version/ + Safari/, no Chrome)');
assert.strictEqual(M.detectBrowser(OPERA), 'Opera', 'Opera (not Chrome)');
assert.strictEqual(M.detectBrowser(''), 'your browser', 'unknown → fallback');
console.log('  detectBrowser: OK');

// ── detectOS ──
assert.strictEqual(M.detectOS(FF), 'Linux', 'Linux');
assert.strictEqual(M.detectOS(CHROME), 'Windows', 'Windows');
assert.strictEqual(M.detectOS(SAFARI), 'macOS', 'macOS');
assert.strictEqual(M.detectOS('Mozilla/5.0 (Linux; Android 14; Pixel)'), 'Android', 'Android (before Linux)');
assert.strictEqual(M.detectOS('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'), 'iOS', 'iOS (before macOS)');
assert.strictEqual(M.detectOS('Mozilla/5.0 (X11; CrOS x86_64)'), 'ChromeOS', 'ChromeOS (before Linux)');
assert.strictEqual(M.detectOS(''), 'your OS', 'unknown → fallback');
console.log('  detectOS: OK');

// ── buildEcosiaQuery ──
const url = M.buildEcosiaQuery('Firefox', 'Linux');
assert.ok(url.startsWith('https://www.ecosia.org/search?q='), 'ecosia base');
assert.strictEqual(url, 'https://www.ecosia.org/search?q=' + encodeURIComponent('speech output with Firefox in Linux'), 'encoded query');
console.log('  buildEcosiaQuery: OK');

// ── ttsVoiceIsRobotic / ttsHasNiceVoice ──
assert.ok(M.ttsVoiceIsRobotic('eSpeak German'), 'espeak is robotic');
assert.ok(M.ttsVoiceIsRobotic('mbrola de1'), 'mbrola is robotic');
assert.ok(!M.ttsVoiceIsRobotic('Google Deutsch'), 'Google is not robotic');

const v = (name, lang, localService = true) => ({ name, lang, localService });
// Firefox/Linux: only espeak voices for German → not nice.
assert.strictEqual(M.ttsHasNiceVoice([v('eSpeak German', 'de'), v('eSpeak English', 'en')], 'de-DE'), false, 'espeak-only de → not nice');
// Chrome: a remote Google German voice → nice.
assert.strictEqual(M.ttsHasNiceVoice([v('Google Deutsch', 'de-DE', false), v('eSpeak German', 'de')], 'de-DE'), true, 'Google de → nice');
// macOS native German voice (localService, non-robotic name) → nice.
assert.strictEqual(M.ttsHasNiceVoice([v('Anna', 'de-DE', true)], 'de'), true, 'native de voice → nice');
// No voice for the language at all → not nice.
assert.strictEqual(M.ttsHasNiceVoice([v('Google US English', 'en-US', false)], 'de-DE'), false, 'no de voice → not nice');
// Empty / missing voices → not nice.
assert.strictEqual(M.ttsHasNiceVoice([], 'de-DE'), false, 'no voices → not nice');
assert.strictEqual(M.ttsHasNiceVoice(null, 'de-DE'), false, 'null voices → not nice');
// lang prefix match (de-AT voice for de target) → nice.
assert.strictEqual(M.ttsHasNiceVoice([v('Wien', 'de-AT', true)], 'de-DE'), true, 'de-AT matches de prefix');
// Firefox: a local non-robotic-NAMED voice is still treated as low quality (warn).
assert.strictEqual(M.ttsHasNiceVoice([v('Deutsch', 'de-DE', true)], 'de-DE', 'Firefox'), false, 'Firefox local voice → warn');
// Firefox: a cloud (non-local) voice counts as nice.
assert.strictEqual(M.ttsHasNiceVoice([v('Google Deutsch', 'de-DE', false)], 'de-DE', 'Firefox'), true, 'Firefox cloud voice → nice');
// Chrome with the same local voice → still nice (unchanged behavior).
assert.strictEqual(M.ttsHasNiceVoice([v('Anna', 'de-DE', true)], 'de-DE', 'Chrome'), true, 'Chrome local voice → nice');
// Expanded robotic detection: speech-dispatcher / eloquence / bare "default".
assert.ok(M.ttsVoiceIsRobotic('speech-dispatcher'), 'speech-dispatcher robotic');
assert.ok(M.ttsVoiceIsRobotic('eloquence'), 'eloquence robotic');
assert.ok(M.ttsVoiceIsRobotic('default'), 'bare default robotic');
assert.ok(!M.ttsVoiceIsRobotic('Microsoft Hedda Desktop'), 'real SAPI voice not robotic');
console.log('  ttsHasNiceVoice: OK');

console.log('unit-tts-voice: ALL PASSED');
