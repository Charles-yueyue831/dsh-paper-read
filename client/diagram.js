import mermaid from "mermaid";
import DOMPurify from "dompurify";
import { validateDiagram } from "./report-utils.js";

mermaid.initialize({
  startOnLoad: false,
  securityLevel: "strict",
  suppressErrorRendering: true,
  maxTextSize: 30000,
  maxEdges: 300,
  theme: "neutral",
  flowchart: { htmlLabels: false },
  htmlLabels: false,
});
let sequence = 0;
/** Render locally bundled Mermaid and sanitize its SVG before it enters the report. No callbacks are bound. */
export async function renderDiagram(source) {
  validateDiagram(source);
  const { svg } = await mermaid.render(`pi-diagram-${++sequence}`, source);
  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: [
      "foreignObject",
      "script",
      "a",
      "image",
      "use",
      "animate",
      "animateMotion",
      "animateTransform",
      "set",
    ],
    FORBID_ATTR: ["href", "xlink:href"],
    ALLOW_DATA_ATTR: false,
  });
}
