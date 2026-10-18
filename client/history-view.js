export const statusLabels = { completed:'已完成', failed:'分析未完成', cancelled:'已取消', running:'正在分析', fetched:'已取得论文' };
export const stageLabels = { starting:'准备任务', fetch:'获取论文', research:'检索相关研究', analysis:'分析论文', evidence:'阅读并提取依据', synthesis:'撰写报告', save:'保存报告' };
export function explainFailure(message = '') {
  if (/标题请先搜索/.test(message)) return '先前版本未能识别论文标题。现在可以重新尝试分析，系统会先检索这篇论文。';
  if (/max-tokens|MODEL_OUTPUT_TRUNCATED/.test(message)) return '模型输出过长，本次分析未完成。可减少选中的分析内容后重试。';
  if (/HTTP 429/.test(message)) return '论文网站暂时限制访问，请稍后重试，或使用其他来源的论文链接。';
  if (/timeout|timed out|超时/i.test(message)) return '等待论文网站或模型回复超时，可稍后继续完成分析。';
  if (/输出经一次修复仍不合格/.test(message)) return '模型返回的内容不完整或格式不符合要求，已保存成功完成的部分，可继续尝试。';
  return message;
}

export function createHistoryView(React) {
  const h = React.createElement;
  return function HistoryView({ runs, selected, setSelected, detail, setDetail, run, busy, modules, onRepair }) {
    const [editing, setEditing] = React.useState(null);
    const [removing, setRemoving] = React.useState(null);
    React.useEffect(() => { setEditing(null); setRemoving(null); }, [runs]);
    const action = (name, fn) => h('button',{type:'button', disabled:busy, onClick:fn}, name);
    const args = r => ({key:r.key,runId:r.runId});
    return h(React.Fragment,null,
      ...runs.map(r => h('article',{key:r.key+'/'+r.runId,className:'pi-result'},
        h('label',null,h('input',{type:'checkbox', disabled:busy || !!r.record?.deletedAt || r.status!=='completed' || !!r.type,
          checked:selected.some(s=>s.runId===r.runId&&s.key===r.key),
          onChange:e=>setSelected(e.target.checked ? [...selected,args(r)] : selected.filter(s=>s.runId!==r.runId||s.key!==r.key))}),r.displayTitle || r.paper?.title || '未识别的论文'),
        h('div',{className:'pi-small'}, (r.record?.deletedAt?'已删除':r.interrupted?'上次分析中断':statusLabels[r.status] || r.status)+' · '+(r.startedAt?new Date(r.startedAt).toLocaleString():'时间未知')),
        r.record?.notes ? h('p',null,r.record.notes) : null,
        r.error ? h('p',{className:'pi-error'},explainFailure(r.error)) : null,
        !r.record?.deletedAt && r.recoveryError ? h('p',{className:'pi-small'},r.recoveryError) : null,
        h('div',{className:'pi-actions'},
          action('查看详情',()=>{setEditing(null);run('history_detail',args(r));}),
          r.record?.deletedAt ? action('恢复记录',()=>run('history_restore',{...args(r),revision:r.record.revision || 0})) : h(React.Fragment,null,
            r.status==='completed' && r.type!=='discovery' ? action('查看报告',()=>run('report',args(r))) : null,
            r.canResume ? action(r.hasDocument ? '继续完成分析' : '重新尝试分析',()=>run('resume',args(r))) : null,
            r.canReanalyze ? action('重新分析选中内容',()=>run('analyze',{...args(r),modules})) : null,
            !r.type && !r.hasDocument && r.status!=='running' ? action('修改论文信息',()=>onRepair(r.input || {})) : null,
            action('编辑记录',()=>setEditing({...args(r),title:r.displayTitle || '',notes:r.record?.notes || '',revision:r.record?.revision || 0})),
            action('删除记录',()=>setRemoving(r.runId)),
          )),
        removing===r.runId ? h('div',{className:'pi-note',role:'group','aria-label':'确认删除记录'},
          h('p',null,'删除后会移入“已删除”，论文和报告仍保留，可随时恢复。'),
          action('确认删除',()=>run('history_delete',{...args(r),revision:r.record?.revision || 0})),
          action('保留记录',()=>setRemoving(null))) : null,
        editing?.runId===r.runId ? h('form',{onSubmit:e=>{e.preventDefault();run('history_update',editing);}},
          h('label',null,'研究名称',h('input',{value:editing.title,required:true,maxLength:300,onChange:e=>setEditing({...editing,title:e.target.value})})),
          h('label',null,'我的备注',h('textarea',{value:editing.notes,maxLength:5000,onChange:e=>setEditing({...editing,notes:e.target.value})})),
          h('div',{className:'pi-actions'},h('button',{type:'submit',disabled:busy},'保存修改'),action('取消编辑',()=>setEditing(null)))) : null,
      )),
      detail ? h('section',{className:'pi-note','aria-label':'研究记录详情'},
        h('h3',null,detail.displayTitle),
        h('p',null,'论文原名：'+(detail.paper?.title || '未识别')),
        h('p',null,'状态：'+(detail.record?.deletedAt?'已删除':detail.interrupted?'上次分析中断':statusLabels[detail.status] || detail.status)),
        h('p',null,'论文信息：'+(detail.input?.reference || detail.input?.file || detail.paper?.url || '未保存')),
        h('p',null,'我的备注：'+(detail.record?.notes || '暂无备注')),
        !detail.record?.deletedAt ? h('p',null,'已完成分析内容：'+(detail.completedModules?.length || 0)+' 项') : h('p',null,'论文材料与报告已保留，恢复记录后可继续查看。'),
        detail.error ? h('p',{className:'pi-error'},'未完成原因：'+explainFailure(detail.error)) : null,
        detail.error ? h('details',null,h('summary',null,'查看原始错误信息'),h('pre',{className:'pi-report-source'},detail.error)) : null,
        h('p',{className:'pi-small'},'记录共更新 '+(detail.record?.revision || 0)+' 次。论文原文和已生成的报告保持原样。'),
        action('关闭详情',()=>setDetail(null))) : null,
    );
  };
}
