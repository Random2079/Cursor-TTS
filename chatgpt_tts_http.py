"""Локальный мост ChatGPT → уже запущенный tts_daemon.

Слушает только 127.0.0.1:47392. Голос не выбирает: демону уходят
готовые команды speak/stop, а спикер берётся из текущего tts_config.json.
Чужой сайт (Origin не chatgpt.com и не chrome-extension) получает 403.
"""
from __future__ import annotations

import json
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

from speak_edge import send_command

HOST = "127.0.0.1"
PORT = 47392
CHATGPT_ORIGIN = "https://chatgpt.com"
MAX_BODY = 256_000
MAX_TEXT = 100_000


def host_allowed(host: str | None) -> bool:
    if not host:
        return False
    value = host.strip().lower()
    return value in {f"{HOST}:{PORT}", HOST}


def origin_allowed(origin: str | None, referer: str | None) -> bool:
    """Пустой Origin — локальный клиент без браузера. Чужой сайт — нет."""
    if origin is not None:
        origin = origin.strip()
    if origin:
        if origin == CHATGPT_ORIGIN:
            return True
        return _extension_origin(origin)
    if referer:
        ref = referer.strip()
        if ref == CHATGPT_ORIGIN or ref.startswith(CHATGPT_ORIGIN + "/"):
            return True
        return ref.startswith("chrome-extension://")
    return True


def _extension_origin(origin: str) -> bool:
    prefix = "chrome-extension://"
    if not origin.startswith(prefix):
        return False
    ext_id = origin[len(prefix) :]
    return bool(ext_id) and "/" not in ext_id and " " not in ext_id


def speak_command(body: dict) -> dict:
    """Только текст. speaker/engine/voice из запроса не пересылаются."""
    text = body.get("text", "")
    if not isinstance(text, str):
        raise ValueError("text must be a string")
    text = text.strip()
    if len(text) < 2:
        raise ValueError("text too short")
    if len(text) > MAX_TEXT:
        raise ValueError("text too long")
    return {"cmd": "speak", "text": text}


def stop_command() -> dict:
    return {"cmd": "stop"}


def forward(payload: dict) -> dict:
    reply = send_command(payload, timeout=3.0)
    if not isinstance(reply, dict):
        raise RuntimeError("bad daemon reply")
    return reply


class BridgeServer(ThreadingHTTPServer):
    allow_reuse_address = False
    daemon_threads = True

    def server_bind(self) -> None:
        if sys.platform == "win32":
            exclusive = getattr(__import__("socket"), "SO_EXCLUSIVEADDRUSE", None)
            if exclusive is not None:
                self.socket.setsockopt(__import__("socket").SOL_SOCKET, exclusive, 1)
        super().server_bind()


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt: str, *args: object) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def do_GET(self) -> None:
        if not self._client_ok():
            return
        path = urlsplit(self.path).path
        if path == "/health":
            try:
                reply = forward({"cmd": "ping"})
            except (OSError, TimeoutError, json.JSONDecodeError, RuntimeError) as error:
                self._send(503, {"ok": False, "error": "daemon down", "detail": str(error)})
                return
            self._send(200, {"ok": True, "daemon": bool(reply.get("ok"))})
            return
        self._send(404, {"ok": False, "error": "not found"})

    def do_POST(self) -> None:
        if not self._client_ok():
            return
        path = urlsplit(self.path).path
        if path == "/stop":
            self._discard_body()
            self._forward(stop_command())
            return
        if path != "/speak":
            self._discard_body()
            self._send(404, {"ok": False, "error": "not found"})
            return
        try:
            body = self._read_json()
            payload = speak_command(body)
        except ValueError as error:
            self._send(400, {"ok": False, "error": str(error)})
            return
        except json.JSONDecodeError:
            self._send(400, {"ok": False, "error": "bad json"})
            return
        self._forward(payload)

    def do_OPTIONS(self) -> None:
        if not self._client_ok():
            return
        self._send(204, None)

    def _client_ok(self) -> bool:
        if not host_allowed(self.headers.get("Host")) or not origin_allowed(
            self.headers.get("Origin"), self.headers.get("Referer")
        ):
            self._send(403, {"ok": False, "error": "forbidden"})
            return False
        return True

    def _cors_origin(self) -> str | None:
        origin = (self.headers.get("Origin") or "").strip()
        if origin and origin_allowed(origin, None):
            return origin
        return None

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length < 0 or length > MAX_BODY:
            raise ValueError("body too large")
        raw = self.rfile.read(length) if length else b""
        if not raw:
            raise ValueError("empty body")
        data = json.loads(raw.decode("utf-8"))
        if not isinstance(data, dict):
            raise ValueError("json object required")
        return data

    def _discard_body(self) -> None:
        try:
            length = int(self.headers.get("Content-Length", "0") or "0")
        except ValueError:
            return
        if 0 < length <= MAX_BODY:
            self.rfile.read(length)

    def _forward(self, payload: dict) -> None:
        try:
            reply = forward(payload)
        except (OSError, TimeoutError, json.JSONDecodeError, RuntimeError) as error:
            self._send(503, {"ok": False, "error": "daemon down", "detail": str(error)})
            return
        self._send(200, reply)

    def _send(self, code: int, payload: dict | None) -> None:
        body = b""
        if payload is not None:
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "close")
        cors = self._cors_origin()
        if cors and code != 403:
            self.send_header("Access-Control-Allow-Origin", cors)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        if body and self.command != "HEAD":
            self.wfile.write(body)


def main() -> int:
    try:
        server = BridgeServer((HOST, PORT), Handler)
    except OSError as error:
        print(f"cannot bind {HOST}:{PORT}: {error}", file=sys.stderr)
        return 1
    print(f"listening http://{HOST}:{PORT}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        return 0
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
