#!/usr/bin/env python3
# Orchestrateur du banc d'essai : démarre le serveur, lance chaque suite, agrège.
# Usage : python3 tests/e2e/tout_tester.py [--sans-relais]
import os
import subprocess
import sys

from _outils import demarrer_serveur

ICI = os.path.dirname(os.path.abspath(__file__))
SUITES = [
    ("test_recherche.py", False),
    ("test_outils_pages.py", False),
    ("test_marche_profils.py", False),   # hors ligne : les 3 fichiers de données sont locaux
    ("test_cwv.py", False),
    ("test_warp.py", False),
    ("test_arsenal.py", False),
    ("test_arsenal_en.py", False),
    ("test_arsenal_offline.py", False),
    ("test_biblio_url.py", False),
    ("test_moderation.py", False),   # jamais inscrite en v83 : le garde-fou v85 l'a trouvée
    ("test_arsenal_wiki.py", False),
    ("test_liens_compagnon.py", False),
    ("test_langue.py", False),
    ("test_mesure.py", False),   # v91 : voidrelay.fr résolu en local, envois interceptés
    ("test_arsenal_tir.py", False),   # v94 : précision, ramassage, Incarnon, famille (calculs refaits à la main)
    ("test_arsenal_malus.py", False),   # v95 : malus des mods corrompus (Blind Rage −55 % efficacité…)
    ("test_arsenal_combo.py", False),   # v96 : durée de combo en %, combo supplémentaire, finisher
    ("test_arsenal_chasseur.py", False),  # v97 : griffes des bêtes, Récupération du Chasseur
    ("test_arsenal_rechoix.py", False),   # v98 : rechoisir l'objet équipé garde son build
    ("test_debordement_mobile.py", False),   # v101 : aucune page ne défile de côté à 320 et 768 px
    ("test_marche_complet.py", True),   # relais : appelle les vraies API
    ("test_repli_v1.py", True),
]


def main():
    sans_relais = "--sans-relais" in sys.argv
    srv = demarrer_serveur()
    echecs = []
    try:
        for fichier, relais in SUITES:
            if relais and sans_relais:
                print(f"↷ {fichier} : sauté (--sans-relais)")
                continue
            print(f"\n═══ {fichier} ═══")
            rc = subprocess.call([sys.executable, os.path.join(ICI, fichier)], cwd=ICI)
            if rc != 0:
                echecs.append(fichier)
    finally:
        if srv:
            srv.terminate()
    print("\n" + "=" * 60)
    if echecs:
        print("💥 Suites en échec :", ", ".join(echecs))
        return 1
    print("🛡️  Banc d'essai e2e : toutes les suites passent.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
