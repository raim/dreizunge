// v52_d: the storyline screen gets a subtle top-down background gradient themed by the FIRST
// chapter's writing style (storyStyle); an uploaded story (no style) gets its own "existing" theme;
// an explicit `_theme` override wins; unknown styles fall back to 'neutral'. (v1: automatic from
// style. The manual/LLM theme-picker button is a roadmap follow-up.)
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

const gmapSrc = html.match(/const STORY_THEME_GRADIENTS = \{[\s\S]*?\};/)[0];
const extract = (name) => {
  const at = html.indexOf('function ' + name + '(');
  const b = html.indexOf('{', at); let d = 0, i = b;
  for (; i < html.length; i++) { if (html[i] === '{') d++; else if (html[i] === '}') { d--; if (!d) { i++; break; } } }
  return html.slice(at, i);
};
const { STORY_THEME_GRADIENTS, storylineThemeKey } = new Function(
  gmapSrc + '\n' + extract('storylineThemeKey') + '\nreturn { STORY_THEME_GRADIENTS, storylineThemeKey };')();

// Every gradient is a light 2-colour pair (top, bottom) for a top-down gradient.
for (const [k, v] of Object.entries(STORY_THEME_GRADIENTS)) {
  assert.ok(Array.isArray(v) && v.length === 2 && v.every(c => /^#[0-9a-f]{6}$/i.test(c)), `${k} is a 2-colour hex gradient`);
}
assert.ok(STORY_THEME_GRADIENTS.existing, 'an "existing" (uploaded, no-style) theme exists');
assert.ok(STORY_THEME_GRADIENTS.neutral, 'a neutral fallback theme exists');

// Resolution rules.
assert.strictEqual(storylineThemeKey({ storyStyle: 'funny' }), 'funny', 'defaults to the first chapter style');
assert.strictEqual(storylineThemeKey({ storyStyle: 'philosophical' }), 'philosophical', 'philosophical style themed');
assert.strictEqual(storylineThemeKey({ _theme: 'horror', storyStyle: 'funny' }), 'horror', 'explicit _theme override wins');
assert.strictEqual(storylineThemeKey({}), 'existing', 'no style (uploaded) → existing');
assert.strictEqual(storylineThemeKey(null), 'existing', 'missing topic → existing');
assert.strictEqual(storylineThemeKey({ storyStyle: 'zzz-unknown' }), 'neutral', 'unknown style → neutral fallback');

// It's applied to the storyline screen when it opens.
assert.ok(/_renderStorylineScreen\([^)]*\);\s*applyStorylineTheme\(firstTopic\);/.test(html), 'applied on open');

// ⚠️ v90_b: everything above this line about the APPLYING half used to be three source regexes —
// "the function is defined", "the selector string appears", "the string linear-gradient(180deg
// appears". Emptying applyStorylineTheme's body to `return;` left ALL 360 checks green: the theme
// silently stopped being applied and nothing in the suite noticed, because a defined function and a
// present string are not a painted background. Found by the mutation audit. Run the function.
{
  const applyStorylineTheme = new Function('document', 'STORY_THEME_GRADIENTS', 'storylineThemeKey',
    extract('applyStorylineTheme') + '\nreturn applyStorylineTheme;');
  const mkDoc = (el) => ({ querySelector: (sel) => {
    assert.strictEqual(sel, '#storyline-screen .sl-screen', 'themes the storyline screen container');
    return el;
  } });

  const el = { style: {} };
  applyStorylineTheme(mkDoc(el), STORY_THEME_GRADIENTS, storylineThemeKey)({ storyStyle: 'funny' });
  const [fa, fb] = STORY_THEME_GRADIENTS.funny;
  assert.strictEqual(el.style.background, `linear-gradient(180deg, ${fa} 0%, ${fb} 100%)`,
    'a styled chapter paints its own top-down gradient');

  // the fallbacks the resolver promises actually reach the element
  const el2 = { style: {} };
  applyStorylineTheme(mkDoc(el2), STORY_THEME_GRADIENTS, storylineThemeKey)({});
  const [ea, eb] = STORY_THEME_GRADIENTS.existing;
  assert.strictEqual(el2.style.background, `linear-gradient(180deg, ${ea} 0%, ${eb} 100%)`,
    'an uploaded story paints the "existing" gradient');

  const el3 = { style: {} };
  applyStorylineTheme(mkDoc(el3), STORY_THEME_GRADIENTS, storylineThemeKey)({ storyStyle: 'zzz-unknown' });
  const [na, nb] = STORY_THEME_GRADIENTS.neutral;
  assert.strictEqual(el3.style.background, `linear-gradient(180deg, ${na} 0%, ${nb} 100%)`,
    'an unknown style paints the neutral gradient');

  // non-vacuity: the three cases must not all be the same string, or the assertions above would
  // hold for any constant the function happened to write.
  assert.strictEqual(new Set([el.style.background, el2.style.background, el3.style.background]).size, 3,
    'the three themes are distinguishable (this file cannot pass on a constant)');

  // no container on screen → no throw, nothing painted
  applyStorylineTheme({ querySelector: () => null }, STORY_THEME_GRADIENTS, storylineThemeKey)({ storyStyle: 'funny' });
  console.log('  applyStorylineTheme actually paints the resolved gradient onto the container: OK');
}

console.log('unit-storyline-theme: ALL PASSED');
