"""Import the five teacher PDFs, checking every cumulative row against master.

Usage: python scripts/import-vocabulary.py SOURCE_DIRECTORY
Requires pdfplumber==0.11.10. SOURCE_DIRECTORY contains bronze.pdf, silver.pdf,
gold.pdf, platinum.pdf and master.pdf; original PDFs are not committed.
"""
import hashlib
import json
from pathlib import Path
import re
import sys

import pdfplumber

TIERS = [('bronze', '브론즈', 64), ('silver', '실버', 290), ('gold', '골드', 741),
         ('platinum', '플래티넘', 969), ('master', '마스터', 1000)]
TIER_IDS = {label: tier for tier, label, _ in TIERS}


def clean(value):
    return re.sub(r'\s+', ' ', value or '').strip()


def read_rows(path):
    rows = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            for table in page.extract_tables():
                for cells in table:
                    if clean(cells[0]) == '단어 및 표현':
                        continue
                    if re.fullmatch('[A-Z]', clean(cells[0])) and not any(cells[1:]):
                        continue
                    if len(cells) != 6 or not all(clean(cell) for cell in cells):
                        raise ValueError(f'Incomplete row: {path.name}, page {page.page_number}: {cells}')
                    term, meaning, synonyms, antonyms, source, label = map(clean, cells)
                    rows.append({
                        'id': 'word-' + hashlib.sha256(f'{term}\0{meaning}'.encode()).hexdigest()[:12],
                        'term': term, 'meaning': meaning,
                        'synonyms': synonyms, 'antonyms': antonyms,
                        'sources': [clean(line) for line in cells[4].splitlines() if clean(line)],
                        'tier': TIER_IDS[label],
                    })
    if len({row['id'] for row in rows}) != len(rows):
        raise ValueError(f'Duplicate term/meaning identity in {path.name}')
    return rows


def main():
    directory = Path(sys.argv[1])
    master = read_rows(directory / 'master.pdf')
    for index, (tier, label, count) in enumerate(TIERS):
        expected = [row for row in master if row['tier'] in [entry[0] for entry in TIERS[:index + 1]]]
        actual = read_rows(directory / f'{tier}.pdf')
        if len(expected) != count or len(actual) != count or actual != expected:
            differences = [(a, b) for a, b in zip(actual, expected) if a != b]
            raise ValueError(f'{label}: expected {count}, found {len(actual)}; differences: {differences[:3]}')
        print(f'{label}: {count} cumulative rows verified against master')
    output = Path(__file__).resolve().parents[1] / 'src/data/vocabulary.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(master, ensure_ascii=False, indent=2) + '\n')
    print(f'Wrote {len(master)} distinct entries to {output.name}')


if __name__ == '__main__':
    main()
