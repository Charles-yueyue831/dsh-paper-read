import {createDrawer} from './drawer.js';
import {evidenceFor,safeSource} from './workbench-model.js';
const chapterLabels={abstract:'摘要',introduction:'引言','related-work':'相关工作',methods:'方法',experiments:'实验',results:'结果',limitations:'局限',conclusion:'结论',references:'参考文献',unknown:'未识别章节'};
const reviewLabels={direct:'有直接依据',manual:'需人工核查',insufficient:'证据不足'};
const kindLabels={'paper-fact':'论文事实','literature-fact':'外部研究事实',inference:'合理推断',proposal:'产品假设',unknown:'证据不足'};
const fields={users:'目标用户',scenario:'使用场景',painPoint:'用户问题',mechanism:'论文机制',technicalCapability:'技术能力',productCapability:'产品能力',feature:'用户功能',hypothesis:'验证假设',value:'用户价值',feasibility:'可行性',cost:'成本',risks:'风险',metrics:'验证指标',dependencies:'前提与依赖',journey:'用户流程',acceptance:'成功标准',steps:'实验步骤与对照',stopConditions:'停止条件'};
export function createResearchControls(React){
 const h=React.createElement,Drawer=createDrawer(React);
 return function ResearchControls({bundle,run,busy,part='overview'}){
  const [chapters,setChapters]=React.useState([]),[editing,setEditing]=React.useState(null),[evidence,setEvidence]=React.useState(null),[query,setQuery]=React.useState('');
  React.useEffect(()=>{setChapters([]);setEditing(null);setEvidence(null);},[bundle?.key,bundle?.runId,bundle?.annotations?.revision]);
  if(!Array.isArray(bundle?.reportData?.sections))return part==='overview'?h('p',null,'此报告没有结构化研究数据，可继续阅读原报告。'):null;
  const r=bundle.reportData,args={key:bundle.key,runId:bundle.runId},a=bundle.annotations||{revision:0,entries:[]};
  const findings=r.sections.flatMap(s=>s.findings||[]);
  const button=(text,fn)=>h('button',{type:'button',disabled:busy,onClick:fn},text);
  const edit=(type,id)=>{const prior=a.entries.find(e=>e.type===type&&e.targetId===id);setEditing({type,targetId:id,notes:prior?.notes||'',...(type==='finding'?{status:prior?.status||'pending'}:{priority:prior?.priority||'medium'})});};
  const show=f=>{setEvidence(f);if(f.id)edit('finding',f.id);};
  const form=editing?h('form',{onSubmit:e=>{e.preventDefault();run('annotate',{...args,...editing,reportHash:bundle.reportHash,revision:a.revision});}},
   h('h3',null,'我的意见（独立保存，不更改原报告）'),h('label',null,editing.type==='finding'?'复核状态':'优先级',h('select',{value:editing.status||editing.priority,onChange:e=>setEditing({...editing,[editing.type==='finding'?'status':'priority']:e.target.value})},...Object.entries(editing.type==='finding'?{pending:'待核查',confirmed:'已确认',questioned:'有疑问'}:{high:'高',medium:'中',low:'低'}).map(([v,l])=>h('option',{key:v,value:v},l)))),h('label',null,'备注',h('textarea',{value:editing.notes,maxLength:5000,onChange:e=>setEditing({...editing,notes:e.target.value})})),h('button',{disabled:busy,type:'submit'},'保存意见')):null;
  if(part==='overview')return h('section',{'aria-label':'报告概览'},h('h3',null,r.paper?.title),h('p',{className:'pi-small'},`报告版本 ${bundle.runId} · ${r.createdAt||'时间未记录'} · 模型 ${typeof r.model==='string'?r.model:JSON.stringify(r.model||'未记录')}`),
   h('div',{className:'pi-metrics'},h('span',null,`材料：${({abstract:'仅摘要','abstract-only':'仅摘要','partial-text':'部分正文','extracted-text':'提取正文', 'full-text':'可访问正文',full:'可访问正文',partial:'部分正文'})[r.coverage]||r.coverage||'未记录'}`),h('span',null,r.selection?`实际处理 ${r.selection.processedChunks}/${r.selection.totalChunks} 个片段`:'旧报告未记录覆盖'),h('span',null,`需核查 ${findings.filter(f=>f.review?.status!=='direct').length} 条结论`)),
   h('p',null,'文本覆盖不代表理解准确率；自动复核不能替代人工验证。'),...(r.warnings||[]).map((w,i)=>h('p',{key:i,className:'pi-note'},typeof w==='string'?w:JSON.stringify(w))),
   ...(r.research?.errors||[]).map((e,i)=>h('p',{key:i,className:'pi-note'},`来源限制：${e.source||''} ${e.error||e.message||''}`)),
   h('details',null,h('summary',null,'查看章节覆盖与用量'),r.selection?.chapters? r.selection.chapters.filter(c=>c.total).map(c=>h('label',{key:c.id},c.processed<c.total?h('input',{type:'checkbox',disabled:busy,checked:chapters.includes(c.id),onChange:e=>setChapters(e.target.checked?[...chapters,c.id]:chapters.filter(x=>x!==c.id))}):null,`${chapterLabels[c.id]||c.id}：${c.processed}/${c.total} `,h('progress',{max:c.total,value:c.processed,'aria-label':chapterLabels[c.id]||c.id}))):h('p',null,'此版本未记录章节覆盖。'),chapters.length?button('补充阅读所选章节（新版本）',()=>run('analyze',{...args,supplementChapters:chapters,modules:r.requestedModules})):null,
   r.usage?h('p',null,`累计 ${r.usage.calls} 次调用 · 已知 ${r.usage.knownTokens} Token · ${r.usage.unknownUsageCalls} 次用量未知 · 费用未知`):h('p',null,'模型用量未记录。')));
  return h('section',{'aria-label':'证据与产品行动'},h('h2',null,'核查依据，再决定行动'),
   h('details',null,h('summary',null,`证据审查 · ${findings.length} 条结论`),...findings.map((f,i)=>h('article',{key:f.id||i,className:'pi-result'},h('p',null,f.statement),h('p',{className:'pi-small'},`${kindLabels[f.kind]||'未分类'} · ${reviewLabels[f.review?.status]||'未审查'}`),button('查看原文与复核',()=>show(f))))),
   h('h3',null,`产品机会 · ${r.opportunities?.length||0}`),h('label',null,'筛选机会',h('input',{value:query,onChange:e=>setQuery(e.target.value),placeholder:'搜索用户、问题或方案'})),
   !r.opportunities?.length?h('p',null,'本报告没有结构化产品机会；不据此生成虚构方案。'):null,
   ...(r.opportunities||[]).filter(c=>JSON.stringify(c).toLowerCase().includes(query.toLowerCase())).map(c=>h('article',{key:c.id,className:'pi-card'},
    c.status==='not-recommended'?h('p',{className:'pi-note'},'暂不建议采用 · '+c.risks):h('p',{className:'pi-small'},'待验证产品假设'),h('h3',null,c.name),h('p',null,`${c.users} · ${c.painPoint}`),h('p',null,c.value),
    h('p',null,`我的优先级：${({high:'高',medium:'中',low:'低'})[a.entries.find(e=>e.type==='opportunity'&&e.targetId===c.id)?.priority]||'未设置'} · 模型建议：${({high:'高',medium:'中',low:'低'})[c.priority]}`),
    h('details',null,h('summary',null,'展开方案与验证计划'),h('div',{className:'pi-opportunity-map'},...['mechanism','technicalCapability','productCapability','feature'].map(k=>h('div',{key:k},h('strong',null,fields[k]),h('p',null,c[k])))),...['scenario','hypothesis','feasibility','cost','risks','dependencies','journey','steps','metrics','acceptance','stopConditions'].map(k=>h('p',{key:k},h('strong',null,fields[k]+'：'),c[k]))),
    h('div',{className:'pi-actions'},button('查看论文依据',()=>{setEditing(null);setEvidence({statement:c.name,kind:'proposal',evidenceIds:c.evidenceIds});}),button('调整优先级',()=>{setEvidence(null);edit('opportunity',c.id);}),button('下载 PRD 草稿',()=>run('export_report',{...args,format:'prd',cardId:c.id})),button('下载 PoC 草稿',()=>run('export_report',{...args,format:'poc',cardId:c.id}))))),
   r.opportunities?.length?h('div',{className:'pi-actions'},button('导出全部 PRD 草稿',()=>run('export_report',{...args,format:'prd'})),button('导出全部 PoC 草稿',()=>run('export_report',{...args,format:'poc'}))):null,
   evidence||editing?h(Drawer,{title:evidence?'证据详情与复核':'调整产品机会',onClose:()=>{setEvidence(null);setEditing(null);}},
    evidence?h(React.Fragment,null,h('p',null,evidence.statement),h('p',null,`原始分类：${kindLabels[evidence.kind]||'未分类'}`),h('p',null,`${reviewLabels[evidence.review?.status]||'未经自动审查'}：${evidence.review?.reason||'此内容仍需独立核验。'}`),
    ...Object.entries(evidence.review?.dimensions||{}).map(([k,v])=>h('p',{key:k},`${({object:'研究对象',dataset:'数据集',baseline:'对照组',metric:'指标',conditions:'适用条件'})[k]}：${({supported:'有依据',mismatch:'不匹配',unknown:'未知'})[v]||v}`)),
    evidenceFor(r,evidence.evidenceIds||[]).length?evidenceFor(r,evidence.evidenceIds||[]).map(e=>h('section',{key:e.id},h('h3',null,e.id+' · '+e.locator),h('blockquote',null,e.text),safeSource(e.url)?h('a',{href:safeSource(e.url),target:'_blank',rel:'noreferrer'},'查看来源'):h('p',null,'本地资料或来源链接未记录。'))):h('p',null,'没有可直接定位的原文依据，不能视作已验证收益。')):null,form):null);
 };
}
