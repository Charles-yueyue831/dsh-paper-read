# 工具接口 v0.2.2

实际输入契约由 `index.js` 的 Zod schema 定义，发布的机器可读副本见 [tools.json](tools.json)。下文省略统一前缀 `paper_insight_`。默认参数可以省略，运行时会补齐；所有对象拒绝未知参数，日期还校验日历有效性。

## 执行上下文

插件复用 `ctx.tools.register()`、`ctx.llm.prepareCall()`、`ctx.sandboxPolicy.resolve()` 和会话模型选择。调用必须附带当前 Agent 与 AbortSignal；保存位置来自该 Agent 的沙箱策略。只读会话可读历史和检索，但不能分析、保存或修改订阅。插件模型请求不传工具，论文内容不能自行执行命令。

```js
const result = await ctx.tools.execute({
  name: 'paper_insight_analyze',
  arguments: { reference: 'https://arxiv.org/abs/2210.03629', modules: ['paper','sandbox','decision'] },
  agent, signal, callId: 'research-001',
});
if (result.isError) { /* Harness 统一错误结果 */ }
else console.log(result.value.reportPath);
```

## 输入与输出

| 接口 | 输入 | 成功输出核心字段 |
|---|---|---|
| search | query；limit=10；sources；since/until；sort=relevance/date/citations；author/institution/venue/minCitations | query, searchedAt, papers[], errors[], filters, coverage |
| read | reference 或 file；可同时提供，用 reference 补本地文件元数据 | paper, format, coverage, sourceUrl, segments[], chunks[], totalChunks, selectedChunks, warnings[] |
| fetch | 同 read | key, runId, folder, paper, coverage；保存 document/metadata/source/checkpoint |
| analyze | reference/file 或 key+runId；modules；refreshResearch | status, key, canonicalKey, runId, parentRunId, folder, reportPath, modules, sections[], modelCalls, warnings, sourceErrors |
| resume | key, runId；refreshResearch | 同 analyze；只重试未完成阶段，产生新 runId |
| analyze_principles | reference/file 或 key+runId | 同 analyze，仅 first-principles |
| trace_research | 同上 | 同 analyze，仅 landscape |
| analyze_sandbox | 同上 | 同 analyze，仅 sandbox |
| generate_capabilities | 同上 | 同 analyze，仅 features |
| ideate_products | 同上 | 同 analyze，仅 products |
| optimize_experience | 同上 | 同 analyze，仅 experience |
| analyze_transfer | 同上 | 同 analyze，仅 transfer |
| explain_for_beginners | 同上 | 同 analyze，仅 beginner |
| generate_poc | 同上 | 同 analyze，仅 decision |
| batch | references[]，受 maxPapers 限制 | results[]；每篇成功归档或失败原因；顺序执行 |
| library | query=""；limit=30；offset=0；deleted=false；status 可选 | runs[], total, offset, limit, scanned, scanLimit, coverage；标题、备注与全文搜索 |
| history_detail | key, runId | displayTitle, paper, record, input, error, hasDocument, canResume, canReanalyze, interrupted, completedModules |
| history_update | key, runId；title/notes 至少一项；revision 可选 | record：更新后的详情；独立 record.json 保存修改历史 |
| history_delete | key, runId；revision 可选 | record：标记 deletedAt 后的详情；不删除原文和报告 |
| history_restore | key, runId；revision 可选 | record：清除 deletedAt 后的详情 |
| report | key, runId | path, markdown |
| export_report | key, runId；format=markdown/json | path+markdown 或 report 对象 |
| compare_papers | reports:[{key,runId}]，2–5份分析报告 | summary, comparisons[], reports[], calls, key, runId, reportPath |
| compare_versions | key, before, after | paper, changes:[{id,before,after}], note；不调用模型 |
| subscriptions | topics[] 可选，空数组清空；省略则读取 | topics；不创建调度任务 |
| discover_updates | topics[] 可选；since；limit=10 | checkedAt, newPapers[]（new/updated）, searches[], coverage, key, runId |
| aggregate | limit=30 | asOf, papers, publicationYears, opportunities[], graphs[], note；每篇每模块复用最近可用结果 |

模块枚举：`paper, first-principles, sandbox, features, products, experience, landscape, transfer, beginner, decision`。

论文元数据含 id、title、authors、abstract、published/year、doi、arxivId、url、pdfUrl、institutions、venue、citationCount、sources、retrievedAt。字段缺失明确使用 null/空数组，不猜测。索引返回的引用量可能因来源和检索时点不同而变化。

报告 JSON 包含 schemaVersion、promptVersion、createdAt、paper、model、coverage、evidence、research、sections、validation、calls、priorCalls、parentRunId、timeline、relationGraph。每个 section 有 id、summary、details、findings；每条 finding 有 statement、kind、evidenceIds、confidence、implication、validation。详情字段见 [report-template.json](report-template.json)。部分模块报告会将 `allSectionsPresent` 设为 false，但 `requestedModulesComplete` 为 true。

`kind` 区分 paper-fact、external-fact、inference、proposal、unknown。证据级别是模型标注，不是程序证明；程序校验存在性与原文短引，不自动证明每个结论被引用充分支持。

## 错误与恢复

ToolRuntime 把异常封装为 `isError:true`；可编程服务调用抛出 Error，Web 返回错误字符串与可用检查点。

| 情形 | 行为 |
|---|---|
| 输入非法/缺输入 | 在任何模型调用前拒绝，描述字段问题 |
| 所有来源离线 | `所有来源失败`；不会以模型知识返回假搜索结果 |
| 部分来源限流/失败 | 成功结果 + errors/sourceErrors；报告保存缺口 |
| 全文缺失 | 合法摘要可用时明确 abstract-only；否则报错 |
| 扫描 PDF 或文本不足 | 提示先 OCR；不伪称已读全文 |
| 模型超时/网络异常/结构修复失败 | WORKFLOW_FAILED，携带 key/runId；保留成功块及章节 |
| 输出截断 | 有界提高输出预算并重试一次；不接受不完整 JSON |
| 用户取消 | CANCELLED；已完成检查点保留，可 resume |
| 并发超限 | 明确忙碌提示，稍后重试 |
| 本地路径越界/符号链接/只读 | 拒绝写入，不改动工作区外内容 |
| 非允许域名/私有 IP/危险重定向 | 拒绝请求；显式配置合法公开来源后重试 |

模型调用记录阶段耗时、可获取的 token usage、finish/status。供应商未返回用量时记 null，不推测精确费用。原始 PDF 二进制默认不归档；提取材料带位置与来源链接。强制终止后运行可能仍标 running，显式 resume 会写新版本。

## Web 接口

Web 插件通过实际 `webServer.register({kind:"prefix",path,handler})` 注册 `/api/paper-insight`。仅本地地址，沿用 Harness 身份验证；额外检查 Host、Origin、Sec-Fetch-Site、JSON content-type、请求大小。

- GET `/sessions`：当前存活根 Agent 的会话 ID、工作区、标题。
- POST `/run`：`{sessionId,tool,args}`；tool 为已注册完整名称；返回 202 和任务 id。
- GET `/jobs?id=<id>`：任务状态、阶段进度、result 或 error。
- POST `/cancel`：`{id}`；仅取消任务，不删除归档。

前端通过原生 `sidebar.panellist` 与 `main` slot 注册。后台 job 是本进程内存状态；页面刷新后可用研究历史找回归档，服务器重启后从检查点继续。每个 job 仍受工作区写入策略和并发限制。

## 0.2.2 兼容性与历史管理

名称最多 300 字符，备注最多 5000 字符；`revision` 是乐观锁，界面会携带读取到的版本。并发编辑同一记录时，旧版本修改会被拒绝并提示刷新。所有写操作遵守会话写入权限，当前进程仍在运行的记录拒绝编辑或删除。归档目录和原报告不移动，删除是可恢复标记；默认 library、聚合和重建索引忽略已删除记录，原始报告文件仍在磁盘上。

`reference` 新增完整标题输入：检索真实学术来源并只自动选取唯一完全匹配标题。`PAPER_SELECTION_REQUIRED` 错误包含 `candidates`，Web 展示候选；没有来源时明确失败。`INVALID_REFERENCE` 拒绝空输入及旧错误提示，不新增运行记录。错误对象的 key/runId 使用结构化字段，用户不需要复制进输入框。Web 不再无条件宣称已经取得材料。

旧版无 checkpoint 但有 document.json 的记录可复用正文；若材料和输入都缺失，给出重新填写论文信息的说明。名称备注仅影响历史管理，不改动论文事实或既有报告。归档不要同时交由多个 Harness 进程写入；运行中保护和编辑串行化在单个宿主进程内生效。


## 0.2.3 图文报告

工具名称及参数不变。`report.json` 保持 `schemaVersion: 2`，`promptVersion: "0.2.3"`。
章节新增可选 `visual` 与 `visualOmission`，不能同时存在。`visual` 包含 `title`、`caption`、`kind`（paper-fact/inference/proposal）、`evidenceIds`、`nodes: [{id,label}]`、`edges: [{from,to,label}]`。2–8 个节点、1–12 条边；未知节点或引用会触发已有的一次结构修复。
新生成的 paper/sandbox/experience/decision 模块要求图示或至少 10 字的证据不足说明，其余模块保持原结构。图示不额外调用模型，引用编号校验不代表已验证语义蕴含。旧报告字段仍然兼容，读取不自动迁移磁盘文件。
