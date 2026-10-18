import { createReportView } from "./report-view.js";
/* Native Harness client module; React is supplied by the host to avoid duplicate runtimes. */
window.__ModuleLoader__.load({
  id: "dsh-paper-insight",
  factory: (require) => {
    const React = require("react");
    const h = React.createElement;
    const { MarkdownText } = require("@deepseek-ai/dsh-client-ui-primitives");
    const ReportView = createReportView(React, MarkdownText);
    const { useState, useEffect } = React;
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
      const [sessions, setSessions] = useState([]),
        [session, setSession] = useState(""),
        [query, setQuery] = useState(""),
        [reference, setReference] = useState(""),
        [local, setLocal] = useState(false),
        [modules, setModules] = useState(Object.keys(labels)),
        [papers, setPapers] = useState([]),
        [runs, setRuns] = useState([]),
        [selected, setSelected] = useState([]),
        [historyQuery, setHistoryQuery] = useState(""),
        [report, setReport] = useState(""),
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
        if (!job) return;
        let stopped = false;
        let timer;
        const poll = async () => {
          try {
            const value = await api("/jobs?id=" + encodeURIComponent(job.id));
            if (stopped) return;
            setStatus(
              value.status === "running"
                ? `正在处理：${value.progress?.stage || "starting"} ${value.progress?.completed || ""}${value.progress?.total ? "/" + value.progress.total : ""}`
                : value.status === "completed"
                  ? "已完成，结果已返回。"
                  : value.status,
            );
            if (value.status === "running") {
              timer = setTimeout(poll, 1200);
              return;
            }
            if (value.error) {
              setJob(null);
              setError(value.error.message);
              if (value.error.key)
                setRuns((old) => [
                  {
                    key: value.error.key,
                    runId: value.error.runId,
                    status: value.status,
                    paper: { title: "可从检查点续跑" },
                  },
                  ...old,
                ]);
              return;
            }
            const r = value.result;
            if (job.action === "search") setPapers(r.papers);
            else if (job.action === "library") setRuns(r.runs);
            else if (job.action === "subscriptions") {
              setTopics(r.topics.join("\n"));
              setStatus("关注主题已保存；由 Harness 定时任务触发增量发现。");
            } else if (job.action === "discover_updates") {
              setPapers(r.newPapers);
              setStatus(`发现 ${r.newPapers.length} 篇新增或更新论文。`);
            } else if (r.markdown) setReport(r.markdown);
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
                sessionId: job.sessionId,
              });
              setRuns((old) => [
                {
                  key: r.key,
                  runId: r.runId,
                  status: "completed",
                  paper: { title: r.title || "比较报告" },
                  type:
                    job.action === "compare_papers" ? "comparison" : undefined,
                },
                ...old,
              ]);
              return;
            } else setReport(JSON.stringify(r, null, 2));
            setJob(null);
            if (r.errors?.length)
              setError(
                "部分来源未返回结果：" +
                  r.errors.map((e) => e.source + " " + e.error).join("；"),
              );
          } catch (e) {
            if (!stopped) {
              setError(e.message);
              setJob(null);
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
        setError("");
        if (!session) {
          setError(
            "请先在 Harness 打开一个会话并配置模型和工作区，再点击刷新会话。",
          );
          return;
        }
        try {
          setStatus("提交中…");
          const value = await api("/run", {
            sessionId: session,
            tool: "paper_insight_" + action,
            args,
          });
          setJob({ id: value.id, action, sessionId: session });
        } catch (e) {
          setError(e.message);
        }
      };
      const button = (text, click, primary = false) =>
        h(
          "button",
          {
            type: "button",
            onClick: click,
            disabled: !!job,
            className: primary ? "pi-primary" : "",
          },
          text,
        );
      const input = (label, value, change, type = "text") =>
        h(
          "label",
          null,
          label,
          h("input", { type, value, onChange: (e) => change(e.target.value) }),
        );
      const analyze = (ref) =>
        run("analyze", {
          ...(local ? { file: ref } : { reference: ref }),
          modules,
        });
      return h(
        "section",
        { className: "pi-workbench", "aria-label": "论文研究工作台" },
        h("h1", null, "论文 → 产品"),
        h("p", null, "发现研究，理解机制，把技术转化为可验证的产品方案。"),
        h(
          "label",
          null,
          "研究会话",
          h(
            "select",
            {
              "aria-label": "研究会话",
              value: session,
              onChange: (e) => setSession(e.target.value),
            },
            h("option", { value: "" }, "请选择会话"),
            ...sessions.map((s) =>
              h(
                "option",
                { key: s.id, value: s.id },
                (s.workspace || s.title) + " · " + s.id.slice(-8),
              ),
            ),
          ),
        ),
        button("刷新会话", refresh),
        h(
          "div",
          { className: "pi-actions" },
          h("div", { className: "pi-note", role: "status" }, status),
          job
            ? h(
                "button",
                {
                  onClick: () =>
                    api("/cancel", { id: job.id }).catch((e) =>
                      setError(e.message),
                    ),
                },
                "取消任务",
              )
            : null,
        ),
        error ? h("p", { role: "alert", className: "pi-error" }, error) : null,
        h(
          "div",
          { className: "pi-grid" },
          h(
            "div",
            null,
            h(
              "section",
              { className: "pi-card" },
              h("h2", null, "发现论文"),
              input("主题关键词", query, setQuery),
              h(
                "details",
                null,
                h("summary", null, "筛选条件"),
                ...["author", "institution", "venue", "since", "until"].map(
                  (k) =>
                    input(
                      {
                        author: "作者",
                        institution: "机构",
                        venue: "会议 / 期刊",
                        since: "起始日期",
                        until: "结束日期",
                      }[k],
                      advanced[k],
                      (v) => setAdvanced({ ...advanced, [k]: v }),
                      ["since", "until"].includes(k) ? "date" : "text",
                    ),
                ),
                h(
                  "label",
                  null,
                  "排序",
                  h(
                    "select",
                    {
                      value: advanced.sort,
                      onChange: (e) =>
                        setAdvanced({ ...advanced, sort: e.target.value }),
                    },
                    ...Object.entries({
                      relevance: "相关性",
                      date: "发表时间",
                      citations: "引用量",
                    }).map(([k, v]) => h("option", { key: k, value: k }, v)),
                  ),
                ),
              ),
              h(
                "div",
                { className: "pi-actions" },
                button(
                  "检索论文",
                  () =>
                    run("search", {
                      query,
                      ...Object.fromEntries(
                        Object.entries(advanced).filter(([, v]) => v),
                      ),
                      limit: 10,
                    }),
                  true,
                ),
              ),
            ),
            h(
              "section",
              { className: "pi-card" },
              h("h2", null, "分析论文"),
              h(
                "label",
                null,
                h("input", {
                  type: "checkbox",
                  checked: local,
                  onChange: (e) => setLocal(e.target.checked),
                }),
                "使用工作区内本地文件",
              ),
              input(
                local ? "PDF / 文本相对路径" : "论文 URL / DOI / arXiv ID",
                reference,
                setReference,
              ),
              h(
                "p",
                { className: "pi-small" },
                "选择本次研究模块。完整分析可能耗时数分钟，并使用当前会话模型额度。",
              ),
              h(
                "div",
                { className: "pi-checks" },
                ...Object.entries(labels).map(([id, label]) =>
                  h(
                    "label",
                    { key: id },
                    h("input", {
                      type: "checkbox",
                      checked: modules.includes(id),
                      onChange: (e) =>
                        setModules(
                          e.target.checked
                            ? [...modules, id]
                            : modules.filter((m) => m !== id),
                        ),
                    }),
                    label,
                  ),
                ),
              ),
              h(
                "div",
                { className: "pi-actions" },
                button("开始分析", () => analyze(reference), true),
              ),
            ),
            h(
              "section",
              { className: "pi-card" },
              h("h2", null, "持续研究"),
              h(
                "label",
                null,
                "关注主题，每行一个",
                h("textarea", {
                  value: topics,
                  onChange: (e) => setTopics(e.target.value),
                }),
              ),
              h(
                "div",
                { className: "pi-actions" },
                button("读取关注主题", () => run("subscriptions")),
                button("保存关注主题", () =>
                  run("subscriptions", {
                    topics: topics
                      .split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  }),
                ),
                button("发现新增论文", () => run("discover_updates")),
                button("聚合产品机会", () => run("aggregate")),
              ),
              h(
                "p",
                { className: "pi-small" },
                "定期更新可让 Harness 的定时任务调用增量发现工具。此处不会自动创建定时任务。",
              ),
            ),
          ),
          h(
            "div",
            null,
            h(
              "section",
              { className: "pi-card" },
              h("h2", null, "检索结果"),
              papers.length
                ? papers.map((p, i) =>
                    h(
                      "article",
                      { key: p.id || i, className: "pi-result" },
                      h("strong", null, p.title),
                      h(
                        "div",
                        { className: "pi-small" },
                        (p.authors || []).slice(0, 3).join("、") +
                          " · " +
                          (p.published || p.year || "日期未知"),
                      ),
                      h("p", null, p.abstract?.slice(0, 250)),
                      h(
                        "div",
                        { className: "pi-actions" },
                        button("分析这篇", () => {
                          setLocal(false);
                          setReference(p.id);
                          run("analyze", { reference: p.id, modules });
                        }),
                        p.url?.startsWith("https://")
                          ? h(
                              "a",
                              {
                                href: p.url,
                                target: "_blank",
                                rel: "noreferrer",
                              },
                              "论文来源",
                            )
                          : null,
                      ),
                    ),
                  )
                : h("p", null, "输入主题检索，或直接指定论文开始分析。"),
            ),
            h(
              "section",
              { className: "pi-card" },
              h("h2", null, "研究历史"),
              input("全文搜索历史报告", historyQuery, setHistoryQuery),
              h(
                "div",
                { className: "pi-actions" },
                button("查询历史", () =>
                  run("library", { query: historyQuery }),
                ),
                button("比较所选论文", () =>
                  run("compare_papers", { reports: selected }),
                ),
              ),
              ...runs.map((r, i) =>
                h(
                  "article",
                  { key: r.runId + "-" + i, className: "pi-result" },
                  h(
                    "label",
                    null,
                    h("input", {
                      type: "checkbox",
                      disabled: r.status !== "completed" || Boolean(r.type),
                      checked: selected.some((s) => s.runId === r.runId),
                      onChange: (e) =>
                        setSelected(
                          e.target.checked
                            ? [...selected, { key: r.key, runId: r.runId }]
                            : selected.filter((s) => s.runId !== r.runId),
                        ),
                    }),
                    r.paper?.title || r.key,
                  ),
                  h(
                    "div",
                    { className: "pi-small" },
                    r.status + " · " + r.runId,
                  ),
                  h(
                    "div",
                    { className: "pi-actions" },
                    r.status === "completed" && r.type !== "discovery"
                      ? button("查看报告", () =>
                          run("report", { key: r.key, runId: r.runId }),
                        )
                      : !r.type
                        ? button("从检查点继续", () =>
                            run("resume", { key: r.key, runId: r.runId }),
                          )
                        : null,
                    !r.type
                      ? button("重做所选模块", () =>
                          run("analyze", {
                            key: r.key,
                            runId: r.runId,
                            modules,
                          }),
                        )
                      : null,
                  ),
                ),
              ),
              h(
                "section",
                { className: "pi-card" },
                h("h2", null, "研究报告"),
                report
                  ? h(ReportView, {
                      text: report,
                      onDownload: () => {
                        const url = URL.createObjectURL(
                          new Blob([report], {
                            type: "text/markdown;charset=utf-8",
                          }),
                        );
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "paper-research.md";
                        a.click();
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                      },
                    })
                  : h(
                      "p",
                      null,
                      "完成分析或选择历史报告后，内容将显示在这里。",
                    ),
              ),
            ),
          ),
        ),
      );
    }
    return {
      inject: ["slots"],
      apply(ctx) {
        ctx.effect(() => {
          const style = document.createElement("style");
          style.textContent = css;
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
