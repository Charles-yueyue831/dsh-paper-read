# DeepSeek Harness 文献研究插件设计

本插件把论文发现、证据阅读、技术理解和产品判断连接起来。用户在 Harness 对话中提出主题、论文链接或本地 PDF，插件通过当前会话的模型完成分析，将可追溯的中文报告保存到当前工作区。

## 接入方式与依据

采用用户指定的 dsh-git-vcs 0.2.0 的 ESM 模块、Cordis apply/inject、dsh.bundle 和 cordis.patch.yml 组合包形式。文献处理使用模型可调用工具，不依赖其 Git 或浏览器侧实现。相比独立 MCP 服务，这种方式直接复用 Harness 模型与会话；相比纯提示词技能，它能够验证输入、控制抓取与落盘。

官方接口核对基线：deepseek-ai/deepseek-harness 提交 687f282e8625c6b8d11ff58211a90524be2e4317，包版本 0.2.1-rc.2。宿主通过 ctx.tools.register 注册带标准 JSON Schema 的工具，通过 ctx.llm.prepareCall/stream 调用模型，通过 ctx.sandboxPolicy.resolve 取得会话写入边界。发布包声明实际目标版本，不把参考插件的版本号误认为宿主版本。

## 工作流

1. 从 arXiv、OpenReview、Semantic Scholar、OpenAlex 检索；记录来源、检索时间、筛选范围与失败。
2. 按 DOI、arXiv ID 和标题合并，保留来源。解析开放 HTML/PDF 或工作区内的本地 PDF/文本。
3. 将全文划分成带定位信息的证据段。原文片段先编号，模型选择编号提取事实，由程序附上原文，再结合公开参考文献、后续引用和同期研究综合分析。
4. 每次生成两章，共五组结构化报告章节，验证章节完整性、引用 ID 与证据定位。只做有界重试，失败不伪装成功。
5. 原文摘取、证据、引用、模型运行信息和报告保存到独立运行目录，支持查看历史和部分失败后的重试。

## 十项需求对应

| 用户需求 | 实现与报告要求 |
|---|---|
| 学术网站 AI 论文抓取 | 四源搜索、时间过滤、去重、开放全文、本地导入 |
| Harness 大模型分析及本地保存 | 复用会话模型；Markdown、JSON、BibTeX 和证据文本 |
| Agent 沙箱 | 区分用沙箱复现实验与增强沙箱本身；列接口、资源、隔离、权限、快照、观测、成本、验证指标 |
| 新功能或能力 | 用户任务、机制到功能的映射、基线、MVP、依赖、验收指标 |
| 新产品 | 目标用户、未满足需求、工作流、差异化、交付方式、成本、否证实验 |
| 产品体验 | 具体体验问题、交互前后对比、延迟与失败恢复、可理解性、实验设计 |
| 第一性原理与矛盾 | 目标函数、约束、瓶颈、主要与次要矛盾、作用机制、代价及适用边界；不强行套用矛盾框架 |
| 研究现状与脉络 | 研究截止时间、前驱/本文/后继、文献来源、引用关系与主题相关关系区分、覆盖限制 |
| 技术迁移 | 不变量、假设、目标域差异、数据与接口、迁移路径、负迁移、最低成本验证 |
| 零基础介绍与产品例子 | 直觉类比及边界、术语解释、输入输出例子；已有产品事实须有来源，构想明确标注 |

## 质量与边界

原文是数据，不作为运行指令。模型分析调用不授予工具；不会执行论文代码。摘要、部分全文、完整提取文本分别标记，文本抽取不等于已理解图表。仅由元数据确认的相关论文不能充当实验结论依据。产品构想、迁移推断和作者报告的事实分别标记。

调用有取消信号、超时、大小限制、源级限流、重试上限和模型调用预算。单源失败不影响其他源。批量逐篇记录结果。只在配置目录和会话工作区允许的边界内读写，拒绝路径穿越与符号链接逃逸。网络只读取允许的公开学术来源并验证跳转。密钥从环境变量读取，不写入报告。

## 验收

自动测试覆盖来源解析、重复与时间过滤、全文定位、结构化输出、假引用、失败恢复、原子落盘、取消及路径边界。以真实 Cordis、工具注册表和 LLM 服务执行集成测试，以模拟模型验证完整流程；另外执行公开论文来源的联网探针。另在本地 0.2.1-alpha.2 的官方 headless 会话中使用用户现有模型路由执行真实提示词验收，记录于 acceptance.md；不把模拟结果称为真实论文结论。

## 参考

- https://www.npmjs.com/package/dsh-git-vcs/v/0.2.0
- https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md
- https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cookbook/adding-a-tool.md
- https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/sandbox.md
- https://info.arxiv.org/help/api/user-manual.html
- https://docs.openreview.net/reference/api-v2/openapi-definition
- https://api.semanticscholar.org/api-docs/
- https://help.openalex.org/api/
