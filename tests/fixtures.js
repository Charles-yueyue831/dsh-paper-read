import { sections } from '../lib/analysis.js';
export const passage = 'The method separates planning from execution. The experiments evaluate recovery after tool failures. This is a deliberately synthetic test fixture, not a real research result. '.repeat(12);
export const paper = { id: 'arxiv:2601.00001v1', arxivId: '2601.00001v1', title: 'Synthetic Agent Paper', authors: ['Fixture Author'], abstract: passage, year: 2026, published: '2026-01-01', doi: null, url: 'https://arxiv.org/abs/2601.00001v1', pdfUrl: null, venue: 'test', sources: ['arxiv'], citationCount: null };
export const research = { retrievedAt: '2026-10-17T00:00:00Z', references: [], citations: [], discovery: [], errors: [], coverage: 'Synthetic fixtures only' };
export function modelResponse(input) {
  const data = JSON.parse(input.split('\n上次结构校验失败：')[0]);
  if (data.requiredSectionIds) return JSON.stringify({ sections: data.requiredSectionIds.map(id => ({
    id, details: Object.fromEntries((data.requiredDetailFields?.[id] || []).map(key => [key, '合成测试说明；不代表真实研究结论。'])), summary: `这是 ${id} 章节的合成测试摘要，不是真实论文分析。`,
    findings: [{ statement: '该合成测试材料描述了规划与执行分离，这是一条用于验证管线的测试事实。', kind: 'paper-fact', evidenceIds: [data.evidence[0].facts[0].id], confidence: 'low', implication: '验证分析结构，不构成研究结论。', validation: '仅用于自动测试，应以真实论文和真实模型另行验证。' }],
  })) });
  return JSON.stringify({ summary: 'Synthetic evidence extraction', facts: [{ statement: 'Planning and execution are separate.', passageId: data.passages[0].id }] });
}
export function fakeModel() {
  const calls = [];
  return { route: { provider: 'fixture', model: 'fixture-model' }, calls, async generate(_system, input) { calls.push({ fixture: true }); return modelResponse(input); } };
}
