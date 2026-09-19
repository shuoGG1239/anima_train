"""Preprocess luluka_extra: rename, resize, WD14 tag for Anima."""
from __future__ import annotations

import csv
import hashlib
import re
import sys
from pathlib import Path

import numpy as np
from onnxruntime import InferenceSession
from PIL import Image

IMG_DIR = Path(r"C:\c_git_project\aigc-ui\datasets\luluka_extra")
MODEL_DIR = Path(
    r"C:\c_git_project\ComfyUI-aki-v2\ComfyUI\custom_nodes\ComfyUI-WD14-Tagger\models"
)
MODEL_NAME = "wd-swinv2-tagger-v3"
TRIGGER = "moria luluka"
MAX_SIDE = 2048
MIN_SIDE = 768
THRESHOLD = 0.35
CHARACTER_THRESHOLD = 0.85
EXCLUDE = {
    "moria luluka",
    "luluka",
    "luokun",
    "watermark",
    "text",
    "signature",
    "artist name",
    "username",
    "patreon username",
    "twitter username",
    "logo",
    "english text",
    "chinese text",
    "japanese text",
    "commentary",
    "commentary request",
}
IMG_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}


def short_stem(path: Path) -> str:
    name = path.stem
    # keep already-short names
    if len(name) <= 60 and re.fullmatch(r"[A-Za-z0-9_\-\(\)]+", name or "x"):
        return name
    # prefer id-like prefix from pixiv dumps: 11493533_...
    m = re.match(r"^(\d{5,})", name)
    if m:
        return f"pixiv_{m.group(1)}"
    h = hashlib.md5(name.encode("utf-8", errors="ignore")).hexdigest()[:10]
    return f"img_{h}"


def resize_image(im: Image.Image) -> Image.Image:
    im = im.convert("RGB")
    w, h = im.size
    # upscale small side
    mn = min(w, h)
    if mn < MIN_SIDE:
        scale = MIN_SIDE / mn
        w, h = int(round(w * scale)), int(round(h * scale))
        im = im.resize((w, h), Image.LANCZOS)
    # downscale large side
    mx = max(im.size)
    if mx > MAX_SIDE:
        scale = MAX_SIDE / mx
        w, h = int(round(im.size[0] * scale)), int(round(im.size[1] * scale))
        im = im.resize((w, h), Image.LANCZOS)
    # ensure even dims for some train pipelines
    w, h = im.size
    w2, h2 = w - (w % 2), h - (h % 2)
    if (w2, h2) != (w, h) and w2 > 0 and h2 > 0:
        im = im.crop((0, 0, w2, h2))
    return im


def load_tags(csv_path: Path) -> tuple[list[str], int, int]:
    tags: list[str] = []
    general_index = None
    character_index = None
    with csv_path.open(encoding="utf-8") as f:
        reader = csv.reader(f)
        next(reader)
        for row in reader:
            if general_index is None and row[2] == "0":
                general_index = reader.line_num - 2
            elif character_index is None and row[2] == "4":
                character_index = reader.line_num - 2
            tags.append(row[1].replace("_", " "))
    if general_index is None or character_index is None:
        raise RuntimeError("failed to parse tag csv")
    return tags, general_index, character_index


def preprocess_batch(image: Image.Image, size: int) -> np.ndarray:
    ratio = float(size) / max(image.size)
    new_size = tuple(int(x * ratio) for x in image.size)
    image = image.resize(new_size, Image.LANCZOS)
    square = Image.new("RGB", (size, size), (255, 255, 255))
    square.paste(image, ((size - new_size[0]) // 2, (size - new_size[1]) // 2))
    arr = np.asarray(square).astype(np.float32)[:, :, ::-1]
    return np.expand_dims(arr, 0)


def tag_image(session, tags, general_index, character_index, image: Image.Image) -> str:
    inp = session.get_inputs()[0]
    height = inp.shape[1]
    batch = preprocess_batch(image, height)
    probs = session.run([session.get_outputs()[0].name], {inp.name: batch})[0][0]
    result = list(zip(tags, probs))
    general = [t for t in result[general_index:character_index] if t[1] > THRESHOLD]
    character = [t for t in result[character_index:] if t[1] > CHARACTER_THRESHOLD]
    names = []
    seen = set()
    for name, _ in character + general:
        low = name.lower().strip()
        if low in EXCLUDE or low in seen:
            continue
        seen.add(low)
        names.append(name)
    body = ", ".join(names)
    return f"{TRIGGER}, {body}" if body else TRIGGER


def main() -> int:
    onnx = MODEL_DIR / f"{MODEL_NAME}.onnx"
    csv_path = MODEL_DIR / f"{MODEL_NAME}.csv"
    if not onnx.exists():
        print("missing wd14 model", onnx, file=sys.stderr)
        return 1

    images = sorted(
        [p for p in IMG_DIR.iterdir() if p.is_file() and p.suffix.lower() in IMG_EXTS],
        key=lambda p: p.name.lower(),
    )
    print(f"found {len(images)} images in {IMG_DIR}")

    # 1) rename overly long / unsafe names first
    renamed = []
    used = set()
    for src in images:
        stem = short_stem(src)
        # avoid collision
        base = stem
        n = 1
        while stem.lower() in used or (
            (IMG_DIR / f"{stem}{src.suffix.lower()}").exists()
            and (IMG_DIR / f"{stem}{src.suffix.lower()}").resolve() != src.resolve()
        ):
            stem = f"{base}_{n}"
            n += 1
        used.add(stem.lower())
        dst = IMG_DIR / f"{stem}{src.suffix.lower()}"
        if dst.resolve() != src.resolve():
            # also move companion txt if any
            old_txt = src.with_suffix(".txt")
            print(f"rename: {src.name[:70]} -> {dst.name}")
            src.rename(dst)
            if old_txt.exists():
                old_txt.rename(dst.with_suffix(".txt"))
            renamed.append(dst)
        else:
            renamed.append(src)

    # 2) resize in place (save as png for quality consistency if was huge jpeg ok keep)
    print("loading WD14 ...")
    session = InferenceSession(str(onnx), providers=["CPUExecutionProvider"])
    tags, gi, ci = load_tags(csv_path)

    final_images = sorted(
        [p for p in IMG_DIR.iterdir() if p.is_file() and p.suffix.lower() in IMG_EXTS],
        key=lambda p: p.name.lower(),
    )

    for i, path in enumerate(final_images, 1):
        im = Image.open(path)
        before = im.size
        im2 = resize_image(im)
        after = im2.size
        # write resized: prefer png if transparency needed else keep jpeg for jpg sources under 2k
        out_path = path
        if path.suffix.lower() in {".jpg", ".jpeg"} and max(after) <= MAX_SIDE:
            im2.save(out_path, quality=95, optimize=True)
        else:
            # normalize extension to .png when converting from weird formats or when we changed size a lot
            if path.suffix.lower() not in {".png", ".jpg", ".jpeg"}:
                out_path = path.with_suffix(".png")
                path.unlink(missing_ok=True)
            im2.save(out_path, optimize=True)

        caption = tag_image(session, tags, gi, ci, im2)
        out_path.with_suffix(".txt").write_text(caption + "\n", encoding="utf-8")
        print(f"[{i}/{len(final_images)}] {before} -> {after}  {out_path.name}")
        print(f"  {caption[:160]}{'...' if len(caption) > 160 else ''}")

    # remove orphan txt without image
    stems = {p.stem for p in IMG_DIR.iterdir() if p.suffix.lower() in IMG_EXTS}
    for t in list(IMG_DIR.glob("*.txt")):
        if t.stem not in stems:
            print("remove orphan caption", t.name)
            t.unlink()

    print("done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
