// unit-book-script.test.js
// v78_p (user-reported) — a MULTI-CHAPTER job carries the chosen script end to end.
//
// User: "I continued a german->serbian (latin script) lesson via 'continue story' and 2 chapters. I
// selected 'Serbian - cyrillic' as the language, to switch the story to cyrillic script, however
// the stories came out in latin script. Also, I had activated 'add script lesson', but script
// lessons were never made."
//
// ONE omission, TWO symptoms. The client's multi-chapter body (`gbody`) never set `script` /
// `srcScript`, so:
//   1. the server had no script, `sysStory` omitted the `scriptNote` (v76_h) and the model wrote
//      `sr` in its default Latin; and
//   2. the arc primer then ran `introExtendLetters('cyrillic-sr', <a Latin text>)`, found no
//      Cyrillic letters IN THE CHAPTER, and built nothing — so "no script lessons" was not a
//      second bug but a consequence of the first.
// The server's `userOpts` was missing them too, so fixing only the client would have moved the
// failure one hop rather than removing it.
//
// `/api/generate` had always passed them; only the book route did not — which is why this survived
// `v78_g`, whose reproduction case was a single-chapter storyline.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./lib-dom');

const client = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

// ── 1. The client sends the scripts on the multi-chapter path ───────────────
{
  // The multi-chapter branch builds `gbody` and posts it to /api/generate-book.
  const at = client.indexOf('const gbody = { generated:true, topic,');
  assert.ok(at > 0, 'the multi-chapter request body is built where expected');
  const block = client.slice(at, client.indexOf("fetch('/api/generate-book'", at));
  assert.ok(/gbody\.script\s*=/.test(block), 'gbody carries the chosen target script');
  assert.ok(/gbody\.srcScript\s*=/.test(block), 'gbody carries the chosen source script');
  assert.ok(/APP\.script/.test(block) && /APP\.srcScript/.test(block),
    'and takes them from the picker state rather than re-deriving them');
  console.log('  the multi-chapter request carries both scripts');
}

// ── 2. The server passes them into userOpts ─────────────────────────────────
// The hop that would otherwise swallow them. `generate()` reads `userOpts.script` for the story
// prompt, the saved stamps AND the arc primer, so this one field feeds all three symptoms.
{
  const at = server.indexOf('const userOpts = {');
  assert.ok(at > 0, 'the book route builds userOpts');
  const block = server.slice(at, server.indexOf('const data  = await generate(', at));
  assert.ok(/script:\s*base\.script/.test(block), 'userOpts.script comes from the job');
  assert.ok(/srcScript:\s*base\.srcScript/.test(block), 'userOpts.srcScript too');
  console.log('  the book route hands both scripts to generate()');
}

// ── 3. Non-vacuity: `base` really has them, and generate() really reads them ─
// Without these, §2 could be passing on fields that are always null, or on a value nothing
// consumes — which is exactly how the bug looked from the outside.
{
  assert.ok(/script:\s*script\s*\|\|\s*null,\s*srcScript:\s*srcScript\s*\|\|\s*null/.test(server),
    '`base` carries the scripts from the request body (v78_g)');
  assert.ok(/script,\s*srcScript\s*\}\s*=\s*body/.test(server.replace(/\s+/g, ' ')) ||
            /script, srcScript \} = body/.test(server.replace(/\s+/g, ' ')),
    'and the book handler destructures them from the body at all');
  assert.ok(/sysStory\([^)]*userOpts\.script\)/.test(server),
    'the story prompt is built with the chosen script — symptom 1');
  assert.ok(/script:\s*userOpts\.script/.test(server),
    'and the saved topic is stamped with it — which is what the arc primer later reads');
  console.log('  base carries them, the prompt uses them, the topic is stamped with them');
}

// ── 4. The prompt really says it, and only for a digraphic language ─────────
// `scriptNote` is what makes the model stop drifting. Guarded here because symptom 1 is invisible
// without a live model: everything above can be wired correctly and the story still come out Latin
// if this note is dropped.
{
  const prompts = JSON.parse(fs.readFileSync(path.join(ROOT, 'prompts.json'), 'utf8'));
  assert.ok(prompts.story && prompts.story.scriptNote, 'prompts.json carries story.scriptNote');
  assert.ok(/\{scriptLabel\}/.test(prompts.story.scriptNote),
    'and names the script it wants');
  assert.ok(/hasScriptChoice\(lang\)\s*&&\s*P\.scriptNote/.test(server),
    'it is added only when the language really HAS a choice — nothing is said to the other 31');
  console.log('  the story prompt states the script, for digraphic languages only');
}

// ── 5. The causal link, stated so it is not re-diagnosed as two bugs ────────
// `introExtendLetters` teaches the letters that appear in THIS CHAPTER'S TEXT. A Latin story
// therefore yields an empty Cyrillic primer with no error — the "script lessons were never made"
// half. Asserted on the builder's contract so a future refactor that stops reading the chapter
// text has to face this comment.
{
  assert.ok(/function introExtendLetters\(scriptName, chapterText/.test(server),
    'the primer is built from the CHAPTER TEXT, which is why a Latin story silently yields none');
  const at = server.indexOf('function buildArcIntroLessons');
  const block = server.slice(at, at + 1800);
  assert.ok(/introExtendLetters\(/.test(block), 'and the arc primer goes through it');
  console.log('  the primer reads the chapter text — the second symptom follows from the first');
}

console.log('unit-book-script: ALL PASSED');
