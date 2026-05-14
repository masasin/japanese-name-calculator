# Japanese Name Calculator

[日本語の説明へ](#日本語)

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

## Docker Compose deployment

Build and start the app on a home server:

```bash
mkdir -p data/sources data/generated
docker compose up -d --build
```

Then open:

```text
http://SERVER_IP:8000
```

The container starts FastAPI with uvicorn on `0.0.0.0:8000`. The Compose file exposes host port `8000` by default. To use a different host port:

```bash
HOST_PORT=8080 docker compose up -d --build
```

First startup runs:

```bash
uv run --no-sync python name_fortune.py --ensure-data
```

That command downloads missing source dumps and builds `data/generated/naming.sqlite` only when the generated database is absent. Later restarts reuse the bind-mounted data. The Compose file persists:

- `./data/sources` -> `/app/data/sources`
- `./data/generated` -> `/app/data/generated`

The first run can take several minutes because the app waits for the source downloads and database build before serving requests.

Rebuild the generated database from already downloaded sources:

```bash
docker compose run --rm naming uv run --no-sync python scripts/update_sources.py --build
```

Download missing sources and rebuild:

```bash
docker compose run --rm naming uv run --no-sync python scripts/update_sources.py --all
```

Force fresh source downloads and rebuild:

```bash
docker compose run --rm naming uv run --no-sync python scripts/update_sources.py --all --force-download
```

Rebuild the image after source code changes:

```bash
docker compose up -d --build
```

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

## License

BSD-2-Clause. See `LICENSE`.

## 日本語

このフォルダには、日本人名の五格チェックを行うローカル FastAPI Web アプリと Python 計算ツールが含まれています。

### ファイル

- `name_fortune.py`: コマンドライン用の計算ツール。
- `main.py`: FastAPI アプリ。
- `static/`: ブラウザ用のシングルページ UI。
- `scripts/update_sources.py`: 元データをダウンロードし、生成データを再構築するスクリプト。
- `data/sources/`: KanjiVG、KANJIDIC2、日本語版 Wiktionary のダウンロード済み元データ。
- `data/generated/naming.sqlite`: 実行時に使う生成済みローカルデータベース。

### データソース

- KanjiVG: 漢字とかなの主な画数データ。Unicode 文字ごとの一意な stroke path ID を数えます。
- KANJIDIC2 / EDRDG: 漢字の意味、読み、メタデータ。
- 日本語版 Wiktionary dump: ダウンロード済み dump からローカルに抽出した日本語の漢字の意味。
- fortune.netoff.co.jp: 公開されている 1-81 の点数ラベル。Benesse / たまひよ独自のラベルや文章ではありません。

### 使い方

Web アプリを起動します。

```bash
uv run uvicorn main:app --host 127.0.0.1 --port 8000
```

次の URL を開きます。

```text
http://127.0.0.1:8000
```

ブラウザ UI は名字と候補名をローカルストレージに保存し、JSON のエクスポートとインポートに対応しています。

### Docker Compose でのデプロイ

ホームサーバー上でアプリをビルドして起動します。

```bash
mkdir -p data/sources data/generated
docker compose up -d --build
```

次の URL を開きます。

```text
http://SERVER_IP:8000
```

コンテナは `0.0.0.0:8000` で uvicorn による FastAPI を起動します。Compose ファイルはデフォルトでホストの `8000` 番ポートを公開します。別のホストポートを使う場合は次のように実行します。

```bash
HOST_PORT=8080 docker compose up -d --build
```

初回起動時には次のコマンドが実行されます。

```bash
uv run --no-sync python name_fortune.py --ensure-data
```

このコマンドは生成済みデータベースが存在しない場合のみ、不足している元データをダウンロードして `data/generated/naming.sqlite` を作成します。以降の再起動では、bind mount されたデータを再利用します。Compose ファイルは次のディレクトリを永続化します。

- `./data/sources` -> `/app/data/sources`
- `./data/generated` -> `/app/data/generated`

初回実行では、アプリが元データのダウンロードとデータベース作成を待ってから配信を開始するため、数分かかることがあります。

ダウンロード済みの元データから生成データベースを再構築します。

```bash
docker compose run --rm naming uv run --no-sync python scripts/update_sources.py --build
```

不足している元データをダウンロードして再構築します。

```bash
docker compose run --rm naming uv run --no-sync python scripts/update_sources.py --all
```

元データを強制的に再ダウンロードして再構築します。

```bash
docker compose run --rm naming uv run --no-sync python scripts/update_sources.py --all --force-download
```

ソースコード変更後にイメージを再ビルドします。

```bash
docker compose up -d --build
```

コマンドラインのサンプルセットを実行します。

```bash
uv run python ~/Documents/naming/name_fortune.py --sample
```

任意の名前で実行します。

```bash
uv run python ~/Documents/naming/name_fortune.py \
  --surname '山田:やまだ' \
  --surname '佐藤:さとう' \
  --given '蓮:やまと' \
  --given '凛:はな'
```

ローカルデータを更新または作成します。

```bash
uv run python ~/Documents/naming/scripts/update_sources.py --all
```

ダウンロード済みの元データから再構築します。

```bash
uv run python ~/Documents/naming/scripts/update_sources.py --build
```

基本的なチェックを実行します。

```bash
uv run python -m py_compile main.py name_fortune.py
node --check static/app.js
```

### 補足

五格の計算は、確認済みの名前について、`山田` のような四文字名字の扱いを含め、貼り付けられた例と一致します。

点数ラベルは公開されている 81 数表に基づいているため、計算された格数が一致していても、たまひよの表示と異なる場合があります。

Web UI は、たまひよ風の表示に合わせて `×` の点数ラベルを `△` として表示します。内部の点数計算では、公開表の元の点数重みを維持しています。

### ライセンス

BSD-2-Clause です。詳しくは `LICENSE` を参照してください。
