import { z } from "zod";
import { parseConfig, sourceNames, isoNow } from "./lib/config.js";
import { PaperInsight } from "./lib/service.js";
import { paperKey } from "./lib/papers.js";
import { MODULE_IDS, MODULE_TOOLS } from "./lib/modules.js";
import {
  compareReports,
  versionDiff,
  discoverUpdates,
  aggregateResearch,
} from "./lib/knowledge.js";
import { installWeb } from "./lib/web.js";

export const name = "paper-insight";
export const inject = ["tools", "llm", "sandboxPolicy"];
const text = z.string().trim().min(1).max(2000);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (s) =>
      !Number.isNaN(Date.parse(s)) &&
      new Date(s).toISOString().slice(0, 10) === s,
    "无效日期",
  );
const runFields = {
  key: z.string().regex(/^[a-f0-9]{20}$/),
  runId: z.string().regex(/^\d+-[a-f0-9]{8}$/),
};
const runArgs = z.object(runFields).strict();
const inputFields = {
  reference: text.optional(),
  file: text.optional(),
  key: runFields.key.optional(),
  runId: runFields.runId.optional(),
};
const hasInput = (v) => Boolean(v.reference || v.file || (v.key && v.runId));
const documentArgs = z
  .object({ reference: text.optional(), file: text.optional() })
  .strict()
  .refine((v) => v.reference || v.file, "提供 reference 或 file");
const analyzeArgs = z
  .object({
    ...inputFields,
    modules: z.array(z.enum(MODULE_IDS)).min(1).max(10).optional(),
    refreshResearch: z.boolean().optional(),
  })
  .strict()
  .refine(hasInput, "提供 reference/file 或 key+runId");
const searchArgs = z
  .object({
    query: z.string().trim().min(1).max(600),
    limit: z.number().int().min(1).max(50).default(10),
    sources: z.array(z.enum(sourceNames)).min(1).max(5).optional(),
    since: date.optional(),
    until: date.optional(),
    sort: z.enum(["relevance", "date", "citations"]).default("relevance"),
    author: text.optional(),
    institution: text.optional(),
    venue: text.optional(),
    minCitations: z.number().int().min(0).optional(),
  })
  .strict()
  .refine(
    (v) => !v.since || !v.until || v.since <= v.until,
    "since 不能晚于 until",
  );

/** Same definitions are used by natural-language tools, the workbench and programmatic hosts. */
export function createTools(service) {
  const definition = (suffix, description, schema, execute) => ({
    name: `paper_insight_${suffix}`,
    description,
    parameters: z.toJSONSchema(schema, { unrepresentable: "any" }),
    output: {
      schema: { type: "object", additionalProperties: true },
      render: (_args, value) => [{ type: "text", text: JSON.stringify(value) }],
    },
    timeoutMs: 1800000,
    execute: async (raw, exec) =>
      JSON.parse(JSON.stringify(await execute(schema.parse(raw), exec))),
  });
  return [
    definition(
      "search",
      "检索真实学术来源。支持日期、作者、机构、会议、引用量筛选；缺失元数据不会满足筛选，结果是有界候选。",
      searchArgs,
      (args, exec) => service.search(args, exec),
    ),
    definition(
      "read",
      "获取学术 URL/DOI/arXiv ID 或工作区内文件的正文与定位，不生成报告。",
      documentArgs,
      async (args, exec) => {
        const { segments, ...doc } = await service.read(args, exec);
        return doc;
      },
    ),
    definition(
      "fetch",
      "获取并持久化论文材料；返回 key/runId，之后可离线复用材料分析。",
      documentArgs,
      async (args, exec) => {
        const archive = service.archive(exec, true);
        const document = await service.read(args, exec);
        const key = paperKey(document.paper);
        const run = await archive.start(document.paper, key, exec.signal);
        await archive.write(run, "document.json", document, exec.signal);
        await archive.write(
          run,
          "checkpoint.json",
          {
            schemaVersion: 2,
            promptVersion: "0.2.0",
            key,
            input: args,
            document,
            evidence: [],
            sections: [],
            modules: MODULE_IDS,
            calls: [],
          },
          exec.signal,
        );
        await archive.finish(run, "fetched", { coverage: document.coverage });
        return {
          key,
          runId: run.runId,
          folder: run.folder,
          paper: document.paper,
          coverage: document.coverage,
        };
      },
    ),
    definition(
      "analyze",
      "按十个模块分析并本地归档。可指定 modules 子集；传 key/runId 复用已有材料重新分析，生成新版本。耗时数分钟、有模型费用。",
      analyzeArgs,
      (args, exec) => service.analyze(args, exec),
    ),
    definition(
      "resume",
      "从失败/取消检查点继续，只执行尚未完成的阶段；新建版本保留旧结果。",
      z
        .object({ ...runFields, refreshResearch: z.boolean().optional() })
        .strict(),
      (args, exec) => service.analyze({ ...args, resume: true }, exec),
    ),
    ...Object.entries(MODULE_TOOLS).map(([tool, module]) =>
      definition(
        tool,
        `仅执行 ${module} 分析模块；reference/file 导入或 key/runId 复用材料。生成独立版本。`,
        z
          .object(inputFields)
          .strict()
          .refine(hasInput, "需要论文输入或归档标识"),
        (args, exec) => service.analyze({ ...args, modules: [module] }, exec),
      ),
    ),
    definition(
      "batch",
      "给定论文标识逐篇分析；默认最多五篇，单篇失败继续。",
      z.object({ references: z.array(text).min(1).max(20) }).strict(),
      (args, exec) => service.batch(args, exec),
    ),
    definition(
      "library",
      "查询本地历史，可按 query 检索报告全文。",
      z
        .object({
          query: z.string().max(600).default(""),
          limit: z.number().int().min(1).max(200).default(30),
        })
        .strict(),
      (args, exec) =>
        service
          .archive(exec)
          .search(args.query, args.limit, service.config.historyLimit),
    ),
    definition("report", "读取已有 Markdown 报告。", runArgs, (args, exec) =>
      service.archive(exec).read(args.key, args.runId),
    ),
    definition(
      "export_report",
      "返回已归档 Markdown 或 JSON 报告，不重新调用模型。",
      z
        .object({
          ...runFields,
          format: z.enum(["markdown", "json"]).default("markdown"),
        })
        .strict(),
      async (args, exec) =>
        args.format === "json"
          ? { report: await service.archive(exec).load(args.key, args.runId) }
          : service.archive(exec).read(args.key, args.runId),
    ),
    definition(
      "compare_papers",
      "比较 2–5 份已完成研究，保留原报告引用并生成新的比较归档。",
      z.object({ reports: z.array(runArgs).min(2).max(5) }).strict(),
      (args, exec) => compareReports(service, args, exec),
    ),
    definition(
      "compare_versions",
      "比较同一归档 key 的两个报告版本，返回模块差异，不调用模型。",
      z
        .object({
          key: runFields.key,
          before: runFields.runId,
          after: runFields.runId,
        })
        .strict(),
      (args, exec) => versionDiff(service, args, exec),
    ),
    definition(
      "subscriptions",
      "读取或保存关注主题。仅保存配置；周期触发请通过 Harness 的 schedule 工具设置。",
      z
        .object({
          topics: z.array(z.string().trim().min(1).max(600)).max(50).optional(),
        })
        .strict(),
      async (args, exec) => {
        const archive = service.archive(exec, Boolean(args.topics));
        return args.topics
          ? archive.state("subscriptions", {
              topics: [...new Set(args.topics)],
              updatedAt: isoNow(),
            })
          : (await archive.state("subscriptions")) || {
              topics: service.config.topics,
            };
      },
    ),
    definition(
      "discover_updates",
      "执行一次关注主题增量检索，保存已见指纹与发现历史；不自动调用分析，可由 Harness 定时任务调用。",
      z
        .object({
          topics: z.array(z.string().min(1).max(600)).min(1).max(50).optional(),
          since: date.optional(),
          limit: z.number().int().min(1).max(50).default(10),
        })
        .strict(),
      (args, exec) => discoverUpdates(service, args, exec),
    ),
    definition(
      "aggregate",
      "聚合本地论文年份、研究关系图和产品机会，保留每条建议的来源，不冒充全网趋势。",
      z
        .object({ limit: z.number().int().min(1).max(100).default(30) })
        .strict(),
      (args, exec) => aggregateResearch(service, args, exec),
    ),
  ];
}
export function apply(ctx, options = {}) {
  const config = parseConfig(options);
  const service = new PaperInsight(ctx, config);
  const lifetime = new AbortController();
  ctx.effect(() => () => lifetime.abort(new Error("文献研究插件已卸载")));
  const tools = createTools(service);
  for (const tool of tools)
    ctx.tools.register({
      ...tool,
      execute: (args, exec) =>
        tool.execute(args, {
          ...exec,
          signal: AbortSignal.any([exec.signal, lifetime.signal]),
        }),
    });
  if (config.webEnabled) installWeb(ctx, service, tools, lifetime.signal);
}
