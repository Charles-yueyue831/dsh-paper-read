import { AcademicHttp } from './http.js';
import { PaperSources, paperKey } from './papers.js';
import { ContentReader } from './content.js';
import { Archive } from './storage.js';
import { analyzeDocument, renderReport, renderBibtex } from './analysis.js';
import { createHarnessModel } from './model.js';
import { checkAbort, safeError, isoNow } from './config.js';

export class PaperInsight {
  constructor(ctx, config, dependencies = {}) {
    this.ctx = ctx; this.config = config;
    this.http = dependencies.http || new AcademicHttp(config);
    this.sources = dependencies.sources || new PaperSources(this.http, config);
    this.reader = dependencies.reader || new ContentReader(this.http, config);
    this.makeModel = dependencies.makeModel || createHarnessModel;
    this.busy = false;
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
    } else doc = await this.reader.read(await this.sources.resolve(args.reference, exec.signal), exec.signal);
    return doc;
  }
  async analyze(args, exec) {
    if (this.busy) throw new Error('已有论文分析正在运行，请等待完成或取消后重试。');
    this.busy = true;
    try { return await this.analyzeOne(args, exec); } finally { this.busy = false; }
  }
  async analyzeOne(args, exec) {
    const archive = this.archive(exec, true);
    // Check the registered model before spending network traffic or creating a run.
    const model = this.makeModel(this.ctx, exec, this.config);
    const document = await this.read(args, exec);
    const key = paperKey(document.paper); const run = await archive.start(document.paper, key, exec.signal);
    try {
      await archive.write(run, 'document.json', document, exec.signal);
      await archive.write(run, 'source.txt', document.segments.map(s => `[${s.locator}]\n${s.text}`).join('\n\n'), exec.signal);
      const related = await this.sources.related(document.paper, exec.signal);
      await archive.write(run, 'references.json', related, exec.signal);
      const report = await analyzeDocument(document, related, model, this.config, exec.signal,
        evidence => archive.write(run, 'evidence.json', evidence, exec.signal));
      const markdown = renderReport(report);
      await archive.write(run, 'report.json', report, exec.signal);
      const reportPath = await archive.write(run, 'report.md', markdown, exec.signal);
      await archive.write(run, 'references.bib', renderBibtex([document.paper, ...related.references, ...related.citations, ...related.discovery]), exec.signal);
      checkAbort(exec.signal);
      await archive.finish(run, 'completed', { coverage: document.coverage, model: model.route, calls: model.calls, reportPath });
      return { status: 'completed', key, runId: run.runId, title: document.paper.title, reportPath, folder: run.folder,
        coverage: document.coverage, sections: report.sections.map(s => ({ id: s.id, summary: s.summary })),
        modelCalls: model.calls.length, warnings: document.warnings, sourceErrors: related.errors };
    } catch (error) {
      await archive.finish(run, exec.signal?.aborted ? 'cancelled' : 'failed', { error: safeError(error), calls: model.calls }).catch(() => {});
      throw new Error(`${safeError(error)}；已提取的材料保存在 ${run.folder}`, { cause: error });
    }
  }
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
