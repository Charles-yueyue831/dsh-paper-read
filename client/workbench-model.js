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

// Use the running host contract, never the installed package version, as authority.
export function researchCompatibility(tools) {
 if (!Array.isArray(tools)) return '正在检查研究服务，请稍候或刷新会话。';
 for (const action of ['analyze','resume']) {
  const fields=tools.find(t=>t.name==='paper_insight_'+action)?.parameters?.properties;
  if (!fields?.maxCalls || !fields?.maxTotalTokens) return '研究界面已更新，但后台服务仍是旧版。请完全退出并重新打开 DeepSeek Harness；网页端需重启对应服务，然后刷新页面。';
 }
 return '';
}
export function failureStatus(error, status) {
 const saved=Boolean(error?.key && error?.runId);
 if(status==='cancelled')return saved?'研究已取消，已完成的内容已保存，可从研究历史继续。':'操作已取消，未生成可恢复的研究记录。';
 if(status==='budget-paused')return saved?'研究已暂停：预算已用完，已完成内容已保存。请在研究历史中调整预算并继续。':'操作因预算限制暂停，未生成可恢复的研究记录。';
 return saved?'研究未完成，已完成的内容已保存，可从研究历史继续。':'操作未完成，尚未生成可恢复的研究记录。';
}
export function recoverJob(jobs,sessions,session) {
 const valid=(jobs||[]).filter(j=>j.status==='running' && typeof j.id==='string' && typeof j.action==='string' && sessions.some(s=>s.id===j.sessionId));
 return valid.find(j=>j.sessionId===session) || (!session?valid[0]:null) || null;
}
