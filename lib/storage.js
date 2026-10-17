import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { checkAbort, isoNow } from './config.js';

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
    return this.write(run, 'manifest.json', { schemaVersion: 1, key: run.key, runId: run.runId, paper: run.paper,
      startedAt: run.startedAt, finishedAt: isoNow(), status, ...extra });
  }
  async list(limit = 30) {
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
          items.push({ ...manifest, folder });
        } catch (e) { if (!['ENOENT'].includes(e.code)) throw e; }
      }
    }
    return items.sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, limit);
  }
  async read(key, runId) {
    if (!/^[a-f0-9]{20}$/.test(key) || !/^\d+-[a-f0-9]{8}$/.test(runId)) throw new Error('无效报告标识');
    const root = await this.dir();
    const filename = await containedPath(root, `${key}/${runId}/report.md`);
    return { path: filename, markdown: await fs.readFile(filename, 'utf8') };
  }
}
