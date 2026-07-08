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
assert.ok(/function applyStorylineTheme\(firstTopic\)/.test(html), 'applyStorylineTheme defined');
assert.ok(/#storyline-screen \.sl-screen/.test(html), 'theme targets the storyline screen container');
assert.ok(/linear-gradient\(180deg/.test(html), 'uses a top-down (180deg) gradient');
assert.ok(/_renderStorylineScreen\([^)]*\);\s*applyStorylineTheme\(firstTopic\);/.test(html), 'applied on open');

console.log('unit-storyline-theme: ALL PASSED');
