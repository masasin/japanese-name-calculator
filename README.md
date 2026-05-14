# Local Japanese Name Calculator

This folder contains a local FastAPI web app and Python calculator for Japanese name 五格 checks.

## Files

- `name_fortune.py`: command-line calculator.
- `main.py`: FastAPI app.
- `static/`: single-page browser UI.
- `scripts/update_sources.py`: downloads source files and rebuilds generated data.
- `data/sources/`: downloaded source files for KanjiVG, KANJIDIC2, and Japanese Wiktionary.
- `data/generated/naming.sqlite`: generated local runtime database.

## Sources

- KanjiVG: primary stroke source for kanji and kana. The tool counts unique stroke path IDs per Unicode character.
- KANJIDIC2 / EDRDG: kanji meanings, readings, and metadata.
- Japanese Wiktionary dump: Japanese kanji meanings extracted locally from the downloaded dump.
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
uv run python ~/Documents/naming/scripts/update_sources.py --all
```

Rebuild from already downloaded sources:

```bash
uv run python ~/Documents/naming/scripts/update_sources.py --build
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
