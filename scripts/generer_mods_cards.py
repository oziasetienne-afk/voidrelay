# -*- coding: utf-8 -*-
"""VoidRelay — régénère data/mods_cards.json depuis la base warframe-items (WFCD).

Pour CHAQUE mod utilisé par les règles de scripts/generer_builds.mjs : la vraie
carte (imageName), la vraie polarité et le rang max réel (fusionLimit), en
écartant les variantes tuto (/Beginner/, /Intermediate/) qui partagent le nom.
Télécharge les cartes manquantes depuis cdn.warframestat.us vers assets/wfimg/
(même pipeline que les 51 cartes d'origine) avec vérification taille+signature.

Usage :  python3 scripts/generer_mods_cards.py
Source :  https://raw.githubusercontent.com/WFCD/warframe-items/master/data/json/Mods.json
"""
import json, re, os, sys, ssl, urllib.request

def _ctx():
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return ssl.create_default_context()

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_URL = "https://raw.githubusercontent.com/WFCD/warframe-items/master/data/json/Mods.json"
CDN = "https://cdn.warframestat.us/img/"
# Formes SVG du site (voir POL dans generer_builds.mjs). Pas de glyphe officiel
# par école ici : on mappe sur les 5 formes existantes, harmonisées avec les
# 22 fiches manuelles (zenurik = double barre comme mesa.html/rhino.html).
POLMAP = {"madurai": "V", "vazarin": "D", "naramon": "BAR", "zenurik": "EQ",
          "umbra": "U", "penjaga": "EQ", "unairu": "V", "universal": "V"}

def main():
    # cache local optionnel (ex. téléchargé via curl quand les certificats python manquent)
    local = sys.argv[1] if len(sys.argv) > 1 else None
    if local and os.path.exists(local):
        print("Base warframe-items depuis", local)
        db = json.load(open(local, encoding="utf-8"))
    else:
        print("Téléchargement de la base warframe-items…")
        db = json.load(urllib.request.urlopen(DB_URL, timeout=120, context=_ctx()))
    src = open(os.path.join(ROOT, "scripts/generer_builds.mjs"), encoding="utf-8").read()
    listed = set()
    for m in re.finditer(r'mods: \[([^\]]+)\]', src):
        listed.update(x.group(1) for x in re.finditer(r'"([^"]+)"', m.group(1)))
    for m in re.finditer(r'aura: "([^"]+)"|exilus: "([^"]+)"', src):
        listed.add(m.group(1) or m.group(2))

    def best(name):
        c = [x for x in db if x.get("name") == name and "imageName" in x
             and "/Beginner/" not in x.get("uniqueName", "")
             and "/Intermediate/" not in x.get("uniqueName", "")
             # /Expert/ (20/10/2026) : variantes rang 10 d'Intensify et Stretch ; le jeu et
             # warframe.market disent rang max 5 → la carte affichait « 10/10 ».
             and "/Expert/" not in x.get("uniqueName", "")]
        return max(c, key=lambda x: x.get("fusionLimit") or 0) if c else None

    cards, miss = {}, []
    for n in sorted(listed):
        b = best(n)
        if not b:
            miss.append(n); continue
        fl = b.get("fusionLimit") or 3
        cards[n] = {"img": b["imageName"],
                    "pol": POLMAP.get(b.get("polarity", "madurai"), "V"),
                    "rk": "%d/%d" % (fl, fl)}
    if miss:
        print("⚠️ introuvables dans warframe-items (corrige les règles !) :", miss)
        sys.exit(1)

    for c in cards.values():
        dest = os.path.join(ROOT, "assets/wfimg", c["img"])
        if os.path.exists(dest):
            continue
        data = urllib.request.urlopen(CDN + c["img"], timeout=60, context=_ctx()).read()
        assert len(data) > 2048 and (data[:2] == b"\xff\xd8" or data[:8] == b"\x89PNG\r\n\x1a\n"), c["img"]
        open(dest, "wb").write(data)
        print("  téléchargé :", c["img"])

    out = os.path.join(ROOT, "data/mods_cards.json")
    json.dump(cards, open(out, "w"), ensure_ascii=False, indent=0)
    print("✅ %d mods -> %s" % (len(cards), out))

if __name__ == "__main__":
    main()
