import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { checkAbort, isoNow } from './config.js';
import { validateReference } from './reference.js';

// Serialize edits to the same record across Archive instances in this host.
const edits = new Map();
const activeRuns = new Set();

export async function containedPath(root, relative, { create = false } = {}) {
  const base = await fs.realpath(root);
  if (path.isAbsolute(relative) || relative.split(/[\\/]/).some(p => p === '..')) throw new Error('路径必须位于工作区内');
  const parts = relative.split(/[\\/]/).filter(p => p && p !== '.');
  let current = base;
  for (const part of parts) {
    current = path.join(current, part);
    let stat;
    try { stat = await fs.lstat(current); }
    catch (e) {
      if (e.code !== 'ENOENT') throw e;
      if (create) { try { await fs.mkdir(current, { mode: 0o700 }); } catch (e2) { if (e2.code !== 'EEXIST') throw e2; } stat = await fs.lstat(current); }
    }
    if (stat?.isSymbolicLink()) throw new Error('归档路径不允许符号链接');
    if (create && stat && !stat.isDirectory()) throw new Error('归档路径必须是目录');
  }
  return current;
}

export class Archive {
  constructor(root, outputDir, writable) { this.root = root; this.outputDir = outputDir; this.writable = writable; }
  async dir(create = false) {
    if (create && !this.writable) throw new Error('当前会话为只读模式，不能保存论文报告');
    return containedPath(this.root, this.outputDir, { create });
  }
  async start(paper, key, signal) {
    checkAbort(signal); const root = await this.dir(true);
    const runId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
    const folder = await containedPath(root, `${key}/${runId}`, { create: true });
    const run = { folder, key, runId, startedAt: isoNow(), paper };
    await this.write(run, 'manifest.json', { schemaVersion: 1, status: 'running', key, runId, startedAt: run.startedAt, paper }, signal);
    activeRuns.add(folder);
    return run;
  }
  async write(run, filename, content, signal) {
    if (!this.writable) throw new Error('当前会话为只读模式');
    checkAbort(signal);
    if (!/^[a-zA-Z0-9_.-]+$/.test(filename)) throw new Error('无效归档文件名');
    const root = await this.dir();
    const folder = await containedPath(root, `${run.key}/${run.runId}`);
    const temporary = path.join(folder, `.${filename}.${randomUUID()}.tmp`);
    const destination = path.join(folder, filename);
    const body = typeof content === 'string' ? content : JSON.stringify(content, null, 2) + '\n';
    try {
      await fs.writeFile(temporary, body, { flag: 'wx', mode: 0o600, signal });
      checkAbort(signal); await fs.rename(temporary, destination);
    } finally { await fs.unlink(temporary).catch(() => {}); }
    return destination;
  }
  async finish(run, status, extra = {}) {
    const result = await this.write(run, 'manifest.json', { schemaVersion: 1, key: run.key, runId: run.runId, paper: run.paper,
      startedAt: run.startedAt, finishedAt: isoNow(), status, ...extra });
    activeRuns.delete(run.folder);
    await this.reindex();
    return result;
  }
  async reindex() {
    return this.state('index', {schemaVersion:1, updatedAt:isoNow(), runs:(await this.list(2000)).map(({key,runId,startedAt,status,displayTitle,canonicalKey,type})=>({key,runId,startedAt,status,title:displayTitle,canonicalKey,type})), limit:2000});
  }
  async list(limit = 30, { deleted = false } = {}) {
    const root = await this.dir(); let keys;
    try { keys = await fs.readdir(root, { withFileTypes: true }); } catch (e) { if (e.code === 'ENOENT') return []; throw e; }
    const items = [];
    for (const key of keys.filter(k => k.isDirectory() && /^[a-f0-9]{20}$/.test(k.name))) {
      for (const run of await fs.readdir(path.join(root, key.name), { withFileTypes: true })) {
        if (!run.isDirectory() || !/^\d+-[a-f0-9]{8}$/.test(run.name)) continue;
        const folder = await containedPath(root, `${key.name}/${run.name}`);
        try {
          const manifestPath = await containedPath(folder, 'manifest.json');
          const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
          const record = await this.optional(key.name, run.name, 'record.json') || {};
          if (Boolean(record.deletedAt) !== deleted) continue;
          items.push({ ...manifest, folder, record, displayTitle: record.title || manifest.paper?.title });
        } catch (e) { if (!['ENOENT'].includes(e.code)) throw e; }
      }
    }
    return items.sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, limit);
  }
  async load(key, runId, filename = 'report.json') {
    if (!/^[a-f0-9]{20}$/.test(key) || !/^\d+-[a-f0-9]{8}$/.test(runId) || !/^[a-zA-Z0-9_.-]+$/.test(filename)) throw new Error('无效报告标识');
    const root = await this.dir();
    return JSON.parse(await fs.readFile(await containedPath(root, `${key}/${runId}/${filename}`), 'utf8'));
  }
  async optional(key, runId, filename) {
    try { return await this.load(key, runId, filename); }
    catch (e) { if (e.code === 'ENOENT') return null; throw e; }
  }
  async checkpoint(key, runId) {
    const manifest = await this.load(key, runId, 'manifest.json');
    if (activeRuns.has(path.join(await this.dir(), key, runId))) throw new Error('这条研究仍在运行，请完成或取消后再继续。');
    const record = await this.optional(key, runId, 'record.json');
    if (record?.deletedAt) throw new Error('这条研究已删除，请先在“已删除”中恢复。');
    if (manifest.type) throw new Error('此记录不是单篇论文分析，不能继续分析。');
    const cp = await this.optional(key, runId, 'checkpoint.json');
    if (cp) return cp;
    // v0.1 archives saved a document but did not yet have a checkpoint file.
    const document = await this.optional(key, runId, 'document.json');
    if (document?.paper && document.chunks?.length) return {
      schemaVersion: 2, promptVersion: '0.2.0', key, document,
      input: {}, evidence: [], sections: [], calls: [],
    };
    throw new Error('这条旧记录没有保存可继续的论文材料，请重新填写论文信息开始分析。');
  }
  async detail(key, runId) {
    const manifest = await this.load(key, runId, 'manifest.json');
    const record = await this.optional(key, runId, 'record.json') || { revision: 0 };
    let cp, recoveryError;
    if (!record.deletedAt && !manifest.type) {
      try { cp = await this.checkpoint(key, runId); }
      catch (e) { recoveryError = e.message; }
    }
    let input = cp?.input || {};
    let validInput = Boolean(input.file);
    if (!validInput && input.reference) {
      try { validateReference(input.reference); validInput = true; }
      catch (e) { recoveryError = e.message; input = {}; }
    }
    const hasDocument = Boolean(cp?.document?.paper && cp.document.chunks?.length);
    const canAnalyze = !record.deletedAt && !manifest.type && (hasDocument || validInput);
    const active = activeRuns.has(path.join(await this.dir(), key, runId));
    const fallback = cp?.document?.paper?.title || input.reference || input.file;
    const title = manifest.paper?.title;
    const displayTitle = record.title || (title && !/^(Pending paper|可从检查点续跑)$/.test(title) && !/已提取材料及检查点/.test(title) ? title : fallback) || '未识别的论文';
    return { ...manifest, record, displayTitle, input, hasDocument,
      canResume: Boolean(canAnalyze && manifest.status !== 'completed' && !active),
      canReanalyze: Boolean(canAnalyze && !active),
      interrupted: manifest.status === 'running' && !active,
      recoveryError: recoveryError || (!canAnalyze && !manifest.type ? '请补充有效的论文标题、链接或本地文件。' : null),
      completedModules: (cp?.sections || []).map(s => s.id),
    };
  }
  async updateRecord(key, runId, patch, expectedRevision) {
    if (!this.writable) throw new Error('当前会话为只读模式，不能修改研究历史。');
    const lock = path.join(await this.dir(), key, runId);
    const previous = edits.get(lock) || Promise.resolve();
    const task = previous.catch(() => {}).then(async () => {
      const manifest = await this.load(key, runId, 'manifest.json');
      if (activeRuns.has(lock)) throw new Error('这条研究仍在运行，请完成或取消后再修改。');
      const old = await this.optional(key, runId, 'record.json') || { revision: 0 };
      if (expectedRevision !== undefined && old.revision !== expectedRevision) throw new Error('这条记录已被更新，请刷新历史后再试。');
      const record = { ...old, ...patch, revision: (old.revision || 0) + 1, updatedAt: isoNow(),
        versions: [...(old.versions || []), { revision: old.revision || 0, title: old.title || '', notes: old.notes || '', deletedAt: old.deletedAt || null, updatedAt: old.updatedAt || null }] };
      await this.write({ key, runId }, 'record.json', record);
      await this.reindex();
      return { record: await this.detail(key, runId) };
    });
    edits.set(lock, task);
    try { return await task; } finally { if (edits.get(lock) === task) edits.delete(lock); }
  }
  async state(name, value) {
    if (!/^[a-z][a-z0-9-]+$/.test(name)) throw new Error('无效状态名');
    const root = await this.dir(value !== undefined);
    const filename = await containedPath(root, `${name}.json`);
    if (value === undefined) { try { return JSON.parse(await fs.readFile(filename, 'utf8')); } catch(e) { if(e.code === 'ENOENT') return null; throw e; } }
    const temp = `${filename}.${randomUUID()}.tmp`;
    try { await fs.writeFile(temp, JSON.stringify(value,null,2)+'\n', {flag:'wx',mode:0o600}); await fs.rename(temp,filename); }
    finally { await fs.unlink(temp).catch(()=>{}); }
    return value;
  }
  async search(query = '', limit = 30, scanLimit = 2000, { deleted = false, status, offset = 0 } = {}) {
    const runs = await this.list(scanLimit, { deleted }); const result=[];
    for (let run of runs) {
      if (status && run.status !== status) continue;
      if (/^(Pending paper|可从检查点续跑)$|已提取材料及检查点/.test(run.displayTitle || '')) run = { ...run, ...await this.detail(run.key,run.runId) };
      let text = [run.displayTitle, run.paper?.title, run.record?.notes].filter(Boolean).join('\n');
      if (query && run.status === 'completed' && run.type !== 'discovery') {
        try { text += '\n'+(await this.read(run.key,run.runId)).markdown; }
        catch(e) { if(e.code !== 'ENOENT') throw e; }
      }
      const normalize = value => value.normalize('NFKC').replace(/\s+/g,' ').toLowerCase();
      const position=normalize(text).indexOf(normalize(query));
      if(position>=0)result.push({...run,snippet:text.slice(Math.max(0,position-80),position+240)});
    }
    const page = await Promise.all(result.slice(offset, offset + limit).map(async run => run.canResume !== undefined ? run : ({...run, ...await this.detail(run.key,run.runId)})));
    return {runs:page,total:result.length,offset,limit,scanned:runs.length,scanLimit,coverage:'按最近运行的归档全文检索，超过 scanLimit 的旧记录未扫描'};
  }
  async read(key, runId) {
    if (!/^[a-f0-9]{20}$/.test(key) || !/^\d+-[a-f0-9]{8}$/.test(runId)) throw new Error('无效报告标识');
    const root = await this.dir();
    const filename = await containedPath(root, `${key}/${runId}/report.md`);
    return { path: filename, markdown: await fs.readFile(filename, 'utf8') };
  }
}
