// unit-continuation-postpass.test.js
// v78_r (user-reported) — what a CONTINUATION's post-pass may see, and what it may overwrite.
//
// User: "when continuing a story with a book job, we should NOT automatically update an existing
// summary and title, and only run those, if none exist. These should then use the whole story
// context, not just the context of the recently added chapters. Same for the post-pass
// chapter-title generation."
//
// And the failure that proves the context half matters, from the same report — adding chapters 3
// and 4 to a six-chapter storyline:
//
//     Chapters : 2, Lang: German …
//     Attempt 1/3: 0/2 titles came back named   (…2/3, 3/3 the same)
//     Chapter-title post-pass failed: no usable titles after 3 attempts
//
// while the storyline-header button, which passes all six, succeeded first time. **A mid-story
// fragment with no beginning is not enough for the model to name anything**, and `v71_p`'s
// three-attempt retry loop cannot fix missing context — it retries the same impossible request.
// That is the diagnostic worth keeping: a retry loop hides a context bug as a flaky model.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./lib-dom');

const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const fn = (() => {
  const at = server.indexOf('async function _titleStorylinePostPass');
  assert.ok(at > 0, 'the post-pass exists');
  const b = server.indexOf('{', at);
  let d = 0, i = b;
  for (; i < server.length; i++) { const c = server[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return server.slice(at, i);
})();

// ── 1. The excerpts come from the WHOLE chain, not the new chapters ─────────
{
  assert.ok(/const ctxTopics\s*=/.test(fn), 'the post-pass resolves a context set');
  assert.ok(/const stories = ctxTopics\.map/.test(fn),
    'the story excerpts are built from the whole-chain context, not from `topics`');
  assert.ok(/sl\.chapters\.map\(id => findSavedById\(id\)\)/.test(fn),
    'and the chain is read from the storyline\'s own chapter list');
  console.log('  chapter-title excerpts come from the whole chain');
}

// ── 2. …but only the NEW chapters are renamed ──────────────────────────────
// The other half of the ruling. Titles come back for the whole chain; applying them all would
// rename chapters the learner already has.
{
  assert.ok(/_applyChapterTitles\(_newTopics, _newMeta, bj\)/.test(fn),
    'only the chapters this job added are renamed');
  assert.ok(/_idx\.get\(t\.id\)/.test(fn),
    'and their titles are picked out BY ID, not by position — `chapterIds` need not be a ' +
    'contiguous tail of the chain');
  console.log('  only the new chapters are renamed, matched by id');
}

// ── 3. An existing storyline title is kept ─────────────────────────────────
{
  assert.ok(/_slPre && String\(_slPre\.title \|\| ''\)\.trim\(\)/.test(fn),
    'the storyline title is only generated when there is none');
  assert.ok(/keeping existing/.test(fn),
    'and the skip is logged, so a run that generated nothing is distinguishable from one that failed');
  console.log('  an existing storyline title is kept, and the skip is logged');
}

// ── 4. An existing summary is kept ─────────────────────────────────────────
{
  assert.ok(/_slPre2 && String\(_slPre2\.summary \|\| ''\)\.trim\(\)/.test(fn),
    'the summary is only generated when there is none');
  console.log('  an existing summary is kept');
}

// ── 5. When they ARE generated, it is from the whole chain ─────────────────
// Non-vacuity for §1 in the other two branches: skipping regeneration is only half the ruling —
// a FIRST generation must still see the whole story.
{
  // Sliced between the numbered section markers, not by a byte window around the function name.
  // The first draft used `indexOf('generateStorylineSummary') - 600`, which matched the name inside
  // the section's own COMMENT and then looked backwards into the title block — a window pin,
  // written in the same session that retired six of them. Markers are what the code guarantees.
  const between = (a, b) => {
    const i = fn.indexOf(a); assert.ok(i > 0, `section marker ${a} exists`);
    const j = b ? fn.indexOf(b, i) : fn.length;
    return fn.slice(i, j > i ? j : fn.length);
  };
  const titleBlock = between('// 2) Whole-storyline title', '// 3) Whole-storyline summary');
  assert.ok(/ctxTopics\.map\(t => t\.topic\)/.test(titleBlock),
    'a first storyline title is built from the whole chain');
  const sumBlock = between('// 3) Whole-storyline summary', '// 4)');
  assert.ok(/ctxTopics\.map\(t => t\.topic\)/.test(sumBlock) && /ctxTopics\.flatMap/.test(sumBlock),
    'and so is a first summary, including the vocabulary it draws on');
  console.log('  first-time title and summary both use the whole chain');
}

// ── 6. The full-story context checkbox defaults ON ─────────────────────────
// User: "the default should be to use the full story context. So the checkmark field on the main
// page should be pre-selected/active."
{
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.ok(/id="use-full-chain-cb"[^>]*\bchecked\b/.test(html),
    'the full-story-context checkbox is checked by default');
  // It must still be the thing the request reads, or the default is decorative.
  assert.ok(/useFullChain:.*use-full-chain-cb.*checked/.test(html),
    'and the request still reads that checkbox');
  console.log('  the full-story-context checkbox defaults to on and still drives the request');
}

console.log('unit-continuation-postpass: ALL PASSED');
