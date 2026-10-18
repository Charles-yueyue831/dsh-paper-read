import { runWorkflow } from './workflow.js';
import { AcademicHttp } from './http.js';
import { PaperSources } from './papers.js';
import { ContentReader } from './content.js';
import { Archive } from './storage.js';
import { createHarnessModel } from './model.js';
import { checkAbort, safeError, isoNow } from './config.js';

export class PaperInsight {
  constructor(ctx, config, dependencies = {}) {
    this.ctx = ctx; this.config = config;
    this.http = dependencies.http || new AcademicHttp(config);
    this.sources = dependencies.sources || new PaperSources(this.http, config);
    this.reader = dependencies.reader || new ContentReader(this.http, config);
    this.makeModel = dependencies.makeModel || createHarnessModel;
    this.busy = false; this.active = 0;
  }
  archive(exec, write = false) {
    const policy = this.ctx.sandboxPolicy.resolve(exec.agent ? { session: exec.agent.session } : {});
    if (!policy?.workspaceRoot) throw new Error('宿主没有提供工作区目录');
    const writable = ['workspace-write', 'danger-full-access'].includes(policy.mode);
    if (write && !writable) throw new Error('当前会话为只读模式，请切换到允许工作区写入的模式后再生成报告。');
    return new Archive(policy.workspaceRoot, this.config.outputDir, writable);
  }
  async search(args, exec) { return this.sources.search(args, exec.signal); }
  async read(args, exec) {
    const archive = this.archive(exec);
    let doc;
    if (args.file) {
      doc = await this.reader.local(args.file, archive.root, exec.signal);
      if (args.reference) { doc.paper = await this.sources.resolve(args.reference, exec.signal); doc.warnings.push('本地全文与 reference 的对应关系由用户指定，尚未自动核验。'); }
    } else if (/^https:\/\//.test(args.reference || '') && !/^https:\/\/(?:www\.)?(?:arxiv.org|openreview.net|(?:dx\.)?doi.org)\//.test(args.reference)) doc = await this.reader.url(args.reference, exec.signal);
    else doc = await this.reader.read(await this.sources.resolve(args.reference, exec.signal), exec.signal);
    return doc;
  }
  async analyze(args, exec) {
    if (this.active >= this.config.concurrency || this.busy && !this.active) throw new Error('已有论文分析达到并发上限，请等待完成或取消后重试。');
    this.active++; this.busy = true;
    try { return await this.analyzeOne(args, exec); } finally { this.active--; this.busy = this.active > 0; }
  }
  async analyzeOne(args, exec) { return runWorkflow(this, args, exec); }
  async batch(args, exec) {
    if (this.busy) throw new Error('已有论文分析正在运行');
    if (args.references.length > this.config.maxPapers) throw new Error(`单次最多分析 ${this.config.maxPapers} 篇`);
    this.archive(exec, true); this.busy = true; const results = [];
    try {
      for (const reference of [...new Set(args.references)]) {
        checkAbort(exec.signal);
        try { results.push(await this.analyzeOne({ reference }, exec)); }
        catch (e) { checkAbort(exec.signal); results.push({ reference, status: 'failed', error: safeError(e) }); }
      }
      return { finishedAt: isoNow(), results, completed: results.filter(r => r.status === 'completed').length, failed: results.filter(r => r.status === 'failed').length };
    } finally { this.busy = false; }
  }
}
