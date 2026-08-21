// unit-speech-icon-consistency.test.js — user follow-up after v81_aa.
//
// "replace all speech button icons, that read-out a text, by the speech icon used e.g. in
// language selection, such that they are not mixed up with the mute button." Landed first with
// 🗣 (matching the pre-existing `.lang-footer-lbl.tts-pill` speech-state pill); a second,
// immediate follow-up asked for 💬 (U+1F4AC) instead, APPLIED EVERYWHERE the app used 🗣 for
// speech — not just the read-aloud triggers this file enumerates, but the pill itself, the
// dialect-glossary labels, and every ui.json string that baked the icon in. This file only
// re-checks the read-aloud-trigger slice of that sweep; it does not re-verify the pill or the
// dialect labels.
//
// The mute pill (`v81_z`, PLAN §C4 "keep going") consolidated every app-wide mute TOGGLE into one
// `#mute-pill` showing 🔊 (unmuted) / 🔇 (muted). Before this release, every "click to hear THIS
// specific text read aloud" button ALSO showed 🔊 — visually indistinguishable from the global
// mute state, even though they are semantically unrelated (one is "sound on/off app-wide", the
// other is "speak this word/sentence/story now"). Every read-aloud trigger now shows 💬 instead.
//
// Rule 32 (guard the ENUMERATION, not the instance): rather than pin each of the ~11 individual
// call sites by hand, this finds every button/span whose onclick calls one of the four TTS-trigger
// functions (speak/speakBodyText/speakStory/speakChainStory) and asserts its icon content — across
// BOTH index.html and build-static.js's own re-implementations of two of these renderers.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const builder = fs.readFileSync(path.join(ROOT, 'build-static.js'), 'utf8');
const ui = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

// Find every `onclick="...speak(...)"` / `speakBodyText(...)` / `speakStory(...)` /
// `speakChainStory(...)` call site, then read the icon nearby. Usually that is the tag's own text
// content (between its `>` and the next `<`); one button (`listen-big`) instead nests its icon in
// a child `<span class="listen-icon">`, so this looks in a small window after the tag rather than
// only the immediately adjacent text run.
function readOutIcons(src, label) {
  const re = /onclick="[^"]*\bspeak(?:BodyText|Story|ChainStory)?\(/g;
  const found = [];
  let m;
  while ((m = re.exec(src))) {
    const tagEnd = src.indexOf('>', m.index);
    assert.ok(tagEnd > -1, `${label}: unterminated tag near "onclick=speak..." at index ${m.index}`);
    const window = src.slice(tagEnd + 1, tagEnd + 120);
    const icon = window.includes('💬') ? '💬' : window.includes('🔊') ? '🔊' : '';
    found.push({ at: m.index, call: m[0], icon, window });
  }
  return found;
}

const liveIcons = readOutIcons(html, 'index.html');
const staticIcons = readOutIcons(builder, 'build-static.js');

assert.ok(liveIcons.length >= 10,
  `expected at least 10 read-aloud call sites in index.html, found ${liveIcons.length} — the ` +
  'enumeration regex may have broken, not that every trigger vanished');
console.log(`  found ${liveIcons.length} read-aloud call sites in index.html, ` +
  `${staticIcons.length} in build-static.js`);

// The one deliberate exception: the "🐢 Slow" playback-speed variant next to `listen-big`. It was
// never 🔊 (never confusable with mute) and carries its own turtle+text label instead of any
// speaker glyph — out of scope for "replace speech icons that read as the mute button."
for (const entry of [...liveIcons, ...staticIcons]) {
  if (entry.window.startsWith('🐢 Slow')) continue; // the slow-playback variant, see above
  assert.strictEqual(entry.icon, '💬',
    `THE REGRESSION: a read-aloud trigger (${entry.call}...) shows "${entry.icon}" instead of 💬 ` +
    '— it will read as the mute button again');
}
console.log('  every read-aloud trigger (live + static) shows 💬, none show 🔊 (except the ' +
  'deliberately unrelated "🐢 Slow" variant): OK');

// ── Two more triggers the enumeration above cannot see ─────────────────────────────────────────
// `#us-spk` gets its onclick assigned via a JS PROPERTY (`sp.onclick = () => {...}`), not an
// inline `onclick="..."` attribute — invisible to the regex above by construction. `#sum-sum-spk`
// has NO onclick anywhere (a pre-existing, unrelated dead-wiring gap, not introduced or fixed by
// this change) but still carries the same `.spk-ico` class and icon as every other read-aloud
// button for visual consistency, so it is checked here too.
for (const id of ['us-spk', 'sum-sum-spk']) {
  const at = html.indexOf(`id="${id}"`);
  assert.ok(at > -1, `${id} exists`);
  const tagEnd = html.indexOf('>', at);
  const nextOpen = html.indexOf('<', tagEnd);
  const icon = html.slice(tagEnd + 1, nextOpen).trim();
  assert.strictEqual(icon, '💬', `${id} (not caught by the inline-onclick enumeration above) must show 💬`);
}
console.log('  the two triggers invisible to the enumeration (JS-assigned or unwired) also show 💬: OK');

// ── Mutation check: the enumeration must actually be able to catch a regression ───────────────
{
  const mutated = html.replace(
    /(onclick="event\.stopPropagation\(\);speakStory\(\)" id="speakstory-btn" title="Read aloud">)💬(<\/button>)/,
    '$1🔊$2'
  );
  assert.notStrictEqual(mutated, html,
    'the mutation must actually flip one icon back to 🔊 — if this fires, the guard below is vacuous');
  assert.ok(readOutIcons(mutated, 'mutated').some(x => x.icon === '🔊'),
    'sanity: the mutated copy is detectably different from the fixed one');
}
console.log('  mutation check: reintroducing a 🔊 read-aloud icon is detectable: OK');

// ── The sound-test button: icon moved OUT of the baked ui.json string, into code ──────────────
// Was `"tts.voice_test": "🔊 1, 2, 3"` (baked per-language); now the icon is a JS-side prefix
// (matching the established convention: gen.title/settings.title also add their emoji in code,
// not in the translated string) and the string itself is just the language-agnostic "1, 2, 3".
assert.strictEqual(ui.en['tts.voice_test'], '1, 2, 3',
  'tts.voice_test should no longer bake an icon into the translated string');
assert.ok(/💬 \$\{escHtml\(t\('tts\.voice_test'\)\)\}/.test(html),
  'the sound-test button prefixes 💬 in code rather than relying on a baked-in string icon');
// Every language block was swept the same mechanical way — spot-check none still has the old icon.
const staleVoiceTest = Object.keys(ui).filter(l => ui[l]['tts.voice_test'] === '🔊 1, 2, 3');
assert.deepStrictEqual(staleVoiceTest, [],
  `these language blocks still bake 🔊 into tts.voice_test, missed by the sweep: ${staleVoiceTest.join(', ')}`);
console.log('  tts.voice_test: icon moved to code, no language block left with the old baked 🔊: OK');

// ── The OTHER direction: the mute pill itself is untouched ────────────────────────────────────
// This change is specifically about NOT confusing read-aloud triggers with the mute toggle — the
// mute toggle's own 🔊/🔇 is correct and must stay exactly as it is.
assert.ok(/id="mute-pill" class="mute-btn" onclick="toggleMute\(\)" title="Mute"[^>]*>🔊<\/button>/.test(html),
  'the global mute pill itself must still show 🔊 (unmuted) — this change does not touch it');
assert.ok(/b\.textContent = APP\.muted \? '🔇' : '🔊';/.test(html),
  'updateMuteButtons() must still be the one place driving 🔊/🔇 — untouched by this change');
console.log('  the mute pill itself is untouched (still 🔊/🔇, still the only place that toggles it): OK');

console.log('unit-speech-icon-consistency: ALL PASSED');
