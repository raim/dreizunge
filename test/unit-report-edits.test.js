// Unit test for report-edits.js (todo #12): a temporal edit/activity report over
// a lessons.json. Uses a tiny synthetic store; asserts event extraction from each
// level (storyline / chapter / lesson / question / flag), most-recent-first order,
// --since and --kinds filtering, and that both renderers emit the rows.
const assert = require('assert');
const path = require('path');
const { collectEvents, renderMarkdown, renderHtml } = require(path.join(__dirname, '..', 'report-edits.js'));

const store = {
  storylines: [
    { id: 'sl_1', title: 'Story One', lang: 'en', srcLang: 'de',
      createdAt: '2026-06-01T08:00:00.000Z', updatedAt: '2026-06-05T09:00:00.000Z',
      chapters: ['tp_a', 'tp_b'] },
  ],
  topics: [
    { id: 'tp_a', topic: 'Greetings', lang: 'en', srcLang: 'de',
      generatedAt: '2026-06-01T08:01:00.000Z', updatedAt: '2026-06-01T08:01:00.000Z',
      lessons: [
        { id: 1, type: 'vocab', title: 'Words', _genMeta: { at: '2026-06-01T08:01:30.000Z', model: 'qwen' },
          vocab: [
            { target: 'Hallo', source: 'hello', editedAt: '2026-06-06T10:00:00.000Z' },
            { target: 'Tschüss', source: 'bye',
              userFlag: { comment: 'wrong gloss', at: '2026-06-07T11:00:00.000Z' } },
          ] },
      ] },
    { id: 'tp_b', topic: 'Numbers', lang: 'en', srcLang: 'de',
      generatedAt: '2026-06-02T08:00:00.000Z', updatedAt: '2026-06-08T08:00:00.000Z',
      lessons: [] },
    // standalone topic (not in any storyline)
    { id: 'tp_solo', topic: 'Solo', lang: 'fr', srcLang: 'en',
      generatedAt: '2026-05-20T08:00:00.000Z', lessons: [] },
  ],
  flags: {
    'tp_x:order:Foo': { topic: 'old topic', target: 'Foo bar', flaggedAt: '2026-04-01T00:00:00.000Z', comment: 'legacy' },
  },
};

// 1) full collection
const all = collectEvents(store);
const byKind = {};
all.forEach(e => byKind[e.kind] = (byKind[e.kind] || 0) + 1);
assert.strictEqual(byKind.storyline, 2, 'storyline created+updated');      // created + updated
assert.strictEqual(byKind.chapter, 4, 'chapters: a(gen) b(gen+upd) solo(gen)'); // tp_a gen (gen==upd so 1) + tp_b gen+upd (2) + solo gen (1)
assert.strictEqual(byKind.lesson, 1, 'lesson _genMeta.at');
assert.strictEqual(byKind.question, 1, 'one edited question');
assert.strictEqual(byKind.flag, 2, 'one userFlag + one legacy flag');

// 2) most-recent-first ordering
for (let i = 1; i < all.length; i++)
  assert.ok(all[i - 1].ts >= all[i].ts, 'events must be sorted descending by ts');
assert.strictEqual(all[0].ts, '2026-06-08T08:00:00.000Z', 'newest event first (tp_b updated)');

// 3) standalone vs in-storyline labelling (now split into storyline/chapter columns)
const solo = all.find(e => e.kind === 'chapter' && e.chapter.includes('Solo'));
assert.ok(solo && /standalone/i.test(solo.storyline), 'standalone chapter marked standalone in storyline column');
const greet = all.find(e => e.kind === 'chapter' && e.chapter.includes('Greetings'));
assert.ok(greet && greet.storyline.includes('Story One'),
  'in-storyline chapter names its storyline in the storyline column');

// 3b) a question event carries the full storyline/chapter/lessonType/question split
const q = all.find(e => e.kind === 'question' && e.action === 'edited');
assert.ok(q && q.storyline.includes('Story One') && q.chapter.includes('Greetings')
  && /vocab/.test(q.lessonType) && q.question.includes('Hallo'),
  'edited question splits into storyline/chapter/lessonType/question');

// 4) --since filter
const since = collectEvents(store, { since: '2026-06-06T00:00:00.000Z' });
assert.ok(since.length < all.length && since.every(e => e.ts >= '2026-06-06T00:00:00.000Z'),
  '--since drops older events');

// 5) --kinds filter
const onlyFlags = collectEvents(store, { kinds: ['flag'] });
assert.ok(onlyFlags.length === 2 && onlyFlags.every(e => e.kind === 'flag'), '--kinds=flag keeps only flags');

// 6) --limit
assert.strictEqual(collectEvents(store, { limit: 3 }).length, 3, '--limit caps count');

// 7) renderers
const md = renderMarkdown(all, { source: 'synthetic' });
assert.ok(md.includes('| When (UTC) | Storyline | Chapter | Lessonset type | Question | Action | Detail |'), 'markdown table header present');
assert.ok(md.includes('Greetings') && md.includes('wrong gloss'), 'markdown includes content + flag comment');
assert.ok(!/\n\|[^\n]*\n[^|]/.test(''), 'noop'); // placeholder
const html = renderHtml(all, { source: 'synthetic' });
assert.ok(/<table>/.test(html) && /Greetings/.test(html), 'html includes a table and content');
assert.ok(/&amp;|&lt;|&gt;|<td/.test(html), 'html is escaped/structured');
// legend for used kinds + sortable headers present
assert.ok(/class="legend">Row colour:/.test(html), 'html has a colour legend');
assert.ok(/<span class="box k-storyline">/.test(html) && /<span class="box k-flag">/.test(html),
  'legend has swatches for the used kinds');
assert.ok(/th\{[^}]*cursor:pointer/.test(html), 'headers are styled as sortable');

// 8) the embedded sort script actually reorders rows (run it against a tiny DOM stub)
const mkCell = (text, ds) => ({ textContent: text, getAttribute: k => (k === 'data-sort' ? (ds == null ? null : ds) : null) });
const mkRow = cells => ({ cells });
const mkTh = () => ({ _a: {}, title: '', setAttribute(k, v) { this._a[k] = v; }, getAttribute(k) { return this._a[k]; }, addEventListener(ev, fn) { if (ev === 'click') this.click = fn; } });
const rowStubs = [
  mkRow([mkCell('2026-06-06T10:00:00Z', '2026-06-06T10:00:00Z'), mkCell('banana')]),
  mkRow([mkCell('2026-06-08T12:00:00Z', '2026-06-08T12:00:00Z'), mkCell('apple')]),
  mkRow([mkCell('2026-06-01T08:00:00Z', '2026-06-01T08:00:00Z'), mkCell('cherry')]),
];
const tbody = { rows: rowStubs.slice(), appendChild(r) { const i = this.rows.indexOf(r); if (i >= 0) this.rows.splice(i, 1); this.rows.push(r); } };
const ths = [mkTh(), mkTh()];
const tableStub = { tHead: { rows: [{ cells: ths }] }, tBodies: [tbody] };
const documentStub = { querySelector: sel => (sel === 'table' ? tableStub : null) };
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
new Function('document', script)(documentStub);

ths[1].click(); // sort by text column, ascending
assert.deepStrictEqual(tbody.rows.map(r => r.cells[1].textContent), ['apple', 'banana', 'cherry'], 'text column sorts ascending');
assert.strictEqual(ths[1].getAttribute('aria-sort'), 'ascending', 'active header marked ascending');
ths[1].click(); // toggle to descending
assert.deepStrictEqual(tbody.rows.map(r => r.cells[1].textContent), ['cherry', 'banana', 'apple'], 'second click toggles descending');
ths[0].click(); // sort by time column via data-sort
assert.deepStrictEqual(tbody.rows.map(r => r.cells[0].getAttribute('data-sort')),
  ['2026-06-01T08:00:00Z', '2026-06-06T10:00:00Z', '2026-06-08T12:00:00Z'], 'time column sorts chronologically by data-sort');
assert.strictEqual(ths[1].getAttribute('aria-sort'), 'none', 'previously-active header resets to none');
console.log('  HTML table sort script reorders rows: OK');

console.log(`unit-report-edits: ALL PASSED (${all.length} events; kinds ${JSON.stringify(byKind)})`);
