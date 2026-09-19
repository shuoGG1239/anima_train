"""Local web UI to review similar image groups and delete duplicates.

    pip install fastapi uvicorn pillow imagehash
    Double-click similar_images_web/start.py
"""

from __future__ import annotations

import mimetypes
import uuid
from dataclasses import dataclass
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from similar_images_web.folder_picker import pick_folder
from similar_images_web.similar_scan import resolve_under_root, scan_similar_groups

ROOT_DIR = Path(__file__).resolve().parent
STATIC_DIR = ROOT_DIR / "static"


@dataclass
class ScanSession:
    root: Path


sessions: dict[str, ScanSession] = {}

app = FastAPI(title="Similar Images")


class ScanRequest(BaseModel):
    path: str
    threshold: int = Field(default=8, ge=0, le=32)
    method: str = Field(default="phash")
    recursive: bool = False


class ScanItemOut(BaseModel):
    path: str
    name: str
    distance: int
    size_bytes: int


class ScanGroupOut(BaseModel):
    index: int
    items: list[ScanItemOut]


class ScanResponse(BaseModel):
    scan_id: str
    root: str
    scanned: int
    skipped: int
    threshold: int
    method: str
    recursive: bool
    groups: list[ScanGroupOut]


class DeleteRequest(BaseModel):
    scan_id: str
    paths: list[str]


class DeleteResult(BaseModel):
    deleted: list[str]
    errors: list[str]


class PickFolderResponse(BaseModel):
    path: str | None = None


def get_session(scan_id: str) -> ScanSession:
    session = sessions.get(scan_id)
    if session is None:
        raise HTTPException(status_code=404, detail="scan session expired; scan again")
    return session


@app.get("/api/pick-folder", response_model=PickFolderResponse)
def api_pick_folder(initial: str | None = Query(default=None)) -> PickFolderResponse:
    try:
        chosen = pick_folder(initial)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"无法打开文件夹选择框: {exc}") from exc
    return PickFolderResponse(path=chosen)


@app.post("/api/scan", response_model=ScanResponse)
def api_scan(body: ScanRequest) -> ScanResponse:
    root = Path(body.path.strip()).expanduser()
    try:
        result = scan_similar_groups(
            root,
            threshold=body.threshold,
            method=body.method,
            recursive=body.recursive,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    scan_id = uuid.uuid4().hex
    sessions[scan_id] = ScanSession(root=result.root)

    groups_out: list[ScanGroupOut] = []
    for group in result.groups:
        items = [
            ScanItemOut(
                path=str(item.path),
                name=item.path.name,
                distance=item.distance,
                size_bytes=item.size_bytes,
            )
            for item in group.items
        ]
        groups_out.append(ScanGroupOut(index=group.index, items=items))

    return ScanResponse(
        scan_id=scan_id,
        root=str(result.root),
        scanned=result.scanned,
        skipped=result.skipped,
        threshold=result.threshold,
        method=result.method,
        recursive=result.recursive,
        groups=groups_out,
    )


@app.get("/api/image")
def api_image(scan_id: str = Query(...), path: str = Query(...)) -> FileResponse:
    session = get_session(scan_id)
    try:
        file_path = resolve_under_root(session.root, path)
    except ValueError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="file not found")
    media_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
    return FileResponse(file_path, media_type=media_type)


@app.post("/api/delete", response_model=DeleteResult)
def api_delete(body: DeleteRequest) -> DeleteResult:
    session = get_session(body.scan_id)
    deleted: list[str] = []
    errors: list[str] = []

    for raw in body.paths:
        try:
            file_path = resolve_under_root(session.root, raw)
        except ValueError:
            errors.append(f"{raw}: outside scan root")
            continue
        if not file_path.is_file():
            errors.append(f"{raw}: not found")
            continue
        try:
            file_path.unlink()
            deleted.append(str(file_path))
            caption = file_path.with_suffix(".txt")
            if caption.is_file() and caption.resolve().parent == file_path.resolve().parent:
                caption.unlink()
        except OSError as exc:
            errors.append(f"{raw}: {exc}")

    return DeleteResult(deleted=deleted, errors=errors)


app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")


def main() -> None:
    import uvicorn

    uvicorn.run("similar_images_web.app:app", host="127.0.0.1", port=8765, reload=False)


if __name__ == "__main__":
    main()
