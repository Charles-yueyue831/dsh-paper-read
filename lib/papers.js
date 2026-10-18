import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { safeError, checkAbort, isoNow } from './config.js';

const asArray = x => x == null ? [] : Array.isArray(x) ? x : [x];
const clean = x => String(x || '').replace(/\s+/g, ' ').trim();
const text = x => typeof x === 'object' && x ? (x.value ?? x['#text'] ?? '') : x;
export const stripVersion = id => id?.replace(/v\d+$/, '');
export const paperKey = p => createHash('sha256').update(p.doi?.toLowerCase() || stripVersion(p.arxivId) || p.id).digest('hex').slice(0, 20);
export function normalizePaper(p) {
  return { id: String(p.id), title: clean(p.title), authors: (p.authors || []).map(clean), abstract: clean(p.abstract),
    published: p.published || null, year: p.year || Number(p.published?.slice(0, 4)) || null,
    doi: p.doi?.replace(/^https?:\/\/(?:dx\.)?doi.org\//i, '').toLowerCase() || null,
    arxivId: p.arxivId || null, url: p.url || '', pdfUrl: p.pdfUrl || null,
    institutions: p.institutions || [], venue: p.venue || '', citationCount: p.citationCount ?? null, sources: p.sources || [],
    retrievedAt: isoNow() };
}
export function parseArxiv(xml) {
  const feed = new XMLParser({ ignoreAttributes: false, processEntities: false }).parse(xml).feed;
  return asArray(feed?.entry).filter(e => e.id && !String(e.id).includes('/errors')).map(e => {
    const id = String(e.id).split('/abs/')[1];
    return normalizePaper({ id: `arxiv:${id}`, arxivId: id, title: text(e.title), abstract: text(e.summary),
      authors: asArray(e.author).map(a => text(a.name)), published: text(e.published)?.slice(0, 10),
      doi: text(e['arxiv:doi']) || null, url: `https://arxiv.org/abs/${id}`, pdfUrl: `https://arxiv.org/pdf/${id}`,
      sources: ['arxiv'], venue: text(e['arxiv:journal_ref']) || 'arXiv' });
  });
}
export function parseOpenReview(data) {
  return (data.notes || []).filter(n => n.content?.title && (!n.replyto || n.replyto === n.id)).map(n => {
    const c = n.content;
    return normalizePaper({ id: `openreview:${n.id}`, title: text(c.title), abstract: text(c.abstract), authors: asArray(text(c.authors)),
      published: (n.pdate || n.cdate) ? new Date(n.pdate || n.cdate).toISOString().slice(0, 10) : null,
      url: `https://openreview.net/forum?id=${n.id}`, pdfUrl: c.pdf ? new URL(text(c.pdf), 'https://openreview.net').href : null,
      venue: text(c.venue) || text(c.venueid) || 'OpenReview', sources: ['openreview'] });
  });
}
export function parseSemantic(p) {
  return normalizePaper({ id: `s2:${p.paperId}`, title: p.title, abstract: p.abstract, authors: (p.authors || []).map(a => a.name),
    published: p.publicationDate, year: p.year, doi: p.externalIds?.DOI || null, arxivId: p.externalIds?.ArXiv || null,
    url: p.url, pdfUrl: p.openAccessPdf?.url || null, venue: p.venue, citationCount: p.citationCount, sources: ['semantic-scholar'] });
}
export function parseOpenAlex(p) {
  const words = [];
  for (const [word, positions] of Object.entries(p.abstract_inverted_index || {})) {
    for (const index of positions) if (Number.isInteger(index) && index >= 0 && index < 30000) words[index] = word;
  }
  const arxivUrl = (p.locations || []).map(l => l.landing_page_url || '').find(u => /arxiv.org\/abs\//.test(u));
  return normalizePaper({ id: `openalex:${p.id.split('/').at(-1)}`, title: p.title, abstract: words.join(' '),
    authors: (p.authorships || []).map(a => a.author.display_name), institutions: [...new Set((p.authorships || []).flatMap(a => (a.institutions || []).map(i => i.display_name)))], published: p.publication_date, year: p.publication_year,
    doi: p.doi?.replace('https://doi.org/', '') || null, arxivId: arxivUrl?.split('/abs/')[1] || null,
    url: p.primary_location?.landing_page_url || p.id, pdfUrl: p.best_oa_location?.pdf_url || null,
    venue: p.primary_location?.source?.display_name || '', citationCount: p.cited_by_count, sources: ['openalex'] });
}
export function parseCrossref(p) {
  const d=(p.published?.['date-parts'] || p.created?.['date-parts'] || [])[0];
  return normalizePaper({id:`doi:${p.DOI}`,doi:p.DOI,title:p.title?.[0],abstract:p.abstract?.replace(/<[^>]+>/g,' '),authors:(p.author || []).map(a=>[a.given,a.family].filter(Boolean).join(' ')),institutions:(p.author || []).flatMap(a=>(a.affiliation || []).map(i=>i.name)),published:d ? [d[0],String(d[1] || 1).padStart(2,'0'),String(d[2] || 1).padStart(2,'0')].join('-') : null,venue:p['container-title']?.[0],url:p.URL,citationCount:p['is-referenced-by-count'],sources:['crossref']});
}
export function deduplicate(papers) {
  const groups = []; const aliases = new Map();
  for (const p of papers) {
    const keys = [p.doi && `doi:${p.doi.toLowerCase()}`, p.arxivId && `arxiv:${stripVersion(p.arxivId)}`,
      p.title && `title:${p.title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')}`].filter(Boolean);
    const matches = [...new Set(keys.map(k => aliases.get(k)).filter(Boolean))];
    const record = matches[0] || { ...p, sources: [...p.sources] };
    if (!matches.length) groups.push(record);
    const merged = [...matches.slice(1), p];
    for (const other of merged) {
      record.sources = [...new Set([...record.sources, ...other.sources])];
      record.institutions = [...new Set([...(record.institutions || []), ...(other.institutions || [])])];
      if(other.citationCount != null) record.citationCount = Math.max(record.citationCount ?? 0,other.citationCount);
      if(!record.year && other.year) record.year=other.year;
      for (const key of ['abstract', 'doi', 'arxivId', 'pdfUrl', 'published', 'venue']) if (!record[key] && other[key]) record[key] = other[key];
      if (other.abstract?.length > record.abstract.length) record.abstract = other.abstract;
      if (other.arxivId && stripVersion(other.arxivId) === stripVersion(record.arxivId) && Number(other.arxivId.match(/v(\d+)$/)?.[1] || 0) > Number(record.arxivId.match(/v(\d+)$/)?.[1] || 0)) {
        record.arxivId = other.arxivId; record.id = other.id; record.pdfUrl = other.pdfUrl; record.url = other.url;
      }
      if (matches.includes(other) && other !== record) {
        groups.splice(groups.indexOf(other), 1);
        for (const [key, value] of aliases) if (value === other) aliases.set(key, record);
      }
    }
    for (const key of keys) aliases.set(key, record);
  }
  return groups;
}

const S2_FIELDS = 'title,abstract,authors,year,publicationDate,venue,url,externalIds,openAccessPdf,citationCount';
const titleTokens = s => clean(s).toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
function relevance(paper, query) {
  const q = titleTokens(query); const t = titleTokens(paper.title);
  if (q.join(' ') === t.join(' ')) return 2;
  const words = new Set(t);
  return q.filter(word => words.has(word)).length / Math.max(1, q.length);
}
export class PaperSources {
  constructor(http, config) { this.http = http; this.config = config; }
  async oneSearch(source, query, limit, signal, offset = 0, sort = 'relevance') {
    const q = encodeURIComponent(query);
    switch (source) {
      case 'arxiv': return parseArxiv(await this.http.text(`https://export.arxiv.org/api/query?search_query=all:${q}&start=${offset}&max_results=${limit}&sortBy=${sort === 'date' ? 'submittedDate' : 'relevance'}&sortOrder=descending`, { signal }));
      case 'openreview': return parseOpenReview(await this.http.json(`https://api2.openreview.net/notes/search?term=${q}&limit=${limit}&offset=${offset}`, { signal }));
      case 'semantic-scholar': return (await this.http.json(`https://api.semanticscholar.org/graph/v1/paper/search?query=${q}&limit=${limit}&offset=${offset}&fields=${S2_FIELDS}`, { signal })).data?.map(parseSemantic) || [];
      case 'openalex': return (await this.http.json(`https://api.openalex.org/works?search=${q}&per_page=${limit}&page=${Math.floor(offset / limit) + 1}${sort === 'date' ? '&sort=publication_date:desc' : ''}`, { signal })).results?.map(parseOpenAlex) || [];
      case 'crossref': return (await this.http.json(`https://api.crossref.org/works?query=${q}&rows=${limit}`, { signal })).message.items.map(parseCrossref);
      default: throw new Error(`未知来源：${source}`);
    }
  }
  async search({ query, limit = 10, sources = this.config.sources, since, until, sort = 'relevance', author, institution, venue, minCitations }, signal) {
    const results = await Promise.allSettled(sources.map(s => this.oneSearch(s, query, Math.min(100, limit * 2), signal, 0, sort)));
    checkAbort(signal); const errors = []; const found = [];
    results.forEach((r, i) => r.status === 'fulfilled' ? found.push(...r.value) : errors.push({ source: sources[i], error: safeError(r.reason) }));
    const contains = (value, filter) => !filter || String(value).toLowerCase().includes(filter.toLowerCase());
    const papers = deduplicate(found).filter(p => contains(p.authors.join(' '), author) && contains(p.institutions?.join(' ') || '', institution) && contains(p.venue, venue) && (minCitations == null || p.citationCount != null && p.citationCount >= minCitations)).filter(p => (!since || p.published && p.published >= since) && (!until || p.published && p.published <= until))
      .sort((a, b) => (sort === 'relevance' ? relevance(b, query) - relevance(a, query) : sort === 'citations' ? (b.citationCount ?? -1) - (a.citationCount ?? -1) : 0) || String(b.published || '').localeCompare(String(a.published || ''))).slice(0, limit);
    if (errors.length === sources.length) throw new Error(`所有来源失败：${errors.map(e => `${e.source}: ${e.error}`).join('; ')}`);
    return { query, sort, filters: {author:author || null,institution:institution || null,venue:venue || null,minCitations:minCitations ?? null}, searchedAt: isoNow(), since: since || null, until: until || null, papers, errors,
      coverage: '有界候选检索；每源最多 limit×2 条后按元数据过滤。缺失机构/引用量的候选不会满足相应筛选，不代表完整收录。' };
  }
  async resolve(reference, signal) {
    let ref = reference.trim();
    if (/^https:\/\/(www\.)?arxiv.org\/(abs|pdf|html)\//.test(ref)) ref = `arxiv:${new URL(ref).pathname.replace(/^\/(abs|pdf|html)\//, '').replace(/\.pdf$/, '')}`;
    if (/^\d{4}\.\d{4,5}(v\d+)?$/.test(ref)) ref = `arxiv:${ref}`;
    if (/^https:\/\/openreview.net\//.test(ref)) ref = `openreview:${new URL(ref).searchParams.get('id')}`;
    ref = ref.replace(/^https:\/\/(dx\.)?doi.org\//, 'doi:');
    if (/^10\.\d{4,9}\//.test(ref)) ref = `doi:${ref}`;
    let papers;
    if (ref.startsWith('arxiv:')) {
      const id = ref.slice(6);
      if (!/^(?:\d{4}\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/\d{7})(?:v\d+)?$/.test(id)) throw new Error('无效 arXiv ID');
      papers = parseArxiv(await this.http.text(`https://export.arxiv.org/api/query?id_list=${encodeURIComponent(id)}`, { signal }));
    } else if (ref.startsWith('openreview:')) {
      const id = ref.slice(11); if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('无效 OpenReview ID');
      papers = parseOpenReview(await this.http.json(`https://api2.openreview.net/notes?id=${encodeURIComponent(id)}`, { signal }));
    } else if (ref.startsWith('openalex:')) {
      const id = ref.slice(9); if (!/^W\d+$/.test(id)) throw new Error('无效 OpenAlex ID');
      papers = [parseOpenAlex(await this.http.json(`https://api.openalex.org/works/${id}`, { signal }))];
    } else if (/^(doi:|s2:)/.test(ref)) {
      const id = ref.startsWith('doi:') ? `DOI:${ref.slice(4)}` : ref.slice(3);
      try { papers = [parseSemantic(await this.http.json(`https://api.semanticscholar.org/graph/v1/paper/${encodeURIComponent(id)}?fields=${S2_FIELDS}`, { signal }))]; }
      catch (error) {
        checkAbort(signal); if (!ref.startsWith('doi:')) throw error;
        try { papers = [parseOpenAlex(await this.http.json(`https://api.openalex.org/works/https://doi.org/${encodeURIComponent(ref.slice(4))}`, { signal }))]; }
        catch (e) { checkAbort(signal); papers = [parseCrossref((await this.http.json(`https://api.crossref.org/works/${encodeURIComponent(ref.slice(4))}`, { signal })).message)]; }
      }
    } else throw new Error('请使用 arXiv ID/链接、OpenReview 链接、DOI、s2:ID 或 openalex:ID；标题请先搜索。');
    if (!papers?.length) throw new Error('未找到论文'); return papers[0];
  }
  async related(paper, signal) {
    const errors = []; const references = []; const citations = []; let discovery = [];
    const id = paper.doi ? `DOI:${paper.doi}` : paper.arxivId ? `ARXIV:${stripVersion(paper.arxivId)}` : paper.id.startsWith('s2:') ? paper.id.slice(3) : null;
    if (id) {
      const responses = await Promise.allSettled(['references', 'citations'].map(kind =>
        this.http.json(`https://api.semanticscholar.org/graph/v1/paper/${encodeURIComponent(id)}/${kind}?limit=${this.config.maxRelated}&fields=${S2_FIELDS}`, { signal })));
      responses.forEach((r, i) => {
        if (r.status === 'rejected') errors.push({ source: `semantic-scholar/${i ? 'citations' : 'references'}`, error: safeError(r.reason) });
        else for (const row of r.value.data || []) {
          const p = row.citedPaper || row.citingPaper;
          if (p?.paperId) (i ? citations : references).push(parseSemantic(p));
        }
      });
    }
    if (!references.length && paper.doi) {
      try {
        const item = (await this.http.json(`https://api.crossref.org/works/${encodeURIComponent(paper.doi)}`, { signal })).message;
        for (const [i, r] of (item.reference || []).slice(0, this.config.maxRelated).entries()) {
          references.push(normalizePaper({ id: r.DOI ? `doi:${r.DOI}` : `crossref-reference:${i}`, title: r['article-title'] || r.unstructured || '(Crossref 未提供标题)',
            authors: r.author ? [r.author] : [], doi: r.DOI || null, year: Number(r.year) || null, url: r.DOI ? `https://doi.org/${r.DOI}` : '', sources: ['crossref'] }));
        }
      } catch (e) { checkAbort(signal); errors.push({ source: 'crossref', error: safeError(e) }); }
    }
    try { discovery = await this.oneSearch('openalex', paper.title.split(/\s+/).slice(0, 10).join(' '), this.config.maxRelated, signal); }
    catch (e) { checkAbort(signal); errors.push({ source: 'openalex', error: safeError(e) }); }
    checkAbort(signal);
    const key = paperKey(paper);
    const tag = (rows, relation, prefix) => deduplicate(rows).filter(p => paperKey(p) !== key).map((p, i) => ({ ...p, evidenceId: `${prefix}${i + 1}`, relation, evidenceLevel: 'metadata-and-abstract' }));
    return { retrievedAt: isoNow(), references: tag(references, 'cited-by-target', 'R'), citations: tag(citations, 'cites-target', 'C'),
      discovery: tag(discovery, 'topic-search-only', 'D'), errors, coverage: `每类至多 ${this.config.maxRelated} 篇，非系统综述；主题搜索不证明引用或技术继承关系。` };
  }
}
