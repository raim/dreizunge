// probe_lesson_script_v80h.js — lessons that carry NONE of their chapter's target script.
// Reports; does not assert. The paired guard `unit-lesson-script-output` pins the detector.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const SCRIPTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts.json'), 'utf8'));
const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const a = src.indexOf('function lessonScriptDefect('), b = src.indexOf('\nfunction buildGenMeta(');
const detect = new Function('_scriptsData', src.slice(a, b) + '\nreturn lessonScriptDefect;')(SCRIPTS);

// The chapter's script: the stamp when present, else the language's single script from scripts.json.
const langScript = SCRIPTS._langScript || {};
const scriptOf = (t) => {
  if (t.script) return t.script;
  const m = langScript[t.lang];
  const arr = m ? (Array.isArray(m) ? m : [m]) : [];
  return arr.length === 1 ? arr[0] : null;          // a language with a CHOICE and no stamp: skip
};

let checked = 0, flagged = 0;
const byType = {}, byLang = {}, rows = [];
for (const t of store.topics) {
  const sc = scriptOf(t);
  if (!sc || sc === 'latin') continue;
  for (const L of (t.lessons || [])) {
    if (!L || L._hidden) continue;
    checked++;
    const d = detect(L, sc);
    if (!d) continue;
    flagged++;
    const ty = L.type || 'standard';
    byType[ty] = (byType[ty] || 0) + 1;
    byLang[t.lang] = (byLang[t.lang] || 0) + 1;
    rows.push(`  ${t.lang}  ${sc.padEnd(12)} ${ty.padEnd(13)} id=${String(L.id).padEnd(20)} latin=${d.latinChars}  ${t.topic}`);
  }
}
console.log('lessons in non-Latin chapters checked : ' + checked);
console.log('carrying ZERO target-script characters: ' + flagged +
            (checked ? '  (' + (100 * flagged / checked).toFixed(1) + '%)' : ''));
console.log('by type : ' + JSON.stringify(byType));
console.log('by lang : ' + JSON.stringify(byLang));
console.log('\n' + rows.join('\n'));
console.log('\n(reported, not asserted)');
