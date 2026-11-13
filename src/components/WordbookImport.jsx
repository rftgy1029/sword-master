import { useEffect, useRef, useState } from 'react';
import { MAX_BOOK_NAME_LENGTH, MAX_WORDBOOKS, MAX_WORDS, validText } from '../game/wordbooks.js';
import { previewWordbook, readWordbookFile, wordbookColumns } from '../game/wordbookImport.js';

export default function WordbookImport({ wordbooks, onSave }) {
  const [sheets, setSheets] = useState([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [termColumn, setTermColumn] = useState(-1);
  const [meaningColumn, setMeaningColumn] = useState(-1);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const success = useRef(null);
  const request = useRef(0);
  const columns = sheets.length ? wordbookColumns(sheets[sheetIndex].data) : null;
  const preview = columns && termColumn >= 0 && meaningColumn >= 0 && termColumn !== meaningColumn
    ? previewWordbook(columns.data, termColumn, meaningColumn) : null;
  const remaining = MAX_WORDS - wordbooks.reduce((total, book) => total + book.words.length, 0);
  const full = wordbooks.length >= MAX_WORDBOOKS || remaining === 0;
  useEffect(() => { if (saved) success.current?.focus({ preventScroll: true }); }, [saved]);

  function selectSheet(index, workbook = sheets) {
    const mapped = wordbookColumns(workbook[index].data);
    setSheetIndex(index);
    setTermColumn(mapped.term ?? -1);
    setMeaningColumn(mapped.meaning ?? -1);
    setError('');
  }

  async function openFile(files) {
    if (!files.length || full) return;
    const id = ++request.current;
    setSheets([]);
    setSaved('');
    setError('');
    setBusy(false);
    if (files.length !== 1) {
      setError('한 번에 파일 하나를 선택해 주세요.');
      return;
    }
    const file = files[0];
    setBusy(true);
    try {
      const workbook = await readWordbookFile(file);
      if (id !== request.current) return;
      selectSheet(0, workbook);
      setName(file.name.replace(/\.[^.]+$/, '').slice(0, MAX_BOOK_NAME_LENGTH));
      setSheets(workbook);
    } catch (failure) {
      if (id !== request.current) return;
      const message = failure.message;
      setError(/[가-힣]/.test(message) ? message : '파일을 읽을 수 없습니다. UTF-8 CSV 또는 Excel(.xlsx) 파일인지 확인해 주세요.');
    } finally {
      if (id === request.current) setBusy(false);
    }
  }

  function save(event) {
    event.preventDefault();
    if (!preview?.words.length || preview.words.length > remaining || full || !validText(name, MAX_BOOK_NAME_LENGTH)) return;
    const book = { id: `book-${crypto.randomUUID()}`, name: name.trim(), words: preview.words };
    if (!onSave(book)) {
      setError('단어장을 저장하지 못했습니다. 저장 상태를 확인한 뒤 다시 시도해 주세요.');
      return;
    }
    setSaved(`${book.name} · ${book.words.length}개를 저장했습니다. 새 모험에서 선택할 수 있어요.`);
    setSheets([]);
    setError('');
  }

  return <section className="wordbook-import" aria-labelledby="wordbook-import-title">
    <h3 id="wordbook-import-title">단어장 가져오기</h3>
    <div className={`wordbook-drop${dragging ? ' is-dragging' : ''}`}
      onDragOver={(event) => { event.preventDefault(); if (!full) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => { event.preventDefault(); setDragging(false); void openFile(event.dataTransfer.files); }}>
      <label htmlFor="wordbook-file">파일을 끌어다 놓거나 선택하세요</label>
      <input id="wordbook-file" type="file" accept=".csv,.xlsx" disabled={full}
        onChange={(event) => { void openFile(event.target.files); event.target.value = ''; }} />
      <small>UTF-8 CSV 또는 Excel(.xlsx) · 최대 2MB · 첫 줄에 열 이름</small>
    </div>
    {full && <p role="status">저장 한도에 도달했습니다. 최대 {MAX_WORDBOOKS}개 단어장과 단어 {MAX_WORDS.toLocaleString()}개를 저장할 수 있어요.</p>}
    {busy && <p role="status">단어장을 읽고 있습니다…</p>}
    {error && <p className="game-save-error" role="alert">{error}</p>}
    {saved && <p ref={success} tabIndex={-1} role="status">{saved}</p>}
    {columns && <form className="wordbook-preview" onSubmit={save}>
      <div className="wordbook-fields">
        <label>단어장 이름<input value={name} maxLength={MAX_BOOK_NAME_LENGTH} onChange={(event) => setName(event.target.value)} required /></label>
        {sheets.length > 1 && <label>시트<select value={sheetIndex} onChange={(event) => selectSheet(Number(event.target.value))}>
          {sheets.map(({ sheet }, index) => <option key={index} value={index}>{sheet}</option>)}
        </select></label>}
        {[[termColumn, setTermColumn, '단어 열'], [meaningColumn, setMeaningColumn, '뜻 열']].map(([value, setValue, label]) =>
          <label key={label}>{label}<select value={value} onChange={(event) => setValue(Number(event.target.value))}>
            <option value={-1}>열 선택</option>
            {columns.columns.map((column, index) => <option key={index} value={index}>{index + 1}열 · {column || '제목 없음'}</option>)}
          </select></label>)}
      </div>
      {!preview && <p role="status">{columns.columns.length < 2 ? '단어와 뜻이 들어 있는 열 두 개가 필요합니다.' : '단어와 뜻에 서로 다른 열을 골라 주세요.'}</p>}
      {preview && <>
        <p role="status">가져올 단어 {preview.words.length.toLocaleString()}개 · 빈칸 {preview.blank}행 · 중복 {preview.duplicates}행 · 형식 오류 {preview.invalid}행</p>
        {preview.words.length > remaining && <p role="alert">현재 {remaining.toLocaleString()}개까지 추가할 수 있어요. 파일에서 단어 수를 줄여 주세요.</p>}
        {preview.words.length > 0 && <dl className="wordbook-sample" aria-label="가져올 단어 미리보기">
          {preview.words.slice(0, 5).map(({ term, meaning }, index) => <div key={index}><dt lang="en">{term}</dt><dd>{meaning}</dd></div>)}
        </dl>}
      </>}
      <button className="game-primary" disabled={!preview?.words.length || preview.words.length > remaining || !validText(name, MAX_BOOK_NAME_LENGTH)}>단어장 저장</button>
    </form>}
  </section>;
}
