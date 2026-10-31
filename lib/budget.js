import { safeError } from './config.js';

export function budgetError(code, message) { return Object.assign(new Error(message), { code }); }
export function usageTokens(usage) {
  if (!usage) return null;
  if (Number.isSafeInteger(usage.totalTokens) && usage.totalTokens >= 0) return usage.totalTokens;
  // Harness counts uncached and cached inputs separately. Never silently omit caches.
  const fields = ['inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens'];
  if (!fields.every(k => Number.isSafeInteger(usage[k]) && usage[k] >= 0)) return null;
  return fields.reduce((sum, k) => sum + usage[k], 0);
}
export function summarizeCalls(calls) {
  const stages = {};
  for (const call of calls) {
    const row = stages[call.stage || 'unknown'] ||= { calls: 0, durationMs: 0, knownTokens: 0, unknownUsageCalls: 0 };
    row.calls++; row.durationMs += call.durationMs || 0;
    const tokens = usageTokens(call.usage);
    if (tokens === null) row.unknownUsageCalls++; else row.knownTokens += tokens;
  }
  return { calls: calls.length, stages, knownTokens: Object.values(stages).reduce((n,s) => n+s.knownTokens,0),
    unknownUsageCalls: Object.values(stages).reduce((n,s) => n+s.unknownUsageCalls,0), cost: null };
}

/** Wrap all workflow calls, including injected test models, in one durable ledger.
 * A running reservation is retained on crashes: ambiguous dispatches still consume a call.
 * tokenAccounting is an internal adapter contract, NOT an assumed Harness API.
 */
export function budgetedModel(model, limits, prior = [], onChange = async () => {}) {
  const ledger = prior.map(x => ({ ...x }));
  const calls = [];
  let tail = Promise.resolve();
  const wrapped = { route: model.route, calls, ledger, limits, stage: 'generation',
    generate(system, input, signal, maxTokens) {
      const stage = wrapped.stage;
      const task = tail.then(() => dispatch(system, input, signal, maxTokens, stage));
      tail = task.catch(() => {});
      return task;
    },
  };
  async function dispatch(system, input, signal, maxTokens, stage) {
      signal?.throwIfAborted();
      if (ledger.length >= limits.maxCalls) throw budgetError('BUDGET_EXHAUSTED', `调用预算已用完（${ledger.length}/${limits.maxCalls}），请提高总预算后继续。`);
      let reservedTokens = null;
      if (limits.maxTokens != null) {
        if (!model.tokenAccounting?.enforcesOutputLimit || typeof model.tokenAccounting.countInput !== 'function')
          throw budgetError('TOKEN_BUDGET_UNSUPPORTED', '当前模型路由不支持总 Token 硬限制；请清空 Token 上限并使用调用次数限制，或选择支持可信计数的路由。');
        const inputTokens = await model.tokenAccounting.countInput(system, input, signal);
        if (!Number.isSafeInteger(inputTokens) || inputTokens < 0 || !Number.isSafeInteger(maxTokens) || maxTokens < 1)
          throw budgetError('TOKEN_BUDGET_UNSUPPORTED', '无法取得可信输入计数或输出上限，未发起模型调用。');
        reservedTokens = inputTokens + maxTokens;
        if (ledger.some(c => !Number.isSafeInteger(c.accountedTokens))) throw budgetError('TOKEN_BUDGET_UNSUPPORTED', '已有调用用量未知，无法安全启用总 Token 硬限制。');
        if (ledger.reduce((n,c) => n+c.accountedTokens,0) + reservedTokens > limits.maxTokens)
          throw budgetError('BUDGET_EXHAUSTED', '剩余 Token 预算不足以容纳本次输入及输出上限，请提高预算后继续。');
      }
      const row = { stage, status: 'reserved', usage: null, accountedTokens: reservedTokens, maxTokens, durationMs: 0 };
      ledger.push(row); calls.push(row);
      // Persist BEFORE dispatch; if this fails, no call is made.
      await onChange(ledger);
      const start = Date.now(), oldLength = model.calls?.length || 0;
      try { const value = await model.generate(system, input, signal, maxTokens); row.status = 'completed'; return value; }
      catch (e) { row.status = 'failed'; row.error = safeError(e); throw e; }
      finally {
        const source = model.calls?.length > oldLength ? model.calls.at(-1) : null;
        row.usage = source?.usage || null; row.durationMs = Date.now()-start;
        const tokens = usageTokens(row.usage);
        // Unknown usage retains the conservative reservation, never releases it as zero.
        row.accountedTokens = tokens ?? reservedTokens;
        await onChange(ledger);
      }
  }
  return wrapped;
}
