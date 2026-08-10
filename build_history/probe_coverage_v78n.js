// probe_coverage_v78n.js — session 32. Story COVERAGE (share of the text a learner could read),
// as distinct from MARKS (occurrences highlighted, which v78_h and v78_k measured). Result at the
// v78_n cut: 9.2% of tokens, 8.2% of types, median chapter 13.2%, no chapter above 50%.
// Re-run after any change to lesson generation; the roadmap records the numbers to compare against.
// How much of a chapter's STORY do its lessons actually teach?
// Marks count occurrences highlighted. COVERAGE is the share of the text a learner could read.
// Uses the PRODUCT matcher (_highlightVocabHtml + _storyWordSources), never a re-implementation.
const fs=require('fs'), path=require('path');
const {loadClient, ROOT}=require('/home/claude/work/dreizunge_v78/test/lib-dom');
const L=JSON.parse(fs.readFileSync(path.join(ROOT,'lessons.json'),'utf8'));
const LANGS=JSON.parse(fs.readFileSync(path.join(ROOT,'languages.json'),'utf8'));
const C=loadClient({quiet:true});
C.run(`LANGS=${JSON.stringify(LANGS)}; true;`);

const TOK=/[\p{L}\p{N}][\p{L}\p{N}'\u2019\-]*/gu;
const norm=s=>s.toLowerCase().replace(/[\u2019\u2018]/g,"'");

function analyse(t){
  const story=String(t.story||'');
  const vocab=(t.lessons||[]).flatMap(l=>(l.vocab||[])).map(x=>x&&x.target).filter(Boolean);
  let extra=[];
  try{ extra=JSON.parse(C.run(`JSON.stringify(_storyExtraWords(${JSON.stringify({lessons:t.lessons})}))`,'x')); }catch(_){}
  const words=[...new Set(vocab.concat(extra))].sort((a,b)=>b.length-a.length);
  if(!words.length) return null;
  const html=C.run(`_highlightVocabHtml(${JSON.stringify(story)}, ${JSON.stringify(words)})`,'h');
  // tokens inside <mark> = covered occurrences
  const covered=new Set(); let coveredTok=0;
  for(const m of html.matchAll(/<mark[^>]*>([^<]*)<\/mark>/g)){
    for(const w of (m[1].match(TOK)||[])){ coveredTok++; covered.add(norm(w)); }
  }
  const allTok=story.match(TOK)||[];
  const types=new Set(allTok.map(norm));
  return { tokens:allTok.length, coveredTok,
           types:types.size, coveredTypes:[...types].filter(x=>covered.has(x)).length };
}

let n=0, T=0,CT=0, Y=0,CY=0; const perChapter=[];
for(const t of L.topics){
  if(!t.story||String(t.story).length<200) continue;
  const r=analyse(t); if(!r||!r.tokens) continue;
  n++; T+=r.tokens; CT+=r.coveredTok; Y+=r.types; CY+=r.coveredTypes;
  perChapter.push(r.coveredTypes/r.types);
  if(n>=120) break;
}
perChapter.sort((a,b)=>a-b);
const pct=x=>Math.round(1000*x)/10;
const q=p=>pct(perChapter[Math.floor(p*(perChapter.length-1))]);
console.log('chapters measured:', n);
console.log('TOKEN coverage (running words) :', pct(CT/T)+'%   ('+CT+' of '+T+')');
console.log('TYPE  coverage (distinct words):', pct(CY/Y)+'%   ('+CY+' of '+Y+')');
console.log('per-chapter TYPE coverage — min', q(0)+'%  p25', q(.25)+'%  median', q(.5)+'%  p75', q(.75)+'%  max', q(1)+'%');
console.log('chapters below 25% type coverage:', perChapter.filter(x=>x<0.25).length,
            '| above 50%:', perChapter.filter(x=>x>0.5).length);
