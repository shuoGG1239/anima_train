"""Fetch Danbooru images by tag(s) into datasets/<slug>/images.

Edit TAGS (and optional settings), then run:

    python danbooru_fetch.py

Requires: pip install gallery-dl pillow PySocks
Uses gallery-dl with SOCKS proxy (v2rayN default 1080).
"""

from __future__ import annotations

import re
import shutil
import subprocess
import sys
from pathlib import Path
from urllib.parse import quote

from PIL import Image

# --- edit here ---
TAGS = ["seia_(swimsuit)_(blue_archive)"]

PROXY = "socks5://127.0.0.1:1080"
MIN_SIDE = 768
MAX_SIDE = 2048
PREPROCESS = True
JPEG_QUALITY = 95
# Prefix for caption; empty string = Danbooru tags only (comma-separated).
TRIGGER = ""
# --- end config ---

ROOT = Path(__file__).resolve().parent
DATASETS_DIR = ROOT / "datasets"
IMG_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif"}
SKIP_EXTS = {".mp4", ".webm", ".zip", ".rar"}
CAPTION_DROP = {
    "commentary_request",
    "translation_request",
    "translated",
    "check_translation",
    "artist_request",
    "bad_id",
    "bad_pixiv_id",
    "md5_mismatch",
}


def tags_query(tags: list[str]) -> str:
    return "+".join(t.strip() for t in tags if t.strip())


def dataset_slug(tags: list[str]) -> str:
    raw = "_".join(t.strip() for t in tags if t.strip())
    slug = re.sub(r"[^\w\-.]+", "_", raw, flags=re.ASCII)
    return slug.strip("_") or "danbooru"


def post_url(post_id: str) -> str:
    return f"https://danbooru.donmai.us/posts/{post_id}"


def seed_archive(archive: Path, post_ids: set[str]) -> None:
    if not post_ids:
        return
    known: set[str] = set()
    if archive.is_file():
        known = {line.strip() for line in archive.read_text(encoding="utf-8").splitlines() if line.strip()}
    new_lines = [post_url(pid) for pid in sorted(post_ids, key=int) if post_url(pid) not in known]
    if not new_lines:
        return
    with archive.open("a", encoding="utf-8") as f:
        for line in new_lines:
            f.write(line + "\n")


def run_gallery_dl(dest: Path, query: str, archive: Path) -> None:
    url = f"https://danbooru.donmai.us/posts?tags={quote(query, safe='+()_-')}"
    filter_expr = f"min(image_width, image_height) >= {MIN_SIDE}"
    cmd = [
        sys.executable,
        "-m",
        "gallery_dl",
        "--proxy",
        PROXY,
        "-o",
        "extractor.*.timeout=120.0",
        "-o",
        "downloader.*.timeout=120.0",
        "-d",
        str(dest),
        "--filename",
        "{id}.{extension}",
        "--filter",
        filter_expr,
        "--write-tags",
        "--download-archive",
        str(archive),
        url,
    ]
    print("Running:", " ".join(cmd))
    proc = subprocess.run(cmd)
    if proc.returncode != 0:
        print(
            f"gallery-dl exited with code {proc.returncode} "
            "(often timeout mid-batch). Re-run this script to resume; "
            "existing files are kept.",
            file=sys.stderr,
        )


def find_tag_file(img: Path) -> Path | None:
    for candidate in (
        img.with_name(img.name + ".txt"),
        img.with_suffix(".txt"),
        img.parent / f"{img.stem}.txt",
    ):
        if candidate.is_file():
            return candidate
    return None


def tags_to_caption(tag_path: Path | None) -> str:
    if tag_path is None:
        return TRIGGER.strip()
    lines: list[str] = []
    seen: set[str] = set()
    for line in tag_path.read_text(encoding="utf-8", errors="replace").splitlines():
        t = line.strip()
        if not t or t in CAPTION_DROP:
            continue
        key = t.lower()
        if key in seen:
            continue
        seen.add(key)
        lines.append(t)
    body = ", ".join(lines)
    trig = TRIGGER.strip()
    if trig and body:
        return f"{trig}, {body}"
    if trig:
        return trig
    return body


def preprocess_image(src: Path, dst: Path) -> None:
    with Image.open(src) as im:
        im.load()
        w, h = im.size
        if min(w, h) < MIN_SIDE:
            raise ValueError(f"too small: {w}x{h}")

        if im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info):
            rgba = im.convert("RGBA")
            bg = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
            bg.paste(rgba, mask=rgba.split()[-1])
            im = bg.convert("RGB")
        elif im.mode != "RGB":
            im = im.convert("RGB")

        w, h = im.size
        m = max(w, h)
        if m > MAX_SIDE:
            scale = MAX_SIDE / m
            nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
            if min(nw, nh) < MIN_SIDE:
                scale = MIN_SIDE / min(w, h)
                nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
            im = im.resize((nw, nh), Image.Resampling.LANCZOS)

        im.save(dst, format="JPEG", quality=JPEG_QUALITY, optimize=True)


def organize_and_preprocess(
    download_root: Path, images_dir: Path, archive: Path
) -> dict[str, int]:
    stats = {
        "images": 0,
        "skipped_video": 0,
        "skipped_small": 0,
        "errors": 0,
    }
    images_dir.mkdir(parents=True, exist_ok=True)

    sources = sorted(
        p for p in download_root.rglob("*") if p.is_file() and p.suffix.lower() in IMG_EXTS
    )
    for src in sources:
        if not src.stem.isdigit():
            continue
        if (
            src.parent.resolve() == images_dir.resolve()
            and src.suffix.lower() == ".jpg"
            and (images_dir / f"{src.stem}.txt").is_file()
        ):
            continue
        post_id = src.stem
        tag_path = find_tag_file(src)
        caption = tags_to_caption(tag_path)
        out_img = images_dir / f"{post_id}.jpg"
        out_txt = images_dir / f"{post_id}.txt"

        try:
            if PREPROCESS:
                preprocess_image(src, out_img)
            else:
                shutil.copy2(src, images_dir / f"{post_id}{src.suffix.lower()}")
                out_img = images_dir / f"{post_id}{src.suffix.lower()}"
            out_txt.write_text(caption + "\n", encoding="utf-8")
            seed_archive(archive, {post_id})
            stats["images"] += 1
        except ValueError:
            stats["skipped_small"] += 1
        except Exception as exc:
            stats["errors"] += 1
            print(f"skip {src.name}: {exc}", file=sys.stderr)

    for path in download_root.rglob("*"):
        if path.is_file() and path.suffix.lower() in SKIP_EXTS:
            stats["skipped_video"] += 1
            path.unlink(missing_ok=True)

    nested = download_root / "danbooru"
    if nested.is_dir() and stats["images"] > 0:
        shutil.rmtree(nested, ignore_errors=True)

    return stats


def main() -> None:
    if not TAGS or not tags_query(TAGS):
        raise SystemExit("TAGS is empty — set at least one Danbooru tag.")

    query = tags_query(TAGS)
    slug = dataset_slug(TAGS)
    dataset_root = DATASETS_DIR / slug
    download_root = dataset_root
    images_dir = dataset_root / "images"
    archive = dataset_root / "gallery-dl-archive.txt"

    print(f"tags: {query}")
    print(f"dataset: {dataset_root}")

    if images_dir.is_dir():
        seed_archive(
            archive,
            {p.stem for p in images_dir.glob("*.jpg") if p.stem.isdigit()},
        )

    run_gallery_dl(download_root, query, archive)
    stats = organize_and_preprocess(download_root, images_dir, archive)

    paired = sum(
        1
        for p in images_dir.glob("*")
        if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
        and (images_dir / f"{p.stem}.txt").is_file()
    )
    print("done:", stats)
    print(f"images_dir: {images_dir}")
    print(f"paired image+caption: {paired}")


if __name__ == "__main__":
    main()
