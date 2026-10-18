# v0.2.1 报告渲染验收

验收日期：2026-10-18。插件版本 0.2.1。使用本机 Harness Web 独立验收 profile（3091），不修改 Harness 核心，不中断用户主实例（3080）。

## 实现

复用已检查的 `@deepseek-ai/dsh-client-ui-primitives` 导出 `MarkdownText` 和宿主 React；通过插件 manifest 声明客户端依赖。增加本地 Mermaid ESM 资源，经过现有本机/同源请求守卫提供；仅在遇到图表时加载。Mermaid strict 模式、禁用 HTML labels、禁止报告内配置/交互/外部资源，再使用 DOMPurify 清洗 SVG。参考 [Mermaid 安全级别文档](https://mermaid.js.org/config/schema-docs/config-properties-securitylevel.html)。

`client/main.js` 调用研究工具；完成后继续调用 `paper_insight_report`，读取持久化的完整 Markdown。`client/report-view.js` 负责阅读/源码、目录、证据跳转与图表；不会修改归档或调用模型。`scripts/build-client.js` 构建提交到仓库及 npm 的 `client.js`、`dist/diagram.js`，并保留第三方许可证。

## 已执行检查

- `npm run build:client`：构建通过。
- `npm test`：55 项通过。新增围栏解析、代码保真、引用链接、图表安全约束、静态资源路径和来源守卫检查。
- `DSH_TEST_ROOT=<官方运行时目录> npm run test:host`：真实 Cordis、23 工具注册/卸载、LlmRuntime 和归档链路通过；这项使用合成模型响应。
- 浏览器渲染夹具 `tests/fixtures/rendering.md`：1 个表格、2 个数学公式、2 个 Mermaid 图（流程图与时序图）；2 个故意无效/不安全图表显示源码与原因；脚本/iframe/object 为 0，危险链接为 0。
- 证据链接 `P1.F1` 点击后焦点移至 `P1-F1` 标题；重复标题具有独立 ID；章节目录可以跳转。
- 下载得到的 `paper-research.md` 与夹具逐字节相同。浏览器下载事件监听超时，随后直接核验已落盘文件通过。
- 真实 ReAct 完整报告：15 个二级标题（含十个分析模块及证据/引用附录）、1 个 Mermaid 引用关系图、0 个图表错误；原报告 SHA256 未改变。
- 从工作台仅重做该论文的沙箱模块，使用 Harness 已配置的真实模型。运行 `1792309473224-b3c05722` 完成后，不再点击“查看报告”，阅读视图自动切换到该新版本完整报告；一次真实模型调用，结构、证据 ID 和短引校验通过；源码视图与新版本归档 41,221 字符完全一致。

## 可复核资料

完整真实研究过程和经脱敏公开示例仍见 [0.2.0 验收](acceptance-v0.2.0.md) 与 [ReAct 报告](example-react-v0.2.0.md)。本次渲染及自动读取检查结果追加到 [验收摘要](acceptance-summary.json) 的 `renderingPatch` 字段；原研究摘要保留。

本次不重新执行所有十个研究模块；前版真实模型的完整归档用于阅读回归，另实际调用沙箱模块验证新增的自动展示链路。公式、表格、无效图表用明确标注的合成夹具验证，不把它们冒充 ReAct 研究成果。现有来源缺口（Semantic Scholar 限流等）不因界面渲染而消失。

## 边界

- 只渲染完整的顶层 Mermaid 围栏；列表、引用内的嵌套围栏和未闭合围栏保留普通 Markdown/代码展示。
- 图表限制 30,000 字符和 300 条边；超过限制、配置指令、交互链接、HTML 或外部资源降级为源码。
- 章节目录收集二级标题；章节/证据定位使用生成报告中的标题锚点。
- 原始 Markdown 和 JSON 格式、分析 promptVersion 维持兼容，不触发历史报告重算。
