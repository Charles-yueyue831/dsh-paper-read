import test from 'node:test';
import assert from 'node:assert/strict';
import {installWeb} from '../lib/web.js';
import {createTools} from '../index.js';
import {researchCompatibility,failureStatus,recoverJob} from '../client/workbench-model.js';

test('old or unavailable hosts cannot silently drop research budgets',()=>{
 const tools=createTools({});
 assert.equal(researchCompatibility(tools),'');
 assert.match(researchCompatibility(null),/检查/);
 assert.match(researchCompatibility(tools.map(t=>({...t,parameters:{properties:{}}}))),/重新打开/);
 assert.match(researchCompatibility(tools.filter(t=>t.name!=='paper_insight_resume')),/旧版/);
});
test('failure receipts never claim a checkpoint without both archive identifiers',()=>{
 assert.match(failureStatus({},'failed'),/尚未生成/);
 assert.match(failureStatus({key:'key'},'failed'),/尚未生成/);
 assert.match(failureStatus({key:'key',runId:'run'},'failed'),/已保存/);
 assert.match(failureStatus({key:'key',runId:'run'},'budget-paused'),/预算已用完/);
 assert.match(failureStatus({},'cancelled'),/已取消/);
});
test('restore live tasks only for an existing session and never cross a selected workspace',()=>{
 const jobs=[{id:'j',action:'analyze',sessionId:'a',status:'running'}];
 assert.equal(recoverJob(jobs,[{id:'a'}],'a').id,'j');
 assert.equal(recoverJob(jobs,[{id:'a'}],'').id,'j');
 assert.equal(recoverJob(jobs,[{id:'a'},{id:'b'}],'b'),null);
 assert.equal(recoverJob(jobs,[],''),null);
 assert.equal(recoverJob([{...jobs[0],status:'completed'}],[{id:'a'}],''),null);
});
test('running job discovery survives client remount and excludes payloads and completed jobs',async()=>{
 let handler,finish;
 const gate=new Promise(resolve=>{finish=resolve;});
 const agent={id:'session-a',session:{requestHeader:()=>({})}};
 const tools=[{name:'paper_insight_analyze',parameters:{},execute:async()=>{await gate;return {ok:true};}}];
 installWeb({inject:(_,cb)=>cb({effect:fn=>fn(),webServer:{register:r=>{handler=r.handler;}},agents:{roots:()=>[agent],get:id=>id===agent.id?agent:null}})},
 {config:{concurrency:1},archive:()=>({root:'/tmp/fixture'})},tools,new AbortController().signal);
 const request=async(path,input)=>{
  let result;
  await handler({url:'/api/paper-insight'+path,method:input?'POST':'GET',headers:{host:'localhost:3080','content-type':'application/json'},async *[Symbol.asyncIterator](){yield JSON.stringify(input);}},
  {writeHead(){},end:body=>{result=JSON.parse(body);}});
  return result;
 };
 try{
  const job=await request('/run',{sessionId:agent.id,tool:'paper_insight_analyze',args:{reference:'private input'}});
  const sessions=await request('/sessions');
  assert.equal(sessions.activeJobs.length,1);
  assert.equal(sessions.activeJobs[0].id,job.id);
  assert.equal(sessions.activeJobs[0].sessionId,agent.id);
  assert.equal(sessions.activeJobs[0].action,'analyze');
  assert.ok(sessions.activeJobs[0].startedAt>0);
  assert.doesNotMatch(JSON.stringify(sessions.activeJobs),/private input|controller|args/);
  finish();await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual((await request('/sessions')).activeJobs,[]);
 }finally{finish();}
});
