export const MAX_WORDS = 1000;
export const MAX_WORDBOOKS = 20;
export const MAX_TERM_LENGTH = 120;
export const MAX_MEANING_LENGTH = 300;
export const MAX_BOOK_NAME_LENGTH = 80;

export const normalizeText = (value) => value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
export const wordKey = (term, meaning) => JSON.stringify([normalizeText(term), normalizeText(meaning)]);

export function validWordbooks(books) {
  if (!Array.isArray(books) || books.length > MAX_WORDBOOKS) return false;
  const ids = new Set();
  let total = 0;
  for (const book of books) {
    if (!/^book-[a-f0-9-]{36}$/.test(book?.id) || ids.has(book.id) ||
        !validText(book.name, MAX_BOOK_NAME_LENGTH) || !Array.isArray(book.words) || !book.words.length) return false;
    ids.add(book.id);
    total += book.words.length;
    if (total > MAX_WORDS) return false;
    const words = new Set();
    for (const word of book.words) {
      if (!validText(word?.term, MAX_TERM_LENGTH) || !validText(word.meaning, MAX_MEANING_LENGTH)) return false;
      const key = wordKey(word.term, word.meaning);
      if (words.has(key)) return false;
      words.add(key);
    }
  }
  return true;
}

export function validText(value, limit) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= limit && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value);
}
