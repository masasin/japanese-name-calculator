#!/usr/bin/env python3
"""Local Japanese name-grid calculator.

The program keeps character data outside the code:
  - kanji/kana strokes: KanjiVG stroke-path data
  - kanji readings/meanings: KANJIDIC2 from EDRDG
  - 1-81 score labels: scraped cache from a public 81-number table

It calculates the standard five grids used by many Japanese name sites. The
result is not a copy of any one site's proprietary prose.
"""

from __future__ import annotations

import argparse
import bz2
import gzip
import html
import json
import re
import sqlite3
import sys
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
SOURCE_DIR = DATA_DIR / "sources"
GENERATED_DIR = DATA_DIR / "generated"

KANJIDIC_URL = "https://www.edrdg.org/kanjidic/kanjidic2.xml.gz"
KANJIVG_RELEASE_API = "https://api.github.com/repos/KanjiVG/kanjivg/releases/latest"
SCORE_TABLE_URL = "https://fortune.netoff.co.jp/seimei/kichiku/"
JAWIKTIONARY_DUMP_URL = "https://dumps.wikimedia.org/jawiktionary/latest/jawiktionary-latest-pages-articles.xml.bz2"

KANJIVG_GZ = SOURCE_DIR / "kanjivg.xml.gz"
KANJIDIC_GZ = SOURCE_DIR / "kanjidic2.xml.gz"
JAWIKTIONARY_BZ2 = SOURCE_DIR / "jawiktionary-pages-articles.xml.bz2"
SQLITE_DB = GENERATED_DIR / "naming.sqlite"

SMALL_KANA_TO_FULL = str.maketrans(
    "ぁぃぅぇぉゃゅょゎっァィゥェォャュョヮッヶヵ",
    "あいうえおやゆよわつアイウエオヤユヨワツケカ",
)


@dataclass(frozen=True)
class Surname:
    text: str
    reading: str


@dataclass(frozen=True)
class GivenName:
    kanji: str
    reading: str


def fetch_url(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "local-name-calculator/1.0"})
    with urllib.request.urlopen(req, timeout=60) as response:
        return response.read()


def text_from_html(raw: bytes) -> str:
    decoded = raw.decode("utf-8", errors="replace")
    decoded = re.sub(r"<script\b.*?</script>", " ", decoded, flags=re.I | re.S)
    decoded = re.sub(r"<style\b.*?</style>", " ", decoded, flags=re.I | re.S)
    decoded = re.sub(r"<[^>]+>", " ", decoded)
    decoded = html.unescape(decoded)
    return re.sub(r"[ \t\r\f\v]+", " ", decoded)


def ensure_data() -> None:
    if not SQLITE_DB.exists():
        update_sources(download=True, build=True)


def download_sources(force: bool = False) -> None:
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    if force or not KANJIVG_GZ.exists():
        download_kanjivg()
    if force or not KANJIDIC_GZ.exists():
        KANJIDIC_GZ.write_bytes(fetch_url(KANJIDIC_URL))
    if force or not JAWIKTIONARY_BZ2.exists():
        JAWIKTIONARY_BZ2.write_bytes(fetch_url(JAWIKTIONARY_DUMP_URL))


def update_sources(download: bool = True, build: bool = True, force_download: bool = False) -> None:
    if download:
        download_sources(force=force_download)
    if build:
        build_sqlite_database()


def download_kanjivg() -> None:
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    release = json.loads(fetch_url(KANJIVG_RELEASE_API).decode("utf-8"))
    assets = release.get("assets", [])
    for asset in assets:
        name = str(asset.get("name", ""))
        url = asset.get("browser_download_url")
        if name.endswith(".xml.gz") and url:
            KANJIVG_GZ.write_bytes(fetch_url(str(url)))
            return
    raise RuntimeError("Could not find a .xml.gz asset in the latest KanjiVG GitHub release.")


def build_stroke_data() -> dict[str, int]:
    if not KANJIVG_GZ.exists():
        download_kanjivg()

    with gzip.open(KANJIVG_GZ, "rb") as fh:
        root = ET.parse(fh).getroot()

    by_codepoint: dict[str, set[int]] = {}
    stroke_id = re.compile(r"(?:^|:)([0-9a-f]{5,6})(?:-[a-z0-9]+)?-s([0-9]+)$", re.I)
    for elem in root.iter():
        if elem.tag.rsplit("}", 1)[-1] != "path":
            continue
        candidates = []
        for key, value in elem.attrib.items():
            if key.rsplit("}", 1)[-1] == "id":
                candidates.append(value)
        for value in candidates:
            match = stroke_id.search(value)
            if not match:
                continue
            codepoint = match.group(1).lower()
            number = int(match.group(2))
            by_codepoint.setdefault(codepoint, set()).add(number)

    strokes = {
        chr(int(codepoint, 16)): len(numbers)
        for codepoint, numbers in by_codepoint.items()
        if numbers
    }
    if not strokes:
        raise RuntimeError("KanjiVG stroke cache build found no stroke paths.")

    return strokes


def build_kanji_data() -> dict[str, dict[str, object]]:
    if not KANJIDIC_GZ.exists():
        KANJIDIC_GZ.write_bytes(fetch_url(KANJIDIC_URL))

    with gzip.open(KANJIDIC_GZ, "rb") as fh:
        root = ET.parse(fh).getroot()

    cache: dict[str, dict[str, object]] = {}
    for character in root.findall("character"):
        literal_el = character.find("literal")
        if literal_el is None or not literal_el.text:
            continue
        literal = literal_el.text
        stroke_counts = [
            int(el.text)
            for el in character.findall("./misc/stroke_count")
            if el.text and el.text.isdigit()
        ]
        readings = [
            el.text
            for el in character.findall("./reading_meaning/rmgroup/reading")
            if el.text and el.attrib.get("r_type") in {"ja_on", "ja_kun"}
        ]
        nanori = [
            el.text
            for el in character.findall("./reading_meaning/nanori")
            if el.text
        ]
        meanings = [
            el.text
            for el in character.findall("./reading_meaning/rmgroup/meaning")
            if el.text and not el.attrib
        ]
        cache[literal] = {
            "strokes": stroke_counts,
            "readings": readings,
            "nanori": nanori,
            "meanings": meanings,
        }

    return cache


def build_score_data() -> dict[str, str]:
    text = text_from_html(fetch_url(SCORE_TABLE_URL))
    scores: dict[str, str] = {}
    for num, label in re.findall(r"\b([1-9][0-9]?)\s+(大吉◎|吉○|小吉△|凶×|大凶[✕×])", text):
        n = int(num)
        if 1 <= n <= 81 and str(n) not in scores:
            scores[str(n)] = label.replace("✕", "×")

    if len(scores) < 81:
        raise RuntimeError(f"Expected 81 score rows from {SCORE_TABLE_URL}; got {len(scores)}")

    return scores


def build_japanese_meaning_data(kanji: dict[str, dict[str, object]]) -> dict[str, list[str]]:
    if not JAWIKTIONARY_BZ2.exists():
        JAWIKTIONARY_BZ2.write_bytes(fetch_url(JAWIKTIONARY_DUMP_URL))

    wanted = set(kanji)
    extractor = JapaneseMeaningExtractor()
    meanings: dict[str, list[str]] = {}

    with bz2.open(JAWIKTIONARY_BZ2, "rb") as fh:
        for _, page in ET.iterparse(fh, events=("end",)):
            if page.tag.rsplit("}", 1)[-1] != "page":
                continue
            title = child_text(page, "title")
            ns = child_text(page, "ns")
            if ns == "0" and len(title) == 1 and title in wanted:
                content = revision_text(page)
                if content:
                    meanings[title] = extractor.extract_meanings(content)
            page.clear()
    return meanings


def child_text(parent: ET.Element, name: str) -> str:
    for child in parent:
        if child.tag.rsplit("}", 1)[-1] == name:
            return child.text or ""
    return ""


def revision_text(page: ET.Element) -> str:
    for item in page.iter():
        if item.tag.rsplit("}", 1)[-1] == "text":
            return item.text or ""
    return ""


def build_sqlite_database() -> None:
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)

    strokes = build_stroke_data()
    kanji = build_kanji_data()
    scores = build_score_data()
    meanings_ja = build_japanese_meaning_data(kanji)

    tmp_path = SQLITE_DB.with_suffix(".sqlite.tmp")
    if tmp_path.exists():
        tmp_path.unlink()

    with sqlite3.connect(tmp_path) as db:
        db.executescript(
            """
            CREATE TABLE metadata (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            CREATE TABLE strokes (
                character TEXT PRIMARY KEY,
                strokes INTEGER NOT NULL
            );
            CREATE TABLE kanji (
                character TEXT PRIMARY KEY,
                strokes_json TEXT NOT NULL,
                readings_json TEXT NOT NULL,
                nanori_json TEXT NOT NULL,
                meanings_en_json TEXT NOT NULL
            );
            CREATE TABLE scores (
                number INTEGER PRIMARY KEY,
                label TEXT NOT NULL
            );
            CREATE TABLE meanings_ja (
                character TEXT PRIMARY KEY,
                meanings_json TEXT NOT NULL
            );
            """
        )
        db.executemany(
            "INSERT INTO metadata (key, value) VALUES (?, ?)",
            [
                ("kanjivg_source", KANJIVG_RELEASE_API),
                ("kanjidic_source", KANJIDIC_URL),
                ("score_source", SCORE_TABLE_URL),
                ("jawiktionary_source", JAWIKTIONARY_DUMP_URL),
                ("database_note", "Generated local SQLite data. Do not edit by hand."),
            ],
        )
        db.executemany(
            "INSERT INTO strokes (character, strokes) VALUES (?, ?)",
            sorted(strokes.items()),
        )
        db.executemany(
            """
            INSERT INTO kanji
                (character, strokes_json, readings_json, nanori_json, meanings_en_json)
            VALUES (?, ?, ?, ?, ?)
            """,
            [
                (
                    character,
                    json.dumps(entry.get("strokes", []), ensure_ascii=False),
                    json.dumps(entry.get("readings", []), ensure_ascii=False),
                    json.dumps(entry.get("nanori", []), ensure_ascii=False),
                    json.dumps(entry.get("meanings", []), ensure_ascii=False),
                )
                for character, entry in sorted(kanji.items())
            ],
        )
        db.executemany(
            "INSERT INTO scores (number, label) VALUES (?, ?)",
            [(int(number), label) for number, label in sorted(scores.items(), key=lambda item: int(item[0]))],
        )
        db.executemany(
            "INSERT INTO meanings_ja (character, meanings_json) VALUES (?, ?)",
            [
                (character, json.dumps(meanings, ensure_ascii=False))
                for character, meanings in sorted(meanings_ja.items())
            ],
        )
        db.commit()

    tmp_path.replace(SQLITE_DB)


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def sqlite_rows(query: str, params: tuple[object, ...] = ()) -> list[sqlite3.Row]:
    ensure_data()
    with sqlite3.connect(SQLITE_DB) as db:
        db.row_factory = sqlite3.Row
        return list(db.execute(query, params))


def source_metadata() -> dict[str, str]:
    return {
        row["key"]: row["value"]
        for row in sqlite_rows("SELECT key, value FROM metadata")
    }


def kanji_data() -> dict[str, dict[str, object]]:
    return {
        row["character"]: {
            "strokes": json.loads(row["strokes_json"]),
            "readings": json.loads(row["readings_json"]),
            "nanori": json.loads(row["nanori_json"]),
            "meanings": json.loads(row["meanings_en_json"]),
        }
        for row in sqlite_rows(
            """
            SELECT character, strokes_json, readings_json, nanori_json, meanings_en_json
            FROM kanji
            """
        )
    }


def stroke_data() -> dict[str, int]:
    return {
        row["character"]: int(row["strokes"])
        for row in sqlite_rows("SELECT character, strokes FROM strokes")
    }


def score_data() -> dict[str, str]:
    return {
        str(row["number"]): row["label"]
        for row in sqlite_rows("SELECT number, label FROM scores")
    }


def ja_meaning_data() -> dict[str, list[str]]:
    return {
        row["character"]: json.loads(row["meanings_json"])
        for row in sqlite_rows("SELECT character, meanings_json FROM meanings_ja")
    }


def character_strokes(ch: str, strokes: dict[str, int]) -> int:
    if ch in strokes:
        return int(strokes[ch])
    normalized = ch.translate(SMALL_KANA_TO_FULL)
    if normalized in strokes:
        return int(strokes[normalized])
    raise KeyError(ch)


def strokes_for_text(text: str, strokes: dict[str, int]) -> list[int]:
    return [character_strokes(ch, strokes) for ch in text]


class JapaneseMeaningExtractor:
    def extract_meanings(self, content: str) -> list[str]:
        section = self._extract_section(content, "意義")
        if not section:
            return []
        meanings: list[str] = []
        for raw_line in section.splitlines():
            line = raw_line.strip()
            if not line.startswith("#"):
                continue
            line = line.lstrip("#*:; ").strip()
            cleaned = self._clean_wikitext(line)
            if cleaned and cleaned not in meanings:
                meanings.append(cleaned)
            if len(meanings) >= 5:
                break
        return meanings

    def _extract_section(self, content: str, heading: str) -> str:
        match = re.search(rf"^===+\s*{re.escape(heading)}\s*===+\s*$", content, flags=re.M)
        if not match:
            return ""
        start = match.end()
        next_heading = re.search(r"^===+[^=].*===+\s*$", content[start:], flags=re.M)
        end = start + next_heading.start() if next_heading else len(content)
        return content[start:end]

    def _clean_wikitext(self, text: str) -> str:
        text = re.sub(r"<ref\b.*?</ref>", "", text, flags=re.S)
        text = re.sub(r"<[^>]+>", "", text)
        text = re.sub(r"\{\{(?:[^{}]|\{[^{}]*\})*?\}\}", "", text)
        text = re.sub(r"\[\[([^|\]]+)\|([^|\]]+)\]\]", r"\2", text)
        text = re.sub(r"\[\[([^\]]+)\]\]", r"\1", text)
        text = re.sub(r"\[https?://[^\s\]]+\s*([^\]]+)\]", r"\1", text)
        text = re.sub(r"'{2,}", "", text)
        text = re.sub(r"\s+", " ", text)
        return text.strip(" 。、;；")


def element_from_strokes(strokes: int) -> str:
    return {
        1: "木",
        2: "木",
        3: "火",
        4: "火",
        5: "土",
        6: "土",
        7: "金",
        8: "金",
        9: "水",
        0: "水",
    }[strokes % 10]


GENERATES = {
    "木": "火",
    "火": "土",
    "土": "金",
    "金": "水",
    "水": "木",
}

CONTROLS = {
    "木": "土",
    "土": "水",
    "水": "火",
    "火": "金",
    "金": "木",
}


def element_relation(left: str, right: str) -> str:
    if "?" in {left, right}:
        return "unknown"
    if left == right:
        return "same"
    if GENERATES.get(left) == right:
        return "generates"
    if GENERATES.get(right) == left:
        return "supported_by"
    if CONTROLS.get(left) == right:
        return "controls"
    if CONTROLS.get(right) == left:
        return "controlled_by"
    return "neutral"


def judge_element_sequence(elements: list[str]) -> dict[str, Any]:
    relations = [
        {
            "from": elements[index],
            "to": elements[index + 1],
            "relation": element_relation(elements[index], elements[index + 1]),
        }
        for index in range(len(elements) - 1)
    ]
    weights = {
        "generates": 2,
        "same": 1,
        "supported_by": 1,
        "neutral": 0,
        "controls": -1,
        "controlled_by": -2,
        "unknown": 0,
    }
    points = sum(weights[item["relation"]] for item in relations)
    if points >= 3:
        level = "strong"
    elif points >= 0:
        level = "mixed"
    else:
        level = "weak"
    return {"level": level, "points": points, "relations": relations}


def sound_element(kana_text: str) -> str:
    if not kana_text:
        return "?"
    first = kana_text[0].translate(SMALL_KANA_TO_FULL)
    first = first.translate(str.maketrans("ガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポ", "カキクケコサシスセソタチツテトハヒフヘホハヒフヘホ"))
    if first in "かきくけこカキクケコ":
        return "木"
    if first in "たちつてとなにぬねのらりるれろタチツテトナニヌネノラリルレロ":
        return "火"
    if first in "あいうえおやゆよわアイウエオヤユヨワ":
        return "土"
    if first in "さしすせそサシスセソ":
        return "金"
    if first in "はひふへほまみむめもハヒフヘホマミムメモ":
        return "水"
    return "?"


def final_sound(reading: str) -> str:
    if not reading:
        return "?"
    text = reading.translate(SMALL_KANA_TO_FULL)
    if text[-1] != "ー":
        return text[-1]
    if len(text) < 2:
        return "ー"
    previous = text[-2]
    vowel = {
        "あ": "あ", "か": "あ", "さ": "あ", "た": "あ", "な": "あ", "は": "あ", "けん": "あ", "や": "あ", "ら": "あ", "わ": "あ",
        "ア": "あ", "カ": "あ", "サ": "あ", "タ": "あ", "ナ": "あ", "ハ": "あ", "マ": "あ", "ヤ": "あ", "ラ": "あ", "ワ": "あ",
        "い": "い", "き": "い", "し": "い", "ち": "い", "に": "い", "ひ": "い", "み": "い", "り": "い",
        "イ": "い", "キ": "い", "シ": "い", "チ": "い", "ニ": "い", "ヒ": "い", "ミ": "い", "リ": "い",
        "う": "う", "く": "う", "す": "う", "つ": "う", "ぬ": "う", "ふ": "う", "む": "う", "ゆ": "う", "る": "う",
        "ウ": "う", "ク": "う", "ス": "う", "ツ": "う", "ヌ": "う", "フ": "う", "ム": "う", "ユ": "う", "ル": "う",
        "え": "え", "け": "え", "せ": "え", "て": "え", "ね": "え", "へ": "え", "め": "え", "れ": "え",
        "エ": "え", "ケ": "え", "セ": "え", "テ": "え", "ネ": "え", "ヘ": "え", "メ": "え", "レ": "え",
        "お": "お", "こ": "お", "そ": "お", "と": "お", "の": "お", "ほ": "お", "も": "お", "よ": "お", "ろ": "お", "を": "お",
        "オ": "お", "コ": "お", "ソ": "お", "ト": "お", "ノ": "お", "ホ": "お", "モ": "お", "ヨ": "お", "ロ": "お", "ヲ": "お",
    }.get(previous)
    return vowel or previous


def grid_for_name(surname_strokes: list[int], given_strokes: list[int]) -> dict[str, int]:
    if not surname_strokes or not given_strokes:
        raise ValueError("Surname and given name must both contain at least one character.")

    family_padding = max(0, len(surname_strokes) - 2)
    given_padding = 1 if len(given_strokes) == 1 else 0
    tenkaku = sum(surname_strokes)
    jinkaku = surname_strokes[-1] + given_strokes[0]
    chikaku = sum(given_strokes) + family_padding + given_padding
    soukaku = sum(surname_strokes) + sum(given_strokes)

    if len(surname_strokes) == 1 and len(given_strokes) == 1:
        gaikaku = 2 + family_padding
    elif len(surname_strokes) == 1:
        gaikaku = sum(given_strokes[1:]) + 1 + family_padding
    elif len(given_strokes) == 1:
        gaikaku = sum(surname_strokes[:-1]) + 1 + family_padding
    else:
        gaikaku = sum(surname_strokes[:-1]) + sum(given_strokes[1:]) + family_padding

    return {
        "天格": tenkaku,
        "人格": jinkaku,
        "地格": chikaku,
        "外格": gaikaku,
        "総格": soukaku,
    }


def score_for(n: int, scores: dict[str, str]) -> str:
    key = str(((n - 1) % 81) + 1)
    return scores.get(key, "?")


def score_weight(label: str) -> int:
    if "大吉" in label:
        return 2
    if "吉" in label and "小吉" not in label:
        return 1
    if "小吉" in label:
        return 0
    if "大凶" in label:
        return -2
    if "凶" in label:
        return -1
    return 0


def suitability_from_grid(grid_scores: dict[str, str], name_flags: list[str]) -> dict[str, Any]:
    judged = ["人格", "地格", "外格", "総格"]
    points = sum(score_weight(grid_scores.get(name, "?")) for name in judged)
    if any("total grid is 40+" in flag for flag in name_flags):
        points -= 1
    if points >= 4:
        level = "strong"
    elif points >= 1:
        level = "mixed"
    else:
        level = "weak"
    return {"level": level, "points": points}


def flags(surname: str, given: str, grid: dict[str, int], kanji: dict[str, dict[str, object]]) -> list[str]:
    result: list[str] = []
    if len(given) == 1:
        result.append("one-character given name")
    if grid["総格"] >= 40:
        result.append("total grid is 40+ strokes")
    if surname and given and surname[-1] == given[0]:
        result.append("surname final character equals given-name first character")
    for ch in given:
        entry = kanji.get(ch)
        if not entry:
            continue
        if ch == "凛":
            result.append("contains 凛, added to jinmeiyo kanji in 2004")
    return result


def describe_characters(text: str, strokes: dict[str, int], kanji: dict[str, dict[str, object]]) -> str:
    parts = []
    for ch in text:
        count = character_strokes(ch, strokes)
        entry = kanji.get(ch)
        if entry:
            meanings = entry.get("meanings", [])
            meaning = f" ({'; '.join(str(x) for x in meanings[:3])})" if meanings else ""
        else:
            meaning = ""
        parts.append(f"{ch}:{count}{meaning}")
    return ", ".join(parts)


def character_details(
    text: str,
    strokes: dict[str, int],
    kanji: dict[str, dict[str, object]],
    meanings_ja: dict[str, list[str]],
) -> list[dict[str, Any]]:
    details = []
    for ch in text:
        entry = kanji.get(ch, {})
        details.append(
            {
                "character": ch,
                "strokes": character_strokes(ch, strokes),
                "meanings_en": entry.get("meanings", []),
                "meanings_ja": meanings_ja.get(ch, []),
                "readings": entry.get("readings", []),
                "nanori": entry.get("nanori", []),
            }
        )
    return details


def evaluate_structured(surnames: Iterable[Surname], given_names: Iterable[GivenName]) -> dict[str, Any]:
    ensure_data()
    strokes = stroke_data()
    kanji = kanji_data()
    scores = score_data()

    surname_values = list(surnames)
    given_values = list(given_names)
    meanings_ja = ja_meaning_data()
    metadata = source_metadata()
    response: dict[str, Any] = {
        "surnames": [],
        "candidates": [],
        "results": [],
        "analysis": [],
        "sources": {
            "strokes": metadata.get("kanjivg_source"),
            "kanji": metadata.get("kanjidic_source"),
            "scores": metadata.get("score_source"),
            "meanings_ja": metadata.get("jawiktionary_source"),
        },
    }

    for surname in surname_values:
        surname_strokes = strokes_for_text(surname.text, strokes)
        response["surnames"].append(
            {
                "text": surname.text,
                "reading": surname.reading,
                "strokes": surname_strokes,
                "characters": character_details(surname.text, strokes, kanji, meanings_ja),
            }
        )

    for given in given_values:
        given_strokes = strokes_for_text(given.kanji, strokes)
        response["candidates"].append(
            {
                "text": given.kanji,
                "reading": given.reading,
                "strokes": given_strokes,
                "characters": character_details(given.kanji, strokes, kanji, meanings_ja),
            }
        )

    for given in given_values:
        aggregate_points = 0
        levels: list[str] = []
        for surname in surname_values:
            surname_strokes = strokes_for_text(surname.text, strokes)
            given_strokes = strokes_for_text(given.kanji, strokes)
            grid = grid_for_name(surname_strokes, given_strokes)
            grid_scores = {name: score_for(value, scores) for name, value in grid.items()}
            five_elements = {
                "天格": element_from_strokes(grid["天格"]),
                "人格": element_from_strokes(grid["人格"]),
                "地格": element_from_strokes(grid["地格"]),
            }
            surname_final = final_sound(surname.reading)
            surname_sound_element = sound_element(surname_final)
            given_sound_element = sound_element(given.reading)
            sound_elements = {
                "surname_final": {"sound": surname_final, "element": surname_sound_element},
                "given_first": {"sound": given.reading[0] if given.reading else "", "element": given_sound_element},
            }
            name_flags = flags(surname.text, given.kanji, grid, kanji)
            suitability = suitability_from_grid(grid_scores, name_flags)
            aggregate_points += int(suitability["points"])
            levels.append(str(suitability["level"]))
            response["results"].append(
                {
                    "surname": surname.text,
                    "surname_reading": surname.reading,
                    "candidate": given.kanji,
                    "candidate_reading": given.reading,
                    "grid": grid,
                    "grid_scores": grid_scores,
                    "five_elements": five_elements,
                    "five_element_judgment": judge_element_sequence([
                        five_elements["天格"],
                        five_elements["人格"],
                        five_elements["地格"],
                    ]),
                    "sound_elements": sound_elements,
                    "sound_judgment": judge_element_sequence([surname_sound_element, given_sound_element]),
                    "flags": name_flags,
                    "suitability": suitability,
                }
            )

        if levels:
            if levels.count("strong") == len(levels):
                summary_level = "strong"
            elif "weak" in levels and levels.count("weak") >= levels.count("strong"):
                summary_level = "weak"
            else:
                summary_level = "mixed"
            response["analysis"].append(
                {
                    "candidate": given.kanji,
                    "reading": given.reading,
                    "level": summary_level,
                    "points": aggregate_points,
                    "strong_count": levels.count("strong"),
                    "mixed_count": levels.count("mixed"),
                    "weak_count": levels.count("weak"),
                }
            )

    response["analysis"].sort(key=lambda item: (item["points"], item["strong_count"]), reverse=True)
    return response


def evaluate(surnames: Iterable[Surname], given_names: Iterable[GivenName]) -> str:
    ensure_data()
    strokes = stroke_data()
    kanji = kanji_data()
    scores = score_data()

    lines: list[str] = []
    for surname in surnames:
        surname_strokes = strokes_for_text(surname.text, strokes)
        lines.append(f"# Surname {surname.text} ({surname.reading})")
        lines.append(f"strokes: {describe_characters(surname.text, strokes, kanji)}")
        lines.append("")
        for given in given_names:
            given_strokes = strokes_for_text(given.kanji, strokes)
            grid = grid_for_name(surname_strokes, given_strokes)
            five_elements = {
                "天格": element_from_strokes(grid["天格"]),
                "人格": element_from_strokes(grid["人格"]),
                "地格": element_from_strokes(grid["地格"]),
            }
            surname_final = final_sound(surname.reading)
            surname_sound = sound_element(surname_final)
            given_sound = sound_element(given.reading)
            grid_text = " / ".join(
                f"{name} {value}{score_for(value, scores)}"
                for name, value in grid.items()
            )
            elements_text = " / ".join(f"{name} {element}" for name, element in five_elements.items())
            name_flags = flags(surname.text, given.kanji, grid, kanji)
            lines.append(f"## {given.kanji} ({given.reading})")
            lines.append(f"strokes: {describe_characters(given.kanji, strokes, kanji)}")
            lines.append(f"grids: {grid_text}")
            lines.append(f"five-elements by grid: {elements_text}")
            lines.append(f"sound elements: surname-final={surname_final}:{surname_sound} / given-first={given.reading[0]}:{given_sound}")
            if name_flags:
                lines.append(f"flags: {', '.join(name_flags)}")
            lines.append("")
    return "\n".join(lines).rstrip()


def parse_given(raw: str) -> GivenName:
    if ":" not in raw:
        raise argparse.ArgumentTypeError("Given names must be KANJI:reading, for example 蓮:やまと")
    kanji, reading = raw.split(":", 1)
    if not kanji or not reading:
        raise argparse.ArgumentTypeError("Given names must include both kanji and reading.")
    return GivenName(kanji=kanji, reading=reading)


def parse_surname(raw: str) -> Surname:
    if ":" in raw:
        text, reading = raw.split(":", 1)
    else:
        text, reading = raw, raw
    if not text or not reading:
        raise argparse.ArgumentTypeError("Surnames must be TEXT or TEXT:reading.")
    return Surname(text=text, reading=reading)


def sample_inputs() -> tuple[list[Surname], list[GivenName]]:
    surnames = [Surname("山田", "やまだ"), Surname("佐藤", "さとう")]
    givens = [
        GivenName("陽太", "ようた"),
        GivenName("大和", "やまと"),
        GivenName("悠真", "やまと"),
        GivenName("蓮", "やまと"),
        GivenName("湊", "やまと"),
        GivenName("凛", "はな"),
        GivenName("陽菜", "はな"),
        GivenName("葵", "あおい"),
        GivenName("翼", "つばさ"),
        GivenName("樹", "けん"),
        GivenName("健", "けん"),
        GivenName("咲良", "はな"),
        GivenName("結菜", "はな"),
    ]
    return surnames, givens


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Calculate Japanese name 五格 grids from external stroke data.")
    parser.add_argument("--surname", action="append", type=parse_surname, default=[], help="Surname as TEXT or TEXT:reading. Repeatable.")
    parser.add_argument("--given", action="append", type=parse_given, default=[], help="Given name as KANJI:reading. Repeatable.")
    parser.add_argument("--sample", action="store_true", help="Run the names discussed in this folder.")
    parser.add_argument("--ensure-data", action="store_true", help="Download/build local source caches, then exit unless names are supplied.")
    args = parser.parse_args(argv)

    if args.ensure_data:
        ensure_data()
        if not args.sample and not args.surname and not args.given:
            print(f"Data ready in {SQLITE_DB}")
            return 0

    if args.sample:
        surnames, givens = sample_inputs()
    else:
        surnames, givens = args.surname, args.given

    if not surnames or not givens:
        parser.error("Provide --sample, or at least one --surname and one --given KANJI:reading.")

    print(evaluate(surnames, givens))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
