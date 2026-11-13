import {
  MAX_MEANING_LENGTH, MAX_TERM_LENGTH, MAX_WORDS, normalizeText, validText, wordKey,
} from './wordbooks.js';

export const MAX_FILE_SIZE = 2 * 1024 * 1024;

export async function readWordbookFile(file) {
  if (file.size > MAX_FILE_SIZE) throw new Error('2MB 이하의 파일을 선택해 주세요.');
  if (/\.xlsx$/i.test(file.name)) {
    const { default: readWorkbook } = await import('read-excel-file/browser');
    return readWorkbook(file);
  }
  if (/\.csv$/i.test(file.name)) {
    const { default: Papa } = await import('papaparse');
    const input = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
    const { data, errors } = Papa.parse(input, { delimiter: ',' });
    if (errors.length) throw new Error('CSV의 쉼표와 큰따옴표 형식을 확인해 주세요.');
    if (/[\r\n]$/.test(input) && data.at(-1)?.length === 1 && data.at(-1)[0] === '') data.pop();
    return [{ sheet: '', data }];
  }
  throw new Error('CSV 또는 Excel(.xlsx) 파일을 선택해 주세요.');
}

const cellText = (value) => typeof value === 'string' || typeof value === 'number'
  ? String(value).trim().replace(/\s+/g, ' ') : '';

export function wordbookColumns(rows) {
  const headerIndex = rows.findIndex((row) => row.some((cell) => cellText(cell)));
  if (headerIndex === -1) return { columns: [], data: [] };
  const data = rows.slice(headerIndex + 1);
  const width = data.reduce((max, row) => Math.max(max, row.length), rows[headerIndex].length);
  const columns = Array.from({ length: width }, (_, i) => cellText(rows[headerIndex][i]));
  const term = columns.findIndex((name) => ['단어', '영단어', 'word', 'term', 'english'].includes(normalizeText(name)));
  const meaning = columns.findIndex((name) => ['뜻', '의미', 'meaning', 'definition', 'korean'].includes(normalizeText(name)));
  return { columns, data, term, meaning };
}

export function previewWordbook(data, termColumn, meaningColumn) {
  const words = [];
  const seen = new Set();
  let blank = 0;
  let duplicates = 0;
  let invalid = 0;
  for (const row of data) {
    const term = cellText(row[termColumn]);
    const meaning = cellText(row[meaningColumn]);
    if (!term || !meaning) {
      blank++;
      continue;
    }
    if (!validText(term, MAX_TERM_LENGTH) || !validText(meaning, MAX_MEANING_LENGTH)) {
      invalid++;
      continue;
    }
    const key = wordKey(term, meaning);
    if (seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);
    words.push({ term, meaning });
    if (words.length > MAX_WORDS) break;
  }
  return { words, blank, duplicates, invalid };
}
