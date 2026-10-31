const chapterLabels={abstract:'摘要',introduction:'引言','related-work':'相关工作',methods:'方法',experiments:'实验',results:'结果',limitations:'局限',conclusion:'结论',references:'参考文献',unknown:'未识别章节'};
const reviewLabels={direct:'有直接依据',manual:'需人工核查',insufficient:'证据不足'};
const opportunityFields={users:'目标用户',scenario:'使用场景',painPoint:'问题',mechanism:'机制',technicalCapability:'技术能力',productCapability:'产品能力',feature:'功能',hypothesis:'假设',value:'价值',feasibility:'可行性',cost:'成本',risks:'风险',metrics:'指标',dependencies:'依赖',journey:'用户流程',acceptance:'验收标准',steps:'实验步骤',stopConditions:'停止条件'};

export function createResearchControls(React){
 const h=React.createElement;
 return function ResearchControls({bundle,run,busy}){
   const [chapters,setChapters]=React.useState([]),[editing,setEditing]=React.useState(null);
   React.useEffect(()=>{setChapters([]);setEditing(null);},[bundle?.runId,bundle?.annotations?.revision]);
   if(!Array.isArray(bundle?.reportData?.sections))return null;
   const r=bundle.reportData,args={key:bundle.key,runId:bundle.runId},a=bundle.annotations||{revision:0,entries:[]};
   const button=(text,fn)=>h('button',{type:'button',disabled:busy,onClick:fn},text);
   const edit=(type,id)=>{const prior=a.entries.find(e=>e.type===type&&e.targetId===id);setEditing({type,targetId:id,notes:prior?.notes||'',...(type==='finding'?{status:prior?.status||'pending'}:{priority:prior?.priority||'medium'})});};
   return h('section',{'aria-label':'研究覆盖与复核',className:'pi-note'},
     h('h3',null,'材料覆盖与研究用量'),
     r.selection?.chapters?h(React.Fragment,null,
       h('p',null,`已处理 ${r.selection.processedChunks}/${r.selection.totalChunks} 个片段。文本覆盖不代表理解准确率。`),
       ...r.selection.chapters.filter(c=>c.total).map(c=>h('label',{key:c.id},
         c.processed<c.total?h('input',{type:'checkbox',disabled:busy,checked:chapters.includes(c.id),onChange:e=>setChapters(e.target.checked?[...chapters,c.id]:chapters.filter(x=>x!==c.id))}):null,
         `${chapterLabels[c.id]}：${c.processed}/${c.total} `,h('progress',{max:c.total,value:c.processed,'aria-label':chapterLabels[c.id]}))),
       chapters.length?button('补充阅读所选章节',()=>run('analyze',{...args,supplementChapters:chapters,modules:r.requestedModules})):null
     ):h('p',null,'此版本未记录章节处理覆盖。'),
     r.usage?h(React.Fragment,null,h('p',null,`累计 ${r.usage.calls} 次调用 · 已知 ${r.usage.knownTokens} Token · ${r.usage.unknownUsageCalls} 次用量未知 · 费用未知`),
       ...Object.entries(r.usage.stages).map(([id,s])=>h('p',{key:id},`${({extraction:'证据提取',generation:'报告撰写',repair:'格式修复',review:'证据复核'})[id]||'其他'}：${s.calls} 次，${(s.durationMs/1000).toFixed(1)} 秒`))):null,
     h('details',null,h('summary',null,'检查结论依据与人工复核'),h('p',null,'自动审查仅辅助发现证据缺口；人工确认不改变模型原始分类。'),
       ...r.sections.flatMap(s=>s.findings.filter(f=>f.id).map(f=>h('article',{key:f.id,className:'pi-result'},
         h('p',null,f.statement),h('p',null,`${reviewLabels[f.review?.status]||'未审查'}：${f.review?.reason||'未记录'}`),
         h('p',null,`来源：${f.evidenceIds.join('、')||'无直接依据'}`),
         ...a.entries.filter(e=>e.type==='finding'&&e.targetId===f.id).map(e=>h('p',{key:e.targetId},`我的复核：${({confirmed:'已确认',questioned:'有疑问',pending:'待核查'})[e.status]} · ${e.notes}`)),
         button('记录我的复核',()=>edit('finding',f.id)))))),
     h('details',null,h('summary',null,`产品机会（${r.opportunities?.length||0}）`),
       !r.opportunities?.length?h('p',null,'没有结构化机会，请查看报告中的适用性和证据不足说明。'):null,
       ...(r.opportunities||[]).map(c=>h('article',{key:c.id,className:'pi-result'},h('h4',null,c.name),
         h('p',null,`${c.status==='not-recommended'?'不建议采用':'待验证方案'} · 依据：${c.evidenceIds.join('、')||'缺少直接证据，仅为假设'}`),
         h('p',null,`优先级：${({high:'高',medium:'中',low:'低'})[a.entries.find(e=>e.type==='opportunity'&&e.targetId===c.id)?.priority||c.priority]}（可由你调整）`),
         h('details',null,h('summary',null,'查看能力、需求与验证计划'),...Object.entries(opportunityFields).filter(([k])=>k!=='name').map(([k,label])=>h('p',{key:k},h('strong',null,label+'：'),c[k]))),
         h('div',{className:'pi-actions'},button('调整优先级',()=>edit('opportunity',c.id)),button('下载 PRD 草稿',()=>run('export_report',{...args,format:'prd',cardId:c.id})),button('下载 PoC 草稿',()=>run('export_report',{...args,format:'poc',cardId:c.id})))))),
     editing?h('form',{'aria-label':'保存人工意见',onSubmit:e=>{e.preventDefault();run('annotate',{...args,...editing,reportHash:bundle.reportHash,revision:a.revision});}},
       h('label',null,editing.type==='finding'?'复核状态':'我的优先级',h('select',{value:editing.status||editing.priority,onChange:e=>setEditing({...editing,[editing.type==='finding'?'status':'priority']:e.target.value})},
         ...Object.entries(editing.type==='finding'?{pending:'待核查',confirmed:'已确认',questioned:'有疑问'}:{high:'高',medium:'中',low:'低'}).map(([v,l])=>h('option',{key:v,value:v},l)))),
       h('label',null,'我的备注',h('textarea',{value:editing.notes,maxLength:5000,onChange:e=>setEditing({...editing,notes:e.target.value})})),h('button',{type:'submit',disabled:busy},'保存意见'),button('取消',()=>setEditing(null))):null
   );
 };
}
