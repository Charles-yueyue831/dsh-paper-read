// Run against installed official runtime packages; no global Harness/profile mutation.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import * as Plugin from '../index.js';
import { passage, modelResponse } from '../tests/fixtures.js';

const runtimeRoot = process.env.DSH_TEST_ROOT || process.cwd();
const require = createRequire(path.join(runtimeRoot, 'package.json'));
const fromHost = name => import(pathToFileURL(require.resolve(name)).href);
const { Context, Service } = await fromHost('@deepseek-ai/cordis');
const { default: ToolRuntime } = await fromHost('@deepseek-ai/dsh-tools');
const { default: LlmRuntime, LlmAdapter } = await fromHost('@deepseek-ai/dsh-llm');
const { default: SystemPrompt } = await fromHost('@deepseek-ai/dsh-system-prompt');
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-paper-host-'));
const originalFetch = globalThis.fetch;
const ctx = new Context();
let mode = 'workspace-write'; let requests = 0;
class PolicyFixture extends Service {
  constructor(ctx) { super(ctx, 'sandboxPolicy'); }
  resolve() { return { mode, workspaceRoot: root }; }
}
class ResearchFixtureAdapter extends LlmAdapter {
  async *stream(options) {
    requests++; assert.equal(options.tools, undefined);
    const text = modelResponse(options.messages[0].content[0].text);
    yield { type: 'text-delta', index: 0, text };
    yield { type: 'finish', reason: { kind: 'stop' } };
  }
}
try {
  await fs.writeFile(path.join(root, 'fixture.txt'), passage);
  globalThis.fetch = async url => {
    if (String(url).startsWith('https://api.openalex.org/works')) return new Response(JSON.stringify({ results: [] }));
    throw new Error(`Unexpected fixture URL: ${url}`);
  };
  await ctx.plugin(SystemPrompt); await ctx.plugin(ToolRuntime); await ctx.plugin(LlmRuntime); await ctx.plugin(PolicyFixture);
  ctx.llm.registerAdapter(['fixture'], new ResearchFixtureAdapter());
  const fiber = await ctx.plugin(Plugin, { provider: 'fixture', model: 'fixture-model', maxChunks: 1 });
  assert.equal(ctx.tools.schemas().filter(t => t.name.startsWith('paper_insight_')).length, Plugin.createTools({}).length);
  const signal = new AbortController().signal;
  const searched=await ctx.tools.execute({signal,callId:'search-regression',name:'paper_insight_search',arguments:{query:'fixture',sources:['openalex']}});
  assert.equal(searched.isError,false,JSON.stringify(searched));
  const result = await ctx.tools.execute({ signal, callId: 'paper-test', name: 'paper_insight_analyze', arguments: { file: 'fixture.txt' } });
  assert.equal(result.isError, false, JSON.stringify(result));
  assert.equal(result.value.status, 'completed'); assert.equal(requests, 6);
  const report = JSON.parse(await fs.readFile(path.join(result.value.folder, 'report.json'), 'utf8'));
  assert.equal(report.sections.length, 10);
  mode = 'read-only';
  const blocked = await ctx.tools.execute({ signal, callId: 'read-only', name: 'paper_insight_analyze', arguments: { file: 'fixture.txt' } });
  assert.equal(blocked.isError, true); assert.equal(requests, 6);
  const malformed = await ctx.tools.execute({ signal, callId: 'bad-input', name: 'paper_insight_search', arguments: { query: 'AI', limit: 999 } });
  assert.equal(malformed.isError, true);
  await fiber.dispose();
  assert.equal(ctx.tools.schemas().filter(t => t.name.startsWith('paper_insight_')).length, 0);
  console.log(JSON.stringify({ ok: true, runtime: 'DSH 0.2.1-rc.2 / Cordis 4.0.5', tools: Plugin.createTools({}).length, modelCalls: requests, sections: 10,
    tests: ['real Cordis load/unload', 'real tool registry canonical output', 'real LLM runtime with fixture adapter', 'local artifact pipeline', 'read-only policy fixture', 'input validation'],
    note: 'Synthetic paper/model responses. No live paid model, UI, SSH or production sandbox backend was used.' }, null, 2));
} finally { globalThis.fetch = originalFetch; await ctx.fiber.dispose(); await fs.rm(root, { recursive: true, force: true }); }
