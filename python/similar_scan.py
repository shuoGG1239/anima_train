"""Perceptual-hash clustering for similar images."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import imagehash
from PIL import Image

IMG_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif"}


@dataclass(frozen=True)
class ImageItem:
    path: Path
    distance: int
    size_bytes: int


@dataclass(frozen=True)
class SimilarGroup:
    index: int
    items: list[ImageItem]


@dataclass(frozen=True)
class ScanResult:
    root: Path
    scanned: int
    skipped: int
    threshold: int
    method: str
    recursive: bool
    groups: list[SimilarGroup]


class UnionFind:
    def __init__(self, n: int) -> None:
        self.parent = list(range(n))

    def find(self, x: int) -> int:
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]
            x = self.parent[x]
        return x

    def union(self, a: int, b: int) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.parent[rb] = ra


def iter_images(root: Path, recursive: bool) -> list[Path]:
    if recursive:
        paths = [p for p in root.rglob("*") if p.is_file() and p.suffix.lower() in IMG_EXTS]
    else:
        paths = [p for p in root.iterdir() if p.is_file() and p.suffix.lower() in IMG_EXTS]
    return sorted(paths)


def compute_hash(path: Path, method: str) -> imagehash.ImageHash:
    with Image.open(path) as im:
        im.load()
        if im.mode not in ("RGB", "L"):
            im = im.convert("RGB")
        fn = getattr(imagehash, method)
        return fn(im)


def scan_similar_groups(
    root: Path,
    *,
    threshold: int = 8,
    method: str = "phash",
    recursive: bool = False,
) -> ScanResult:
    root = root.resolve()
    if not root.is_dir():
        raise ValueError(f"not a directory: {root}")
    if method not in ("phash", "dhash", "ahash", "whash"):
        raise ValueError(f"unsupported hash method: {method}")
    if threshold < 0 or threshold > 32:
        raise ValueError("threshold must be between 0 and 32")

    images = iter_images(root, recursive)
    hashes: list[imagehash.ImageHash] = []
    valid: list[Path] = []
    skipped = 0
    for path in images:
        try:
            hashes.append(compute_hash(path, method))
            valid.append(path)
        except OSError:
            skipped += 1

    n = len(valid)
    groups: list[SimilarGroup] = []
    if n < 2:
        return ScanResult(
            root=root,
            scanned=n,
            skipped=skipped,
            threshold=threshold,
            method=method,
            recursive=recursive,
            groups=groups,
        )

    uf = UnionFind(n)
    for i in range(n):
        for j in range(i + 1, n):
            if hashes[i] - hashes[j] <= threshold:
                uf.union(i, j)

    clusters: dict[int, list[int]] = {}
    for i in range(n):
        clusters.setdefault(uf.find(i), []).append(i)

    cluster_list = [idxs for idxs in clusters.values() if len(idxs) > 1]
    cluster_list.sort(key=lambda g: (-len(g), valid[g[0]].name))

    for gi, idxs in enumerate(cluster_list, 1):
        ref = hashes[idxs[0]]
        items: list[ImageItem] = []
        for i in idxs:
            path = valid[i]
            items.append(
                ImageItem(
                    path=path,
                    distance=int(ref - hashes[i]),
                    size_bytes=path.stat().st_size,
                )
            )
        items.sort(key=lambda it: (it.distance, it.path.name))
        groups.append(SimilarGroup(index=gi, items=items))

    return ScanResult(
        root=root,
        scanned=n,
        skipped=skipped,
        threshold=threshold,
        method=method,
        recursive=recursive,
        groups=groups,
    )


def resolve_under_root(root: Path, rel_or_abs: str) -> Path:
    root = root.resolve()
    candidate = Path(rel_or_abs)
    path = (candidate if candidate.is_absolute() else root / candidate).resolve()
    if path == root or root in path.parents:
        return path
    raise ValueError("path outside scan root")
