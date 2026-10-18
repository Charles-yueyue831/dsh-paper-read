import { fieldLabels, sectionPresentation, readingGroups } from '../lib/report-format.js';
import { headingSlug } from './report-utils.js';

/** Parse only ATX headings outside fences. Source bytes never change in export/source view. */
function splitHeadings(text, level) {
  const result = [{ title: '', text: '' }];
  let fence;
  for (const line of text.match(/[^\n]*\n|[^\n]+$/g) || []) {
    const f = line.match(/^ {0,3}(`{3,}|~{3,})([^\r\n]*)\r?\n?$/);
    if (f) {
      if (!fence && !(f[1][0] === '`' && f[2].includes('`'))) fence = {char:f[1][0],length:f[1].length};
      else if (fence && f[1][0] === fence.char && f[1].length >= fence.length && !f[2].trim()) fence = null;
      result.at(-1).text += line;
      continue;
    }
    const match = !fence && line.match(new RegExp(`^ {0,3}#{${level}}[ \\t]+(.+?)[ \\t]*#*[ \\t]*\\r?\\n?$`));
    if (match) result.push({title:match[1].trim(), text:''});
    else result.at(-1).text += line;
  }
  return result;
}

export function readingModel(text) {
  const [intro, ...sections] = splitHeadings(text, 2);
  const used = new Map();
  const unique = title => {
    const slug = headingSlug(title), n = used.get(slug) || 0;
    used.set(slug, n + 1);
    return slug + (n ? '-' + n : '');
  };
  const chapters = sections.map(section => {
    const presentation = sectionPresentation(section.title);
    const [lead, ...details] = splitHeadings(section.text, 3);
    return { ...presentation, anchor:unique(section.title), sourceTitle:section.title, lead:lead.text,
      details:details.map(detail => ({...detail, anchor:unique(detail.title), label:fieldLabels[detail.title] || detail.title})),
    };
  });
  const groups = [...readingGroups, '深入阅读'].map(label => ({label, chapters:chapters.filter(ch => ch.group === label)})).filter(g => g.chapters.length);
  return { intro:intro.text, chapters, groups };
}
