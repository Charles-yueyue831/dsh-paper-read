import { z } from 'zod';

export const VISUAL_MODULES = ['paper', 'sandbox', 'experience', 'decision'];
const id = z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,19}$/);
export const visualSchema = z.object({
  title: z.string().min(1).max(100),
  caption: z.string().min(10).max(600),
  kind: z.enum(['paper-fact', 'inference', 'proposal']),
  evidenceIds: z.array(z.string()).min(1).max(10),
  nodes: z.array(z.object({ id, label: z.string().min(1).max(80) }).strict()).min(2).max(8),
  edges: z.array(z.object({ from: id, to: id, label: z.string().max(60) }).strict()).min(1).max(12),
}).strict();

export function validateVisual(visual, known) {
  const parsed = visualSchema.parse(visual);
  const ids = new Set(parsed.nodes.map(n => n.id));
  if (ids.size !== parsed.nodes.length) throw new Error('图表节点编号重复');
  for (const edge of parsed.edges) if (!ids.has(edge.from) || !ids.has(edge.to)) throw new Error('图表连接指向不存在的节点');
  for (const ref of parsed.evidenceIds) if (!known.has(ref)) throw new Error(`图表引用不存在：${ref}`);
  if (parsed.kind === 'paper-fact' && !parsed.evidenceIds.some(ref => /^P\d+\.F\d+$/.test(ref))) throw new Error('论文机制图必须有原文证据');
  return parsed;
}

// Only text labels enter Mermaid. All syntax, node IDs and layout are generated here.
// Full-width syntax punctuation keeps labels readable without introducing directives or HTML.
export function diagramLabel(value) {
  const substitutions = {'"':'”', "'":'’', '<':'＜', '>':'＞', '&':'＆', '`':'｀', '#':'＃', '|':'｜', '%':'％', '{':'｛', '}':'｝', '[':'［', ']':'］', ':':'：', '(':'（', ')':'）', '\\':'＼'};
  return [...value.replace(/\s+/g, ' ')].map(c => substitutions[c] || c).join('');
}
export function visualMermaid(visual) {
  const indexes = new Map(visual.nodes.map((node, i) => [node.id, `n${i}`]));
  return ['flowchart TD',
    ...visual.nodes.map(n => `  ${indexes.get(n.id)}["${diagramLabel(n.label)}"]`),
    ...visual.edges.map(e => `  ${indexes.get(e.from)} -->${e.label ? `|"${diagramLabel(e.label)}"|` : ''} ${indexes.get(e.to)}`),
  ].join('\n');
}
