import { modulePresentation, fieldLabels } from './report-format.js';
import { visualMermaid } from './visuals.js';

const md = value => String(value ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cell = value => md(value).replaceAll('|', '\\|').replaceAll('\n', '；');
const refs = ids => ids.map(id => `[${id}](#${id.toLowerCase().replaceAll('.', '-')})`).join('、') || '无直接证据';
const kindLabels = { 'paper-fact': '论文事实', 'literature-fact': '文献事实', inference: '推断', proposal: '待验证方案', unknown: '证据不足' };
const confidenceLabels = {high:'高',medium:'中',low:'低'};
const compareFields = {
  'first-principles': ['existingSolution','newMechanism'],
  experience: ['beforeJourney','afterJourney'],
  transfer: ['sourceDomain','targetDomain'],
};

/** Markdown is the portable complete report. The reader folds detail, never removes it. */
export function renderReport(report) {
  const byId = new Map(report.sections.map(s => [s.id, s]));
  const lines = [`# ${md(report.paper.title)}`, '',
    `生成时间：${report.createdAt} · 模型：${report.model.provider}/${report.model.model}`, '',
    report.paper.url ? `论文来源：${report.paper.url}` : '论文来源：本地导入', '',
    '## 重点概览', '',
    '> 先读结论，再沿着机制、证据与应用深入。图示是对已有材料的概括，产品方案仍需验证。', '',
  ];
  for (const [id, field, label] of [['paper','oneSentenceIdea','核心思想'],['paper','value','主要价值'],['paper','limitations','适用边界'],['decision','technicalExperiments','下一步行动']]) {
    const value = byId.get(id)?.details?.[field];
    if (value) lines.push(`**${label}**`, '', md(value), '');
  }
  if (!byId.has('paper') && !byId.has('decision')) for (const section of report.sections) lines.push(`**${modulePresentation[section.id]?.[1] || section.id}**`, '', md(section.summary), '');
  lines.push('## 阅读与证据边界', '', `阅读范围：${report.coverage}（${report.selection.selectedChunks}/${report.selection.totalChunks} 个文本片段）`, '',
    ...report.warnings.map(w => `- ${md(w)}`), `- ${md(report.research.coverage)}`, `- ${md(report.validation.limitations)}`, '');
  for (const [id, [, title]] of Object.entries(modulePresentation)) {
    const section = byId.get(id);
    if (!section) continue;
    lines.push(`## ${title}`, '', md(section.summary), '');
    if (section.visual) {
      const v = section.visual;
      lines.push(`**${md(v.title)} · ${kindLabels[v.kind]}**`, '', '```mermaid', visualMermaid(v), '```', '',
        md(v.caption), '', `图示依据：${refs(v.evidenceIds)}`, '');
    } else if (section.visualOmission) lines.push(`> 未绘制图示：${md(section.visualOmission)}`, '');
    const pair = compareFields[id];
    if (pair?.every(key => section.details?.[key])) lines.push(
      `| ${fieldLabels[pair[0]]} | ${fieldLabels[pair[1]]} |`, '| --- | --- |',
      `| ${cell(section.details[pair[0]])} | ${cell(section.details[pair[1]])} |`, '');
    // Keep distinct claims together; supporting implications and qualifications remain adjacent.
    if (section.findings.length) {
      lines.push('### 关键判断与依据', '');
      for (const f of section.findings) lines.push(`**${kindLabels[f.kind]} · 置信度${confidenceLabels[f.confidence] || f.confidence}**`, '', md(f.statement), '',
        `依据：${refs(f.evidenceIds)}`, '', `意味着什么：${md(f.implication)}`, '', `验证与限制：${md(f.validation)}`, '');
    }
    for (const [field, value] of Object.entries(section.details || {})) {
      if (pair?.includes(field)) continue;
      lines.push(`### ${fieldLabels[field] || field}`, '', md(value), '');
    }
  }
  lines.push('## 原文证据索引', '');
  for (const e of report.evidence) for (const f of e.facts) lines.push(`### ${f.id.replaceAll('.', '-')}`, '', `${md(e.locator)} · ${md(f.statement)}`, '', `> ${md(f.quote).replaceAll('\n', '\n> ')}`, '');
  lines.push('## 文献索引', '', `检索时间：${report.research.retrievedAt}`, '');
  for (const p of [...report.research.references, ...report.research.citations, ...report.research.discovery]) lines.push(`### ${p.evidenceId}`, '', `${md(p.title)}（${p.year || '年份未知'}）`, '', `${p.url || '无可用链接'} · 关系：${p.relation} · 证据范围：元数据与摘要`, '');
  if (report.research.errors.length) lines.push('## 来源缺口', '', ...report.research.errors.map(e => `- ${md(e.source)}：${md(e.error)}`), '');
  return lines.join('\n');
}
