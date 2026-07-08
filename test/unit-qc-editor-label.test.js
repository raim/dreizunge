// v52_g: the lesson-editor QC flag shows WHICH model(s) suggested a fix. `qcSuggestRows(item)`
// renders one "<model> suggests: [field] <sug>" row per QC model in item.qcByModel (collect-and-
// compare), falling back to the single item.qc for older data. Both editor render sites use it.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const ui = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ui.json'), 'utf8'));

assert.strictEqual(ui.en['qc.editor.suggests_by'], '⚑ {model} suggests:', 'suggests_by key with {model}');
assert.ok(ui.en['qc.editor.suggests'], 'generic suggests fallback present');

assert.ok(/function qcSuggestRows\(item\)/.test(html), 'qcSuggestRows defined');
const rowsCalls = (html.match(/qcSuggestRows\((it|item)\)/g) || []).filter(x => !x.includes('function'));
assert.ok(rowsCalls.length >= 2, 'both QC render sites call qcSuggestRows (found ' + rowsCalls.length + ')');

const extract = (name) => {
  const at = html.indexOf('function ' + name + '(');
  const b = html.indexOf('{', at); let d = 0, i = b;
  for (; i < html.length; i++) { if (html[i] === '{') d++; else if (html[i] === '}') { d--; if (!d) { i++; break; } } }
  return html.slice(at, i);
};
const t = (k, o) => k === 'qc.editor.suggests_by' ? '⚑ ' + o.model + ' suggests:'
  : k === 'qc.editor.suggests' ? '⚑ QC suggests:'
  : k === 'qc.editor.in_target' ? 'in target' : k === 'qc.editor.in_source' ? 'in source' : k;
const escHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const qcSuggestRows = new Function('t', 'escHtml', extract('qcSuggestRows') + '\nreturn qcSuggestRows;')(t, escHtml);

{
  const item = { qc: { sug: 'tg-fix', field: 'source', by: 'translategemma' },
    qcByModel: { qwen: { sug: 'qwen-fix', field: 'source' }, translategemma: { sug: 'tg-fix', field: 'source' } } };
  const out = qcSuggestRows(item);
  assert.ok(out.includes('qwen suggests:') && out.includes('qwen-fix'), 'shows qwen row + suggestion');
  assert.ok(out.includes('translategemma suggests:') && out.includes('tg-fix'), 'shows translategemma row + suggestion');
  assert.strictEqual((out.match(/suggests:/g) || []).length, 2, 'exactly two model rows');
}
{
  const single = qcSuggestRows({ qc: { sug: 'old-fix', field: 'target', by: 'qwen' } });
  assert.ok(single.includes('qwen suggests:') && single.includes('old-fix'), 'fallback to item.qc names the model');
  const noBy = qcSuggestRows({ qc: { sug: 'ancient', field: 'target' } });
  assert.ok(noBy.includes('QC suggests:') && noBy.includes('ancient'), 'no-by fallback -> generic "QC suggests:"');
}
console.log('unit-qc-editor-label: ALL PASSED');
