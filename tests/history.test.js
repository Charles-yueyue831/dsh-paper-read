import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Archive } from '../lib/storage.js';
import { PaperInsight } from '../lib/service.js';
import { PaperSources } from '../lib/papers.js';
import { parseConfig } from '../lib/config.js';
import { createTools } from '../index.js';
import { paper, passage, research, fakeModel } from './fixtures.js';
import { installWeb } from '../lib/web.js';

async function fixture(t) {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'paper-history-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  let mode='workspace-write';
  const doc={paper,coverage:'extracted-text',warnings:[],chunks:[{id:'P1',locator:'page 1',text:passage}],segments:[{locator:'page 1',text:passage}],totalChunks:1,selectedChunks:1};
  const service=new PaperInsight({sandboxPolicy:{resolve:()=>({mode,workspaceRoot:root})}},parseConfig({maxChunks:1}),{
    reader:{read:async()=>doc},sources:{resolve:async()=>paper,related:async()=>research},makeModel:()=>fakeModel(),
  });
  const exec={signal:new AbortController().signal};
  const tools=createTools(service);
  const call=(n,a)=>tools.find(t=>t.name==='paper_insight_'+n).execute(a,exec);
  return {root,doc,service,exec,call,setMode:value=>mode=value,archive:service.archive(exec),tools};
}

test('history CRUD persists metadata, full-text filters and recoverable deletion without changing the report',async t=>{
  const {call,archive}=await fixture(t);
  const created=await call('analyze',{reference:paper.id,modules:['sandbox']});
  const id={key:created.key,runId:created.runId};
  const before=await archive.read(id.key,id.runId);
  const edited=await call('history_update',{...id,title:'我的沙箱研究',notes:'冷启动优化候选',revision:0});
  assert.equal(edited.record.record.revision,1);
  assert.equal((await call('library',{query:'冷启动优化'})).total,1);
  assert.equal((await call('library',{query:'冷启动优化',status:'failed'})).total,0);
  assert.equal((await call('library',{offset:1})).runs.length,0);
  assert.equal((await call('history_detail',id)).displayTitle,'我的沙箱研究');
  await assert.rejects(call('history_update',{...id,title:'stale',revision:0}),/已被更新/);
  await call('history_delete',{...id,revision:1});
  assert.equal((await call('library',{})).total,0);
  assert.equal((await call('library',{deleted:true,query:'冷启动'})).total,1);
  await assert.rejects(call('resume',id),/已删除/);
  await call('history_restore',{...id,revision:2});
  assert.equal((await call('library',{})).total,1);
  assert.equal((await archive.read(id.key,id.runId)).markdown,before.markdown);
  const record=await archive.load(id.key,id.runId,'record.json');
  assert.equal(record.versions.length,3);
  assert.equal(record.versions[1].title,'我的沙箱研究');
});

test('record mutations enforce workspace permissions, identifiers and concurrent revision checks',async t=>{
  const {call,setMode}=await fixture(t);
  const created=await call('analyze',{reference:paper.id,modules:['sandbox']});
  const id={key:created.key,runId:created.runId};
  const concurrent=await Promise.allSettled([call('history_update',{...id,title:'a',revision:0}),call('history_update',{...id,title:'b',revision:0})]);
  assert.equal(concurrent.filter(r=>r.status==='fulfilled').length,1);
  for(const n of ['history_update','history_delete','history_restore']) {
    setMode('read-only');
    await assert.rejects(call(n,{...id,...(n==='history_update'?{title:'x'}:{})}),/只读/);
    setMode('workspace-write');
    await assert.rejects(call(n,{...id,key:'../escape',...(n==='history_update'?{title:'x'}:{})}));
  }
});

test('legacy saved documents can be resumed without downloading or modifying the old version',async t=>{
  const {call,archive,doc,service}=await fixture(t);
  const old=await archive.start(paper,'a'.repeat(20));
  await archive.write(old,'document.json',doc);
  await archive.finish(old,'failed',{error:'模型输出超过长度限制'});
  service.read=()=>{throw new Error('must not download');};
  const detail=await call('history_detail',{key:old.key,runId:old.runId});
  assert.equal(detail.canResume,true);
  const result=await call('resume',{key:old.key,runId:old.runId});
  assert.equal(result.status,'completed');
  assert.notEqual(result.runId,old.runId);
  assert.equal((await archive.load(old.key,old.runId,'manifest.json')).status,'failed');
});

test('old title-only failures show the title and can retry; missing material never claims it can resume',async t=>{
  const {call,archive}=await fixture(t);
  const old=await archive.start({title:'Pending paper'},'b'.repeat(20));
  await archive.write(old,'checkpoint.json',{key:old.key,input:{reference:paper.title},evidence:[],sections:[]});
  await archive.finish(old,'failed',{error:'标题请先搜索'});
  let detail=await call('history_detail',{key:old.key,runId:old.runId});
  assert.equal(detail.displayTitle,paper.title);
  assert.equal(detail.hasDocument,false);
  assert.equal(detail.canResume,true);
  assert.equal((await call('library',{query:paper.title})).total,1);
  const empty=await archive.start({title:'Pending paper'},'c'.repeat(20));
  await archive.finish(empty,'failed');
  detail=await call('history_detail',{key:empty.key,runId:empty.runId});
  assert.equal(detail.canResume,false);
  assert.match(detail.recoveryError,/没有保存/);
  assert.equal(detail.displayTitle,'未识别的论文');
});

test('pasted diagnostics are rejected before creating another failed history entry',async t=>{
  const {call,archive}=await fixture(t);
  const reference='已提取材料及检查点 key=9021464d810d78bedb21 runId=1792312571260-8e14f8c5；可用 paper_insight_resume 续跑';
  await assert.rejects(call('analyze',{reference}),e=>e.code==='INVALID_REFERENCE');
  assert.equal((await archive.list()).length,0);
  const old=await archive.start({title:reference},'d'.repeat(20));
  await archive.write(old,'checkpoint.json',{key:old.key,input:{reference}});
  await archive.finish(old,'failed');
  const detail=await call('history_detail',{key:old.key,runId:old.runId});
  assert.equal(detail.canResume,false);
  assert.equal(detail.displayTitle,'未识别的论文');
  assert.deepEqual(detail.input,{});
  await assert.rejects(call('resume',{key:old.key,runId:old.runId}),/不是论文/);
  assert.equal((await archive.list()).length,1);
});

test('title imports auto-select only a verified exact match and return candidates for uncertain queries',async()=>{
  const sources=new PaperSources({},parseConfig());
  sources.search=async()=>({papers:[paper],searchedAt:'2026-10-18',errors:[]});
  const result=await sources.resolve(paper.title.toUpperCase());
  assert.equal(result.id,paper.id);
  assert.equal(result.resolution.matchedBy,'exact-title');
  await assert.rejects(sources.resolve('vague agent query'),e=>e.code==='PAPER_SELECTION_REQUIRED'&&e.candidates.length===1);
  sources.search=async()=>({papers:[],errors:[]});
  await assert.rejects(sources.resolve('missing paper'),/未检索到/);
  sources.search=async()=>{throw new Error('所有来源失败');};
  await assert.rejects(sources.resolve('network problem'),/所有来源失败/);
});

test('web job API performs real history operations and returns actionable selection errors',async t=>{
  const {service,tools,call}=await fixture(t);
  let handler;
  const agent={id:'test',session:{}};
  installWeb({inject:(_,cb)=>cb({effect:fn=>fn(),webServer:{register:r=>{handler=r.handler;}},agents:{get:()=>agent,roots:()=>[agent]}})},service,tools,new AbortController().signal);
  const request=async(route,input)=>{
    const result={};
    const req={url:'/api/paper-insight'+route,method:input?'POST':'GET',headers:{host:'localhost:3091','content-type':'application/json'},async *[Symbol.asyncIterator](){yield JSON.stringify(input);}};
    await handler(req,{writeHead:status=>{result.status=status;},end:body=>{result.body=JSON.parse(body);}});
    return result;
  };
  const job=async(tool,args)=>{
    const start=await request('/run',{sessionId:'test',tool:'paper_insight_'+tool,args});
    assert.equal(start.status,202);
    for(let i=0;i<100;i++) {
      const response=await request('/jobs?id='+start.body.id);
      if(response.body.status!=='running')return response.body;
      await new Promise(resolve=>setTimeout(resolve,5));
    }
    throw new Error('job did not complete');
  };
  const first=await call('analyze',{reference:paper.id,modules:['sandbox']});
  const id={key:first.key,runId:first.runId};
  assert.equal((await job('history_update',{...id,title:'web edit'})).status,'completed');
  assert.equal((await job('library',{query:'web edit'})).result.total,1);
  assert.equal((await job('history_delete',id)).status,'completed');
  assert.equal((await job('library',{})).result.total,0);
  assert.equal((await job('history_restore',id)).status,'completed');
  service.read=async()=>{throw Object.assign(new Error('请选择论文'),{code:'PAPER_SELECTION_REQUIRED',candidates:[paper]});};
  const failed=await job('analyze',{reference:'uncertain title'});
  assert.equal(failed.error.code,'PAPER_SELECTION_REQUIRED');
  assert.equal(failed.error.candidates[0].id,paper.id);
  assert.doesNotMatch(failed.error.message,/已提取|已保存论文材料/);
});

test('active runs reject mutations; interrupted runs can be resumed and managed after a restart',async t=>{
  const {archive,call}=await fixture(t);
  const active=await archive.start(paper,'e'.repeat(20));
  const id={key:active.key,runId:active.runId};
  await archive.write(active,'checkpoint.json',{key:active.key,input:{reference:paper.id},modules:['sandbox']});
  await assert.rejects(call('history_delete',id),/仍在运行/);
  await assert.rejects(call('resume',id),/仍在运行/);
  await archive.finish(active,'failed');
  const manifest=await archive.load(active.key,active.runId,'manifest.json');
  await archive.write(active,'manifest.json',{...manifest,status:'running'});
  const detail=await call('history_detail',id);
  assert.equal(detail.interrupted,true);
  assert.equal(detail.canResume,true);
  await call('history_update',{...id,notes:'restart recovery'});
  assert.equal((await call('resume',id)).status,'completed');
});
