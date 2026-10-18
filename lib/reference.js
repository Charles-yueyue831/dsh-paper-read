/** Keep diagnostic messages out of paper lookup, including messages from older versions. */
export function validateReference(value) {
  const reference = typeof value === 'string' ? value.trim() : '';
  if (!reference) throw Object.assign(new Error('请填写论文标题、链接或编号。'), { code: 'INVALID_REFERENCE' });
  if (/paper_insight_resume|已提取材料及检查点|key=[a-f0-9]{20}\s+runId=\d+-[a-f0-9]{8}/i.test(reference)) {
    throw Object.assign(new Error('这里填写的是上次的错误提示，不是论文。请在研究历史中选择原论文继续，或重新填写论文标题、链接。'), { code: 'INVALID_REFERENCE' });
  }
  return reference;
}

export const normalizedTitle = value => String(value).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
