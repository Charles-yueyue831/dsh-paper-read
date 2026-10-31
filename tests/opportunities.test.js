import test from 'node:test';
import assert from 'node:assert/strict';
import {opportunityFields,opportunitySchema,opportunitiesFrom,validateOpportunities,renderDraft} from '../lib/opportunities.js';
test('product cards require complete fields and real references; exports remain explicit hypotheses',()=>{
 const card={...Object.fromEntries(Object.keys(opportunityFields).map(k=>[k,'Example '+k])),evidenceIds:['P1.F1'],priority:'medium',status:'proposed'};
 assert.deepEqual(opportunitySchema.parse(card),card);
 assert.throws(()=>opportunitySchema.parse({...card,stopConditions:''}));
 assert.throws(()=>validateOpportunities([card],new Set()));
 const opportunities=opportunitiesFrom([{id:'products',opportunities:[card]}]);
 const report={paper:{title:'Public paper',url:'https://arxiv.org/abs/2210.03629'},createdAt:'2026-10-31',coverage:'partial-text',opportunities,evidence:[{locator:'page 1',facts:[{id:'P1.F1',quote:'Quoted evidence'}]}],research:{references:[],citations:[],discovery:[]}};
 const bytes=JSON.stringify(report);
 for(const format of ['prd','poc']){const draft=renderDraft(report,format,opportunities[0].id);assert.match(draft,/待验证/);assert.match(draft,/停止条件/);assert.match(draft,/Quoted evidence/);assert.match(draft,/partial-text/);}
 assert.equal(JSON.stringify(report),bytes);
 const annotated=renderDraft(report,'prd',opportunities[0].id,{revision:2,entries:[{type:'opportunity',targetId:opportunities[0].id,priority:'high',notes:'<script>plain text</script>'}]});
 assert.match(annotated,/人工优先级：高/);assert.match(annotated,/&lt;script&gt;/);assert.doesNotMatch(annotated,/<script>/);
 const poc=renderDraft(report,'poc');assert.ok(poc.indexOf('### 价值假设')<poc.indexOf('### 用户价值'));
 assert.throws(()=>renderDraft(report,'prd','missing'));
 assert.match(renderDraft({...report,opportunities:[]}),/没有建议采用/);
});
