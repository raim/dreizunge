// probe_coverage_bands_v78n.js — session 32. The same coverage, split by CORPUS FREQUENCY band per
// language (statistics, not a word list). Result at the v78_n cut: top-100 9.0%, top-500 12.2%,
// rare 5.1% — the rarest words are the LEAST covered, the opposite of 'start with the hard words'.
// Are the UNCOVERED words the rare ones or the common ones?
// "Common" is derived by FREQUENCY over the corpus per language — statistics, not a word list
// (INTERNALS §4: no language knowledge in the code).
const fs=require('fs'), path=require('path');
const {loadClient, ROOT}=require('/home/claude/work/dreizunge_v78/test/lib-dom');
const L=JSON.parse(fs.readFileSync(path.join(ROOT,'lessons.json'),'utf8'));
const LANGS=JSON.parse(fs.readFileSync(path.join(ROOT,'languages.json'),'utf8'));
const C=loadClient({quiet:true});
C.run(`LANGS=${JSON.stringify(LANGS)}; true;`);
const TOK=/[\p{L}\p{N}][\p{L}\p{N}'\u2019\-]*/gu;
const norm=s=>s.toLowerCase().replace(/[\u2019\u2018]/g,"'");

// 1. per-language frequency table from every story
const freq={};
for(const t of L.topics){ if(!t.story) continue; const f=freq[t.lang]||(freq[t.lang]={});
  for(const w of (String(t.story).match(TOK)||[])) { const k=norm(w); f[k]=(f[k]||0)+1; } }
const rank={};
for(const lg of Object.keys(freq)){
  rank[lg]=new Map(Object.entries(freq[lg]).sort((a,b)=>b[1]-a[1]).map(([w],i)=>[w,i]));
}
// 2. coverage split by frequency band
const band=(lg,w)=>{ const r=rank[lg]?.get(w); if(r==null) return 'rare';
  return r<100?'top100' : r<500?'top500' : 'rare'; };
const tally={top100:[0,0], top500:[0,0], rare:[0,0]};
let n=0;
for(const t of L.topics){
  if(!t.story||String(t.story).length<200) continue;
  const vocab=(t.lessons||[]).flatMap(l=>(l.vocab||[])).map(x=>x&&x.target).filter(Boolean);
  let extra=[]; try{ extra=JSON.parse(C.run(`JSON.stringify(_storyExtraWords(${JSON.stringify({lessons:t.lessons})}))`,'x')); }catch(_){}
  const words=[...new Set(vocab.concat(extra))].sort((a,b)=>b.length-a.length);
  if(!words.length) continue;
  const html=C.run(`_highlightVocabHtml(${JSON.stringify(t.story)}, ${JSON.stringify(words)})`,'h');
  const covered=new Set();
  for(const m of html.matchAll(/<mark[^>]*>([^<]*)<\/mark>/g))
    for(const w of (m[1].match(TOK)||[])) covered.add(norm(w));
  const types=new Set((String(t.story).match(TOK)||[]).map(norm));
  for(const w of types){ const b=band(t.lang,w); tally[b][1]++; if(covered.has(w)) tally[b][0]++; }
  if(++n>=120) break;
}
console.log('chapters:', n);
for(const b of ['top100','top500','rare']){
  const [c,tot]=tally[b];
  console.log(('  '+b).padEnd(10), String(c).padStart(5)+' / '+String(tot).padStart(6),
    '=', (Math.round(1000*c/tot)/10)+'% covered');
}
