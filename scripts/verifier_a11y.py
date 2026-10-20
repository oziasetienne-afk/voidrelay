#!/usr/bin/env python3
"""Garde d'accessibilité/intégrité statique — toutes les pages HTML du site.

Vérifie sur chaque page : img sans alt, ids en double, aria-controls/labelledby/
describedby pointant vers un id absent, présence d'un h1 unique, <html lang>,
<title>, meta description, liens/boutons sans nom accessible.

Sort en code 1 à la moindre violation (utilisé par verifier_invariants.sh).
État de référence : audit complet du 16/07/2026 — 5 670 pages, zéro violation.

Exceptions PAR CONCEPTION (ne pas « corriger » sans comprendre) :
- Pages outils portées (codex, fonderie, taches, calc-reliques, reliques-ce-soir,
  assistant-farm) : le h1 est rendu par js/views.js dans #app — absent du HTML
  statique, présent à l'exécution (vérifié Playwright).
- warframe.html : redirecteur noindex (pas de h1/description).
- google*.html : fichier de vérification Google, à ne jamais toucher.
- offline.html / embed/ / hub-widget.example.html : coquilles techniques non indexées.
- Liens aria-hidden avec tabindex=-1 : surcouches « stretched-link » doublées d'un
  vrai lien nommé (pattern volontaire, cf. hero de l'accueil).
"""
import os
import sys
import collections
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# fichier -> ensemble de contrôles ignorés
SKIP = {
    "codex.html": {"h1"}, "fonderie.html": {"h1"}, "taches.html": {"h1"},
    "calc-reliques.html": {"h1"}, "reliques-ce-soir.html": {"h1"},
    "assistant-farm.html": {"h1"},
    # Coques EN des outils portés : h1 rendu par views.js (comme les FR ci-dessus).
    "en/relic-calc.html": {"h1"}, "en/relics-tonight.html": {"h1"},
    "warframe.html": {"h1", "desc"},
    "embed/index.html": {"h1", "desc"},
    "hub-widget.example.html": {"desc"},
    "offline.html": {"desc"},
}


class Scan(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids = collections.Counter()
        self.aria_refs = []
        self.imgs_no_alt = 0
        self.h1 = 0
        self.lang = None
        self.title = False
        self.meta_desc = False
        self.stack = []
        self.bad_links = 0
        self.bad_buttons = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if "id" in a:
            self.ids[a["id"]] += 1
        for k in ("aria-controls", "aria-labelledby", "aria-describedby"):
            if a.get(k):
                for ref in a[k].split():
                    self.aria_refs.append(ref)
        if tag == "img" and "alt" not in a:
            self.imgs_no_alt += 1
        if tag == "h1":
            self.h1 += 1
        if tag == "html":
            self.lang = a.get("lang")
        if tag == "title":
            self.title = True
        if tag == "meta" and a.get("name") == "description" and a.get("content"):
            self.meta_desc = True
        if tag in ("a", "button"):
            hidden = a.get("aria-hidden") == "true"
            labeled = bool(a.get("aria-label") or a.get("title")) or hidden
            self.stack.append([tag, labeled, False])
        elif self.stack and tag == "img" and (a.get("alt") or "").strip():
            self.stack[-1][2] = True

    def handle_data(self, data):
        if self.stack and data.strip():
            self.stack[-1][2] = True

    def handle_endtag(self, tag):
        if tag in ("a", "button") and self.stack and self.stack[-1][0] == tag:
            t, labeled, has_text = self.stack.pop()
            if not labeled and not has_text:
                if t == "a":
                    self.bad_links += 1
                else:
                    self.bad_buttons += 1


def main():
    bad = []
    n = 0
    for dirpath, dirs, files in os.walk(ROOT):
        # _site/ = copie publiée (scripts/construire_site.sh) : la compter doublerait tout.
        dirs[:] = [d for d in dirs if d not in (".git", "node_modules", "_site")]
        if "/.git" in dirpath or "/node_modules" in dirpath:
            continue
        for f in files:
            if not f.endswith(".html"):
                continue
            rel = os.path.relpath(os.path.join(dirpath, f), ROOT)
            if os.path.basename(rel).startswith("google"):
                continue
            n += 1
            skip = SKIP.get(rel, set())
            s = Scan()
            try:
                with open(os.path.join(ROOT, rel), encoding="utf-8", errors="replace") as fh:
                    s.feed(fh.read())
            except Exception as e:
                bad.append(f"{rel} : illisible ({e})")
                continue
            if s.imgs_no_alt:
                bad.append(f"{rel} : {s.imgs_no_alt} img sans alt")
            dups = [i for i, c in s.ids.items() if c > 1 and i]
            if dups:
                bad.append(f"{rel} : ids en double {dups[:3]}")
            missing = sorted({r for r in s.aria_refs if r not in s.ids})
            if missing:
                bad.append(f"{rel} : aria-ref vers id absent {missing[:3]}")
            if "h1" not in skip and s.h1 != 1:
                bad.append(f"{rel} : {s.h1} h1 (attendu : 1)")
            if not s.lang:
                bad.append(f"{rel} : <html> sans lang")
            if not s.title:
                bad.append(f"{rel} : sans <title>")
            if "desc" not in skip and not s.meta_desc:
                bad.append(f"{rel} : sans meta description")
            if s.bad_links:
                bad.append(f"{rel} : {s.bad_links} lien(s) sans nom accessible")
            if s.bad_buttons:
                bad.append(f"{rel} : {s.bad_buttons} bouton(s) sans nom accessible")

    if bad:
        print(f"❌ a11y : {len(bad)} violation(s) sur {n} pages :", file=sys.stderr)
        for b in bad[:25]:
            print("   " + b, file=sys.stderr)
        if len(bad) > 25:
            print(f"   … et {len(bad) - 25} autres", file=sys.stderr)
        sys.exit(1)
    print(f"a11y OK — {n} pages, zéro violation")


if __name__ == "__main__":
    main()
