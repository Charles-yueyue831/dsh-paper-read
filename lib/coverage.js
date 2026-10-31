import { createHash } from 'node:crypto';
export const chapterLabels = { abstract:'摘要', introduction:'引言', 'related-work':'相关工作', methods:'方法', experiments:'实验', results:'结果', limitations:'局限', conclusion:'结论', references:'参考文献', unknown:'未识别章节' };
const headings = [
  ['abstract', /^(abstract|摘要)$/i], ['introduction', /^(introduction|引言|介绍)$/i],
  ['related-work', /^(related work|background|相关工作|背景)$/i],
  ['methods', /^(methods?|methodology|approach|proposed method|方法|方法论)(?:\s*[:：].{0,60})?$/i],
  ['experiments', /^(experiments?|experimental (setup|evaluation)|evaluation|实验|实验设置)(?:\s*[:：].{0,60})?$/i],
  ['results', /^(results?(?: and discussion)?|实验结果|结果|结果与讨论)$/i],
  ['limitations', /^(limitations?(?: and future work)?|局限性?|局限与展望)$/i],
  ['conclusion', /^(conclusions?(?: and future work)?|结论|总结)$/i],
  ['references', /^(references|bibliography|参考文献)$/i],
];
export const textHash = text => createHash('sha256').update(text).digest('hex');
export function chapterRanges(segments) {
  let current='unknown';
  return segments.map(segment=>{
    let offset=0;const ranges=[];
    for (const line of segment.text.split(/(?<=\n)/)) {
      const title=line.trim().replace(/^#{1,6}\s*/, '').replace(/^(?:\d+(?:\.\d+)*\.?|[IVX]+\.)\s+/, '').replace(/\*\*/g,'');
      const matched=headings.find(([,pattern])=>pattern.test(title));
      if(matched) current=matched[0];
      ranges.push({start:offset,end:offset+line.length,chapter:current});offset+=line.length;
    }
    return ranges;
  });
}
export function chooseChunks(all, limit, modules=[]) {
  if(all.length<=limit)return all;
  const recognized=all.some(c=>c.chapters?.some(x=>x!=='unknown'));
  if(!recognized)return Array.from({length:limit},(_,i)=>all[Math.round(i*(all.length-1)/Math.max(1,limit-1))]);
  const order=modules.includes('decision') || modules.includes('experience')
    ? ['experiments','results','methods','limitations','abstract','introduction','conclusion','related-work','unknown','references']
    : ['methods','experiments','results','limitations','abstract','introduction','conclusion','related-work','unknown','references'];
  const chosen=[];
  for(const chapter of order){
    if(chosen.length>=limit)break;
    if(chosen.some(c=>c.chapters.includes(chapter)))continue;
    const c=all.find(c=>c.chapters.includes(chapter));if(c)chosen.push(c);
  }
  for(const c of all)if(chosen.length<limit&&!chosen.includes(c))chosen.push(c);
  return chosen.sort((a,b)=>all.indexOf(a)-all.indexOf(b));
}
export function coverageOf(document,evidence=[]) {
  const all=document.allChunks || document.chunks;
  const selected=new Set(document.chunks.map(c=>c.id));
  const processed=new Set(all.filter(c=>evidence.some(e=>e.chunkId===c.id&&e.textHash===textHash(c.text))).map(c=>c.id));
  return { totalChunks:document.totalChunks, selectedChunks:selected.size, processedChunks:processed.size,
    completeInventory:all.length===document.totalChunks,
    chapters:Object.entries(chapterLabels).map(([id,label])=>{
      const rows=all.filter(c=>(c.chapters || ['unknown']).includes(id));
      return {id,label,total:rows.length,selected:rows.filter(c=>selected.has(c.id)).length,processed:rows.filter(c=>processed.has(c.id)).length};
    }), note:'文本处理覆盖不等于理解准确率；未识别或未出现的章节不代表论文没有该章节。' };
}
