import test from 'node:test';
import assert from 'node:assert/strict';
import {modes,precheck,safeSource,progressCount,evidenceFor} from '../client/workbench-model.js';
import {RESEARCH_MODES} from '../lib/modules.js';
import {renderDraft,opportunityFields} from '../lib/opportunities.js';
test('UI modes and server presets match the approved reading intent',()=>{
 assert.deepEqual(modes,RESEARCH_MODES);
 assert.deepEqual(modes.quick,['paper','first-principles','beginner']);
 assert.deepEqual(modes.deep,['paper','first-principles','landscape','transfer','beginner']);
});
test('preflight blocks missing context, empty selection, invalid budgets and overlapping jobs',()=>{
 const valid={session:'s',reference:'arxiv:1',modules:['paper'],maxCalls:8,busy:false};
 assert.equal(precheck(valid),'');
 for(const change of [{session:''},{reference:' '},{modules:[]},{maxCalls:0},{maxCalls:1.5},{maxCalls:1001},{busy:true}])assert.notEqual(precheck({...valid,...change}),'');
});
test('progress never invents a denominator or displays impossible completion',()=>{
 for(const p of [{completed:1},{total:5},{completed:6,total:5},{completed:-1,total:5},{}])assert.equal(progressCount(p),'');
 assert.equal(progressCount({completed:0,total:5}),'0/5');
});
test('source links permit only HTTPS and evidence drawer quotes only recorded evidence',()=>{
 for(const u of ['javascript:alert(1)','file:///etc/passwd','http://example.org','not a url'])assert.equal(safeSource(u),null);
 assert.equal(safeSource('https://arxiv.org/abs/1'),'https://arxiv.org/abs/1');
 const report={paper:{url:'https://arxiv.org/abs/1'},evidence:[{locator:'page 2',facts:[{id:'P1.F1',quote:'Exact text <script>'}]}],research:{references:[{evidenceId:'R1',title:'Related',url:'https://example.org'}]}};
 assert.equal(evidenceFor(report,['missing']).length,0);
 assert.equal(evidenceFor(report,['P1.F1'])[0].text,'Exact text <script>');
 assert.match(evidenceFor(report,['R1'])[0].text,/仅有出版元数据/);
});
test('product exports identify the exact run and keep annotations distinct',()=>{
 const card={...Object.fromEntries(Object.keys(opportunityFields).map(k=>[k,'value'])),id:'c',priority:'medium',status:'proposed',evidenceIds:[]};
 const report={paper:{title:'Paper'},createdAt:'2026',schemaVersion:3,opportunities:[card],evidence:[],research:{references:[],citations:[],discovery:[]}};
 const text=renderDraft(report,'poc','c',{revision:1,entries:[{type:'opportunity',targetId:'c',priority:'high',notes:'manual note'}]},{key:'paper-key',runId:'run-A'});
 assert.match(text,/paper-key \/ run-A/);assert.match(text,/人工备注：manual note/);assert.match(text,/待验证方案/);
});
