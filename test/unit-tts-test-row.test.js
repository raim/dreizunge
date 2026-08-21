// unit-tts-test-row.test.js
// v49: the sound-test strip below the generation form is ALWAYS shown for a concrete
// target language — one compact single-line row: language flag · speech-variant selector ·
// the 1,2,3 test button (tts.voice_test).
// The previous behavior only showed a multi-line warning box when ttsHasNiceVoice()
// judged the voices bad, and under-warned on some browser/OS combos; the gating and the
// long tts.voice_warn_q question is no longer shown inline (it's reused as the Test button's
// hover tooltip instead). ttsHasNiceVoice itself stays
// (unit-tts-voice.test.js) but must no longer drive the row.
// PLAN §C4 "keep going" (global mute-pill consolidation) removed this row's own mute button —
// see the block below for the regression guard.
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
// v79_o, rule 29: this used to match the exact literal
// `title="${escAttr(t('tts.voice_warn_q'))}"`. The user asked for the row to be tightened, so the
// Test button's tooltip now also carries `tts.test_lbl` (the visible "Test" label was removed and
// its string moved into the tooltip rather than being orphaned). The CLAIM — voice_warn_q is a
// hover tooltip, attribute-escaped, not body text — did not change; only the expression did.
// Re-anchored at the claim: it appears inside a title=, escAttr'd, and nowhere as text.
assert.ok(/title="[^"]*escAttr\([^"]*t\('tts\.voice_warn_q'\)/.test(fn),
  'tts.voice_warn_q is reused as a hover tooltip (attribute-escaped), not shown inline');
assert.ok(!/>\$\{escHtml\(t\('tts\.voice_warn_q'\)\)\}</.test(fn),
  'and is never rendered as visible body text');
assert.ok(!/<span[^>]*>\$\{escHtml\(t\('tts\.voice_warn_q'\)\)\}/.test(fn),
  'tts.voice_warn_q is NOT rendered as inline body text');
assert.ok(!/_ttsVoicesSettled/.test(fn), 'voices-loading gate removed (row does not depend on voices)');

// v79_o (user: "remove the Test and Mute: strings to make this row tighter"). The row's VISIBLE
// pieces were: language flag, speech-variant selector, test button, mute button. `tts.test_lbl`
// was no longer rendered text — it moved into the test button's `title=` tooltip so its
// translation was not orphaned. The old assertion ordered four visible pieces.
//
// PLAN §C4 "keep going" (global mute-pill consolidation) changed the CLAIM again, not just the
// text (rule 29): this row's own mute button is GONE — the always-reachable #corner-pills mute
// pill replaces it, along with every other scattered instance. `tts.voice_mute_hint`/
// `tts.mute_hint_short` (the "if the sound is bad, mute it" hint, previously this button's
// tooltip) are now unused, left in ui.json rather than pruned (a separate cleanup). The row is
// just: language flag, speech-variant selector, test button.
const iSel  = fn.indexOf('_ttsVariantSelectHtml');
const iBtn  = fn.indexOf("t('tts.voice_test')");
assert.ok(iSel > -1 && iBtn > -1, 'selector and test button both present');
assert.ok(iSel < iBtn, 'row order: the speech-variant selector sits beside the test button');
assert.ok(fn.includes("t('tts.test_lbl')"),
  'tts.test_lbl must survive as a tooltip rather than being dropped (its translations are not orphaned)');
// THE REGRESSION this consolidation must not reintroduce: no mute button, and no toggleMute()
// call, inside this specific row.
assert.ok(!/class="mute-btn"/.test(fn),
  'the sound-test row must NOT carry its own mute-btn — muting is global now (#corner-pills)');
assert.ok(!/toggleMute\(\)/.test(fn),
  'the sound-test row must NOT call toggleMute() itself');
assert.ok(!/data-mute-tip/.test(fn),
  'data-mute-tip was this row-specific button\'s own mechanism and must be gone with it');

// v49 (later): selectLang must refresh the row (its flag) IMMEDIATELY after setting APP.lang,
// before the heavier helpers (repopulateContinueSelect/updateDocDir) — a throw in any of those
// otherwise leaves the flag showing the previous language even though APP.lang changed.
// v78_q: slice the WHOLE function by brace-matching, not a fixed 900-character window. The window
// was sized to the function as it stood; a comment added inside it pushed the very markers this
// section looks for past the end, and the ordering claim — which is what the test is about — was
// still perfectly true (standing rule 18: pin the claim, not the layout).
const selLang = (() => {
  const at = html.indexOf('function selectLang(');
  const b = html.indexOf('{', at);
  let d = 0, i = b;
  for (; i < html.length; i++) { const c = html[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return html.slice(at, i);
})();
const iLang = selLang.indexOf('APP.lang=code');
const iTts  = selLang.indexOf('updateTtsVoiceNote()');
const iRepop = selLang.indexOf('repopulateContinueSelect()');
assert.ok(iLang > -1 && iTts > iLang, 'selectLang refreshes the tts row after setting APP.lang');
assert.ok(iRepop > -1 && iTts < iRepop,
  'selectLang refreshes the tts row BEFORE repopulateContinueSelect (throw-safe flag update)');

// v49 (later): the row sits under the "I learn" (target) column — right-aligned, fit-content
// width, and forced onto a SINGLE line (nowrap). It shows the tested language's FLAG (no name,
// no "sound" words) so it stays compact: "<flag> <variant selector> <test button>".
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

// ui.json: en present, and this key is now TRANSLATED (the user's translate pass filled it). We
// don't require every language (a legit cognate like "Test" stays "Test", and one language may
// lag), but the bulk should carry the key. tts.mute_hint_short/tts.voice_mute_hint are no longer
// checked here — they are unused now that this row's mute button is gone (still present in
// ui.json, deliberately not pruned; see the code comment above updateTtsVoiceNote()).
assert.strictEqual(ui.en['tts.test_lbl'], 'Test');
const _langCount = Object.keys(ui).filter(l => l !== 'en').length;
const _hasKey = k => Object.keys(ui).filter(l => l !== 'en' && ui[l][k] !== undefined).length;
assert.ok(_hasKey('tts.test_lbl') >= _langCount - 3, 'tts.test_lbl translated across (nearly) all languages');

console.log('  always-on compact sound-test row (flag · variant selector · 1,2,3, no mute button): OK');
console.log('unit-tts-test-row: ALL PASSED');
