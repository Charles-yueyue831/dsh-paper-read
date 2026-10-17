# 兼容性与验证记录

验证日期：2026 年 10 月 17 日（Asia/Shanghai）。这是插件工程验证，不是对某篇论文技术结论的独立复现。

## 环境与接口

- Node.js：24.18.0；声明的最低版本为 22.12.0。
- 实际宿主包：`@deepseek-ai/cordis@4.0.5`、`@deepseek-ai/dsh-tools@0.2.1-rc.2`、`@deepseek-ai/dsh-llm@0.2.1-rc.2`、`@deepseek-ai/dsh-system-prompt@0.2.1-rc.2`。
- 官方源码核对：`deepseek-ai/deepseek-harness` 的 `687f282e8625c6b8d11ff58211a90524be2e4317`。
- 参考插件：读取了 npm 发布的 `dsh-git-vcs@0.2.0` 的 package.json、Cordis patch、入口与说明；借鉴包结构与宿主服务调用方式，未复制其 Git 业务实现。
- 本地安装：已使用官方插件命令把同一插件接入用户现有 `web` profile；另用独立 `paper-acceptance` profile、同一本地 Harness 源码及用户已有模型路由做真实验收。模型凭据未进入仓库。
- 本地 Harness 版本：`0.2.1-alpha.2`，源码版本标识 `d743267`。命令行验收详情见 [acceptance.md](acceptance.md)。

## 已验证

| 验证 | 结果 |
|---|---|
| 自动测试 | 35 项：来源解析、去重、日期、网络限制、重试、取消、路径、归档、模型流、输出结构与引用 |
| 真实 Cordis 插件生命周期 | 六个工具注册成功；插件卸载后自动移除 |
| 真实 DSH 工具执行管线 | 参数校验、规范 JSON 输出、执行错误返回正常 |
| 真实 DSH LLM 服务 | 模拟适配器经 `prepareCall` 与模型流接口执行，完整六次调用生成十章报告 |
| 完整本地归档 | Markdown、JSON、BibTeX、证据、原文与状态文件均生成 |
| 只读会话策略 | 策略服务测试替身返回 read-only 时拒绝分析落盘，不发模型请求 |
| arXiv 检索 | 真实 API 成功返回论文 |
| OpenReview 检索 | 真实 API v2 成功返回论文 |
| Semantic Scholar 检索 | 首次遇到 429；后续真实查询成功返回论文，保留限流处理 |
| OpenAlex 检索 | 真实 API 成功返回论文 |
| 真实 HTML 全文 | Attention Is All You Need，提取 39603 字符；测试上限为 2 段，因此正确标记 partial-text |
| 真实 PDF 提取 | 同一论文 PDF 共 15 页，测试提取前 2 页共 7290 字符，正确标记页数限制 |
| 运行依赖审计 | 更新 XML 解析器后 npm audit 返回 0 个已报告漏洞 |

## 未覆盖的条件

- 真实模型验收使用用户在 Harness 中已配置的路由；不公开模型网关或凭据。实际报告质量、时长和费用由所选模型与正文长度决定。
- 本版使用 Harness 的通用工具展示，没有独立界面。本机现有 Web 组合的新建会话弹层存在 React 渲染错误，网页验收未完成；真实提示词验收改用同一本地 Harness 的官方 headless 会话。此网页故障未被修改或掩盖。
- 未验证 Windows、Linux、远程 SSH 工作区或生产环境操作系统沙箱；目前面向本地工作区。
- 未把所有网络来源视为始终可用。API 限流、授权、站点更新与全文解析失败仍会发生，报告显式记录缺口。
- 未确认所有未来 Harness 0.2.x 版本兼容。包声明范围用于安装检查；实际覆盖为上述 alpha.2 本地实例和 rc.2 宿主服务测试。
- 引用校验验证的是引用 ID 存在、短引文本匹配与结构完整性，不自动证明每个判断被证据充分支持。

## 复测入口

`npm test` 无需网络或模型密钥。`npm run test:live` 访问公开学术 API，不调用大模型。`DSH_TEST_ROOT=... npm run test:host` 使用实际官方宿主包与合成论文/模型响应验证接口。详见 README。
