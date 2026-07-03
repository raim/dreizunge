// unit-tts-test-row.test.js
// v49: the sound-test strip below the generation form is ALWAYS shown for a concrete
// target language — one compact single-line row: "Test" (tts.test_lbl) + the tested
// language flag · the 1,2,3 test button (tts.voice_test) · "Bad? Mute:" (tts.mute_hint_short)
// · the mute button.
// The previous behavior only showed a multi-line warning box when ttsHasNiceVoice()
// judged the voices bad, and under-warned on some browser/OS combos; the gating and the
// long tts.voice_warn_q question is no longer shown inline (it's reused as the Test button's
// hover tooltip instead). ttsHasNiceVoice itself stays
// (unit-tts-voice.test.js) but must no longer drive the row.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ui = JSON.parse(fs.readFileSync(path.join(root, 'ui.json'), 'utf8'));

const fn = html.slice(html.indexOf('function updateTtsVoiceNote('),
                      html.indexOf('function speakBodyText('));
assert.ok(fn.length > 0, 'updateTtsVoiceNote body found');

// No voice-quality gating in the row. The long tts.voice_warn_q question is no longer shown
// inline — it's reused as the Test button's hover tooltip (title=...), not as body text.
assert.ok(!/if\(ttsHasNiceVoice\(/.test(fn), 'row no longer gated on ttsHasNiceVoice');
assert.ok(/title="\$\{escAttr\(t\('tts\.voice_warn_q'\)\)\}"/.test(fn),
  'tts.voice_warn_q is reused as the Test button hover tooltip (attribute-escaped)');
assert.ok(!/<span[^>]*>\$\{escHtml\(t\('tts\.voice_warn_q'\)\)\}/.test(fn),
  'tts.voice_warn_q is NOT rendered as inline body text');
assert.ok(!/_ttsVoicesSettled/.test(fn), 'voices-loading gate removed (row does not depend on voices)');

// The compact row: label, test button, short mute hint, mute button — in that order.
const iLbl = fn.indexOf("t('tts.test_lbl')");
const iBtn = fn.indexOf("t('tts.voice_test')");
const iHint = fn.indexOf("t('tts.mute_hint_short')");
const iMute = fn.indexOf('toggleMute()');
assert.ok(iLbl > -1 && iBtn > -1 && iHint > -1 && iMute > -1, 'all four row pieces present');
assert.ok(iLbl < iBtn && iBtn < iHint && iHint < iMute, 'pieces in row order');
assert.ok(/class="mute-btn"/.test(fn), 'mute button carries .mute-btn (kept in sync by updateMuteButtons)');
// The mute button reuses the (formerly orphaned) tts.voice_mute_hint as its hover tooltip,
// stored in data-mute-tip so updateMuteButtons preserves it instead of overwriting with the
// generic mute/unmute label.
assert.ok(/data-mute-tip="\$\{escAttr\(t\('tts\.voice_mute_hint'\)\)\}"/.test(fn),
  'sound-test mute button carries tts.voice_mute_hint as data-mute-tip');
assert.ok(/title="\$\{escAttr\(t\('tts\.voice_mute_hint'\)\)\}"/.test(fn),
  'sound-test mute button initial title is tts.voice_mute_hint');
const muteSync = html.slice(html.indexOf('function updateMuteButtons('),
                            html.indexOf('function updateMuteButtons(') + 400);
assert.ok(/b\.dataset\.muteTip \|\| \(APP\.muted \? 'Unmute' : 'Mute'\)/.test(muteSync),
  'updateMuteButtons preserves a specialized data-mute-tip tooltip');

// v49 (later): selectLang must refresh the row (its flag) IMMEDIATELY after setting APP.lang,
// before the heavier helpers (repopulateContinueSelect/updateDocDir) — a throw in any of those
// otherwise leaves the flag showing the previous language even though APP.lang changed.
const selLang = html.slice(html.indexOf('function selectLang('),
                           html.indexOf('function selectLang(') + 900);
const iLang = selLang.indexOf('APP.lang=code');
const iTts  = selLang.indexOf('updateTtsVoiceNote()');
const iRepop = selLang.indexOf('repopulateContinueSelect()');
assert.ok(iLang > -1 && iTts > iLang, 'selectLang refreshes the tts row after setting APP.lang');
assert.ok(iRepop > -1 && iTts < iRepop,
  'selectLang refreshes the tts row BEFORE repopulateContinueSelect (throw-safe flag update)');

// v49 (later): the row sits under the "I learn" (target) column — right-aligned, fit-content
// width, and forced onto a SINGLE line (nowrap). It shows the tested language's FLAG (no name,
// no "sound" words) so it stays compact: "Test <flag> <test button> Bad? Mute: <mute button>".
const noteDiv = html.slice(html.indexOf('id="tts-voice-note"'), html.indexOf('id="tts-voice-note"') + 500);
assert.ok(/justify-content:flex-end/.test(noteDiv), 'row container is right-aligned (flex-end)');
assert.ok(/margin-left:auto/.test(noteDiv) && /width:fit-content/.test(noteDiv),
  'row container is pushed right and sized to its content (under the target column)');
assert.ok(/flex-wrap:nowrap/.test(noteDiv) && /white-space:nowrap/.test(noteDiv),
  'row stays on a single line (nowrap)');
assert.ok(/LANGS\[lang\]/.test(fn) && /L\.flag/.test(fn), 'row shows the tested language flag');
assert.ok(!/escHtml\(L\.name\)/.test(fn), 'row does NOT show the language name (flag only)');

// Still hidden with no concrete target selected (globe / "all").
assert.ok(/if\(!lang\)\{ note\.style\.display = 'none'; return; \}/.test(fn),
  'row hidden when no specific target language is selected');

// The old standalone always-on 1,2,3 button (#tts-test-row, v47.x) is superseded by this
// row — it must be gone or two test buttons would stack on the form.
assert.ok(!/id="tts-test-btn"/.test(html), 'standalone #tts-test-btn removed');
assert.ok(!/_setText\('tts-test-lbl'/.test(html), 'standalone button label wiring removed');

// ui.json: en present, and these keys are now TRANSLATED (the user's translate pass filled
// them). We don't require every language (a legit cognate like "Test" stays "Test", and one
// language may lag), but the bulk should carry the key.
assert.strictEqual(ui.en['tts.test_lbl'], 'Test');
assert.strictEqual(ui.en['tts.mute_hint_short'], 'Mute:');
const _langCount = Object.keys(ui).filter(l => l !== 'en').length;
const _hasKey = k => Object.keys(ui).filter(l => l !== 'en' && ui[l][k] !== undefined).length;
assert.ok(_hasKey('tts.test_lbl') >= _langCount - 3, 'tts.test_lbl translated across (nearly) all languages');
assert.ok(_hasKey('tts.mute_hint_short') >= _langCount - 3, 'tts.mute_hint_short translated across (nearly) all languages');

console.log('  always-on compact sound-test row (label · 1,2,3 · mute hint · mute): OK');
console.log('unit-tts-test-row: ALL PASSED');
