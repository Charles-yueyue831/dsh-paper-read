import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { load } from 'cheerio';
import { containedPath } from './storage.js';
import { checkAbort, safeError } from './config.js';
import { normalizePaper } from './papers.js';
import { chapterRanges, chooseChunks, textHash } from './coverage.js';

export function htmlText(html) {
  const $ = load(html);
  $('script, style, nav, header, footer, form, noscript, .ltx_page_header, .ltx_page_footer').remove();
  const article = $('article').first(); const main = article.length ? article : $('main').first();
  const root = main.length ? main : $('body');
  root.find('h1,h2,h3,h4,p,li,figure,figcaption,tr,section,div').each((_, e) => { $(e).prepend('\n'); $(e).append('\n'); });
  root.find('math').each((_, e) => { const alt = $(e).attr('alttext'); if (alt) $(e).replaceWith(` ${alt} `); });
  return root.text().replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n\n').trim();
}
export function chunksFromSegments(segments, chunkChars, maxChunks) {
  const chunks = [];
  const ranges = chapterRanges(segments);
  for (const [segmentIndex, segment] of segments.entries()) {
    let offset = 0;
    while (offset < segment.text.length) {
      let end = Math.min(segment.text.length, offset + chunkChars);
      if (end < segment.text.length) {
        const split = segment.text.lastIndexOf('\n', end);
        if (split > offset + chunkChars / 2) end = split + 1;
      }
      chunks.push({ id: `P${chunks.length + 1}`, locator: `${segment.locator}; chars ${offset + 1}-${end}`, text: segment.text.slice(offset, end), chapters:[...new Set(ranges[segmentIndex].filter(r=>r.start<end&&r.end>offset).map(r=>r.chapter))] });
      offset = end;
    }
  }
  const total = chunks.length;
  // Spread retained chunks across the paper; do not silently read only the introduction.
  const chosen = chooseChunks(chunks, maxChunks);
  return { chunks: chosen, allChunks: chunks, chunkChars, totalChunks: total, selectedChunks: chosen.length, truncated: total > maxChunks };
}

export function selectDocument(document, {modules=[], supplementChapters=[]}={}, config, evidence=[]) {
  let all=document.allChunks;
  if(!all){
    const candidates=[document.chunkChars,config.chunkChars,Math.max(...document.chunks.map(c=>c.text.length))].filter(Boolean);
    for(const size of document.segments ? candidates : []){
      const rebuilt=chunksFromSegments(document.segments,size,Number.MAX_SAFE_INTEGER);
      if(rebuilt.totalChunks===document.totalChunks && document.chunks.every(c=>rebuilt.allChunks.some(n=>n.id===c.id&&n.text===c.text&&n.locator===c.locator))){all=rebuilt.allChunks;break;}
    }
    if(!all && supplementChapters.length)throw new Error('旧材料的分块参数无法可靠恢复，请重新导入论文后补充分析。');
    if(!all)return document;
  }
  let chosen=document.chunks;
  if(supplementChapters.length){
    const processed=new Set(evidence.filter(e=>all.some(c=>c.id===e.chunkId&&textHash(c.text)===e.textHash)).map(e=>e.chunkId));
    const added=all.filter(c=>c.chapters.some(x=>supplementChapters.includes(x))&&!processed.has(c.id));
    if(!added.length)throw new Error('所选章节没有可补充的未处理片段。');
    chosen=all.filter(c=>processed.has(c.id)||added.slice(0,config.maxChunks).includes(c));
  }else if(!evidence.length)chosen=chooseChunks(all,config.maxChunks,modules);
  return {...document,allChunks:all,chunks:chosen,selectedChunks:chosen.length,truncated:chosen.length<document.totalChunks,
    coverage:document.format==='abstract'?'abstract-only':chosen.length<document.totalChunks||document.pageLimitReached?'partial-text':'extracted-text'};
}

export async function pdfSegments(bytes, config, signal) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  checkAbort(signal);
  const standardFontDataUrl = fileURLToPath(new URL('standard_fonts/', import.meta.resolve('pdfjs-dist/package.json')));
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, disableFontFace: true, useSystemFonts: false, standardFontDataUrl });
  const cancel = () => { void task.destroy().catch(() => {}); };
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    const pdf = await task.promise; const segments = [];
    for (let n = 1; n <= Math.min(pdf.numPages, config.maxPages); n++) {
      checkAbort(signal); const page = await pdf.getPage(n); const content = await page.getTextContent();
      segments.push({ locator: `PDF page ${n}`, text: content.items.map(i => i.str == null ? '' : i.str + (i.hasEOL ? '\n' : ' ')).join('') });
      page.cleanup();
    }
    return { segments, pages: pdf.numPages, pageLimitReached: pdf.numPages > config.maxPages };
  } finally { signal?.removeEventListener('abort', cancel); await task.destroy(); }
}
export class ContentReader {
  constructor(http, config) { this.http = http; this.config = config; }
  async read(paper, signal) {
    const warnings = []; let segments = []; let format = 'abstract'; let url = paper.url; let pageLimitReached = false;
    if (paper.arxivId) {
      try {
        const result = await this.http.get(`https://arxiv.org/html/${paper.arxivId}`, { signal });
        const body = result.bytes.toString('utf8'); const $ = load(body);
        if (!$('article, .ltx_document').length) throw new Error('未获得可识别的论文 HTML');
        const text = htmlText(body); if (text.length < 1000) throw new Error('HTML 正文不足');
        segments = [{ locator: 'arXiv HTML extracted text', text }]; format = 'html'; url = result.url;
      } catch (e) { checkAbort(signal); warnings.push(`HTML：${safeError(e)}`); }
    }
    if (!segments.length && paper.pdfUrl) {
      try {
        const result = await this.http.get(paper.pdfUrl.replace(/^http:/, 'https:'), { signal });
        if (result.bytes.subarray(0, 5).toString() !== '%PDF-') throw new Error('来源返回的不是 PDF');
        const extracted = await pdfSegments(result.bytes, this.config, signal);
        segments = extracted.segments; pageLimitReached = extracted.pageLimitReached; format = 'pdf'; url = result.url;
      } catch (e) { checkAbort(signal); warnings.push(`PDF：${safeError(e)}`); }
    }
    if (!segments.some(s => s.text.trim().length > 100)) {
      if (!paper.abstract) throw new Error('正文与摘要均不可用；扫描 PDF 请先 OCR 后以文本导入。');
      segments = [{ locator: 'Abstract only', text: paper.abstract }]; format = 'abstract';
      warnings.push('仅获得摘要，不能据此确认完整方法、实验或消融结论。');
    }
    return this.package(paper, segments, format, url, warnings, pageLimitReached);
  }
  async url(reference, signal) {
    const result=await this.http.get(reference,{signal});
    if(result.bytes.subarray(0,5).toString()==='%PDF-') {
      const extracted=await pdfSegments(result.bytes,this.config,signal);
      return this.package(normalizePaper({id:`url:${result.url}`,title:new URL(result.url).pathname.split('/').pop(),url:result.url,pdfUrl:result.url,sources:['open-url']}),extracted.segments,'pdf',result.url,['直接 PDF 导入：出版元数据待核实'],extracted.pageLimitReached);
    }
    const $=load(result.bytes.toString('utf8'));const meta=n=>$(`meta[name="${n}"]`).attr('content');
    const paper=normalizePaper({id:`url:${result.url}`,title:meta('citation_title') || $('h1').first().text(),authors:$('meta[name="citation_author"]').map((_,e)=>$(e).attr('content')).get(),doi:meta('citation_doi'),url:result.url,pdfUrl:meta('citation_pdf_url') ? new URL(meta('citation_pdf_url'),result.url).href:null,sources:['open-url']});
    if(!paper.title)throw new Error('页面没有可确认的论文标题');
    if(paper.pdfUrl)return this.read(paper,signal);
    const text=htmlText(result.bytes.toString('utf8')); if(text.length<100)throw new Error('页面正文不足');
    return this.package(paper,[{locator:'Public academic HTML',text}],'html',result.url,['直接网页导入，可能仅为论文页面，全文完整性需人工核查'],true);
  }
  async local(filename, root, signal) {
    const relative = path.isAbsolute(filename) ? path.relative(root, filename) : filename;
    const resolved = await containedPath(root, relative);
    const stat = await fs.stat(resolved);
    if (!stat.isFile() || stat.size > this.config.maxDownloadBytes) throw new Error('本地论文必须是大小限制内的普通文件');
    const bytes = await fs.readFile(resolved, { signal });
    const ext = path.extname(resolved).toLowerCase(); let segments; let pageLimitReached = false;
    if (ext === '.pdf') {
      const extracted = await pdfSegments(bytes, this.config, signal); segments = extracted.segments; pageLimitReached = extracted.pageLimitReached;
    } else if (['.txt', '.md'].includes(ext)) segments = [{ locator: 'Local text', text: bytes.toString('utf8') }];
    else if (['.html', '.htm'].includes(ext)) segments = [{ locator: 'Local HTML extracted text', text: htmlText(bytes.toString('utf8')) }];
    else throw new Error('本地导入支持 PDF、TXT、Markdown、HTML');
    if (!segments.some(s => s.text.trim().length > 100)) throw new Error('未提取到足够文本；扫描 PDF 请先 OCR');
    const paper = normalizePaper({ id: `local:${createHash('sha256').update(bytes).digest('hex')}`, title: path.basename(filename, ext), sources: ['local'], authors: [] });
    return this.package(paper, segments, ext.slice(1), 'local-file', ['本地文件元数据未自动确认；如需研究脉络，请同时提供论文 reference。'], pageLimitReached);
  }
  package(paper, segments, format, url, warnings, pageLimitReached) {
    const selection = chunksFromSegments(segments, this.config.chunkChars, this.config.maxChunks);
    return { paper, format, sourceUrl: url, coverage: format === 'abstract' ? 'abstract-only' : (selection.truncated || pageLimitReached) ? 'partial-text' : 'extracted-text',
      ...selection, pageLimitReached, warnings: [...warnings, '文本抽取不保证公式、图表与双栏阅读顺序完整；重要结论需对照原文图表。'],
      extractedChars: segments.reduce((n, s) => n + s.text.length, 0), segments };
  }
}
