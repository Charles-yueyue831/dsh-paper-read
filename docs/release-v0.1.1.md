# v0.1.1 — npm 安装说明更新

本版本为 npm 分发更新安装说明与包版本。论文检索、模型分析、十章报告、本地归档的实现、依赖及测试代码与已验收的 v0.1.0 完全一致；未重复执行付费模型分析。v0.1.0 的真实 Harness 端到端验收记录与证据摘要仍适用于这份实现，详见 `docs/acceptance.md`。

```sh
dsh plugin --profile web add dsh-paper-insight@0.1.1
```

也可下载本 Release 的 `dsh-paper-insight-0.1.1.tgz`，将上述包名替换为安装包绝对路径。替换插件后重启 Harness。命令行使用时把 profile 改为 `headless` 并为该 profile 配置模型。

- 35 项自动测试及真实 Cordis/tools/LLM 服务合成集成测试通过。
- 原始真实模型验收：ReAct 论文，10 章、47 条发现、54 条原文证据、36 篇关联文献、8 个本地文件。
- 本机既有 Web 新建会话弹层存在 React 错误；真实端到端结果来自官方命令行会话，不代表 Web 交互验收通过。
- `acceptance-summary.json` 是原始验收摘要；`SHA256SUMS` 校验本次分发包。
