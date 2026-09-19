"""Native folder picker (Windows / desktop Python with tkinter)."""

from __future__ import annotations

from pathlib import Path


def pick_folder(initial: str | None = None) -> str | None:
    import tkinter as tk
    from tkinter import filedialog

    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)

    initialdir: str | None = None
    if initial:
        p = Path(initial).expanduser()
        if p.is_dir():
            initialdir = str(p)
        elif p.parent.is_dir():
            initialdir = str(p.parent)

    try:
        chosen = filedialog.askdirectory(
            parent=root,
            initialdir=initialdir,
            title="选择图片文件夹",
            mustexist=True,
        )
    finally:
        root.destroy()

    if not chosen:
        return None
    return str(Path(chosen).resolve())
