// /api/lessons/import "merge mode" (mergeFlags): applies ONLY userFlag / userRating /
// _miscFlags from a submitted topic onto the maintainer's existing topic, matching items by
// identity (target/sentence/base) not index — drift-safe, content untouched. This tests the
// pure mergeFlagsIntoTopic helper; the endpoint routing on body.mergeFlags is server-owed.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

function extract(name) {
  const at = src.indexOf('function ' + name + '(');
  assert.ok(at >= 0, 'missing fn ' + name);
  const bs = src.indexOf('{', at);
  let d = 0, i = bs;
  for (; i < src.length; i++) { const c = src[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(at, i);
}
const { mergeFlagsIntoTopic } = new Function(extract('mergeFlagsIntoTopic') + '\nreturn { mergeFlagsIntoTopic };')();

// Existing (maintainer) topic — clean content, no flags.
const existing = {
  topic: 'Greetings',
  lessons: [
    { id: 'l1', vocab: [{ target: 'Hund', source: 'dog' }, { target: 'Katze', source: 'cat' }],
                sentences: [{ target: 'Guten Tag', source: 'Good day' }] },
    { id: 'l2', items: [{ sentence: 'I ___ home', choices: ['go', 'goes'] }], _miscFlags: [] },
  ],
};
// Incoming (submission) — flags/ratings, items in a DIFFERENT order, plus a _miscFlag.
const incoming = {
  topic: 'Greetings',
  lessons: [
    { id: 'l1', vocab: [{ target: 'Katze', source: 'cat', userFlag: { comment: 'wrong gender' } },
                        { target: 'Hund', source: 'CHANGED', userRating: { at: 't' } }],
                sentences: [{ target: 'Guten Tag', source: 'whatever', userFlag: { correct: 'Guten Tag!' } }] },
    { id: 'l2', items: [{ sentence: 'I ___ home', userRating: { at: 't' } }],
                _miscFlags: [{ exType: 'mcq_article', target: 'der' }] },
  ],
};
// add a delete candidate to vocab (Hund) to confirm userDelete is carried.
incoming.lessons[0].vocab[1].userDelete = { at: 't' };

const applied = mergeFlagsIntoTopic(existing, incoming);
assert.strictEqual(applied, 6, 'applied = 2 flags + 2 ratings + 1 misc + 1 delete');
assert.deepStrictEqual(existing.lessons[0].vocab[0].userDelete, { at: 't' }, 'Hund delete-candidate applied');

// Matched by identity (not index): Katze got the flag, Hund got the rating.
assert.deepStrictEqual(existing.lessons[0].vocab[0].userRating, { at: 't' }, 'Hund rating applied');
assert.deepStrictEqual(existing.lessons[0].vocab[1].userFlag, { comment: 'wrong gender' }, 'Katze flag applied');
// Content is NOT overwritten (Hund.source stays "dog", not "CHANGED").
assert.strictEqual(existing.lessons[0].vocab[0].source, 'dog', 'maintainer content preserved');
assert.deepStrictEqual(existing.lessons[0].sentences[0].userFlag, { correct: 'Guten Tag!' }, 'sentence flag applied');
assert.deepStrictEqual(existing.lessons[1].items[0].userRating, { at: 't' }, 'word_form rating applied');
assert.deepStrictEqual(existing.lessons[1]._miscFlags, [{ exType: 'mcq_article', target: 'der' }], 'misc flag merged');
console.log('  merge: flags/ratings by identity, content preserved, misc merged: OK');

// Idempotent: re-merging the same submission doesn't duplicate _miscFlags.
mergeFlagsIntoTopic(existing, incoming);
assert.strictEqual(existing.lessons[1]._miscFlags.length, 1, 'misc flags deduped on re-merge');
console.log('  merge: idempotent _miscFlags (no dupes): OK');

// Non-matching item is skipped (no crash, not applied).
const ex2 = { topic: 'T', lessons: [{ vocab: [{ target: 'A' }] }] };
const in2 = { topic: 'T', lessons: [{ vocab: [{ target: 'ZZZ', userFlag: {} }] }] };
assert.strictEqual(mergeFlagsIntoTopic(ex2, in2), 0, 'unmatched item applies nothing');
assert.ok(!ex2.lessons[0].vocab[0].userFlag, 'existing item untouched');
console.log('  merge: unmatched items skipped: OK');

// #2: editedAt is carried as a review MARKER (content NOT applied); index fallback when the
// edited item's identity field changed.
const exB = { topic: 'T', lessons: [{ id: 'l1', vocab: [{ target: 'Hund', source: 'dog' }, { target: 'Katze', source: 'cat' }] }] };
const inB = { topic: 'T', lessons: [{ id: 'l1', vocab: [{ target: 'Hund', source: 'DOGGO', editedAt: 'T9' }, { target: 'KatzeRENAMED', source: 'cat', editedAt: 'T9' }] }] };
mergeFlagsIntoTopic(exB, inB);
assert.strictEqual(exB.lessons[0].vocab[0].editedAt, 'T9', 'editedAt marker carried (identity match)');
assert.strictEqual(exB.lessons[0].vocab[0].source, 'dog', 'content NOT applied (keeps maintainer source)');
assert.strictEqual(exB.lessons[0].vocab[1].editedAt, 'T9', 'editedAt carried via index fallback (identity changed)');
assert.strictEqual(exB.lessons[0].vocab[1].target, 'Katze', 'identity-changed item keeps maintainer target');
console.log('  merge: editedAt marker carried (content not applied) + index fallback: OK');

// Wiring guards.
assert.ok(/const mergeFlags = !!\(body && body\.mergeFlags\)/.test(src), 'import handler reads body.mergeFlags');
assert.ok(/mergeFlagsIntoTopic\(exists, l\)/.test(src), 'import handler merges when flagged');
assert.ok(/inIt\.userDelete\) \{ exIt\.userDelete = inIt\.userDelete/.test(src), 'merge carries userDelete');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
assert.ok(/const isFlagSubmission = .*exportedBy === 'dreizunge-static-user'/.test(html), 'client detects flag submissions');
assert.ok(/body\.mergeFlags = confirm\(t\('toast\.import_merge_confirm'\)\)/.test(html), 'import offers merge-vs-replace choice');
console.log('  import merge wiring (server + client + export): OK');

console.log('unit-import-merge: ALL PASSED');
