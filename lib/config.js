import { z } from 'zod';
import path from 'node:path';

export const sourceNames = ['arxiv', 'openreview', 'semantic-scholar', 'openalex'];
export const configSchema = z.object({
  outputDir: z.string().default('.paper-insight'),
  sources: z.array(z.enum(sourceNames)).min(1).default(sourceNames),
  maxPapers: z.number().int().min(1).max(20).default(5),
  maxChunks: z.number().int().min(1).max(50).default(16),
  chunkChars: z.number().int().min(2000).max(20000).default(12000),
  maxOutputTokens: z.number().int().min(1500).max(16000).default(7000),
  maxExtractionTokens: z.number().int().min(1500).max(16000).default(6000),
  modelTimeoutMs: z.number().int().min(1000).max(900000).default(180000),
  httpTimeoutMs: z.number().int().min(1000).max(120000).default(30000),
  maxDownloadBytes: z.number().int().min(1000).max(50000000).default(20000000),
  maxPages: z.number().int().min(1).max(300).default(100),
  maxRelated: z.number().int().min(1).max(50).default(12),
  language: z.enum(['zh-CN', 'en']).default('zh-CN'),
  provider: z.string().optional(),
  model: z.string().optional(),
  extraHosts: z.array(z.string()).default([]),
}).strict().superRefine((v, ctx) => {
  if (Boolean(v.provider) !== Boolean(v.model)) ctx.addIssue({ code: 'custom', message: 'provider 与 model 必须一起配置' });
  if (!v.outputDir || path.isAbsolute(v.outputDir) || v.outputDir.split(/[\\/]/).some(x => x === '..')) {
    ctx.addIssue({ code: 'custom', message: 'outputDir 必须是工作区内的相对目录' });
  }
});

export function parseConfig(value = {}) { return configSchema.parse(value); }
export function safeError(error) {
  return String(error?.message || error).replace(/([?&](?:api_key|key|token)=)[^&\s]+/gi, '$1[REDACTED]').slice(0, 600);
}
export function checkAbort(signal) { signal?.throwIfAborted(); }
export function isoNow() { return new Date().toISOString(); }
