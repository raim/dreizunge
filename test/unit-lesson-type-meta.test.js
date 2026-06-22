// Unit tests for the centralized LESSON_TYPE_META table (item 8 cheap-half).
// Asserts the single source of truth exists, the old duplicated inline
// {type->emoji}/{type->key} maps are gone, and the helpers resolve correctly
// (including the vocab/standard fallback).
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// 1) Single source of truth + helpers are present.
assert.ok(/const LESSON_TYPE_META = \{/.test(html), 'LESSON_TYPE_META table missing');
for (const fn of ['function lessonTypeMeta', 'function lessonTypeEmoji', 'function lessonTypeLabel']) {
  assert.ok(html.includes(fn), 'missing helper: ' + fn);
}
console.log('  source-shape checks: OK');

// 2) The old hand-duplicated maps are gone. The previous code repeated the
//    literal `conjugation:'🔤',error_hunt:'🔍'` (and quoted variant) at 3-4 sites;
//    after centralizing, that pair should appear ONLY inside the table once, in
//    the spaced form `conjugation:   { emoji: '🔤' ...`. So the compact inline
//    duplicates must be absent.
assert.ok(!html.includes("conjugation:'🔤',error_hunt:'🔍'"),
  'compact inline type->emoji map still present (site 3/4 not migrated)');
assert.ok(!html.includes("'conjugation':'🔤','error_hunt':'🔍'"),
  'quoted inline type->emoji map still present (site 2 not migrated)');
assert.ok(!html.includes('const _typeEmojis ='),
  '_typeEmojis local map still present (site 1 not migrated)');
console.log('  no duplicate maps remain: OK');

// 3) Extract the table literal and exercise the helpers against it.
const m = html.match(/const LESSON_TYPE_META = (\{[\s\S]*?\n\});/);
assert.ok(m, 'could not extract LESSON_TYPE_META literal');
// eslint-disable-next-line no-eval
const META = eval('(' + m[1] + ')');

const t = key => 'T:' + key;                       // stub translator
const meta = type => META[type] || META.standard;
const lessonTypeEmoji = type => meta(type).emoji;
const lessonTypeLabel = type => t(meta(type).key);

assert.strictEqual(lessonTypeEmoji('grammar'), '🏷️');
assert.strictEqual(lessonTypeEmoji('conjugation'), '🔤');
assert.strictEqual(lessonTypeEmoji('synonyms'), '🔁');
assert.strictEqual(lessonTypeEmoji('error_hunt'), '🔍');
assert.strictEqual(lessonTypeEmoji('ai_error_hunt'), '🔎');
assert.strictEqual(lessonTypeEmoji('math'), '🔢');
assert.strictEqual(lessonTypeLabel('grammar'), 'T:lesson.type.grammar');
assert.strictEqual(lessonTypeLabel('ai_error_hunt'), 'T:lesson.type.ai_error_hunt');
console.log('  helper resolution: OK');

// 4) Fallback: unknown type and the two vocab aliases resolve to the vocab default.
assert.strictEqual(lessonTypeEmoji('some_future_type'), '📚');
assert.strictEqual(lessonTypeLabel('some_future_type'), 'T:lesson.type.vocab');
assert.strictEqual(lessonTypeEmoji('standard'), '📚');
assert.strictEqual(lessonTypeEmoji('vocab'), '📚');
assert.strictEqual(lessonTypeLabel('standard'), 'T:lesson.type.vocab');
console.log('  vocab/standard fallback: OK');

console.log('unit-lesson-type-meta: ALL PASSED');
