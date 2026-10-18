import { setTimeout as sleep } from 'node:timers/promises';
import { checkAbort } from './config.js';

const HOSTS = [
  'export.arxiv.org', 'arxiv.org', 'www.arxiv.org', 'api2.openreview.net', 'openreview.net',
  'api.semanticscholar.org', 'api.openalex.org', 'api.crossref.org',
  'aclanthology.org', 'proceedings.mlr.press', 'openaccess.thecvf.com',
  'papers.nips.cc', 'proceedings.neurips.cc', 'ieeexplore.ieee.org', 'dl.acm.org',
];
const DELAYS = { 'export.arxiv.org': 3100, 'arxiv.org': 3100, 'api.semanticscholar.org': 1100 };

export class AcademicHttp {
  constructor(config, { fetchImpl = fetch, delayScale = 1 } = {}) {
    this.config = config; this.fetchImpl = fetchImpl; this.delayScale = delayScale;
    this.hosts = new Set([...HOSTS, ...config.extraHosts]); this.queues = new Map(); this.next = new Map();
    for (const host of config.extraHosts) {
      if (!/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(host) || /(?:^|\.)localhost$|\.local$|\.internal$/i.test(host)) {
        throw new Error('extraHosts 只能包含完整的公网域名');
      }
    }
  }
  validate(input) {
    const url = new URL(input);
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || !this.hosts.has(url.hostname)) {
      throw new Error(`未允许的学术来源：${url.origin}`);
    }
    return url;
  }
  async throttle(host, signal) {
    const previous = this.queues.get(host) || Promise.resolve();
    const run = previous.catch(() => {}).then(async () => {
      checkAbort(signal);
      const wait = Math.max(0, (this.next.get(host) || 0) - Date.now());
      if (wait) await sleep(wait, undefined, { signal });
      this.next.set(host, Date.now() + (DELAYS[host] || 250) * this.delayScale);
    });
    this.queues.set(host, run); await run;
  }
  async get(input, { signal, headers = {}, maxBytes = this.config.maxDownloadBytes } = {}) {
    let url = this.validate(input);
    const deadline = AbortSignal.timeout(this.config.httpTimeoutMs);
    const bounded = signal ? AbortSignal.any([signal, deadline]) : deadline;
    for (let attempt = 0, redirects = 0; ;) {
      checkAbort(bounded); await this.throttle(url.hostname, bounded);
      const requestHeaders = { 'user-agent': 'dsh-paper-insight/0.2.0 (academic research)', ...headers };
      if (url.hostname === 'api.semanticscholar.org' && process.env.SEMANTIC_SCHOLAR_API_KEY) requestHeaders['x-api-key'] = process.env.SEMANTIC_SCHOLAR_API_KEY;
      if (url.hostname === 'api.openalex.org' && process.env.OPENALEX_API_KEY) requestHeaders.authorization = `Bearer ${process.env.OPENALEX_API_KEY}`;
      let response;
      try { response = await this.fetchImpl(url, { headers: requestHeaders, signal: bounded, redirect: 'manual' }); }
      catch (error) {
        checkAbort(bounded);
        if (attempt++ >= 2) throw new Error(`${url.hostname} 连接失败：${error.message}`, { cause: error });
        await sleep(500 * 2 ** attempt * this.delayScale, undefined, { signal: bounded });
        continue;
      }
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel();
        if (++redirects > 4) throw new Error('学术来源重定向过多');
        url = this.validate(new URL(response.headers.get('location'), url)); continue;
      }
      if ([429, 500, 502, 503, 504].includes(response.status) && attempt++ < 2) {
        await response.body?.cancel();
        const raw = response.headers.get('retry-after');
        const retry = raw == null ? NaN : (/^\d+$/.test(raw) ? Number(raw) * 1000 : Date.parse(raw) - Date.now());
        await sleep(Math.min(10000, Math.max(500, Number.isFinite(retry) ? retry : 1000 * 2 ** attempt)) * this.delayScale, undefined, { signal: bounded });
        continue;
      }
      if (!response.ok) { await response.body?.cancel(); throw new Error(`${url.hostname} 返回 HTTP ${response.status}`); }
      if (Number(response.headers.get('content-length')) > maxBytes) { await response.body?.cancel(); throw new Error('下载内容超过大小限制'); }
      const chunks = []; let size = 0;
      try {
        for await (const chunk of response.body || []) {
          checkAbort(bounded); size += chunk.length;
          if (size > maxBytes) throw new Error('下载内容超过大小限制');
          chunks.push(Buffer.from(chunk));
        }
      } catch (error) { await response.body?.cancel().catch(() => {}); throw error; }
      return { bytes: Buffer.concat(chunks), url: url.href, contentType: response.headers.get('content-type') || '' };
    }
  }
  async json(url, options) { return JSON.parse((await this.get(url, options)).bytes.toString('utf8')); }
  async text(url, options) { return (await this.get(url, options)).bytes.toString('utf8'); }
}
