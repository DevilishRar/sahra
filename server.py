#!/usr/bin/env python3
"""SahraGuard - driver drowsiness alarm. Your PC IS the server.
Run: python server.py  (open http://localhost:8080)
Phone camera needs HTTPS: use cloudflared tunnel link on Android.
No dependencies - stdlib only.
"""
import json, os, sys, time, urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
PUBLIC = os.path.join(ROOT, "public")
SESSIONS = os.path.join(ROOT, "sessions")
os.makedirs(SESSIONS, exist_ok=True)

MIME = {".html": "text/html", ".js": "text/javascript", ".css": "text/css",
        ".json": "application/json", ".txt": "text/plain", ".webm": "video/webm",
        ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp",
        ".webmanifest": "application/manifest+json", ".woff2": "font/woff2",
        ".ico": "image/x-icon", ".wasm": "application/wasm",
        ".data": "application/octet-stream", ".binarypb": "application/octet-stream"}

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
    def do_OPTIONS(self):
        self.send_response(200); self._cors(); self.end_headers()
    def do_GET(self):
        p = urllib.parse.urlparse(self.path)
        if p.path == "/api/sessions":
            q = urllib.parse.parse_qs(p.query)
            if "id" in q:
                fp = os.path.join(SESSIONS, q["id"][0] + ".json")
                if os.path.exists(fp):
                    with open(fp) as f: return self._json(json.load(f))
                return self._err(404, "not found")
            files = sorted([f[:-5] for f in os.listdir(SESSIONS) if f.endswith(".json")], reverse=True)[:30]
            return self._json(files)
        rel = "index.html" if p.path in ("/", "") else p.path.lstrip("/").replace("..", "")
        fp = os.path.join(PUBLIC, rel)
        if os.path.isfile(fp):
            ext = os.path.splitext(fp)[1].lower()
            with open(fp, "rb") as f: body = f.read()
            self.send_response(200)
            self.send_header("Content-Type", MIME.get(ext, "application/octet-stream"))
            self.send_header("Content-Length", str(len(body)))
            self._cors(); self.end_headers()
            self.wfile.write(body)
        else:
            return self._err(404, "not found: " + p.path)
    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(n) if n else b"{}"
        try: data = json.loads(raw.decode())
        except Exception: data = {}
        if self.path == "/api/sessions":
            sid = "trip_" + time.strftime("%Y%m%d_%H%M%S")
            data["id"] = sid
            with open(os.path.join(SESSIONS, sid + ".json"), "w") as f:
                json.dump(data, f, indent=1)
            print(f"[trip] {sid} alarms={data.get('alarms')} perclos={data.get('perclos')}", flush=True)
            return self._json({"ok": True, "id": sid})
        if self.path == "/api/export":
            lines = ["SahraGuard - Trip Report", f"Duration: {data.get('duration_s',0)}s",
                     f"Alarms: {data.get('alarms',0)}  Warnings: {data.get('warnings',0)}",
                     f"PERCLOS: {data.get('perclos',0)}  Blinks: {data.get('blinks',0)}", "",
                     "Events:"]
            for e in data.get("events", []): lines.append(f" - {e}")
            return self._json({"ok": True, "report": "\n".join(lines)})
        return self._err(404, "unknown api")
    def _json(self, obj):
        b = json.dumps(obj).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self._cors(); self.end_headers(); self.wfile.write(b)
    def _err(self, code, msg):
        b = json.dumps({"ok": False, "error": msg}).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self._cors(); self.end_headers(); self.wfile.write(b)

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    srv = ThreadingHTTPServer(("0.0.0.0", port), H)
    print(f"SahraGuard live: http://localhost:{port}  (phone needs HTTPS tunnel)", flush=True)
    srv.serve_forever()
