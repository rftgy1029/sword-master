import { groupWrongWords, questionType, reviewStatus } from './learning.js';
import { publicAsset } from '../publicAsset.js';

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function downloadLearningCsv(rows) {
  const { default: Papa } = await import('papaparse');
  const csv = Papa.unparse({
    fields: ['단어', '뜻', '출처 단어장', '문제 유형', '풀이 횟수', '정답 횟수', '오답 횟수', '복습 상태'],
    data: rows.map(({ question, entry, source }) =>
      [question.word.term, question.word.meaning, source, questionType(question), entry.attempts, entry.correct, entry.wrong, reviewStatus(entry)]),
  }, { escapeFormulae: /^[\s\uFEFF]*[=+\-@]|^[\t\r\n]/ });
  downloadBlob(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }), 'S’word Master 학습 기록.csv');
}

const regular = 'NanumGothic-Regular.ttf';
const bold = 'NanumGothic-Bold.ttf';
let pdfRuntime;

async function loadPdfRuntime() {
  const [module, normalFont, boldFont] = await Promise.all([
    import('pdfmake/build/pdfmake.js'),
    loadFont(regular),
    loadFont(bold),
  ]);
  const pdf = module.default;
  pdf.addVirtualFileSystem({
    [regular]: { data: normalFont },
    [bold]: { data: boldFont },
  });
  pdf.addFonts({ NanumGothic: { normal: regular, bold } });
  return pdf;
}

async function loadFont(name) {
  const response = await fetch(publicAsset(`fonts/${name}`));
  if (!response.ok) throw new Error('PDF 글꼴을 읽지 못했습니다.');
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

export async function downloadWrongWordsPdf(rows) {
  const words = groupWrongWords(rows);
  if (!words.length) return;
  pdfRuntime ??= loadPdfRuntime().catch((error) => {
    pdfRuntime = undefined;
    throw error;
  });
  const pdf = await pdfRuntime;
  const heading = (text) => ({ text, bold: true, fillColor: '#eae4ef' });
  const date = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'long' }).format(new Date());
  const document = {
    info: { title: 'S’word Master 오답 노트' },
    pageSize: 'A4',
    pageMargins: [40, 42, 40, 46],
    defaultStyle: { font: 'NanumGothic', fontSize: 10, lineHeight: 1.22, color: '#22192b' },
    footer: (page, total) => ({ text: `${page} / ${total}`, alignment: 'center', fontSize: 9, color: '#554963', margin: [0, 14, 0, 0] }),
    content: [
      { text: 'S’word Master', fontSize: 10, bold: true, color: '#6b4d78' },
      { text: '오답 노트', fontSize: 25, bold: true, margin: [0, 4, 0, 5] },
      { text: `${date}  ·  단어 ${words.length}개  ·  오답 문제 ${words.reduce((sum, { problems }) => sum + problems.length, 0)}개`, margin: [0, 0, 0, 16] },
      {
        layout: {
          hLineWidth: (index) => index === 1 ? 0.8 : 0.45,
          vLineWidth: () => 0,
          hLineColor: () => '#d7cedd',
          paddingLeft: () => 9,
          paddingRight: () => 9,
          paddingTop: () => 7,
          paddingBottom: () => 7,
        },
        table: {
          headerRows: 1,
          dontBreakRows: true,
          widths: [98, 122, '*'],
          body: [
            [heading('단어 · 출처'), heading('뜻'), heading('틀린 유형 · 정답 · 복습 상태')],
            ...words.map(({ word, source, problems }) => [
              [{ text: word.term, bold: true, fontSize: 11 }, { text: source, color: '#63566c', margin: [0, 3, 0, 0] }],
              word.meaning,
              problems.map(({ type, answer, wrong, status }, index) => ({
                stack: [
                  { text: [{ text: `${type}  `, bold: true }, { text: answer }] },
                  { text: `오답 ${wrong}회 · ${status}`, fontSize: 9, color: '#63566c' },
                ],
                margin: [0, index ? 6 : 0, 0, 0],
              })),
            ]),
          ],
        },
      },
    ],
  };
  const blob = await pdf.createPdf(document).getBlob();
  downloadBlob(blob, 'S’word Master 오답 노트.pdf');
}
