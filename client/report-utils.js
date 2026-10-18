/** Split complete top-level Mermaid fences, preserving every other byte for Markdown/source view. */
export function splitReport(text) {
  const parts = [];
  let markdown = "";
  let fence = null;
  let block = "";
  const flush = () => {
    if (markdown) parts.push({ type: "markdown", text: markdown });
    markdown = "";
  };
  for (const line of text.match(/[^\n]*\n|[^\n]+$/g) || []) {
    if (!fence) {
      const match = line.match(/^ {0,3}(`{3,}|~{3,})([^\n]*)\r?\n?$/);
      if (match && !(match[1][0] === "`" && match[2].includes("`"))) {
        fence = {
          char: match[1][0],
          length: match[1].length,
          mermaid: match[2].trim().toLowerCase() === "mermaid",
        };
        block = line;
      } else markdown += line;
    } else {
      block += line;
      const close = line.match(/^ {0,3}(`{3,}|~{3,})\s*$/);
      if (
        close &&
        close[1][0] === fence.char &&
        close[1].length >= fence.length
      ) {
        if (fence.mermaid) {
          flush();
          parts.push({
            type: "mermaid",
            text: block.slice(
              block.indexOf("\n") + 1,
              block.length - line.length,
            ),
            raw: block,
          });
        } else markdown += block;
        block = "";
        fence = null;
      }
    }
  }
  markdown += block;
  flush();
  return parts;
}
export function headingSlug(text) {
  return (
    text
      .normalize("NFKC")
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}_\s-]/gu, "")
      .replace(/\s+/g, "-") || "section"
  );
}
/** Harness intentionally rejects relative URLs. Resolve report fragment links, but never rewrite code. */
export function reportLinks(text, pageUrl, prefix) {
  let fence = null;
  return text
    .split("\n")
    .map((line) => {
      const match = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
      if (match) {
        if (!fence) fence = { char: match[1][0], length: match[1].length };
        else if (
          match[1][0] === fence.char &&
          match[1].length >= fence.length &&
          !match[2].trim()
        )
          fence = null;
        return line;
      }
      if (fence || /^(?: {4}|\t)/.test(line)) return line;
      return line
        .split(/(`+[^`]*`+)/g)
        .map((part, i) =>
          i % 2
            ? part
            : part.replace(/\]\(#([^\s)]+)\)/g, (_, fragment) => {
                let target;
                try {
                  target = decodeURIComponent(fragment);
                } catch {
                  return `](#${fragment})`;
                }
                const url = new URL(pageUrl);
                url.hash = prefix + "-" + target;
                return "](" + url.href + ")";
              }),
        )
        .join("");
    })
    .join("\n");
}
/** Static diagrams only: document configuration and interactive/external resources are not accepted. */
export function validateDiagram(source) {
  if (source.length > 30000) throw new Error("图表超过显示限制，请查看源码。");
  if (
    /^\s*---|%%\s*\{|^\s*click\s|<\/?[a-z]|(?:https?:|javascript:|data:|url\s*\(|\bimage\s*:)/im.test(
      source,
    )
  )
    throw new Error("图表包含配置、交互或外部资源；为安全起见仅展示源码。");
  return source;
}
