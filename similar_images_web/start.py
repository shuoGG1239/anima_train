"""Double-click this file to start the similar-images web UI."""

from __future__ import annotations

import sys
import threading
import webbrowser
from pathlib import Path

# anima_train root (parent of this folder)
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import uvicorn

from similar_images_web.app import app

HOST = "127.0.0.1"
PORT = 8765
URL = f"http://{HOST}:{PORT}/"


def _open_browser() -> None:
    webbrowser.open(URL)


def main() -> None:
    print(f"Similar Images UI: {URL}")
    print("Close this window to stop the server.")
    threading.Timer(1.0, _open_browser).start()
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")


if __name__ == "__main__":
    main()
