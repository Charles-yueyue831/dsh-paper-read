import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { validateExtraction, validateReport, structuredCall, analyzeDocument, renderReport } from '../lib/analysis.js';
import { PaperInsight } from '../lib/service.js';
import { parseConfig } from '../lib/config.js';
import { createHarnessModel } from '../lib/model.js';
import { createTools } from '../index.js';
import { fakeModel, paper, passage, research } from './fixtures.js';
const config = parseConfig({ maxChunks: 1 });
const doc = { paper, format: 'txt', sourceUrl: 'local-file', coverage: 'extracted-text', warnings: [], chunks: [{ id: 'P1', locator: 'page 1', text: passage }], segments: [{ locator: 'page 1', text: passage }], totalChunks: 1, selectedChunks: 1 };

test('fabricated extraction quotes are rejected', () => {
  assert.throws(() => validateExtraction({ summary: 'test', facts: [{ statement: 'wrong', quote: 'This text is not in the source.' }] }, doc.chunks[0]), /逐字/);
});
test('report rejects invented citations and missing sections', () => {
  const s = { id: 'paper', summary: 'Long enough test summary', findings: [{ statement: 'This is a sufficiently long statement.', kind: 'paper-fact', evidenceIds: ['P99.F1'], confidence: 'low', implication: 'test', validation: 'test' }] };
  assert.throws(() => validateReport({ sections: [s] }, ['paper'], new Set()), /引用不存在/);
  assert.throws(() => validateReport({ sections: [s] }, ['paper', 'sandbox'], new Set()), /缺失/);
});
test('structured repair happens only once', async () => {
  let calls = 0; const model = { generate: async () => { calls++; return 'bad json'; } };
  await assert.rejects(structuredCall(model, 'system', {}, x => x), /仍不合格/); assert.equal(calls, 2);
});
test('full synthetic analysis includes all ten dimensions and source anchors', async () => {
  const report = await analyzeDocument(doc, research, fakeModel(), config);
  assert.equal(report.sections.length, 10); assert.equal(report.calls.length, 6);
  const md = renderReport(report); assert.match(md, /Agent 沙箱/); assert.match(md, /#p1-f1/); assert.match(md, /### P1-F1/);
});
test('model adapter uses host route, no tools, authoritative block-end and checks finish', async () => {
  let options;
  const ctx = { llm: { prepareCall: async route => ({ config: route, async *stream(o) { options = o; yield { type: 'text-delta', index: 0, text: 'bad duplicate' }; yield { type: 'block-end', index: 0, block: { type: 'text', text: 'correct' } }; yield { type: 'finish', reason: { kind: 'stop' } }; } }) } };
  const exec = { agent: { session: { id: 'session1', requestHeader: () => ({ config: { provider: 'existing', model: 'selected' } }) } } };
  const model = createHarnessModel(ctx, exec, config); assert.equal(await model.generate('system', 'data'), 'correct');
  assert.equal(options.provider, 'existing'); assert.equal(options.tools, undefined); assert.equal(options.messages[0].role, 'user');
});
test('model adapter rejects truncated finish', async () => {
  const ctx = { llm: { prepareCall: async route => ({ config: route, async *stream() { yield { type: 'text-delta', index: 0, text: '{}' }; yield { type: 'finish', reason: { kind: 'max-tokens' } }; } }) } };
  await assert.rejects(createHarnessModel(ctx, {}, { ...config, provider: 'p', model: 'm' }).generate('', ''), /max-tokens/);
});
test('end-to-end synthetic service saves Markdown JSON BibTeX and evidence', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'paper-service-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const service = new PaperInsight({ sandboxPolicy: { resolve: () => ({ mode: 'workspace-write', workspaceRoot: root }) } }, config,
    { sources: { resolve: async () => paper, related: async () => research }, reader: { read: async () => doc }, makeModel: () => fakeModel() });
  const exec = { signal: new AbortController().signal };
  const result = await service.analyze({ reference: paper.id }, exec); assert.equal(result.status, 'completed');
  for (const f of ['manifest.json', 'document.json', 'source.txt', 'references.json', 'evidence.json', 'report.json', 'report.md', 'references.bib']) assert.ok((await fs.stat(path.join(result.folder, f))).size > 0);
  assert.equal((await service.archive(exec).list())[0].status, 'completed');
});
test('failed analysis retains evidence and marks manifest failed', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'paper-failed-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const service = new PaperInsight({ sandboxPolicy: { resolve: () => ({ mode: 'workspace-write', workspaceRoot: root }) } }, config,
    { sources: { resolve: async () => paper, related: async () => research }, reader: { read: async () => doc }, makeModel: () => ({ route: {}, calls: [], generate: async () => { throw new Error('model unavailable'); } }) });
  const exec = { signal: new AbortController().signal }; await assert.rejects(service.analyze({ reference: paper.id }, exec), /已提取/);
  assert.equal((await service.archive(exec).list())[0].status, 'failed'); assert.equal(service.busy, false);
});
test('tool validation rejects invalid dates and ambiguous out-of-scope input', async () => {
  const tool = createTools({ search: () => ({}) })[0]; const exec = { signal: new AbortController().signal };
  await assert.rejects(tool.execute({ query: 'AI', since: '2026-02-30' }, exec));
  await assert.rejects(tool.execute({ query: 'AI', limit: 500 }, exec));
});
test('truncation retries once with a bounded larger output budget and never accepts partial JSON', async () => {
  const budgets = []; const model = { generate: async (_s, _i, _signal, budget) => {
    budgets.push(budget);
    if (budgets.length === 1) { const error = new Error('truncated'); error.code = 'MODEL_OUTPUT_TRUNCATED'; throw error; }
    return '{"ok":true}';
  } };
  assert.deepEqual(await structuredCall(model, '', {}, value => value, undefined, 6000), { ok: true });
  assert.deepEqual(budgets, [6000, 12000]);
});
test('source selection preserves exact text and rejects invented passage IDs', async () => {
  const { sourcePassages, validatePassageExtraction } = await import('../lib/analysis.js');
  const chunk = doc.chunks[0]; const spans = sourcePassages(chunk);
  assert.equal(spans.map(p => p.text).join(''), chunk.text);
  const extracted = validatePassageExtraction({ summary: 'Test', facts: [{ statement: 'Test', passageId: spans[0].id }] }, chunk, spans);
  assert.equal(extracted.facts[0].quote, spans[0].text);
  assert.throws(() => validatePassageExtraction({ summary: 'Test', facts: [{ statement: 'Test', passageId: 'P99.S999' }] }, chunk, spans), /不存在/);
});
test('new sessions use pending selection or host default before a first request', () => {
  const services = { sessionProjections: { stateOf: () => ({ pending: { provider: 'pending', model: 'selected' } }) }, agentDefaultModel: { currentSelection: () => ({ provider: 'default', model: 'fallback' }) } };
  const ctx = { get: name => services[name] };
  assert.equal(createHarnessModel(ctx, {agent:{session:{requestHeader:()=>undefined}}}, config).route.provider, 'pending');
  services.sessionProjections.stateOf = () => ({});
  assert.equal(createHarnessModel(ctx, {agent:{session:{requestHeader:()=>undefined}}}, config).route.model, 'fallback');
});
test('failed provider streams preserve available usage and failure telemetry', async () => {
  const ctx = { llm: {prepareCall: async () => ({config:{}, async *stream() {yield {type:'usage',usage:{inputTokens:7}}; throw new Error('network offline');}})} };
  const model=createHarnessModel(ctx,{}, {...config,provider:'p',model:'m'});
  await assert.rejects(model.generate('',''), /network offline/);
  assert.equal(model.calls.length,1); assert.equal(model.calls[0].status,'failed'); assert.equal(model.calls[0].usage.inputTokens,7);
});
test('tool results are lossless JSON even when optional fields are absent', async () => {
  const tool=createTools({search:async()=>({papers:[],filters:{author:undefined},optional:undefined})})[0];
  const output=await tool.execute({query:'agent'},{});
  assert.deepEqual(output,JSON.parse(JSON.stringify(output))); assert.deepEqual(output.filters,{});
});
