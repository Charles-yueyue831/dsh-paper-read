import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AcademicHttp } from '../lib/http.js';
import { Archive, containedPath } from '../lib/storage.js';
import { ContentReader, htmlText, chunksFromSegments } from '../lib/content.js';
import { parseConfig } from '../lib/config.js';
import { paper, passage } from './fixtures.js';
const config = parseConfig();
async function temp(t) { const p = await fs.mkdtemp(path.join(os.tmpdir(), 'paper-test-')); t.after(() => fs.rm(p, { recursive: true, force: true })); return p; }

test('network blocks arbitrary hosts, credentials, ports and non-https', () => {
  const http = new AcademicHttp(config);
  for (const u of ['http://arxiv.org/abs/x', 'https://127.0.0.1/', 'https://arxiv.org:123/', 'https://user:pass@arxiv.org/', 'https://example.com/']) assert.throws(() => http.validate(u));
});
test('redirect destinations are validated before fetching', async () => {
  let calls = 0; const http = new AcademicHttp(config, { delayScale: 0, fetchImpl: async () => { calls++; return new Response('', { status: 302, headers: { location: 'http://localhost/private' } }); } });
  await assert.rejects(http.get('https://arxiv.org/pdf/x'), /未允许/); assert.equal(calls, 1);
});
test('HTTP retries transient failures with an upper bound', async () => {
  let calls = 0; const http = new AcademicHttp(config, { delayScale: 0, fetchImpl: async () => new Response(++calls < 3 ? 'busy' : '{}', { status: calls < 3 ? 429 : 200 }) });
  assert.deepEqual(await http.json('https://api.openalex.org/works'), {}); assert.equal(calls, 3);
});
test('stream size limits work without content-length', async () => {
  const http = new AcademicHttp(config, { delayScale: 0, fetchImpl: async () => new Response('abcdef') });
  await assert.rejects(http.get('https://arxiv.org/pdf/x', { maxBytes: 3 }), /超过大小/);
});
test('aborted requests never perform a fetch', async () => {
  const http = new AcademicHttp(config, { fetchImpl: async () => { throw new Error('must not fetch'); } }); const ac = new AbortController(); ac.abort();
  await assert.rejects(http.get('https://arxiv.org/pdf/x', { signal: ac.signal }), { name: 'AbortError' });
});
test('HTML extraction removes executable content and preserves math alttext', () => {
  const text = htmlText('<article><h1>Paper</h1><p>A <math alttext="x=y">hidden</math></p><script>steal()</script></article>');
  assert.match(text, /x=y/); assert.doesNotMatch(text, /steal/);
});
test('chunk limits sample across document and expose incomplete coverage', () => {
  const result = chunksFromSegments([{ locator: 'text', text: 'a'.repeat(10000) }], 2000, 2);
  assert.equal(result.totalChunks, 5); assert.equal(result.truncated, true); assert.deepEqual(result.chunks.map(c => c.id), ['P1', 'P5']);
});
test('storage rejects traversal, absolute paths and symlinks', async t => {
  const root = await temp(t); const outside = await temp(t); await fs.symlink(outside, path.join(root, 'link'));
  await assert.rejects(containedPath(root, '../escape')); await assert.rejects(containedPath(root, outside));
  await assert.rejects(containedPath(root, 'link/report', { create: true }), /符号链接/);
});
test('read-only archive does not create directories', async t => {
  const root = await temp(t); const archive = new Archive(root, 'out', false);
  await assert.rejects(archive.start(paper, 'a'.repeat(20)), /只读/); assert.deepEqual(await fs.readdir(root), []);
});
test('archive writes complete manifests and concurrent runs do not overwrite', async t => {
  const root = await temp(t); const archive = new Archive(root, 'out', true); const key = 'a'.repeat(20);
  const runs = await Promise.all([archive.start(paper, key), archive.start(paper, key)]); assert.notEqual(runs[0].folder, runs[1].folder);
  await archive.write(runs[0], 'report.md', '# test'); await archive.finish(runs[0], 'completed');
  assert.equal((await archive.list()).length, 2); assert.equal((await archive.read(key, runs[0].runId)).markdown, '# test');
  await assert.rejects(archive.read('../bad', runs[0].runId));
});
test('local import cannot escape workspace and marks sampled text', async t => {
  const root = await temp(t); await fs.writeFile(path.join(root, 'paper.txt'), passage.repeat(5));
  const reader = new ContentReader({}, parseConfig({ maxChunks: 1, chunkChars: 2000 }));
  const doc = await reader.local('paper.txt', root); assert.equal(doc.coverage, 'partial-text');
  await assert.rejects(reader.local('../other.txt', root));
});
