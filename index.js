import { z } from 'zod';
import { parseConfig, sourceNames } from './lib/config.js';
import { PaperInsight } from './lib/service.js';

export const name = 'paper-insight';
export const inject = ['tools', 'llm', 'sandboxPolicy'];
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s, '无效日期');
const documentArgs = z.object({ reference: z.string().trim().min(1).max(2000).optional(), file: z.string().trim().min(1).max(4000).optional() }).strict()
  .refine(v => v.reference || v.file, '必须提供 reference 或 file');
const searchArgs = z.object({ query: z.string().trim().min(1).max(600), limit: z.number().int().min(1).max(50).default(10),
  sources: z.array(z.enum(sourceNames)).min(1).max(4).optional(), since: date.optional(), until: date.optional(), sort: z.enum(['relevance', 'date']).default('relevance') }).strict()
  .refine(v => !v.since || !v.until || v.since <= v.until, 'since 不能晚于 until');
const str = description => ({ type: 'string', description });
const documentProperties = { reference: str('论文标识：arXiv ID/URL、OpenReview URL、DOI、s2:ID、openalex:ID'), file: str('当前工作区内的 PDF/TXT/MD/HTML 路径；可配合 reference 补充元数据') };

export function createTools(service) {
  const definition = (name, description, schema, properties, required, execute) => ({ name, description,
    parameters: { type: 'object', properties, required, additionalProperties: false },
    output: { schema: { type: 'object', additionalProperties: true }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
    timeoutMs: 1800000,
    async execute(raw, exec) { return execute(schema.parse(raw), exec); },
  });
  return [
    definition('paper_insight_search', '从 arXiv、OpenReview、Semantic Scholar、OpenAlex 检索 AI 论文；返回可用于 read/analyze 的 reference ID、来源与缺口。', searchArgs,
      { query: str('英文主题关键词通常覆盖更好，例如 language agents sandbox'), limit: { type: 'integer' }, sources: { type: 'array', items: { type: 'string', enum: sourceNames } }, since: str('含起始日 YYYY-MM-DD'), until: str('含结束日 YYYY-MM-DD'), sort: { type: 'string', enum: ['relevance', 'date'], description: '默认按标题相关性排序；近期跟踪可用 date，日期过滤仍是有界候选过滤。' } }, ['query'],
      (args, exec) => service.search(args, exec)),
    definition('paper_insight_read', '获取开放论文或工作区内本地文件的文本、分段定位与覆盖范围。不生成报告。', documentArgs, documentProperties, [],
      async (args, exec) => { const { segments, ...doc } = await service.read(args, exec); return doc; }),
    definition('paper_insight_analyze', '使用 Harness 当前会话模型分析一篇论文并自动保存本地。包含技术解析、第一性原理、Agent 沙箱、新功能、新产品、体验、研究脉络、迁移与零基础解释。每篇默认最多 42 次模型调用（含结构修复），可能耗时数分钟；返回报告路径。', documentArgs, documentProperties, [],
      (args, exec) => service.analyze(args, exec)),
    definition('paper_insight_batch', '按给定 reference 列表逐篇分析并归档，默认上限 5 篇。单篇失败继续；取消立即停止。请先搜索再选择论文。',
      z.object({ references: z.array(z.string().trim().min(1).max(2000)).min(1).max(20) }).strict(),
      { references: { type: 'array', items: { type: 'string' } } }, ['references'], (args, exec) => service.batch(args, exec)),
    definition('paper_insight_library', '查看当前工作区的论文分析历史及 completed/failed/cancelled 状态。', z.object({ limit: z.number().int().min(1).max(200).default(30) }).strict(),
      { limit: { type: 'integer' } }, [], async (args, exec) => ({ runs: await service.archive(exec).list(args.limit) })),
    definition('paper_insight_report', '按 library 返回的 key 和 runId 读取已保存的 Markdown 报告。', z.object({ key: z.string(), runId: z.string() }).strict(),
      { key: str('library 返回的 key'), runId: str('library 返回的 runId') }, ['key', 'runId'], (args, exec) => service.archive(exec).read(args.key, args.runId)),
  ];
}

export function apply(ctx, options = {}) {
  const config = parseConfig(options); const service = new PaperInsight(ctx, config);
  const lifetime = new AbortController();
  ctx.effect(() => () => lifetime.abort(new Error('文献研究插件已卸载')));
  for (const tool of createTools(service)) {
    const execute = tool.execute;
    ctx.tools.register({ ...tool, execute: (args, exec) => execute(args, { ...exec, signal: AbortSignal.any([exec.signal, lifetime.signal]) }) });
  }
}
