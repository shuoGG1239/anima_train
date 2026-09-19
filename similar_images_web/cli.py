"""CLI: print similar image groups (same logic as the web UI).

    cd path\\to\\images
    python C:\\c_git_project\\anima_train\\similar_images_web\\cli.py

Web UI: double-click similar_images_web\\start.py
"""

from __future__ import annotations

import sys
from pathlib import Path

_PKG_ROOT = Path(__file__).resolve().parent
_TRAIN_ROOT = _PKG_ROOT.parent
if str(_TRAIN_ROOT) not in sys.path:
    sys.path.insert(0, str(_TRAIN_ROOT))

from similar_images_web.similar_scan import scan_similar_groups

TARGET: Path | None = None
RECURSIVE = False
HASH_THRESHOLD = 8
HASH_METHOD = "phash"


def main() -> None:
    root = (TARGET or Path.cwd()).resolve()
    try:
        result = scan_similar_groups(
            root,
            threshold=HASH_THRESHOLD,
            method=HASH_METHOD,
            recursive=RECURSIVE,
        )
    except ValueError as exc:
        raise SystemExit(exc) from exc

    if result.scanned < 2:
        print(f"{root}: need at least 2 images (found {result.scanned})")
        return

    if not result.groups:
        print(
            f"{root}: no similar groups (threshold={result.threshold}, method={result.method}) "
            f"among {result.scanned} image(s)"
        )
        return

    involved = sum(len(g.items) for g in result.groups)
    print(f"{root}")
    print(f"  scanned: {result.scanned} image(s), skipped: {result.skipped}")
    print(f"  method: {result.method}, max hamming distance: {result.threshold}")
    print(f"  similar groups: {len(result.groups)} ({involved} files)")
    print()

    for group in result.groups:
        print(f"[{group.index}] {len(group.items)} files")
        for item in group.items:
            rel = item.path.relative_to(root) if item.path.is_relative_to(root) else item.path
            print(f"      d={item.distance:2d}  {rel}")
        print()


if __name__ == "__main__":
    main()
