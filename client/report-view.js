import {
  splitReport,
  headingSlug,
  reportLinks,
  validateDiagram,
} from "./report-utils.js";
let diagramModule;
const loadDiagram = () =>
  (diagramModule ||= import(
    "/api/paper-insight/assets/diagram.js?v=0.2.1"
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
      [error, setError] = useState("");
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
              className: "pi-diagram-svg",
              dangerouslySetInnerHTML: { __html: svg },
            })
          : h("p", { role: "status" }, "正在绘制图表…"),
      h(
        "details",
        { open: error ? true : undefined },
        h("summary", null, "图表源码"),
        h("pre", null, h("code", null, source)),
      ),
    );
  }
  return function ReportView({ text, onDownload }) {
    const [view, setView] = useState("read"),
      [toc, setToc] = useState([]);
    const root = useRef(null);
    const prefix = "pi-report-" + useId().replace(/[^a-zA-Z0-9-]/g, "");
    const parts = useMemo(() => splitReport(text), [text]);
    useEffect(() => {
      setView("read");
    }, [text]);
    useEffect(() => {
      if (view !== "read" || !root.current) return;
      const seen = new Map();
      const items = [];
      for (const heading of root.current.querySelectorAll(
        "h1,h2,h3,h4,h5,h6",
      )) {
        const slug = headingSlug(heading.textContent);
        const count = seen.get(slug) || 0;
        seen.set(slug, count + 1);
        heading.id = prefix + "-" + slug + (count ? "-" + count : "");
        heading.tabIndex = -1;
        if (heading.tagName === "H2")
          items.push({ id: heading.id, label: heading.textContent });
      }
      setToc(items);
    }, [text, view, prefix]);
    const jump = (id) => {
      const target =
        root.current &&
        [...root.current.querySelectorAll("[id]")].find((e) => e.id === id);
      if (target) {
        target.scrollIntoView({ block: "start" });
        target.focus({ preventScroll: true });
        return true;
      }
      return false;
    };
    return h(
      "section",
      { className: "pi-report", "aria-label": "研究报告" },
      h(
        "div",
        { className: "pi-report-toolbar" },
        h(
          "div",
          { role: "group", "aria-label": "报告显示方式" },
          h(
            "button",
            {
              type: "button",
              "aria-pressed": view === "read",
              onClick: () => setView("read"),
            },
            "阅读",
          ),
          h(
            "button",
            {
              type: "button",
              "aria-pressed": view === "source",
              onClick: () => setView("source"),
            },
            "Markdown 源码",
          ),
        ),
        h("button", { type: "button", onClick: onDownload }, "下载 Markdown"),
      ),
      view === "read" && toc.length
        ? h(
            "details",
            { className: "pi-report-toc" },
            h("summary", null, "章节目录"),
            h(
              "nav",
              { "aria-label": "报告章节" },
              ...toc.map((item) =>
                h(
                  "button",
                  {
                    key: item.id,
                    type: "button",
                    onClick: () => jump(item.id),
                  },
                  item.label,
                ),
              ),
            ),
          )
        : null,
      view === "source"
        ? h(
            "pre",
            { className: "pi-report-source", "aria-label": "研究报告源码" },
            text,
          )
        : h(
            "article",
            {
              className: "pi-report-body",
              ref: root,
              "aria-label": "研究报告内容",
              onClickCapture: (event) => {
                const a = event.target.closest?.("a[href]");
                if (!a) return;
                const url = new URL(a.href, window.location.href);
                if (
                  url.origin === window.location.origin &&
                  url.pathname === window.location.pathname &&
                  url.hash.startsWith("#" + prefix + "-")
                ) {
                  event.preventDefault();
                  event.stopPropagation();
                  try {
                    jump(decodeURIComponent(url.hash.slice(1)));
                  } catch {
                    /* Invalid fragment remains inert. */
                  }
                }
              },
            },
            ...parts.map((part, i) =>
              part.type === "mermaid"
                ? h(Diagram, { key: i, source: part.text })
                : h(MarkdownText, {
                    key: i,
                    text: reportLinks(
                      part.text,
                      window.location.origin + window.location.pathname,
                      prefix,
                    ),
                    labels: markdownLabels,
                  }),
            ),
          ),
    );
  };
}
