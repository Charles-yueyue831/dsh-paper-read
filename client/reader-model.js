/** Select the last heading above the reading line, in rendered document order. */
export function currentChapter(headings, readingLine) {
  let active = headings[0]?.id || '';
  for (const heading of headings) if (heading.top <= readingLine) active = heading.id;
  return active;
}
export function libraryRecords(runs, query = '') {
  const needle = query.trim().toLocaleLowerCase();
  return runs.filter(record => !record.record?.deletedAt &&
    (record.displayTitle || record.paper?.title || '未识别的论文').toLocaleLowerCase().includes(needle));
}
