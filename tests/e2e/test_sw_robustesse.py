#!/usr/bin/env python3
# Service worker, robustesse (21/10/2026) : hôte d'API ancré, cache.put attendu et protégé,
# respondWith jamais undefined, minuteur annulé, alertes marquées après l'envoi. Le
# harnais Node (sw_harnais.mjs) exécute sw.js dans un faux environnement.
import json
import os
import subprocess
import sys

from _outils import ok, bilan

ICI = os.path.dirname(os.path.abspath(__file__))


def main():
    p = subprocess.run(["node", os.path.join(ICI, "sw_harnais.mjs")], capture_output=True, text=True, timeout=60)
    if p.returncode != 0:
        ok("harnais Node exécuté", False, p.stderr.strip()[-400:])
    for ligne in p.stdout.splitlines():
        r = json.loads(ligne)
        ok(r["label"], r["ok"], "" if r["ok"] else r["extra"])
    ok("version du cache à jour", 'const CACHE="wf-hub-v153"' in open(os.path.join(ICI, "..", "..", "sw.js")).read())
    return bilan("sw robustesse")


if __name__ == "__main__":
    sys.exit(main())
