import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArxiv, parseOpenReview, parseSemantic, parseOpenAlex, normalizePaper, deduplicate, PaperSources } from '../lib/papers.js';
import { parseConfig } from '../lib/config.js';
import { paper } from './fixtures.js';

test('arXiv Atom handles singleton author, DOI and versions', () => {
  const [p] = parseArxiv('<feed><entry><id>http://arxiv.org/abs/2601.00001v2</id><title>A paper</title><summary>Some abstract</summary><author><name>Alice</name></author><published>2026-01-01T00:00:00Z</published><arxiv:doi>10.1234/x</arxiv:doi></entry></feed>');
  assert.equal(p.arxivId, '2601.00001v2'); assert.equal(p.doi, '10.1234/x'); assert.deepEqual(p.authors, ['Alice']);
});
test('arXiv error entries never masquerade as papers', () => assert.deepEqual(parseArxiv('<feed><entry><id>http://arxiv.org/api/errors#bad_query</id></entry></feed>'), []));
test('OpenReview handles API v2 fields and excludes replies', () => {
  const notes = [{ id: 'id1', content: { title: { value: 'A title' }, authors: { value: ['A'] }, pdf: { value: '/pdf?id=id1' } }, cdate: 1767225600000 },
    { id: 'comment', replyto: 'id1', content: { title: { value: 'Comment' } } }];
  const parsed = parseOpenReview({ notes }); assert.equal(parsed.length, 1); assert.equal(parsed[0].pdfUrl, 'https://openreview.net/pdf?id=id1');
});
test('normalized provider results contain no undefined values', () => {
  for (const p of [parseSemantic({ paperId: '1', title: 'A' }), parseOpenAlex({ id: 'https://openalex.org/W1', title: 'B' }), normalizePaper({ id: 'x', title: 'c' })]) assert.deepEqual(p, JSON.parse(JSON.stringify(p)));
});
test('OpenAlex reconstructs abstract and rejects excessive positions', () => {
  const p = parseOpenAlex({ id: 'https://openalex.org/W1', abstract_inverted_index: { AI: [0], works: [1], bad: [100000000] } }); assert.equal(p.abstract, 'AI works');
});
test('dedup merges DOI/title bridges and preserves latest arXiv version', () => {
  const rows = [{ ...paper }, { ...paper, id: 'arxiv:2601.00001v3', arxivId: '2601.00001v3', sources: ['arxiv'] },
    { ...paper, id: 's2:x', arxivId: null, doi: '10.1234/x', sources: ['semantic-scholar'] }];
  const found = deduplicate(rows); assert.equal(found.length, 1); assert.equal(found[0].arxivId, '2601.00001v3'); assert.equal(found[0].doi, '10.1234/x'); assert.equal(found[0].sources.length, 2);
});
test('partial search failure remains visible and date filtering is inclusive', async () => {
  const sources = new PaperSources({}, parseConfig()); sources.oneSearch = async s => { if (s === 'arxiv') throw new Error('offline'); return [paper, { ...paper, id: 'old', title: 'Old', arxivId: null, published: '2025-01-01' }]; };
  const out = await sources.search({ query: 'agents', sources: ['arxiv', 'openalex'], since: '2026-01-01', until: '2026-01-01' });
  assert.equal(out.papers.length, 1); assert.equal(out.errors.length, 1);
});
test('all sources failing throws instead of reporting empty success', async () => {
  const sources = new PaperSources({}, parseConfig()); sources.oneSearch = async () => { throw new Error('offline'); };
  await assert.rejects(sources.search({ query: 'agents' }), /所有来源失败/);
});
test('abort is preserved even if a source catches a failure', async () => {
  const sources = new PaperSources({}, parseConfig()); sources.oneSearch = async () => []; const ac = new AbortController(); ac.abort();
  await assert.rejects(sources.search({ query: 'x' }, ac.signal), { name: 'AbortError' });
});
test('an exact classic title outranks newer mentions unless date order is requested', async () => {
  const sources = new PaperSources({}, parseConfig());
  sources.oneSearch = async () => [
    normalizePaper({ id: 'new', title: 'A survey of reasoning', published: '2026-01-01' }),
    normalizePaper({ id: 'classic', title: 'ReAct: Synergizing Reasoning and Acting', published: '2022-10-06' }),
  ];
  const request = { query: 'ReAct: Synergizing Reasoning and Acting', sources: ['openalex'] };
  assert.equal((await sources.search(request)).papers[0].id, 'classic');
  assert.equal((await sources.search({ ...request, sort: 'date' })).papers[0].id, 'new');
});
