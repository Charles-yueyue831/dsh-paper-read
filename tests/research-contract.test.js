import test from 'node:test';
import assert from 'node:assert/strict';
import { createTools } from '../index.js';
import { MODULE_TOOLS } from '../lib/modules.js';

test('research tool contracts accept and preserve workbench budgets', async () => {
  const calls = [];
  const tools = createTools({ analyze: async args => { calls.push(args); return args; } });
  const budgets = { maxCalls: 64, maxTotalTokens: null };
  for (const suffix of ['analyze', 'resume', ...Object.keys(MODULE_TOOLS)]) {
    const tool = tools.find(t => t.name === `paper_insight_${suffix}`);
    const input = suffix === 'resume'
      ? { key: 'a'.repeat(20), runId: '123456789-abcdef12' }
      : { reference: 'arxiv:2210.03629' };
    for (const field of Object.keys(budgets)) assert.ok(tool.parameters.properties[field], `${suffix}: ${field}`);
    const result = await tool.execute({ ...input, ...budgets }, {});
    assert.equal(result.maxCalls, 64);
    assert.equal(result.maxTotalTokens, null);
    await assert.rejects(tool.execute({ ...input, ...budgets, maxCalls: 0 }, {}));
    await assert.rejects(tool.execute({ ...input, ...budgets, unknownBudget: 1 }, {}));
  }
  assert.equal(calls.length, 2 + Object.keys(MODULE_TOOLS).length);
});
