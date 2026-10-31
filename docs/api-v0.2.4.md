# v0.2.4 增量接口

所有旧工具继续保留。新增工具共 28 个，严格参数定义见 tools.json。

## 研究与继续

`paper_insight_analyze` 接受 reference/file 或 key+runId，可选 `mode: quick|deep|product`、modules、`maxCalls: 1..1000`、`maxTotalTokens: null|1..10000000`。显式 modules 优先于模式。调用预算默认 64。

`paper_insight_resume` 使用 key、runId 与可选的新总预算继续。已发生的失败调用也计数。普通重新分析使用新的预算账本；继续和补充章节沿用累计账本。

补充阅读：`paper_insight_analyze({key,runId,supplementChapters:["methods","limitations"],modules:["paper","sandbox"],maxCalls:80})`。章节还支持 abstract/introduction/related-work/experiments/results/conclusion/references/unknown。仅选取未处理的可用片段，每次最多新增 maxChunks 个；旧分块无法可靠重建时要求重新导入，不静默移动引用。

错误 `BUDGET_EXHAUSTED` / `TOKEN_BUDGET_UNSUPPORTED` 会产生 budget-paused 历史记录并携带 key/runId。当前真实适配器没有可信的调用前输入计数，总 Token 硬限制明确拒绝，不发出模型请求。用量和费用未知时保留 null/未知计数。模式、预算和阶段状态同样可在侧边栏设置和查看。

## 人工意见

先通过 report 工具读取 reportHash、annotations.revision 和目标 finding/card 的 id，再调用：

```json
{"key":"20位十六进制标识","runId":"运行编号","type":"finding","targetId":"报告中结论id","reportHash":"报告哈希","revision":0,"status":"questioned","notes":"需要核对实验条件"}
```

工具名为 `paper_insight_annotate`。finding 的 status 支持 pending/confirmed/questioned；opportunity 类型改用 priority: high/medium/low。两类都接受 notes。报告哈希、目标、权限和 revision 必须一致，冲突时刷新报告再编辑。意见独立保存在 annotations.json；不覆盖原文、原始结论或自动审查结果。

## 产品草稿

`paper_insight_export_report({key,runId,format:"prd"|"poc",cardId?})` 返回 markdown 与 filename，无额外模型调用。旧 markdown/json 导出不变。每张卡片包含机制→技术能力→产品能力→功能、用户、场景、问题、假设、价值、可行性、成本、风险、指标、依赖、旅程、验收、实验步骤与停止条件。没有适用方案时保留原因，不生成虚构机会。

## 可信度边界

引用存在且匹配原文，不等于结论已经获得语义或实验证明。自动复核是辅助审查，缺失实验条件不会标记直接支持。用户确认单独记录，不将推断或产品设想改成事实。所有继续操作创建新的不可变运行版本。
