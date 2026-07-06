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
assert.ok(/_lessonIsDialect==='function' && _lessonIsDialect\(\)\) \? pool\.filter\(e => e\.type !== 'listen_mcq' && e\.type !== 'listen_type'\)/.test(html),
  'buildStandardExercises drops listen_mcq + listen_type for dialect');

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

// 4) Source→target MCQ uses a no-lang question + badge for dialect.
assert.ok(/dia \? t\("ex\.mcq_source_target\.q_nolang"/.test(html), 'dialect uses the no-lang MCQ question');
assert.ok(/dia \? t\("ex\.badge\.mcq_source_target_nolang"/.test(html), 'dialect uses the no-lang MCQ badge');
assert.ok('ex.mcq_source_target.q_nolang' in ui.en, 'no-lang question string exists');
assert.ok(!/\{lang\}/.test(ui.en['ex.mcq_source_target.q_nolang']), 'no-lang question has no {lang} placeholder');
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
