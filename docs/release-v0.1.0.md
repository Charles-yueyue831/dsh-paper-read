# v0.1.0 — DeepSeek Harness 文献研究插件

首个版本提供从自然语言提示词到论文检索、真实模型分析、本地报告的完整流程，采用 Cordis 插件体系。仓库名为 `dsh-paper-read`，安装包名为 `dsh-paper-insight`。

- 接入 arXiv、OpenReview、Semantic Scholar、OpenAlex，支持去重、相关性/日期排序与来源失败记录。
- 复用 Harness 会话模型，生成技术解析、第一性原理、Agent 沙箱、产品能力、新产品、体验、研究脉络、迁移、零基础解释和行动建议十章报告。
- 保存 Markdown、JSON、BibTeX、原文证据与运行状态；原文编号选择避免模型抄写引文失真。
- 包含 35 项自动测试、真实宿主服务测试、联网探针和验收核验脚本。

## 真实验收

在本地 Harness `0.2.1-alpha.2` 官方 headless 会话中输入自然语言提示词，模型自行检索并分析 ReAct（arXiv:2210.03629v3），生成 10 章、47 条发现、54 条原文证据和 36 篇关联文献，15 次真实模型调用，8 个本地文件均通过核验。另通过 `0.2.1-rc.2` 的真实 Cordis/tools/LLM 服务合成集成测试。

插件已接入本机 web profile。本机既有 Web 新建会话弹层存在 React 错误，网页交互验收未完成；上述端到端结果来自同一本地 Harness 的官方命令行会话。完整记录见 `docs/acceptance.md`。

## 安装

要求 Node.js ≥ 22.12.0。下载本 Release 的 `dsh-paper-insight-0.1.0.tgz`：

```sh
dsh plugin --profile web add /absolute/path/dsh-paper-insight-0.1.0.tgz
```

替换已有插件后重启 Harness。在可写工作区内输入：

> 检索 ReAct 论文，按照十项要求完整分析，并把报告保存到本地。

命令行模式请安装到 `headless` profile，并为该 profile 配置模型后使用 `dsh headless "你的需求"`。

`acceptance-summary.json` 提供验收统计与产物哈希，`SHA256SUMS` 用于校验安装包。论文图片/公式解析、来源限流与模型判断仍存在边界；本版本不承诺任意未来模型和网站始终可用。
