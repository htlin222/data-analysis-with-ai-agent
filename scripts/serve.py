#!/usr/bin/env python3
"""課程網站的本機伺服器，附一個寫檔端點。

投影片與 demo 的就地編輯結果原本只存在瀏覽器的 localStorage，
不是檔案，因此不進版控。這支伺服器多開一個 POST /_save，
讓編輯結果直接寫成 site/assets/overrides.js，之後由 git 追蹤。

僅綁 127.0.0.1，且只允許寫入該一個路徑。

用法：
    python3 scripts/serve.py [port]
"""
from __future__ import annotations

import http.server
import json
import pathlib
import socketserver
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
TARGET = SITE / "assets" / "overrides.js"
MAX_BODY = 1 << 20          # 1 MB，足夠放全部文字修改

HEADER = """/* overrides.js — 就地編輯的結果。
   由 scripts/serve.py 的 /_save 端點寫入，或手動編輯。
   投影片按 E 進入編輯、修改文字、按 X 存檔。 */
"""


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(SITE), **kw)

    def log_message(self, fmt, *args):
        # 只記寫入，靜態檔的存取量太大。
        # 注意 args[0] 在錯誤路徑上是 HTTPStatus 而不是字串，要先轉型，
        # 否則 404 會讓 handler 拋例外、連線被切斷。
        if args and "_save" in str(args[0]):
            super().log_message(fmt, *args)

    def _drain(self, n: int) -> bytes:
        """先把 request body 讀完再回應。

        沒讀完就送錯誤回應的話，未讀的位元組會留在連線裡，
        用戶端拿到的是連線中斷而不是明確的狀態碼。
        """
        left, chunks = n, []
        while left > 0:
            b = self.rfile.read(min(left, 64 << 10))
            if not b:
                break
            chunks.append(b)
            left -= len(b)
        return b"".join(chunks)

    def _fail(self, code: int, why: str):
        out = json.dumps({"ok": False, "error": why}).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(out)))
        self.end_headers()
        self.wfile.write(out)

    def do_POST(self):
        try:
            n = int(self.headers.get("Content-Length", 0))
        except ValueError:
            n = -1

        if n < 0 or n > MAX_BODY:
            self._drain(min(max(n, 0), MAX_BODY))
            self._fail(413, "body too large")
            return

        raw = self._drain(n)

        if self.path != "/_save":
            self._fail(404, "unknown endpoint")
            return

        try:
            payload = json.loads(raw)
            if not isinstance(payload, dict):
                raise ValueError("top level must be an object")
            # 只接受 {key: {editKey: html}} 這一種形狀
            for k, v in payload.items():
                if not isinstance(k, str) or not isinstance(v, dict):
                    raise ValueError(f"{k!r} must map to an object")
                for a, b in v.items():
                    if not isinstance(a, str) or not isinstance(b, str):
                        raise ValueError(f"{k}/{a!r} must be string to string")
        except Exception as e:
            self._fail(400, str(e))
            return

        body = HEADER + "window.OVERRIDES = " + \
            json.dumps(payload, ensure_ascii=False, indent=2) + ";\n"
        TARGET.write_text(body)

        out = json.dumps({
            "ok": True,
            "path": str(TARGET.relative_to(ROOT)),
            "keys": sum(len(v) for v in payload.values()),
        }).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(out)))
        self.end_headers()
        self.wfile.write(out)

    def end_headers(self):
        # 開發用：避免改了 JS 卻讀到舊快取
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main() -> int:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", port), Handler) as srv:
        print(f"http://localhost:{port}  （編輯結果會寫入 "
              f"{TARGET.relative_to(ROOT)}）")
        try:
            srv.serve_forever()
        except KeyboardInterrupt:
            print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
