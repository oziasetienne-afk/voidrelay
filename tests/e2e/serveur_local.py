#!/usr/bin/env python3
# Serveur local qui émule la résolution d'URL propres de Cloudflare Pages :
# /x -> x.html ou x/index.html ; /x/ -> x/index.html.
import http.server
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _outils import RACINE, PORT  # noqa: E402


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=RACINE, **kw)

    def translate_path(self, path):
        fs = super().translate_path(path)
        clean = path.split("?")[0].split("#")[0]
        if not os.path.isfile(fs) and not clean.endswith("/"):
            if os.path.isfile(fs + ".html"):
                return fs + ".html"
            if os.path.isfile(os.path.join(fs, "index.html")):
                return os.path.join(fs, "index.html")
        return fs

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
