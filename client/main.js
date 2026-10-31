import { modes, modeLabels, views, precheck, safeSource, progressCount } from './workbench-model.js';
import { workbenchStyle } from './workbench-style.js';
import { readingStyle } from "./reading-style.js";
import { createReportView } from "./report-view.js";
import { createResearchControls } from './research-controls.js';
import { createHistoryView, statusLabels, stageLabels, explainFailure } from "./history-view.js";
/* Native Harness client module; React is supplied by the host to avoid duplicate runtimes. */
window.__ModuleLoader__.load({
  id: "dsh-paper-insight",
  factory: (require) => {
    const React = require("react");
    const h = React.createElement;
    const { MarkdownText } = require("@deepseek-ai/dsh-client-ui-primitives");
    const ReportView = createReportView(React, MarkdownText);
    const ResearchControls=createResearchControls(React);
    const HistoryView = createHistoryView(React);
    const { useState, useEffect, useRef } = React;
    const labels = {
      paper: "技术理解",
      "first-principles": "第一性原理",
      landscape: "研究脉络",
      sandbox: "Agent 沙箱",
      features: "产品功能",
      products: "新产品",
      experience: "体验优化",
      transfer: "技术迁移",
      beginner: "零基础教学",
      decision: "PoC 与行动",
    };
    const css = `.pi-workbench{height:100%;overflow:auto;padding:28px clamp(18px,4vw,60px);box-sizing:border-box;color:var(--dsw-alias-label-primary);font:14px/1.6 system-ui}.pi-workbench h1{font-size:28px;letter-spacing:-.6px;margin:0}.pi-workbench h2{font-size:17px;margin:0 0 12px}.pi-workbench p{color:var(--dsw-alias-label-secondary)}.pi-grid{display:grid;grid-template-columns:minmax(300px,420px) minmax(0,1fr);gap:22px;margin-top:22px}.pi-card{border:1px solid var(--dsw-alias-border-l2,#ddd);border-radius:14px;padding:20px;margin-bottom:18px;background:var(--dsw-alias-bg-layer-2)}.pi-workbench input:not([type=checkbox]),.pi-workbench select,.pi-workbench textarea{box-sizing:border-box;width:100%;padding:9px 11px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,#bbb);background:var(--dsw-alias-bg-layer-1);color:inherit;font:inherit}.pi-workbench textarea{min-height:88px}.pi-workbench label{display:block;margin:10px 0 5px}.pi-workbench button{padding:8px 13px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,#bbb);background:var(--dsw-alias-bg-layer-3);color:inherit;cursor:pointer;font:inherit}.pi-workbench button:disabled{opacity:.45;cursor:default}.pi-workbench .pi-primary{background:#3566d6;color:white;border:0}.pi-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.pi-checks{display:grid;grid-template-columns:1fr 1fr;gap:4px}.pi-checks label{margin:0}.pi-note{padding:10px;border-radius:8px;background:var(--dsw-alias-bg-layer-3);overflow-wrap:anywhere}.pi-result{padding:12px 0;border-bottom:1px solid var(--dsw-alias-border-l2,#ddd)}.pi-result strong{display:block}.pi-report-source{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.8 ui-monospace,monospace;margin:0}.pi-report-body{font-size:15px;line-height:1.8;overflow-wrap:anywhere}.pi-report-body h1{font-size:26px;margin:24px 0 16px}.pi-report-body h2{font-size:21px;margin:28px 0 14px;border-bottom:1px solid var(--dsw-alias-border-l2,#ddd);padding-bottom:8px}.pi-report-body h3{font-size:17px;margin:22px 0 10px}.pi-report-body p{color:inherit}.pi-report-body pre{font-family:ui-monospace,monospace}.pi-report-body table{display:block;max-width:100%;overflow:auto}.pi-report-body blockquote{border-left:3px solid var(--dsw-alias-border-l2,#ddd);margin:16px 0;padding-left:16px}.pi-report-toolbar{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:14px 0}.pi-report-toolbar button[aria-pressed=true]{background:#3566d6;color:white}.pi-report-toc{margin:16px 0}.pi-report-toc nav{display:flex;flex-wrap:wrap;gap:8px;padding-top:12px}.pi-report-body [id]{scroll-margin-top:20px}.pi-diagram{margin:24px 0;padding:16px;border:1px solid var(--dsw-alias-border-l2,#ddd);border-radius:10px}.pi-diagram-svg{overflow:auto;background:white;color:#222;border-radius:6px;padding:12px}.pi-diagram-svg svg{display:block;max-width:none;min-width:min(100%,600px)}.pi-diagram pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.7 ui-monospace,monospace}.pi-diagram summary{cursor:pointer;margin-top:12px}.pi-small{font-size:12px;opacity:.75}.pi-error{color:#c84343}@media(max-width:900px){.pi-grid{grid-template-columns:1fr}}`;
    async function api(path, data) {
      const res = await fetch(
        "/api/paper-insight" + path,
        data
          ? {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(data),
            }
          : {},
      );
      const value = await res.json();
      if (!res.ok) throw new Error(value.error || "请求失败");
      return value;
    }
    function Workbench() {
      const reportAnchor = useRef(null);
      const [sessions, setSessions] = useState([]),
        [session, setSession] = useState(""),
        [query, setQuery] = useState(""),
        [reference, setReference] = useState(""),
        [local, setLocal] = useState(false),
        [modules, setModules] = useState([...modes.quick]),
        [papers, setPapers] = useState([]),
        [runs, setRuns] = useState([]),
        [selected, setSelected] = useState([]),
        [historyQuery, setHistoryQuery] = useState(""),
        [historyStatus, setHistoryStatus] = useState(""),
        [deleted, setDeleted] = useState(false),
        [offset, setOffset] = useState(0),
        [total, setTotal] = useState(0),
        [detail, setDetail] = useState(null),
        [submitting, setSubmitting] = useState(false),
        [report, setReport] = useState(""),
        [bundle,setBundle]=useState(null),
        [mode,setMode]=useState('quick'),
        [maxCalls,setMaxCalls]=useState('64'),
        [maxTotalTokens,setMaxTotalTokens]=useState(''),
        [status, setStatus] = useState("选择会话以使用对应工作区与模型。"),
        [error, setError] = useState(""),
        [job, setJob] = useState(null),
        [topics, setTopics] = useState(""),
        [advanced, setAdvanced] = useState({
          author: "",
          venue: "",
          institution: "",
          since: "",
          until: "",
          sort: "relevance",
        });
      const [elapsed,setElapsed]=useState(0),[view,setView]=useState('discover'),[origin,setOrigin]=useState('quick'),[sources,setSources]=useState(['arxiv','openalex']),[minCitations,setMinCitations]=useState(''),[progress,setProgress]=useState(null),[cancelling,setCancelling]=useState(false),[localRef,setLocalRef]=useState(''),[remoteRef,setRemoteRef]=useState(''),[resumeTarget,setResumeTarget]=useState(null);
      useEffect(()=>{if(!job?.startedAt)return;const update=()=>setElapsed(Math.floor((Date.now()-job.startedAt)/1000));update();const timer=setInterval(update,1000);return()=>clearInterval(timer);},[job?.id]);
      const submitLock = useRef(false);
      const referenceInput = useRef(null);
      const busy = !!job || submitting;
      const historyArgs = (page = offset) => ({ query: historyQuery, deleted, ...(historyStatus ? {status:historyStatus} : {}), offset:page, limit:20 });
      const repair = (input = {}) => {
        setView('create'); setLocal(Boolean(input.file)); setReference(input.file || input.reference || '');
        setReport(''); setDetail(null); setError('');
        referenceInput.current?.scrollIntoView({block:'center'}); referenceInput.current?.focus();
        setStatus('填写论文信息，然后点击“开始分析”。新的分析会保留在研究历史中。');
      };
      const refresh = () =>
        api("/sessions")
          .then((v) => {
            setSessions(v.sessions);
            setSession((old) =>
              v.sessions.some((s) => s.id === old)
                ? old
                : v.sessions[0]?.id || "",
            );
          })
          .catch((e) => setError(e.message));
      useEffect(() => {
        refresh();
      }, []);
      useEffect(() => {
        setProgress(null);setError('');setTopics('');setHistoryQuery('');setHistoryStatus('');setDeleted(false);setDetail(null);setReference('');setLocalRef('');setRemoteRef('');setResumeTarget(null);setQuery('');setRuns([]); setSelected([]); setReport(''); setBundle(null); setDetail(null); setPapers([]); setOffset(0);
        if (session) run('library', {offset:0,limit:20,deleted:false});
      }, [session]);
      useEffect(() => {
        if (!job) return;
        let stopped = false;
        let timer;
        const poll = async () => {
          try {
            const value = await api("/jobs?id=" + encodeURIComponent(job.id));
            if (stopped) return;
            setProgress(value.progress||null);
            if(value.status!=='running')setCancelling(false);
            if(!job.background) setStatus(
              value.status === "running"
                ? `正在处理：${stageLabels[value.progress?.stage] || "分析中"} ${progressCount(value.progress)}${value.progress?.usage?` · 已调用 ${value.progress.usage.calls}/${value.progress.budget?.maxCalls ?? '未设置'} 次 · 已知 ${value.progress.usage.knownTokens} Token，${value.progress.usage.unknownUsageCalls} 次用量未知`:''}`
                : value.status === "completed"
                  ? "已完成，结果已返回。"
                  : statusLabels[value.status] || "任务未完成",
            );
            if (value.status === "running") {
              timer = setTimeout(poll, 1200);
              return;
            }
            const queueHistory = async () => {
              const next = await api('/run', {sessionId:job.sessionId, tool:'paper_insight_library', args:historyArgs()});
              if (!stopped) setJob({id:next.id,action:'library',sessionId:job.sessionId,background:true});
            };
            if (value.error) {
              setStatus('研究未完成，已保留可恢复的内容。');
              setError(explainFailure(value.error.message));
              if (value.error.candidates) setPapers(value.error.candidates);
              if (value.error.key) await queueHistory();
              else { setJob(null); submitLock.current=false; }
              return;
            }
            const r = value.result;
            if (job.action === "search") setPapers(r.papers);
            else if (job.action === "library") { setRuns(r.runs); setTotal(r.total || 0); setSelected([]); }
            else if (job.action === "history_detail") setDetail(r);
            else if (job.action.startsWith('history_')) {
              if (job.action === 'history_delete') setReport('');
              if (r.record) setDetail(r.record);
              await queueHistory(); return;
            }
            else if (job.action === "subscriptions") {
              setTopics(r.topics.join("\n"));
              setStatus("关注主题已保存；由 Harness 定时任务触发增量发现。");
            } else if (job.action === "discover_updates") {
              setPapers(r.newPapers);
              setStatus(`发现 ${r.newPapers.length} 篇新增或更新论文。`);
            } else if (r.markdown) {
              if(job.action==='export_report'){const url=URL.createObjectURL(new Blob([r.markdown],{type:'text/markdown;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=r.filename||'research-draft.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
              else{setReport(r.markdown);setBundle(r);}
              if(job.reloadHistory) { await queueHistory(); return; }
            }
            else if (r.reportPath) {
              setStatus("分析已完成，正在读取完整报告…");
              const loaded = await api("/run", {
                sessionId: job.sessionId,
                tool: "paper_insight_report",
                args: { key: r.key, runId: r.runId },
              });
              if (stopped) return;
              setJob({
                id: loaded.id,
                action: "report",
                reloadHistory: true,
                sessionId: job.sessionId,
              });
              return;
            } else setReport(JSON.stringify(r, null, 2));
            setJob(null); submitLock.current=false;
            if (r.errors?.length)
              setError(
                "部分来源未返回结果：" +
                  r.errors.map((e) => e.source + " " + e.error).join("；"),
              );
          } catch (e) {
            if (!stopped) {
              setError(e.message);
              setJob(null); submitLock.current=false;
            }
          }
        };
        poll();
        return () => {
          stopped = true;
          clearTimeout(timer);
        };
      }, [job]);
      const run = async (action, args = {}) => {
        if (submitLock.current) return;
        setError("");
        if(['analyze','resume'].includes(action)){
          const calls=Number(maxCalls),tokens=maxTotalTokens?Number(maxTotalTokens):null;
          if(!Number.isInteger(calls)||calls<1||calls>1000||tokens!==null&&(!Number.isInteger(tokens)||tokens<1||tokens>10000000)){setError('请输入有效预算：调用次数 1–1000，Token 为正整数或留空。');return;}
          args={...args,maxCalls:calls,maxTotalTokens:tokens,...(mode&&!args.modules?{mode}:{})};
        }
        if (action === 'analyze' && !modules.length) { setError('请至少选择一项分析内容。'); return; }
        if (!session) {
          setError(
            "请先在 Harness 打开一个会话并配置模型和工作区，再点击刷新会话。",
          );
          return;
        }
        try {
          submitLock.current=true; setSubmitting(true);
          setCancelling(false);setProgress(null);setStatus("提交中…");
          const value = await api("/run", {
            sessionId: session,
            tool: "paper_insight_" + action,
            args,
          });
          setJob({ id: value.id, action, sessionId: session, startedAt:Date.now() });
        } catch (e) {
          setError(e.message); submitLock.current=false;
        } finally { setSubmitting(false); }
      };
      const button = (text, click, primary = false) =>
        h(
          "button",
          {
            type: "button",
            onClick: click,
            disabled: busy,
            className: primary ? "pi-primary" : "",
          },
          text,
        );
      const input = (label, value, change, type = "text") =>
        h(
          "label",
          null,
          label,
          h("input", { type, value, ...(change===setReference ? {ref:referenceInput} : {}), onChange: (e) => change(e.target.value) }),
        );
      const analyze = (ref) => {
        if (!ref.trim()) { setError(local ? '请填写工作区内的文件路径。' : '请填写论文标题、链接或编号。'); return; }
        return run("analyze", {
          ...(local ? { file: ref.trim() } : { reference: ref.trim() }),
          modules,
        });
      };
      const issue=precheck({session,reference,modules,maxCalls,busy});
      const selectPaper=p=>{setLocal(false);setReference(p.id||p.url||p.title);setView('create');setError('');};
      const search=()=>{if(!query.trim()){setError('请输入研究主题。');return;}if(!sources.length){setError('请选择至少一个论文来源。');return;}run('search',{query:query.trim(),sources,...Object.fromEntries(Object.entries(advanced).filter(([,v])=>v)),...(minCitations!==''?{minCitations:Number(minCitations)}:{}),limit:10});};
      const panel=(id,children)=>h('div',{id:'pi-panel-'+id,role:'tabpanel','aria-labelledby':'pi-tab-'+id,hidden:view!==id,className:'pi-panel'},children);
      const setCustom=next=>{setModules(next);if(mode)setOrigin(mode);setMode('');};
      return h('section',{className:'pi-workbench','aria-label':'论文研究工作台'},
        h('h1',null,'论文 → 产品'),h('p',null,'从理解一篇论文，到验证一个产品机会。'),
        h('label',null,'研究会话与工作区',h('select',{'aria-label':'研究会话',value:session,disabled:busy,onChange:e=>setSession(e.target.value)},h('option',{value:''},'请选择会话'),...sessions.map(s=>h('option',{key:s.id,value:s.id},(s.workspace||s.title)+' · '+s.id.slice(-8))))),
        h('div',{className:'pi-actions'},button('刷新会话',refresh),busy?h('span',null,'任务执行期间不能切换工作区；可以自由切换下方视图。'):null),
        h('nav',{className:'pi-tabs',role:'tablist','aria-label':'研究工作区'},...Object.entries(views).map(([id,label])=>h('button',{key:id,id:'pi-tab-'+id,role:'tab','aria-selected':view===id,'aria-controls':'pi-panel-'+id,tabIndex:view===id?0:-1,onClick:()=>setView(id),onKeyDown:e=>{const ids=Object.keys(views),i=ids.indexOf(id);let next;if(e.key==='ArrowRight')next=ids[(i+1)%4];if(e.key==='ArrowLeft')next=ids[(i+3)%4];if(e.key==='Home')next=ids[0];if(e.key==='End')next=ids[3];if(next){e.preventDefault();setView(next);document.getElementById('pi-tab-'+next)?.focus();}}},label))),
        h('section',{className:'pi-status','aria-label':'任务状态'},h('div',{role:'status'},status),job?.startedAt?h('p',{className:'pi-small'},`本次操作已等待 ${elapsed} 秒`):null,progress?.usage?h('p',null,`模型调用 ${progress.usage.calls} 次 · 已知 ${progress.usage.knownTokens} Token · ${progress.usage.unknownUsageCalls} 次用量未知 · 费用未知`):null,
          h('div',{className:'pi-actions'},job?h('button',{disabled:cancelling,onClick:async()=>{setCancelling(true);try{await api('/cancel',{id:job.id});setStatus('正在取消，等待当前操作结束；后续阶段将停止。');}catch(e){setError(e.message);setCancelling(false);}}},cancelling?'正在取消…':'取消任务'):null,
            report?h('button',{onClick:()=>setView('report')},'查看报告'):null)),
        error?h('p',{role:'alert',className:'pi-error'},error):null,
        panel('discover',h('div',{className:'pi-columns'},h('div',null,
          h('form',{className:'pi-card',onSubmit:e=>{e.preventDefault();search();}},h('h2',null,'寻找值得研究的论文'),input('主题关键词',query,setQuery),
            h('fieldset',null,h('legend',null,'论文来源'),...['arxiv','openreview','semantic-scholar','openalex','crossref'].map(s=>h('label',{key:s},h('input',{type:'checkbox',checked:sources.includes(s),onChange:e=>setSources(e.target.checked?[...sources,s]:sources.filter(x=>x!==s))}),s))),
            h('details',null,h('summary',null,'更多筛选'),...['author','institution','venue','since','until'].map(k=>input(({author:'作者',institution:'机构',venue:'会议 / 期刊',since:'起始日期',until:'结束日期'})[k],advanced[k],v=>setAdvanced({...advanced,[k]:v}),['since','until'].includes(k)?'date':'text')),input('最低引用量',minCitations,setMinCitations,'number')),
            h('label',null,'排序',h('select',{value:advanced.sort,onChange:e=>setAdvanced({...advanced,sort:e.target.value})},...Object.entries({relevance:'相关性',date:'发表时间',citations:'引用量'}).map(([k,v])=>h('option',{key:k,value:k},v)))),
            h('div',{className:'pi-actions'},h('button',{type:'submit',className:'pi-primary',disabled:busy||!query.trim()||!sources.length},'检索论文'),button('重置筛选',()=>{setAdvanced({author:'',institution:'',venue:'',since:'',until:'',sort:'relevance'});setMinCitations('');setSources(['arxiv','openalex']);}))),
          h('details',{className:'pi-card'},h('summary',null,'持续关注研究主题'),h('label',null,'每行一个主题',h('textarea',{value:topics,onChange:e=>setTopics(e.target.value)})),h('div',{className:'pi-actions'},button('读取关注主题',()=>run('subscriptions')),button('保存关注主题',()=>run('subscriptions',{topics:topics.split('\n').map(s=>s.trim()).filter(Boolean)})),button('发现新增论文',()=>run('discover_updates'))),h('p',null,'定期发现由 Harness 或外部调度器触发。'))),
          h('section',{className:'pi-card'},h('h2',null,`检索结果 · ${papers.length} 篇`),busy&&job?.action==='search'?h('p',null,'正在查询，以下保留上次结果…'):null,
            !papers.length?h('p',null,'输入主题，或在“创建研究”中直接指定论文。'):null,
            ...papers.map((p,i)=>h('article',{key:p.id||i,className:'pi-result'},h('h3',null,p.title),h('p',{className:'pi-small'},(p.authors||[]).slice(0,4).join('、')+' · '+(p.published||p.year||'日期未知')+' · '+(p.sources?.join('、')||p.source||'来源未知')+' · 引用 '+(p.citations??p.citationCount??'未知')),p.abstract?h('details',null,h('summary',null,'阅读摘要'),h('p',null,p.abstract)):h('p',null,'暂无摘要'),h('div',{className:'pi-actions'},h('button',{onClick:()=>selectPaper(p)},'研究这篇'),safeSource(p.url)?h('a',{href:safeSource(p.url),target:'_blank',rel:'noreferrer'},'查看来源'):null)))))),
        panel('create',h('div',{className:'pi-columns'},h('section',{className:'pi-card'},h('h2',null,'设置本次研究'),
          h('label',null,'研究模式',h('select',{value:mode,onChange:e=>{setMode(e.target.value);if(e.target.value){setOrigin(e.target.value);setModules([...modes[e.target.value]]);}}},h('option',{value:''},`自定义${origin?'（来自'+modeLabels[origin]+'）':''}`),...Object.entries(modeLabels).map(([v,l])=>h('option',{key:v,value:v},l)))),
          h('label',null,h('input',{type:'checkbox',checked:local,onChange:e=>{setReference(local?remoteRef:localRef);if(local)setLocalRef(reference);else setRemoteRef(reference);setLocal(e.target.checked);}}),'使用工作区内本地文件'),
          input(local?'PDF / 文本相对路径':'论文标题 / 链接 / DOI / arXiv 编号',reference,setReference),h('p',{className:'pi-small'},local?'文件应已在所选工作区内，此处不会上传文件。':'标题会先检索匹配；遇到多个候选时需选择论文。'),
          h('fieldset',null,h('legend',null,'研究内容'),...Object.entries({'理解论文':['paper','first-principles','beginner'],'研究与迁移':['landscape','transfer','sandbox'],'产品与行动':['features','products','experience','decision']}).map(([group,ids])=>h('div',{key:group},h('h3',null,group),...ids.map(id=>h('label',{key:id},h('input',{type:'checkbox',checked:modules.includes(id),onChange:e=>setCustom(e.target.checked?[...modules,id]:modules.filter(m=>m!==id))}),labels[id])))),h('div',{className:'pi-actions'},button('全选',()=>setCustom(Object.keys(labels))),button('清空',()=>setCustom([])))),
          input('最多模型调用次数',maxCalls,setMaxCalls,'number'),h('p',{className:'pi-small'},'继续或补充研究时包含此前调用次数。预算用尽后会保留已完成内容。'),h('details',null,h('summary',null,'Token 与费用说明'),h('p',null,'当前 Harness 路由未提供可验证的 Token 硬限制，因此只开放调用次数预算。实际 Token 用量按模型返回记录；费用未知。'))),
          h('aside',{className:'pi-card pi-preview'},h('h2',null,'开始前确认'),h('p',null,reference||'尚未指定论文'),h('p',null,`本次 ${modules.length} 项：${modules.map(id=>labels[id]).join('、')||'尚未选择'}`),h('p',null,`最多 ${maxCalls||'未设置'} 次模型调用`),h('p',null,'将使用所选会话的模型。文件权限及来源访问能力会在执行时检查；报告保存在该工作区配置的数据目录。'),h('p',{role:'status'},issue||'配置已就绪，可以开始。'),h('button',{className:'pi-primary',disabled:!!issue,onClick:()=>analyze(reference)},'开始研究')))),
        panel('history',h('section',{className:'pi-card'},h('h2',null,'研究历史'),h('p',null,'查看已完成报告，或接着完成未完成的研究。重新分析会保留旧版本。'),
          input('搜索论文、备注或报告正文',historyQuery,setHistoryQuery),h('label',null,'研究状态',h('select',{value:historyStatus,onChange:e=>setHistoryStatus(e.target.value)},h('option',{value:''},'全部状态'),...Object.entries(statusLabels).map(([v,l])=>h('option',{key:v,value:v},l)))),h('label',null,h('input',{type:'checkbox',checked:deleted,onChange:e=>setDeleted(e.target.checked)}),'查看已删除记录'),
          h('div',{className:'pi-actions'},button('新建研究',()=>repair()),button('查询历史',()=>{setOffset(0);setDetail(null);run('library',historyArgs(0));}),h('button',{disabled:busy||selected.length<2||selected.length>5,onClick:()=>run('compare_papers',{reports:selected})},`比较所选论文（${selected.length}/5）`)),h('p',{className:'pi-small'},`共 ${total} 条记录`),
          h(HistoryView,{runs,selected,setSelected,detail,setDetail,run:async(action,args)=>{if(action==='report')setView('report');return run(action,args);},busy,modules,onRepair:repair,onBudget:r=>{setResumeTarget(r);setView('create');}}),
          h('div',{className:'pi-actions'},offset>0?button('上一页',()=>{setOffset(offset-20);run('library',historyArgs(offset-20));}):null,offset+20<total?button('下一页',()=>{setOffset(offset+20);run('library',historyArgs(offset+20));}):null))),
        resumeTarget&&view==='create'?h('section',{className:'pi-card'},h('h2',null,'调整预算并继续'),h('p',null,resumeTarget.displayTitle||resumeTarget.paper?.title),h('p',null,'修改上方调用次数总预算后继续；已完成的内容会复用。'),button('按新预算继续',()=>{run('resume',{key:resumeTarget.key,runId:resumeTarget.runId});setResumeTarget(null);},true),button('取消恢复',()=>setResumeTarget(null))):null,
        panel('report',h('section',{className:'pi-card pi-report-card',ref:reportAnchor},h('h2',null,'研究报告'),report?h(React.Fragment,null,
          h(ResearchControls,{bundle,run,busy,part:'overview'}),
          h(ReportView,{text:report,onDownload:()=>{const url=URL.createObjectURL(new Blob([report],{type:'text/markdown;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='paper-research.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}),
          h(ResearchControls,{bundle,run,busy,part:'actions'})):h('p',null,'完成研究后点击“查看报告”，或从研究历史打开已有报告。'))));

    }
    return {
      inject: ["slots"],
      apply(ctx) {
        ctx.effect(() => {
          const style = document.createElement("style");
          style.textContent = css + readingStyle + workbenchStyle;
          document.head.appendChild(style);
          return () => style.remove();
        });
        ctx.slots.inject("main", () =>
          ctx.slots.register({ name: "main", key: "paper-insight" }, Workbench),
        );
        ctx.slots.inject("sidebar.panellist", () =>
          ctx.slots.register(
            {
              name: "sidebar.panellist",
              id: "paper-insight",
              order: 30,
              label: "论文研究",
            },
            ({ size }) =>
              h(
                "span",
                { style: { fontSize: size || 18 }, "aria-hidden": true },
                "▤",
              ),
          ),
        );
      },
    };
  },
});
