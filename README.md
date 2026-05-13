# Local Japanese Name Calculator

This folder contains a local Python calculator for Japanese name 五格 checks.

## Files

- `name_fortune.py`: command-line calculator.
- `data/kanjivg.xml.gz`: downloaded KanjiVG source data.
- `data/stroke_cache.json`: generated stroke counts from KanjiVG stroke paths.
- `data/kanjidic2.xml.gz`: downloaded KANJIDIC2 source data.
- `data/kanji_cache.json`: generated kanji readings and meanings from KANJIDIC2.
- `data/score_table.json`: generated public 1-81 score-label table.

## Sources

- KanjiVG: primary stroke source for kanji and kana. The tool counts unique stroke path IDs per Unicode character.
- KANJIDIC2 / EDRDG: kanji meanings, readings, and metadata.
- fortune.netoff.co.jp: public 1-81 score labels. These are not Benesse/Tamahiyo proprietary labels or prose.

## Usage

Run the discussed sample set:

```bash
python3 ~/Documents/naming/name_fortune.py --sample
```

Run custom names:

```bash
python3 ~/Documents/naming/name_fortune.py \
  --surname '山田:やまだ' \
  --surname '佐藤:さとう' \
  --given '蓮:やまと' \
  --given '凛:はな'
```

Refresh or build local data:

```bash
python3 ~/Documents/naming/name_fortune.py --ensure-data
```

## Notes

The 五格 arithmetic matches the pasted examples for the checked names, including the four-character surname handling for `山田`.

The score labels are from a public 81-number table, so some labels differ from Tamahiyo even when the calculated grid numbers match.
