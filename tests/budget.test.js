import test from 'node:test';
import assert from 'node:assert/strict';
import { budgetedModel, summarizeCalls, usageTokens } from '../lib/budget.js';
const usage = { inputTokens: 4, outputTokens: 2, cacheReadTokens: 3, cacheWriteTokens: 1 };
test('concurrent requests cannot pass the same remaining reservation',async()=>{
 let calls=0;
 const raw={calls:[],tokenAccounting:{enforcesOutputLimit:true,countInput:async()=>1},generate:async()=>{calls++;return 'ok';}};
 const model=budgetedModel(raw,{maxCalls:1,maxTokens:20});
 const results=await Promise.allSettled([model.generate('','',undefined,10),model.generate('','',undefined,10)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(calls,1);
});
test('budget counts failures, persists before dispatch and resumes cumulatively', async () => {
  let dispatched=0; const snapshots=[];
  const raw={calls:[],async generate(){dispatched++;throw Error('offline');}};
  const m=budgetedModel(raw,{maxCalls:1},[],async rows=>snapshots.push(structuredClone(rows)));
  await assert.rejects(m.generate('','',null,10),/offline/);
  assert.equal(snapshots[0][0].status,'reserved');
  await assert.rejects(m.generate('','',null,10),e=>e.code==='BUDGET_EXHAUSTED');
  const resumed=budgetedModel(raw,{maxCalls:1},m.ledger);
  await assert.rejects(resumed.generate('','',null,10),e=>e.code==='BUDGET_EXHAUSTED');
  assert.equal(dispatched,1);
});
test('unsupported Token limits fail before dispatch; unknown usage is not zero', async () => {
  let called=false;
  const m=budgetedModel({generate(){called=true;}},{maxCalls:3,maxTokens:100});
  await assert.rejects(m.generate('','',null,10),e=>e.code==='TOKEN_BUDGET_UNSUPPORTED');
  assert.equal(called,false);assert.equal(usageTokens({inputTokens:4}),null);
  assert.equal(usageTokens(usage),10);
  assert.equal(summarizeCalls([{stage:'review',usage:null}]).unknownUsageCalls,1);
});
test('trusted token adapter reserves full request and retains unknown usage reservation', async () => {
  let count=0;
  const raw={calls:[],tokenAccounting:{enforcesOutputLimit:true,countInput:async()=>5},async generate(){count++;return 'ok';}};
  const m=budgetedModel(raw,{maxCalls:3,maxTokens:20});
  await m.generate('','',null,10);
  await assert.rejects(m.generate('','',null,10),e=>e.code==='BUDGET_EXHAUSTED');
  assert.equal(count,1);assert.equal(m.ledger[0].accountedTokens,15);
});
test('failed persistence prevents model dispatch',async()=>{
  let count=0;const m=budgetedModel({async generate(){count++;}},{maxCalls:2},[],async()=>{throw Error('disk full');});
  await assert.rejects(m.generate('','',null,10),/disk full/);assert.equal(count,0);
});
