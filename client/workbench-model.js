export const modes={quick:['paper','first-principles','beginner'],deep:['paper','first-principles','landscape','transfer','beginner'],product:['paper','sandbox','features','products','experience','decision']};
export const modeLabels={quick:'快速阅读',deep:'深度研究',product:'产品研究'};
export const views={discover:'发现论文',create:'创建研究',report:'研究报告',history:'研究历史'};
export function precheck({session,reference,modules,maxCalls,busy}){
 if(!session)return '请先选择已配置模型与工作区的会话。';
 if(!reference.trim())return '请填写论文信息或工作区内文件路径。';
 if(!modules.length)return '请至少选择一项研究内容。';
 if(!Number.isInteger(Number(maxCalls))||Number(maxCalls)<1||Number(maxCalls)>1000)return '模型调用次数须为 1–1000 的整数。';
 if(busy)return '当前任务完成或取消后才能开始另一项任务。';
 return '';
}
export function safeSource(url){try{const u=new URL(url);return u.protocol==='https:'?u.href:null;}catch{return null;}}
export function progressCount(p){return Number.isInteger(p?.completed)&&Number.isInteger(p?.total)&&p.total>0&&p.completed>=0&&p.completed<=p.total?`${p.completed}/${p.total}`:'';}
export function evidenceFor(report,ids){
 const found=[];
 for(const e of report.evidence||[])for(const f of e.facts||[])if(ids.includes(f.id))found.push({id:f.id,text:f.quote,locator:e.locator,url:report.paper?.url});
 for(const kind of ['references','citations','discovery'])for(const p of report.research?.[kind]||[])if(ids.includes(p.evidenceId))found.push({id:p.evidenceId,text:p.abstract||'仅有出版元数据，不能据此验证技术效果。',locator:p.title,url:p.url});
 return found;
}
