import {
  splitReport,
  headingSlug,
  reportLinks,
  validateDiagram,
} from "./report-utils.js";
import { readingModel } from "./reading-model.js";
let diagramModule;
const loadDiagram = () =>
  (diagramModule ||= import(
    "/api/paper-insight/assets/diagram.js?v=0.2.3"
  ).catch((error) => {
    diagramModule = null;
    throw error;
  }));
const markdownLabels = {
  code: {
    copyLabel: "复制代码",
    copiedLabel: "已复制",
    toolbarLabels: {
      codeLabel: "代码",
      wrapLabel: "自动换行",
      unwrapLabel: "取消换行",
    },
  },
  footnotes: "脚注",
};

/** React and the Markdown renderer are supplied by the running Harness. */
export function createReportView(React, MarkdownText) {
  const h = React.createElement;
  const { useState, useEffect, useRef, useMemo, useId } = React;
  function Diagram({ source }) {
    const [svg, setSvg] = useState(""),
      [error, setError] = useState(""), [zoom, setZoom] = useState(false);
    useEffect(() => {
      let active = true;
      setSvg("");
      setError("");
      (async () => {
        try {
          validateDiagram(source);
          const { renderDiagram } = await loadDiagram();
          const output = await renderDiagram(source);
          if (active) setSvg(output);
        } catch (e) {
          if (active) setError(e.message || "图表渲染失败");
        }
      })();
      return () => {
        active = false;
      };
    }, [source]);
    return h(
      "figure",
      { className: "pi-diagram", "aria-label": "研究关系图" },
      error
        ? h("p", { className: "pi-error", role: "status" }, error)
        : svg
          ? h("div", {
              className: "pi-diagram-svg" + (zoom ? " pi-diagram-zoom" : ""),
              dangerouslySetInnerHTML: { __html: svg },
            })
          : h("p", { role: "status" }, "正在绘制图表…"),
      svg ? h('button', {type:'button', 'aria-pressed':zoom, onClick:()=>setZoom(!zoom)}, zoom ? '适应页面' : '放大图表') : null,
      h(
        "details",
        { open: error ? true : undefined },
        h("summary", null, "图表源码"),
        h("pre", null, h("code", null, source)),
      ),
    );
  }
  return function ReportView({ text, onDownload }) {
    const [view, setView] = useState("read");
    const root = useRef(null);
    const prefix = "pi-report-" + useId().replace(/[^a-zA-Z0-9-]/g, "");
    const model = useMemo(() => readingModel(text), [text]);
    useEffect(() => { setView("read"); }, [text]);
    useEffect(() => {
      if (view !== 'read' || !root.current) return;
      const occupied = new Set([...root.current.querySelectorAll('[id]')].map(e=>e.id));
      for (const heading of root.current.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
        if (heading.id) continue;
        const base = prefix+'-'+headingSlug(heading.textContent); let id=base, n=1;
        while (occupied.has(id)) id=base+'-'+n++;
        heading.id=id; heading.tabIndex=-1; occupied.add(id);
      }
    },[text,view,prefix]);
    const jump = (id) => {
      const target = root.current && [...root.current.querySelectorAll("[id]")].find(e => e.id === id);
      if (!target) return false;
      for (let parent = target.parentElement; parent && parent !== root.current; parent = parent.parentElement) {
        if (parent.tagName === "DETAILS") parent.open = true;
      }
      if (target.tagName === "DETAILS") target.open = true;
      target.scrollIntoView({block:"start"});
      target.focus({preventScroll:true});
      return true;
    };
    const markdown = (text, key) => h(React.Fragment, {key}, ...splitReport(text).map((part, i) => part.type === "mermaid"
      ? h(Diagram, {key:i,source:part.text})
      : h(MarkdownText, {key:i,text:reportLinks(part.text,window.location.origin + window.location.pathname,prefix),labels:markdownLabels})));
    const expand = open => { for (const item of root.current?.querySelectorAll('.pi-deep-dive,.pi-appendix') || []) item.open = open; };
    const chapterBody = chapter => h(React.Fragment, null,
      markdown(chapter.lead, 'lead'),
      chapter.details.length ? h('details', {className:'pi-deep-dive'},
        h('summary',null,`深入解读与依据 · ${chapter.details.length} 项`),
        ...chapter.details.map(detail => h('section',{key:detail.anchor,className:'pi-detail-block'},
          h('h3',{id:prefix+'-'+detail.anchor,tabIndex:-1},detail.label), markdown(detail.text, detail.anchor)))) : null);
    return h('section',{className:'pi-report','aria-label':'研究报告'},
      h('div',{className:'pi-report-toolbar'},
        h('div',{role:'group','aria-label':'报告显示方式'},
          ...[['read','阅读'],['source','Markdown 源码']].map(([id,label]) => h('button',{key:id,type:'button','aria-pressed':view===id,onClick:()=>setView(id)},label))),
        h('div',{className:'pi-actions'},
          view==='read' ? h('button',{type:'button',onClick:()=>expand(true)},'展开全部细节') : null,
          view==='read' ? h('button',{type:'button',onClick:()=>expand(false)},'只看重点') : null,
          h('button',{type:'button',onClick:onDownload},'下载 Markdown'))),
      view==='source' ? h('pre',{className:'pi-report-source','aria-label':'研究报告源码'},text)
      : h('div',{className:'pi-reading-layout'},
        model.chapters.length ? h('nav',{className:'pi-reading-nav','aria-label':'报告章节'},
          h('p',{className:'pi-eyebrow'},'阅读路线'),
          ...model.groups.map(group => h('div',{key:group.label,className:'pi-nav-group'},h('strong',null,group.label),
            ...group.chapters.map(ch => h('button',{type:'button',key:ch.anchor,onClick:()=>jump(prefix+'-'+ch.anchor)},ch.label))))) : null,
        h('article',{className:'pi-report-body',ref:root,'aria-label':'研究报告内容',key:text,
          onClickCapture:event=>{
            const a=event.target.closest?.('a[href]'); if(!a)return;
            const url=new URL(a.href,window.location.href);
            if(url.origin===window.location.origin && url.pathname===window.location.pathname && url.hash.startsWith('#'+prefix+'-')){
              event.preventDefault();event.stopPropagation();
              try {jump(decodeURIComponent(url.hash.slice(1)));} catch { /* malformed hash stays inert */ }
            }
          }},
          markdown(model.intro,'intro'),
          ...model.groups.flatMap(group => group.chapters.map(ch => ch.group==='证据与资料'
            ? h('details',{key:ch.anchor,className:'pi-appendix',id:prefix+'-'+ch.anchor,tabIndex:-1},h('summary',null,ch.label),chapterBody(ch))
            : h('section',{key:ch.anchor,className:'pi-chapter'+(ch.group==='先看重点'?' pi-overview':'')},
              h('p',{className:'pi-eyebrow'},ch.group),
              h('h2',{id:prefix+'-'+ch.anchor,tabIndex:-1},ch.label),chapterBody(ch)))))));
  };
}
