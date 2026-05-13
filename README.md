# Local Japanese Name Calculator

This folder contains a local FastAPI web app and Python calculator for Japanese name 五格 checks.

## Files

- `name_fortune.py`: command-line calculator.
- `main.py`: FastAPI app.
- `static/`: single-page browser UI.
- `data/kanjivg.xml.gz`: downloaded KanjiVG source data.
- `data/stroke_cache.json`: generated stroke counts from KanjiVG stroke paths.
- `data/kanjidic2.xml.gz`: downloaded KANJIDIC2 source data.
- `data/kanji_cache.json`: generated kanji readings and meanings from KANJIDIC2.
- `data/ja_meanings_cache.json`: generated Japanese meaning cache from Japanese Wiktionary.
- `data/score_table.json`: generated public 1-81 score-label table.

## Sources

- KanjiVG: primary stroke source for kanji and kana. The tool counts unique stroke path IDs per Unicode character.
- KANJIDIC2 / EDRDG: kanji meanings, readings, and metadata.
- Japanese Wiktionary: Japanese kanji meanings, cached locally after lookup.
- fortune.netoff.co.jp: public 1-81 score labels. These are not Benesse/Tamahiyo proprietary labels or prose.

## Usage

Run the web app:

```bash
uv run uvicorn main:app --host 127.0.0.1 --port 8000
```

Then open:

```text
http://127.0.0.1:8000
```

The browser UI stores surnames and candidates in local storage and supports JSON export/import.

Run the command-line sample set:

```bash
uv run python ~/Documents/naming/name_fortune.py --sample
```

Run custom names:

```bash
uv run python ~/Documents/naming/name_fortune.py \
  --surname '山田:やまだ' \
  --surname '佐藤:さとう' \
  --given '蓮:やまと' \
  --given '凛:はな'
```

Refresh or build local data:

```bash
uv run python ~/Documents/naming/name_fortune.py --ensure-data
```

Run basic checks:

```bash
uv run python -m py_compile main.py name_fortune.py
node --check static/app.js
```

## Notes

The 五格 arithmetic matches the pasted examples for the checked names, including the four-character surname handling for `山田`.

The score labels are from a public 81-number table, so some labels differ from Tamahiyo even when the calculated grid numbers match.

The web UI displays `×` score labels as `△` to match the Tamahiyo-style presentation, while the internal point calculation keeps the public table's original score weights.
