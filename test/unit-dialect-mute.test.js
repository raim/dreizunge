// unit-dialect-mute.test.js
// Dialect content has no authentic spoken voice, so it is treated as muted: listen-based exercises
// are dropped, speak()/speakBodyText() bail out for dialect, and the source→target MCQ drops the
// "{lang}" (naming standard German is wrong when the answer is the dialect word).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const ui = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ui.json'), 'utf8'));

// 1) Listen exercises are dropped for dialect lessons (pool filtered before the coverage round).
// v55_z: this used to pin the exact ternary `(_lessonIsDialect()) ? pool.filter(...)`, which (a)
// broke the moment the condition gained a second reason and (b) despite its name only ever matched
// buildMixedExercises — buildStandardExercises had NO such filter, which is how a Swahili vocab
// lesson kept serving "tap to listen". The gate is now `_noAudio` = dialect OR no-voice, in BOTH
// builders; assert the INTENT (dialect still silences, both listen types go) not the expression.
for (const fn of ['buildStandardExercises', 'buildMixedExercises']) {
  const at = html.indexOf('function ' + fn + '(');
  assert.ok(at >= 0, 'found ' + fn);
  const b = html.indexOf('{', at); let d = 0, i = b;
  for (; i < html.length; i++) { if (html[i] === '{') d++; else if (html[i] === '}') { d--; if (!d) { i++; break; } } }
  const body = html.slice(at, i);
  assert.ok(/typeof _lessonIsDialect==='function' && _lessonIsDialect\(\)/.test(body),
    fn + ' still treats dialect content as having no voice');
  assert.ok(/e\.type !== 'listen_mcq' && e\.type !== 'listen_type'/.test(body),
    fn + ' drops listen_mcq + listen_type when there is no audio');
}

// 2) speak() and speakBodyText() bail out for dialect.
function fnBody(name){
  const at = html.indexOf('function ' + name + '(');
  const b = html.indexOf('{', at); let d=0,i=b;
  for(;i<html.length;i++){ if(html[i]==='{')d++; else if(html[i]==='}'){d--; if(!d){i++;break;}} }
  return html.slice(at,i);
}
assert.ok(/if\(_lessonIsDialect\(\)\) return;/.test(fnBody('speak')), 'speak() returns early for dialect');
assert.ok(/if\(_lessonIsDialect\(\)\) return;/.test(fnBody('speakBodyText')), 'speakBodyText() returns early for dialect');

// 3) Read-translate card hides the speaker button for dialect.
assert.ok(/_lessonIsDialect\(\)\?'':`<button class="spk-ico"/.test(html),
  'tRead hides the 🔊 button for dialect');

// 4) Source→target MCQ: the BADGE still has a dialect variant; the QUESTION no longer needs one.
// v69_i (user request): the question stopped naming the target language for EVERY lesson, not just
// dialect ones — the badge above it already shows direction (flag→flag) and the language. So the
// old `.q_nolang` text became the canonical `ex.mcq_source_target.q` and the variant was removed;
// the dialect branch for the question disappeared with it. A `{lang}` placeholder creeping back
// into this key would silently reintroduce the language name, so that is asserted directly.
assert.ok(/const q = t\("ex\.mcq_source_target\.q",\{word:qWord\(furiHtml\(ex\.source\)\)\}\);/.test(html),
  'one question string for dialect and non-dialect alike');
assert.ok(!/t\("ex\.mcq_source_target\.q_nolang"/.test(html),
  'the no-lang question variant is no longer USED by the client (the comment explaining it may stay)');
assert.ok(!('ex.mcq_source_target.q_nolang' in ui.en), 'and from ui.json (it became the canonical key)');
assert.ok(!/\{lang\}/.test(ui.en['ex.mcq_source_target.q']), 'the canonical question has no {lang} placeholder');
// The badge keeps its dialect variant — naming a language is right there, wrong in the question.
assert.ok(/dia \? t\("ex\.badge\.mcq_source_target_nolang"/.test(html), 'dialect uses the no-lang MCQ badge');
assert.ok('ex.badge.mcq_source_target_nolang' in ui.en, 'no-lang badge string exists');

// 5) lBlock renders NO listen button for dialect (used by the "what does X mean" MCQ too).
assert.ok(/typeof _lessonIsDialect==='function' && _lessonIsDialect\(\)\)\{\s*return hideWord \? '' : `<div class="target-box"/.test(html.replace(/\n\s*/g,' ')) ||
  /_lessonIsDialect\(\)\)\{[\s\S]*?return hideWord \? '' : `<div class="target-box"/.test(html),
  'lBlock shows the word plainly (no listen button) for dialect');

// 6) The story-unlock speaker button is hidden for dialect.
assert.ok(/id="comp-story-spk"/.test(html), 'story-unlock speaker button has an id');
assert.ok(/_spk\.style\.display = \(typeof _lessonIsDialect==='function' && _lessonIsDialect\(\)\) \? 'none' : ''/.test(html),
  'story-unlock speaker button is hidden for dialect');

console.log('  dialect mute: listen dropped, speak() muted, 🔊 hidden (cards + lBlock + story), MCQ drops {lang}: OK');
console.log('unit-dialect-mute: ALL PASSED');
