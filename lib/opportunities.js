import { z } from 'zod';
import { textHash } from './coverage.js';
export const opportunityFields={name:'机会名称',users:'目标用户',scenario:'使用场景',painPoint:'用户问题',mechanism:'论文机制',technicalCapability:'技术能力',productCapability:'产品能力',feature:'用户功能',hypothesis:'价值假设',value:'用户价值',feasibility:'技术可行性',cost:'实施成本',risks:'风险',metrics:'验证指标',dependencies:'依赖条件',journey:'用户流程',acceptance:'验收标准',steps:'PoC 步骤',stopConditions:'停止条件'};
export const opportunitySchema=z.object({...Object.fromEntries(Object.keys(opportunityFields).map(k=>[k,z.string().min(1).max(1800)])),evidenceIds:z.array(z.string()).max(15),status:z.enum(['proposed','not-recommended']),priority:z.enum(['high','medium','low'])}).strict();
export const opportunityModules=['features','products','sandbox','decision'];
export function validateOpportunities(cards,known){
 for(const card of cards||[])for(const id of card.evidenceIds)if(!known.has(id))throw Error(`产品机会引用不存在：${id}`);
}
export function opportunitiesFrom(sections){return sections.flatMap(s=>(s.opportunities||[]).map(c=>({...c,id:`${s.id}-${textHash(JSON.stringify(c)).slice(0,16)}`,module:s.id,evidenceStatus:c.evidenceIds.length?'linked-hypothesis':'unsupported-hypothesis'})));}
const escape=s=>String(s??'').replace(/[<>]/g,c=>c==='<'?'&lt;':'&gt;');
export function renderDraft(report,format='prd',cardId,annotations,identity={}){
 const cards=(report.opportunities||[]).filter(c=>!cardId||c.id===cardId);
 if(cardId&&!cards.length)throw Error('产品机会不存在');
 const lines=[`# ${format==='poc'?'PoC':'PRD'} 草稿：${escape(report.paper.title)}`,'','> 由论文研究生成的待验证方案，不代表已实现或已验证收益。',`生成时间：${report.createdAt}`, `研究记录：${identity.key||report.paper.id||'未记录'} / ${identity.runId||'未记录'}`, `分析版本：${report.promptVersion||report.schemaVersion||'未记录'}`,''];
 if(!cards.length)lines.push('本次没有建议采用的产品机会。请参阅报告中的不适用原因；不生成虚构需求或收益。');
 for(const c of cards){lines.push(`## ${escape(c.name)}`,'',`状态：${c.status==='not-recommended'?'不建议采用':'待验证假设'} · 模型优先级：${c.priority}`,`来源模块：${c.module} · 卡片：${c.id}`,`证据：${c.evidenceIds.join('、')||'证据不足，仅为假设'}`,'');
 const user=annotations?.entries?.find(e=>e.type==='opportunity'&&e.targetId===c.id);
 if(user)lines.push(`人工优先级：${({high:'高',medium:'中',low:'低'})[user.priority]} · 修订 ${annotations.revision}`,`人工备注：${escape(user.notes)}`,'');
 const fields=format==='poc'?['hypothesis','mechanism','technicalCapability','dependencies','steps','metrics','acceptance','stopConditions','cost','risks','users','scenario','painPoint','productCapability','feature','journey','value','feasibility']:Object.keys(opportunityFields).filter(k=>k!=='name');
 for(const key of fields)lines.push(`### ${opportunityFields[key]}`,'',escape(c[key]),'');}
 lines.push('## 证据与边界','',`论文来源：${report.paper.url||'本地导入'}`,`材料范围：${report.coverage}`,'');
 const used=new Set(cards.flatMap(c=>c.evidenceIds));
 for(const e of report.evidence)for(const f of e.facts)if(used.has(f.id))lines.push(`- ${f.id} · ${escape(e.locator)}：${escape(f.quote)}`);
 for(const p of [...report.research.references,...report.research.citations,...report.research.discovery])if(used.has(p.evidenceId))lines.push(`- ${p.evidenceId} · ${escape(p.title)}：${p.url||'无链接'}（元数据与摘要）`);
 return lines.join('\n');
}
