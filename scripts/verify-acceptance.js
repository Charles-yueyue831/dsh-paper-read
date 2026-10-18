// Verify artifacts from a real `dsh headless --json` run. This never invokes a model.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { sections, validateExtraction, validateReport } from '../lib/analysis.js';
const [tracePath, folder] = process.argv.slice(2);
if (!tracePath || !folder) throw new Error('Usage: node scripts/verify-acceptance.js <trace.jsonl> <report-folder>');
const trace = (await fs.readFile(tracePath, 'utf8')).trim().split('\n').map(JSON.parse);
const read = async name => JSON.parse(await fs.readFile(path.join(folder, name), 'utf8'));
const manifest = await read('manifest.json'); const report = await read('report.json'); const doc = await read('document.json');
assert.equal(manifest.status, 'completed');
assert.equal(report.coverage, 'extracted-text');
assert.ok(trace.some(e => e.type === 'session'));
assert.ok(trace.some(e => e.type === 'tool_call' && e.tool === 'paper_insight_search'));
const searchCalls = new Set(trace.filter(e => e.type === 'tool_call' && e.tool === 'paper_insight_search').map(e => e.callId));
assert.ok(trace.some(e => e.type === 'tool_result' && searchCalls.has(e.callId) && e.status === 'completed' && e.result.includes(report.paper.title)));
const analysisCalls = new Set(trace.filter(e => e.type === 'tool_call' && ['paper_insight_analyze','paper_insight_resume'].includes(e.tool)).map(e => e.callId));
assert.ok(trace.some(e => e.type === 'tool_result' && analysisCalls.has(e.callId) && e.status === 'completed' && e.result.includes(manifest.runId)));
assert.ok(trace.some(e => e.type === 'final' && e.text?.trim()));
assert.ok(trace.some(e => e.type === 'status' && e.phase === 'turn_end' && e.reason?.kind === 'completed'));
const calls=[...(report.priorCalls || []),...report.calls];
assert.ok(calls.length >= doc.chunks.length + 5);
assert.ok(report.calls.every(c => c.provider === report.model.provider && c.model === report.model.model));
assert.ok(!/fixture|mock|synthetic/i.test(report.model.model));
assert.equal(report.evidence.length, doc.chunks.length);
for (let i = 0; i < doc.chunks.length; i++) {
  const e = report.evidence[i];
  validateExtraction({ summary: e.summary, facts: e.facts.map(({ statement, quote }) => ({ statement, quote })) }, doc.chunks[i]);
}
const refs = [...report.research.references, ...report.research.citations, ...report.research.discovery];
const known = new Set([...report.evidence.flatMap(e => e.facts.map(f => f.id)), ...refs.map(r => r.evidenceId)]);
validateReport({ sections: report.sections }, sections.map(([id]) => id), known);
assert.ok(report.sections.every(s => s.findings.length >= 2));
const files = [];
for (const name of ['manifest.json', 'document.json', 'source.txt', 'evidence.json', 'references.json', 'report.json', 'report.md', 'references.bib']) {
  const bytes = await fs.readFile(path.join(folder, name)); assert.ok(bytes.length > 0);
  files.push({ name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
console.log(JSON.stringify({ passed: true, paper: report.paper.title, reference: report.paper.id, coverage: report.coverage,
  chunks: doc.chunks.length, evidenceQuotes: report.evidence.reduce((n, e) => n + e.facts.length, 0), sections: report.sections.map(s => s.id),
  findings: report.sections.reduce((n, s) => n + s.findings.length, 0), relatedReferences: refs.length,
  modelCalls: calls.length, currentRunModelCalls: report.calls.length, sourceGaps: report.research.errors.map(e => e.source), files }, null, 2));
