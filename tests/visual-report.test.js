import test from 'node:test';
import assert from 'node:assert/strict';
import { validateVisual, visualMermaid } from '../lib/visuals.js';
import { readingModel } from '../client/reading-model.js';
import { validateDiagram, splitReport } from '../client/report-utils.js';
import { analyzeDocument, validateReport, renderReport } from '../lib/analysis.js';
import { parseConfig } from '../lib/config.js';
import { fakeModel, paper, passage, research } from './fixtures.js';
import { MODULE_FIELDS } from '../lib/modules.js';
import { fieldLabels } from '../lib/report-format.js';

const visual = {title:'机制图',caption:'原文支持规划与执行分离，本图用于说明具体关系。',kind:'paper-fact',evidenceIds:['P1.F1'],nodes:[{id:'a',label:'规划'},{id:'b',label:'执行'}],edges:[{from:'a',to:'b',label:'任务'}]};
test('diagram relationships and citations fail closed, including unsupported factual diagrams', () => {
  assert.deepEqual(validateVisual(visual,new Set(['P1.F1'])),visual);
  for(const bad of [
    {...visual,evidenceIds:['P99.F9']}, {...visual,evidenceIds:['R1']},
    {...visual,nodes:[visual.nodes[0],visual.nodes[0]]},
    {...visual,edges:[{from:'a',to:'missing',label:''}]},
    {...visual,nodes:Array.from({length:9},(_,i)=>({id:'n'+i,label:'x'}))},
  ]) assert.throws(()=>validateVisual(bad,new Set(['P1.F1','R1'])));
});
test('untrusted node labels cannot supply Mermaid syntax, HTML or click actions', () => {
  const source = visualMermaid({...visual,nodes:[{id:'a',label:'"]\nclick a "https://evil.test" <script> %%{init:x}'},visual.nodes[1]]});
  assert.equal(validateDiagram(source),source);
  assert.equal(source.split('\n').length,4);
  assert.doesNotMatch(source, /<script>|https:|%%\{|^click /m);
});
test('legacy reader groups sections and translates field names without touching body/code', () => {
  const source='# Title\n## 论文与技术解析\nsummary\n### inputProcessOutput\noriginal text\n```md\n## fake\n### fake field\n```\n## 原文证据索引\n### P1-F1\noriginal quote\n';
  const view=readingModel(source);
  assert.equal(view.chapters.length,2);
  assert.equal(view.chapters[0].label,'这项技术如何工作');
  assert.equal(view.chapters[0].details[0].label,'输入、处理与输出');
  assert.match(view.chapters[0].details[0].text,/## fake\n### fake field/);
  assert.equal(view.chapters[1].details[0].anchor,'p1-f1');
  assert.equal(view.chapters[1].details[0].text,'original quote\n');
  assert.equal(readingModel('plain text without sections').intro,'plain text without sections');
});
test('duplicate headings and long/unclosed fences keep stable unique navigation', () => {
  const view=readingModel('## A\n### X\n1\n## A\n### X\n2\n````md\n## B\n```\n### C\n');
  assert.deepEqual(view.chapters.map(c=>c.anchor),['a','a-1']);
  assert.deepEqual(view.chapters.map(c=>c.details[0].anchor),['x','x-1']);
  assert.match(view.chapters[1].details[0].text,/## B/);
});
test('all existing structured fields have readable Chinese names', () => {
  for (const field of Object.values(MODULE_FIELDS).flat()) assert.ok(fieldLabels[field],field);
});
test('full analysis yields four evidenced diagrams without additional model calls and exports all details', async () => {
  const doc={paper,coverage:'partial-text',warnings:['sampled'],chunks:[{id:'P1',locator:'p1',text:passage}],totalChunks:2,selectedChunks:1};
  const report=await analyzeDocument(doc,research,fakeModel(),parseConfig({maxChunks:1}));
  assert.equal(report.calls.length,6);
  assert.equal(report.promptVersion,'0.2.3');
  assert.equal(report.sections.filter(s=>s.visual).length,4);
  const md=renderReport(report);
  assert.equal(splitReport(md).filter(p=>p.type==='mermaid').length,4);
  for(const section of report.sections) for(const field of Object.keys(section.details)) assert.ok(md.includes(fieldLabels[field]),field);
  assert.match(md,/## 重点概览/);assert.match(md,/图示依据：\[P1.F1\]\(#p1-f1\)/);assert.match(md,/partial-text/);
  assert.doesNotMatch(md,/### inputProcessOutput/);
});
test('insufficient evidence can omit a diagram honestly and cannot coexist with a visual', () => {
  const section={id:'paper',summary:'An adequately long summary',visualOmission:'没有关于机制或执行步骤的原文证据，无法可靠绘图。',findings:[{statement:'Insufficient evidence for a mechanism diagram.',kind:'unknown',evidenceIds:[],confidence:'low',implication:'More evidence needed',validation:'Read full text'}]};
  assert.equal(validateReport({sections:[section]},['paper'],new Set()).length,1);
  assert.throws(()=>validateReport({sections:[{...section,visual}]},['paper'],new Set(['P1.F1'])),/不能同时/);
});
