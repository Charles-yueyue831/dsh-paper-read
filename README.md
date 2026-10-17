# dsh-paper-read（dsh-paper-insight）

在 DeepSeek Harness 中检索 AI 论文，使用当前会话的大模型提取证据、分析技术与产品机会，并将报告保存在本地。

按 `dsh-git-vcs@0.2.0` 的 Cordis 插件与组合包方式组织：ESM 入口、`apply`、`inject`、`dsh.bundle`、`cordis.patch.yml`。本插件通过对话中的工具使用，宿主不需要额外的 MCP 服务或另一份模型密钥。

## 安装

要求 Node.js ≥ 22.12.0。兼容基线为 DeepSeek Harness **0.2.1-alpha.2** 和 **0.2.1-rc.2**；真实模型验收与宿主服务测试的区别见 [验证记录](docs/compatibility.md)。仓库名为 `dsh-paper-read`，安装包名和工具前缀分别为 `dsh-paper-insight`、`paper_insight_`。

如果尚未安装兼容的 Harness：

```sh
npm install -g @deepseek-ai/dsh@0.2.1-rc.2
```

从交付的安装包安装（将路径改成你下载的位置）：

```sh
dsh plugin --profile web add /absolute/path/dsh-paper-insight-0.1.0.tgz
dsh --profile web --dump-config
dsh web
```

若启用了 HMR，新安装的插件可自动加载；替换已安装的插件代码后请重启 Harness。`--dump-config` 中应包含 `paper-insight` 插件行。插件没有发布到公共 npm，不能直接用裸包名从 npm 下载。

从源码目录安装：

```sh
cd /absolute/path/dsh-paper-read
npm ci --ignore-scripts
npm test
dsh plugin --profile web add .
dsh web
```

也可以安装到官方命令行模式，再直接传入自然语言需求：

```sh
dsh plugin --profile headless add /absolute/path/dsh-paper-insight-0.1.0.tgz
dsh headless "检索 ReAct 论文，按十项要求完整分析并保存到本地。"
```

Web 与 headless 是不同 profile，须分别安装，并在对应 profile 配好模型路由。

这是无编译步骤的 JavaScript 插件，普通运行依赖由包管理器安装。不要只执行全局 `npm install dsh-paper-insight`，那样不会注册到 DSH profile。

## 在 Harness 中使用

先为会话选择模型并允许工作区写入，然后直接提出需求：

```text
使用 paper_insight_search 搜索 agent memory 方向论文，筛选过去一个月的结果，先给我 5 篇候选。
```

```text
使用 paper_insight_analyze 分析 https://arxiv.org/abs/1706.03762。
重点检查它与 Agent 沙箱、产品能力、新产品和产品体验的关系，并把报告保存到本地。
```

```text
分析当前工作区 papers/example.pdf，使用完整的十章报告。
如果没有获取全文或研究文献不全，请明确标记证据缺口。
```

```text
使用 paper_insight_batch 分析刚才选出的三篇论文。
完成后使用 paper_insight_library 列出报告路径。
```

搜索工具接收英文主题词通常更容易覆盖英文论文；它不会把每一条检索候选都当成已确认与主题相关的论文。先检查标题与摘要，再选择分析对象。

## 需求与输出

| 需求 | 提供的能力 |
|---|---|
| 1. 爬取主流学术来源的 AI 论文 | arXiv、OpenReview、Semantic Scholar、OpenAlex 官方 API；多源去重、日期过滤、来源失败说明 |
| 2. 在 Harness 中分析并保存 | 复用会话模型；HTML/PDF/本地文件阅读；Markdown、JSON、证据文本、BibTeX 本地归档 |
| 3. 论文与 Agent 沙箱的关系 | 分开分析用沙箱复现研究、用论文技术改进沙箱；提供接口、资源、权限、观测、评测与最小集成实验 |
| 4. 实现新的产品功能 | 用户任务、机制到能力的映射、工作流、MVP、依赖和验收指标 |
| 5. 创造新产品 | 目标用户、需求缺口、差异化、交付方式、成本假设、可否证实验 |
| 6. 改善产品体验 | 体验前后对比、延迟与准确性、可解释性、失败恢复、A/B 测试与护栏指标 |
| 7. 第一性原理与矛盾 | 目标、约束、核心瓶颈、主要和次要矛盾、作用机制、权衡与适用边界 |
| 8. 研究现状、文献和研究脉络 | 参考文献、后续引用、相关研究、检索日期和覆盖限制；区分引用关系与推断的技术继承 |
| 9. 技术迁移 | 不变量、源域与目标域差异、数据和接口、适配路径、负迁移和最小验证 |
| 10. 零基础介绍与产品案例 | 日常类比及失效边界、术语、输入输出例子、练习；真实案例与新产品设想分开标记 |

分析报告共十章：技术解析、第一性原理、Agent 沙箱、新功能、新产品、体验、研究脉络、迁移、零基础解释、验证与行动建议。检索和归档是工具能力，不作为空泛的报告章节。

报告中的结论标记为「论文事实」「文献事实」「推断」「待验证方案」「证据不足」。事实条目必须引用已存在的证据 ID，原文短引会逐字核验。校验能发现不存在的引用和错误摘录，但不替代对语义、实验或产品可行性的人工复核。

## 六个工具

| 工具 | 主要参数 | 结果 |
|---|---|---|
| `paper_insight_search` | `query`，可选 `limit/sources/since/until` | 论文元数据、reference ID、来源错误、检索范围 |
| `paper_insight_read` | `reference` 或 `file`，也可一起提供 | 正文片段、位置、阅读覆盖范围，不写报告 |
| `paper_insight_analyze` | `reference` 或 `file` | 完整分析与归档路径 |
| `paper_insight_batch` | `references` 数组 | 逐篇结果；单篇失败不阻断下一篇 |
| `paper_insight_library` | 可选 `limit` | 当前工作区所有运行的状态与路径 |
| `paper_insight_report` | `key`、`runId` | 已保存报告的 Markdown |

`reference` 支持 arXiv ID/链接、OpenReview 论文链接、DOI/DOI 链接、`s2:paperId`、`openalex:W...`。论文标题应先搜索，不会被当成未经核实的论文地址。

本地支持 `.pdf/.txt/.md/.html/.htm`。本地文件必须在会话工作区内；可同时提供 reference 补充准确元数据与引用检索，但需要用户确认文件与标识对应。扫描 PDF 需先 OCR。

## 本地归档

默认在**当前会话工作区**保存：

```text
.paper-insight/
  <论文标识哈希>/
    <时间戳-运行ID>/
      manifest.json       运行状态、模型、用量和时间
      document.json       元数据、全文抽取、片段及覆盖信息
      source.txt          已抽取的原始文本，带页面/段落位置
      evidence.json       逐段证据、短引和原文哈希
      references.json     参考文献、后续引用、相关研究及来源缺口
      report.md           可直接阅读的报告
      report.json         结构化分析结果
      references.bib      可导入文献管理器的 BibTeX
```

每次分析创建独立目录，不覆盖以前的报告。失败或取消会保留已经完成的提取结果，并将运行标记为 `failed` 或 `cancelled`；进程被强制终止时可能保留 `running`，需人工检查。重新调用会新建一次运行，当前版本不自动续接未完成的模型调用。只有全部章节和引用校验通过才标记 `completed`。

## 配置

默认配置见 `cordis.patch.yml`。可在 profile 的 patch 中替换 `paper-insight` 行配置；DSH 替换整段配置，未写出的参数使用代码默认值。普通配置不需要密钥。

| 参数 | 默认值 | 含义 |
|---|---|---|
| `outputDir` | `.paper-insight` | 工作区内相对目录 |
| `sources` | 四个来源 | 可选 `arxiv/openreview/semantic-scholar/openalex` |
| `maxPapers` | 5 | 单次批量上限，最多 20 |
| `maxChunks` | 16 | 每篇最多分析的正文片段；超过后跨全文均匀抽样并标记 partial-text |
| `chunkChars` | 12000 | 每段字符数；可调 2000–20000 |
| `maxOutputTokens` | 7000 | 每两章综合报告的初始输出 token 上限 |
| `maxExtractionTokens` | 6000 | 每段证据提取的初始输出 token 上限 |
| `modelTimeoutMs` | 180000 | 每次模型调用超时 |
| `httpTimeoutMs` | 30000 | 一次抓取及其重试的总超时 |
| `maxDownloadBytes` | 20000000 | 下载/本地文件大小上限 |
| `maxPages` | 100 | PDF 最大提取页数 |
| `maxRelated` | 12 | 每类文献最多保留数量 |
| `provider`、`model` | 当前会话选择 | 要覆盖时必须一起设置；值来自 Harness 的已注册模型路由 |
| `language` | `zh-CN` | 分析正文语言，可为 `en`；固定导航标题仍为中文 |
| `extraHosts` | 空列表 | 额外允许下载的学术全文域名，完整域名，无通配符 |

默认每篇先进行最多 16 次证据提取，再进行 5 次综合分析。每次结构不合格或输出截断合计最多重试一次，因此上限为 **42 次模型调用**，截断重试将该次输出预算翻倍，最高 16000 token；批量按篇累加。实际费用取决于当前模型价格与论文长度。先用 `maxChunks: 4` 可以降低试用成本，但报告会明确标记抽样。输入超过 150000 字符时会要求调低范围，不会偷偷截断证据。

可选 API 密钥从启动 Harness 的环境读取：

```sh
export SEMANTIC_SCHOLAR_API_KEY='你的 Semantic Scholar 密钥'
export OPENALEX_API_KEY='你的 OpenAlex 密钥'
dsh web
```

这些是检索服务的可选凭据，与大模型凭据不同。密钥不保存到报告；已有模型凭据继续由 Harness 管理。来源限流、网络错误或授权要求会出现在结果里。

## 阅读与研究覆盖

- 优先使用 arXiv HTML，失败后尝试开放 PDF；PDF 使用 PDF.js 提取文本。默认还允许 ACL Anthology、PMLR、CVF、NeurIPS 官方全文域名；其他开放源可通过 `extraHosts` 添加。
- 不自动绕过付费墙、验证码或登录。获取不到正文时，只在存在摘要时生成明确标记的摘要分析。
- 公式、图片、表格、复杂双栏顺序可能无法完整抽取。`extracted-text` 表示提取范围内文本已进入分析，不表示模型已经看过所有图片。
- 搜索为每源最多 `limit×2` 个候选的有界检索，然后本地去重与日期筛选。默认按标题相关性排序，指定 `sort: "date"` 则按候选日期排序。没有自动遍历全站或完整系统综述；结果可能不足请求数量。
- 研究脉络使用 Semantic Scholar 的引用与被引关系、Crossref 的参考文献回退、OpenAlex 的主题相关结果。相关结果只有元数据/摘要证据，不会自动读取所有被引论文的全文。
- 报告只能在模型能力与已获取材料范围内回答产品问题。没有可核实的真实产品来源时，明确给出设想，不把它写成已上线案例。

## 运行边界

网络请求使用域名允许列表、跳转检查、超时、大小限制和有限重试；arXiv 请求之间至少间隔 3.1 秒。每个插件实例同时只运行一个分析任务，批量按顺序处理，可取消。

读写范围取自 `ctx.sandboxPolicy` 的当前会话工作区；只读模式下拒绝生成报告。路径校验拒绝越界和已有符号链接。插件属于宿主进程，路径检查不是新的操作系统沙箱；当前版本仅验证本地工作区，不支持远程 SSH 文件世界。不要在不可信进程能够同时替换工作区路径的环境中将这些检查视为完整隔离边界。

证据提取时，程序给原文片段编号，模型选择编号，程序直接取回对应原文作为引文；模型不能自行生成引文。引用存在不等于推断正确，关键结论仍需核对。

论文内容只作为模型输入数据，分析调用不授予工具，不执行论文代码。若要复现实验，应另行使用 Harness 的执行工具和沙箱流程。

## 开发与验证

```sh
npm ci --ignore-scripts
npm test
npm run test:live
npm pack
```

真实宿主服务测试使用隔离目录安装的官方包（该目录需有 `@deepseek-ai/cordis@4.0.5`、`@deepseek-ai/dsh-tools@0.2.1-rc.2`、`@deepseek-ai/dsh-llm@0.2.1-rc.2`、`@deepseek-ai/dsh-system-prompt@0.2.1-rc.2`）：

```sh
DSH_TEST_ROOT=/absolute/path/runtime-test npm run test:host
```

真实提示词验收见 [acceptance.md](docs/acceptance.md)，环境与限制见 [compatibility.md](docs/compatibility.md)，架构与需求映射见 [design.md](docs/design.md)。源码内的合成测试数据不是实际论文结论。

## 卸载

```sh
dsh plugin --profile web remove dsh-paper-insight
```

卸载不删除工作区中已生成的报告。

## 接口来源

- [用户指定的 dsh-git-vcs 0.2.0](https://www.npmjs.com/package/dsh-git-vcs/v/0.2.0)
- [Harness 官方插件打包说明](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md)
- [Harness 官方工具契约](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cookbook/adding-a-tool.md)
- [arXiv API](https://info.arxiv.org/help/api/user-manual.html)
- [OpenReview API](https://docs.openreview.net/reference/api-v2/openapi-definition)
- [Semantic Scholar API](https://api.semanticscholar.org/api-docs/)
- [OpenAlex API](https://help.openalex.org/api/)
