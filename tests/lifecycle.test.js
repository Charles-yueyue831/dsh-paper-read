import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AcademicHttp } from '../lib/http.js';
import { PaperInsight } from '../lib/service.js';
import { parseConfig } from '../lib/config.js';
import { paper, passage, research, fakeModel } from './fixtures.js';
const config = parseConfig({ maxChunks: 1 });
test('transport failures are retried but never indefinitely', async () => {
  let count = 0; const http = new AcademicHttp(config, { delayScale: 0, fetchImpl: async () => { count++; if (count < 3) throw new TypeError('fetch failed'); return new Response('{}'); } });
  assert.deepEqual(await http.json('https://api.openalex.org/works'), {}); assert.equal(count, 3);
});
test('cancellation during model processing records cancelled and releases run lock', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'paper-cancel-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const ac = new AbortController();
  const model = { route: { provider: 'fixture', model: 'fixture' }, calls: [], generate: async () => { ac.abort(); ac.signal.throwIfAborted(); } };
  const doc = { paper, coverage: 'abstract-only', warnings: [], chunks: [{ id: 'P1', locator: 'Abstract', text: passage }], segments: [{ locator: 'Abstract', text: passage }], totalChunks: 1, selectedChunks: 1 };
  const service = new PaperInsight({ sandboxPolicy: { resolve: () => ({ mode: 'workspace-write', workspaceRoot: root }) } }, config,
    { sources: { resolve: async () => paper, related: async () => research }, reader: { read: async () => doc }, makeModel: () => model });
  await assert.rejects(service.analyze({ reference: paper.id }, { signal: ac.signal }));
  assert.equal(service.busy, false); assert.equal((await service.archive({}).list())[0].status, 'cancelled');
});
test('batch continues after a failed paper and deduplicates exact input identifiers', async () => {
  const service = new PaperInsight({ sandboxPolicy: { resolve: () => ({ mode: 'workspace-write', workspaceRoot: '/tmp' }) } }, config);
  service.analyzeOne = async ({ reference }) => { if (reference === 'bad') throw new Error('unavailable'); return { status: 'completed', reference }; };
  const result = await service.batch({ references: ['bad', 'good', 'good'] }, { signal: new AbortController().signal });
  assert.equal(result.failed, 1); assert.equal(result.completed, 1); assert.equal(service.busy, false);
});
