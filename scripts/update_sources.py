#!/usr/bin/env python3
"""Download source data and rebuild the generated local SQLite database."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from name_fortune import SQLITE_DB, SOURCE_DIR, update_sources  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Update local naming source data.")
    parser.add_argument("--download", action="store_true", help="Download missing source files.")
    parser.add_argument("--build", action="store_true", help="Build the generated SQLite database.")
    parser.add_argument("--all", action="store_true", help="Download missing sources and build SQLite.")
    parser.add_argument("--force-download", action="store_true", help="Redownload sources even when files exist.")
    args = parser.parse_args(argv)

    download = args.all or args.download
    build = args.all or args.build
    if not download and not build:
        parser.error("Choose --download, --build, or --all.")

    update_sources(download=download, build=build, force_download=args.force_download)
    if download:
        print(f"Sources ready in {SOURCE_DIR}")
    if build:
        print(f"Generated database ready at {SQLITE_DB}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
