import { AcademicHttp } from '../lib/http.js';
import { PaperSources } from '../lib/papers.js';
import { ContentReader } from '../lib/content.js';
import { parseConfig, safeError } from '../lib/config.js';
const config = parseConfig({ httpTimeoutMs: 45000, maxChunks: 2 });
const http = new AcademicHttp(config); const sources = new PaperSources(http, config);
const output = { checkedAt: new Date().toISOString(), sources: [] };
for (const source of config.sources) {
  try { const result = await sources.oneSearch(source, 'language model', 2); output.sources.push({ source, ok: true, count: result.length, title: result[0]?.title }); }
  catch (e) { output.sources.push({ source, ok: false, error: safeError(e) }); }
}
try {
  const paper = await sources.resolve('1706.03762'); const doc = await new ContentReader(http, config).read(paper);
  output.read = { ok: true, title: paper.title, coverage: doc.coverage, format: doc.format, extractedChars: doc.extractedChars };
} catch (e) { output.read = { ok: false, error: safeError(e) }; }
console.log(JSON.stringify(output, null, 2));
if (!output.sources.some(s => s.ok) || !output.read.ok) process.exitCode = 1;
