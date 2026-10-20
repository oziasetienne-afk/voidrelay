#!/usr/bin/env python3
"""Passifs anglais des Warframes, AVEC leurs chiffres, lus sur le wiki officiel.

Pourquoi (20/10/2026) : WFCD et api.warframestat.us livrent le passif avec des
marqueurs non résolus (« |DAMAGE|% increased damage »). `maj_catalogue_wfcd.py`
les effaçait, d'où 91 pages de builds EN avec des phrases trouées
(« sidearms % faster »). Le module Lua du wiki porte le texte déjà chiffré.

Sortie : data/passifs_en.json → {"source", "date", "passifs": {nom: texte}}.
Un passif qui contiendrait encore un marqueur |X| est écarté (le générateur
n'affiche alors rien plutôt qu'une phrase fausse).

Usage : python3 scripts/maj_passifs_wiki.py   (après chaque mise à jour du jeu)
"""
import datetime
import json
import pathlib
import re
import sys
import urllib.request

SOURCE = "https://wiki.warframe.com/w/Module:Warframes/data?action=raw"
SORTIE = pathlib.Path(__file__).resolve().parent.parent / "data" / "passifs_en.json"

# Chaîne Lua entre guillemets doubles, échappements compris.
CHAINE = r'"((?:[^"\\]|\\.)*)"'
PAIRE = re.compile(r'Name\s*=\s*' + CHAINE + r'\s*,(?:(?!\bName\s*=).)*?\bPassive\s*=\s*' + CHAINE, re.S)


def delua(s: str) -> str:
    # Le module écrit des sauts de ligne Lua (« \r\n », « \r \r ») : 10 passifs les
    # affichaient en clair (Garuda, Harrow, Lavos, Sirius & Orion, Uriel…).
    s = re.sub(r"\\[rnt]", " ", s).replace('\\"', '"').replace("\\\\", "\\")
    return re.sub(r"\s+", " ", s).strip()


def main() -> int:
    req = urllib.request.Request(SOURCE, headers={"User-Agent": "VoidRelay (fan site) passifs"})
    try:
        lua = urllib.request.urlopen(req, timeout=60).read().decode("utf-8")
    except Exception as e:  # réseau coupé : on ne touche pas au fichier existant
        print(f"❌ wiki injoignable : {e}", file=sys.stderr)
        return 1
    passifs, ecartes = {}, []
    for nom, texte in PAIRE.findall(lua):
        nom, texte = delua(nom), delua(texte)
        if not texte:
            continue
        if re.search(r"\|[A-Z_0-9]+\|", texte):
            ecartes.append(nom)
            continue
        passifs[nom] = texte
    # Garde-fou : le module contient ~120 Warframes ; moins de 100 = format changé.
    if len(passifs) < 100:
        print(f"❌ seulement {len(passifs)} passifs lus : format du module changé ? Fichier non modifié.", file=sys.stderr)
        return 1
    SORTIE.write_text(json.dumps({
        "source": SOURCE,
        "date": datetime.date.today().isoformat(),
        "passifs": dict(sorted(passifs.items())),
    }, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"✅ {len(passifs)} passifs écrits dans {SORTIE.name}" + (f" ; écartés (marqueur non résolu) : {', '.join(ecartes)}" if ecartes else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
