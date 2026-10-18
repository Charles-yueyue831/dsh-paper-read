# dsh-paper-insight · 论文 → 产品

DeepSeek Harness 的 Cordis 研究插件。将公开论文检索、证据提取、技术理解、Agent 沙箱迁移、产品创新和 PoC 串成可恢复的研究流程。包名保持 `dsh-paper-insight`，工作台显示“论文研究”。

## 安装与侧边栏

需要 Node.js ≥ 22.12 和 DeepSeek Harness `>=0.2.1-alpha.2 <0.3.0`。已验证的宿主及测试范围见 [验收记录](docs/acceptance-v0.2.0.md)。

```bash
dsh plugin --profile web add dsh-paper-insight@0.2.1
dsh web
```

已运行的 Harness 请在当前任务完成后重启，刷新浏览器。左侧点击 **论文研究**：

1. 先在 Harness 创建或打开一个会话，选择工作区与模型，并允许工作区写入。
2. 工作台选择该会话。检索主题，或输入 URL / DOI / arXiv ID / 本地文件路径。
3. 勾选研究模块并开始分析，查看阶段进度；可取消，之后从历史检查点继续。
4. 在研究历史查看、搜索、重做模块或选择报告比较。分析结束后自动展示完整报告；历史报告默认进入阅读视图。报告和引用图保存在会话工作区。

Web 工作台目前支持本机 `localhost/127.0.0.1/::1` 的 Web Harness，不提供远程公开 HTTP 服务或 Electron IPC 适配。未打开任何会话时会提示先打开会话。工具本身可在 headless 使用：

```bash
dsh plugin --profile headless add dsh-paper-insight@0.2.1
dsh headless "检索 ReAct 论文，执行十模块分析并保存本地；然后只重做沙箱模块，比较两个版本。"
```

Web、headless 是不同 profile，分别安装并配置模型。模型凭据由 Harness 管理，不需给插件另配模型 API Key。

## 报告阅读（0.2.1）

- 阅读视图渲染标题、列表、表格、引用、代码高亮和数学公式，复用 Harness 的 Markdown 组件。
- 章节目录可跳转到二级标题；报告中的证据链接可跳转到原文定位。
- Mermaid 流程图、关系图和时序图在本地绘制，首次遇到图表时才加载随包提供的渲染器，无需外部 CDN。
- “Markdown 源码”保留原始文本，“下载 Markdown”导出同一份原文。阅读已有报告不调用模型。
- 图表语法错误、超出限制或含交互/配置/外部资源时显示原因及源码，其他正文照常显示。原始 HTML 不作为脚本执行。

本次浏览器与打包验收见 [0.2.1 验收记录](docs/acceptance-v0.2.1.md)。

## 核心能力

| 能力 | 实现与边界 |
|---|---|
| 论文发现 | arXiv、OpenReview、Semantic Scholar、OpenAlex、Crossref 官方接口；合并 DOI/arXiv/标题重复项 |
| 高级筛选 | 作者、机构、会议/期刊、日期、最低引用量；相关性、时间或引用量排序。按有限候选元数据过滤，字段缺失可能漏检 |
| 导入与解析 | arXiv、DOI、OpenReview、学术索引标识、允许域名的开放 HTML/PDF、工作区 PDF/TXT/MD/HTML；扫描 PDF 需先 OCR |
| 论文理解 | 背景、问题、机制、输入输出、创新、实验、条件、限制、价值；零基础、产品经理、工程三层解释及公式变量说明 |
| 第一性原理 | 根本目标→客观约束→主要矛盾→次要矛盾→既有解法→新解法→代价与边界→新矛盾，含替代方案 |
| Agent 沙箱 | 直接适用/改造后适用/间接启发/暂不适用，讨论接口、权限、资源、指标、风险、验证周期 |
| 产品创新 | 区分技术能力、产品能力与可操作功能；新产品概念、MVP、商业假设、成本、风险与优先级 |
| 体验、迁移、教学 | 前后旅程和指标；跨域条件及负迁移；直觉→概念→机制→案例→产品→局限 |
| 研究脉络 | 参考文献、后续引用、相关研究、检索日期；生成 `timeline.json` 与 `relations.mmd`，引用图不冒充技术继承图 |
| PoC | 假设、步骤、资源、对照、成功标准与停止条件；不适用的技术明确说明 |
| 知识积累 | 研究历史全文搜索、版本差异、多报告比较、关注主题增量发现、本地产品机会与关系图聚合 |

ACL Anthology、PMLR（ICML 等）、NeurIPS、CVF 的开放全文可直接导入；ICLR 可从 OpenReview 获取。IEEE/ACM 的收录元数据可经 DOI/学术索引检索，公开页面在允许列表内；无法取得合法全文时说明限制，不绕过付费墙或访问验证。没有可用外部来源时返回错误或明确来源缺口，模型记忆不会替代实时检索。

## 工具与可编程调用

全部工具以 `paper_insight_` 开头。保留 0.1.x 的六个名称；新增 17 个工具。详细输入 JSON Schema 见 [tools.json](docs/tools.json)，输出、错误和调用示例见 [API 文档](docs/api.md)。

| 工具后缀 | 用途 |
|---|---|
| `search` / `read` / `fetch` | 搜索、读取、持久化原始提取材料 |
| `analyze` / `batch` / `resume` | 完整或指定模块分析、批量分析、从检查点续跑 |
| `analyze_principles` / `trace_research` / `analyze_sandbox` | 单独研究原理、脉络、沙箱 |
| `generate_capabilities` / `ideate_products` / `optimize_experience` | 单独生成产品能力、新产品、体验方案 |
| `analyze_transfer` / `explain_for_beginners` / `generate_poc` | 单独迁移、教学、PoC |
| `library` / `report` / `export_report` | 历史全文检索、报告读取、Markdown/JSON 导出 |
| `compare_papers` / `compare_versions` | 多论文比较、同一归档的版本差异 |
| `subscriptions` / `discover_updates` / `aggregate` | 关注主题、增量发现、本地知识聚合 |

```text
使用 paper_insight_search 搜索 agent memory，按时间排序，限制 2026-01-01 之后。
分析 https://arxiv.org/abs/2210.03629，仅执行 paper、sandbox、features、decision 模块。
复用历史研究 key 和 runId，调用 paper_insight_analyze_sandbox；不要重新下载论文。
使用 paper_insight_resume 继续刚才失败的检查点。
使用 paper_insight_library 搜索“快照”，返回 10 条报告。
保存关注主题“agent sandbox”和“agentic reinforcement learning”，执行一次增量发现。
```

在 Harness 插件代码中可以调用 `ctx.tools.execute({name, arguments, signal, callId, agent})`，遵循宿主真实 ToolRuntime 契约。另导出 `dsh-paper-insight/api` 的 `PaperInsight` 服务及 `createTools(service)`（包主入口），便于集成；仍须提供已配置的 Harness 服务和会话执行上下文。

## 数据与恢复

```text
<会话工作区>/.paper-insight/
  index.json                 最近运行的可重建索引
  subscriptions.json         关注主题
  discovery.json             已见论文/版本指纹
  <归档key>/<runId>/
    manifest.json            状态、模型、用量、父版本、时间
    checkpoint.json          可恢复的文档/证据/章节检查点
    events.json              阶段状态、时间、错误
    metadata.json
    document.json            解析文本、分块、定位、覆盖率
    source.txt               带原文位置的提取文本
    evidence.json            原文精确短引及哈希
    references.json
    report.md / report.json
    product-ideas.md / poc.md
    references.bib
    timeline.json / relations.mmd
```

论文 `canonicalKey` 根据 DOI、无版本 arXiv ID 或规范化来源生成；运行标识独立。输入尚未解析时先建立请求归档，以便网络失败也能恢复。获取完成后记录 canonicalKey；不同输入写法的运行通过该标识关联。每次续跑或重做都创建新 runId，并记录 parentRunId，绝不覆盖旧报告。

`resume` 复用成功证据块和章节；`analyze` 加 `key/runId` 复用文档和证据，重新生成选定模块。`refreshResearch:true` 更新相关文献并重新生成章节。新版本提示词不会复用旧提示词生成的章节。历史 0.1.x 报告仍可读取，但没有 checkpoint 的旧报告不能直接续跑。

默认只存提取文本及链接，不自动保存远程 PDF 二进制；原始本地文件不被修改。归档里引用的页码/段落用于回查原文。失败/取消也保留检查点，强制中断可能留下 running 状态，可显式续跑。

## 配置

在 profile 的 `cordis.patch.yml` 中覆盖 `paper-insight` 行；配置替换整个 config，省略字段使用默认值。

```yaml
- id: paper-insight
  config:
    outputDir: research/papers
    sources: [arxiv, openreview, semantic-scholar, openalex, crossref]
    topics: [agent sandbox, agentic reinforcement learning]
    lookbackDays: 30
    concurrency: 1
    maxChunks: 16
    maxRelated: 12
    maxPapers: 5
    language: zh-CN
    modelTimeoutMs: 180000
    httpTimeoutMs: 30000
    webEnabled: true
```

`outputDir` 必须是当前会话工作区内的相对路径。`provider` 与 `model` 如需覆盖必须一起设置，使用 Harness 已注册路由。默认使用会话待选模型、最近模型请求或 Harness 默认模型。

完整配置见 [config.json](docs/config.json)。其他限额包括 `chunkChars`（默认12000）、`maxOutputTokens`（7000）、`maxExtractionTokens`（6000）、`maxDownloadBytes`（20MB）、`maxPages`（100）、`historyLimit`（2000）。可用 `extraHosts` 增加明确的公开学术域名，不接受通配符、IP 或本地域名。

可选检索凭据从环境读取 `SEMANTIC_SCHOLAR_API_KEY`、`OPENALEX_API_KEY`。不要把凭据写进论文、报告或提交到仓库。

### 定期增量发现

插件没有常驻轮询定时器。先保存关注主题，再让 Harness 现有调度工具定期执行：

```text
调用 paper_insight_discover_updates，展示新增/更新论文及来源缺口；不要自动分析所有候选。
```

定时任务应由用户通过 Harness 调度功能创建，或由外部调度器启动已配置模型/工作区的 headless profile。增量发现会记录版本指纹，但不是穷尽所有来源的系统综述。

## 安全、质量和费用

- 论文、网页和历史报告均作为不可信资料；分析调用不授予工具，不执行文中代码。
- 事实、文献事实、推断、创新假设、证据不足分别标注；模型选择原文编号，程序生成精确短引。
- 结构化字段缺失或引用不存在会触发一次修复；截断可提升单次输出额度，最高16000 token。无法修复时保存检查点并报错。
- 默认最多16次逐块提取+5次分组生成，各自最多一次修复；完整研究最多42次模型调用。单模块重做通常只需1次生成；实际取决于失败与重试。
- 部分文本、摘要分析、图表/公式抽取限制及文献来源失败会写进报告。结构与引用校验不等于证明语义正确或产品已可行。
- 不自动把理论可能性写成收益，不把引用关系写成技术继承，不强行把论文与 Agent 沙箱关联。
- 路径拒绝越界与符号链接；工作区只读时拒绝写报告。该检查不是操作系统沙箱，不支持远程 SSH 文件世界。
- Web API 复用 Harness 认证入口，并额外限制本机 Host、同源请求及 JSON 请求体。归档、HTTP 和模型调用都有边界；多个宿主进程不应同时更新同一个主题订阅状态文件。

## 开发、测试与扩展

```bash
npm ci --ignore-scripts
npm run build:client
npm test
DSH_TEST_ROOT=/path/to/official-runtime npm run test:host
npm run test:live
npm pack --ignore-scripts
```

`test:host` 使用真实 Cordis/ToolRuntime/LlmRuntime，但响应为合成测试数据；真实模型与侧边栏验收另见 [验收记录](docs/acceptance-v0.2.0.md)。

模块职责：`papers.js` 数据源与归一化；`http.js` 网络限制与退避；`content.js` HTML/PDF 提取；`model.js` 宿主模型适配；`analysis.js` 证据与报告校验；`modules.js` 模板字段；`workflow.js` 检查点与阶段；`storage.js` 原子归档和历史；`knowledge.js` 比较/订阅/聚合；`web.js` 工作台宿主接口；`client/main.js` 原生侧边栏 UI；`client/report-view.js` 报告阅读；`client/report-utils.js` 分块、引用跳转和图表约束；`client/diagram.js` 本地 Mermaid/SVG 清洗。`client.js` 与 `dist/diagram.js` 是构建产物，修改源码后运行 `npm run build:client` 并一同提交。

新增来源时扩展 `sourceNames`、`PaperSources.oneSearch/resolve` 与允许域名，补充真实 API 样本和离线失败测试。新增模块时扩展 `MODULE_FIELDS`、章节目录和分析提示词，补充 Schema 与验收案例。增加客户端功能时使用 Harness 槽位，不替换侧边栏 DOM。

## 故障排查

- `dsh: command not found`：先安装兼容的 Harness 或将已有 CLI 入口加入 PATH。
- 找不到论文工具：确认安装的是当前使用的 profile，并检查 `dsh --profile web --dump-config` 的 paper-insight 行。
- 侧边栏没有入口：重启已运行宿主并刷新页面；查看客户端插件加载错误。
- 没有可选会话：先在 Harness 打开工作区和一个会话，再点刷新会话。
- 来源429/403：降低频率、使用可选API凭据或换公开来源；不要绕过访问限制。
- 模型错误/取消：使用返回的 key/runId 调用 resume，或从历史点击继续。
- 扫描 PDF/解析失败：先 OCR；明确证据不足，不根据标题补造结论。
- 旧报告无检查点：仍可读取；需要重新导入才能使用阶段恢复。

卸载：`dsh plugin --profile web remove dsh-paper-insight`。卸载不删除已保存研究。
