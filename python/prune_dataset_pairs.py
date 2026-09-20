"""Delete images without a matching .txt and .txt without a matching image.

Run from the folder that contains pairs (e.g. datasets/natsume_an-an/images):

    cd C:\\c_git_project\\anima_train\\datasets\\natsume_an-an\\images
    python ..\\..\\..\\python\\prune_dataset_pairs.py

Or set TARGET below to an absolute path and run from anywhere.
"""

from __future__ import annotations

from pathlib import Path

# None = current working directory when you run the script
TARGET: Path | None = None

IMG_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif"}


def stems_in_dir(root: Path) -> tuple[set[str], set[str]]:
    image_stems: set[str] = set()
    text_stems: set[str] = set()
    for path in root.iterdir():
        if not path.is_file():
            continue
        ext = path.suffix.lower()
        if ext in IMG_EXTS:
            image_stems.add(path.stem)
        elif ext == ".txt":
            text_stems.add(path.stem)
    return image_stems, text_stems


DRY_RUN = True

def main() -> None:
    root = './'

    image_stems, text_stems = stems_in_dir(root)
    orphan_images = image_stems - text_stems
    orphan_texts = text_stems - image_stems

    to_delete: list[Path] = []
    for stem in sorted(orphan_images):
        for path in root.iterdir():
            if path.is_file() and path.stem == stem and path.suffix.lower() in IMG_EXTS:
                to_delete.append(path)
    for stem in sorted(orphan_texts):
        path = root / f"{stem}.txt"
        if path.is_file():
            to_delete.append(path)

    if not to_delete:
        print(f"{root}: already aligned ({len(image_stems)} pairs)")
        return

    print(f"{root}")
    print(f"  images: {len(image_stems)}, captions: {len(text_stems)}")
    print(f"  orphan images: {len(orphan_images)}, orphan captions: {len(orphan_texts)}")
    for path in sorted(to_delete):
        print(f"  {'[dry-run] ' if DRY_RUN else ''}delete {path.name}")

    if DRY_RUN:
        print("DRY_RUN=True — nothing removed")
        return

    for path in to_delete:
        path.unlink()
    print(f"removed {len(to_delete)} file(s)")


if __name__ == "__main__":
    main()
