"""CLI: scan similar image groups and emit JSON (used by the desktop app).

    python python/scan_cli.py --path C:\\path\\to\\images [--threshold 8] [--method phash] [--recursive] [--json-out result.json]

When --json-out is given, JSON is written to that file (and a copy to stdout);
otherwise it is printed to stdout only. Same logic as similar_scan.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_PY_ROOT = Path(__file__).resolve().parent
if str(_PY_ROOT) not in sys.path:
    sys.path.insert(0, str(_PY_ROOT))

from similar_scan import scan_similar_groups  # noqa: E402


def build_result(
    root: Path,
    *,
    threshold: int,
    method: str,
    recursive: bool,
) -> dict:
    result = scan_similar_groups(
        root,
        threshold=threshold,
        method=method,
        recursive=recursive,
    )
    groups = []
    for group in result.groups:
        groups.append(
            {
                "index": group.index,
                "items": [
                    {
                        "path": str(item.path),
                        "name": item.path.name,
                        "distance": item.distance,
                        "size_bytes": item.size_bytes,
                    }
                    for item in group.items
                ],
            }
        )
    return {
        "root": str(result.root),
        "scanned": result.scanned,
        "skipped": result.skipped,
        "threshold": result.threshold,
        "method": result.method,
        "recursive": result.recursive,
        "groups": groups,
    }


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Scan similar image groups and emit JSON.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("--path", default=".", help="image folder to scan")
    parser.add_argument("--threshold", type=int, default=8, help="max hamming distance (0-32)")
    parser.add_argument("--method", default="phash", choices=["phash", "dhash", "ahash", "whash"])
    parser.add_argument("--recursive", action="store_true", help="scan subfolders recursively")
    parser.add_argument("--json-out", default=None, help="write JSON to this file")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    root = Path(args.path).expanduser().resolve()
    threshold = max(0, min(32, args.threshold))

    try:
        payload = build_result(
            root,
            threshold=threshold,
            method=args.method,
            recursive=args.recursive,
        )
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    text = json.dumps(payload, ensure_ascii=False, indent=2)
    if args.json_out:
        Path(args.json_out).write_text(text, encoding="utf-8")
    print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
