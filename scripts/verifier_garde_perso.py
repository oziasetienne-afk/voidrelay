#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Garde-fou du garde perso : il laisse passer une fusion GitHub, il bloque un gmail.

POURQUOI CE FICHIER EXISTE. Le 20/10/2026, la fusion de la PR #1 par l'interface
GitHub (93ed59a) a rougi « Garde secrets et infos perso » sans la moindre fuite :
GitHub pose lui-même le committer « GitHub <noreply@github.com> » sur toute fusion
web, et scripts/garde_perso.py ne connaissait pas cette adresse. Un garde qui rougit
à chaque fusion finit ignoré — et le jour d'une vraie fuite, plus personne ne regarde.

Le test rejoue les deux cas sur de VRAIS commits, dans un dépôt git jetable :
  1. fusion web : auteur @users.noreply.github.com, committer noreply@github.com → RAS ;
  2. committer gmail → bloqué (et un auteur gmail aussi).
Mis en échec sur l'ancien garde (celui de 93ed59a) avant d'être branché.

    python3 scripts/verifier_garde_perso.py [chemin/vers/garde_perso.py]
"""
import os
import subprocess
import sys
import tempfile

ICI = os.path.dirname(os.path.abspath(__file__))
GARDE = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(ICI, "garde_perso.py")
NOREPLY = "12345+exemple@users.noreply.github.com"
# Adresse perso FICTIVE, assemblée à l'exécution : écrite en clair, garde_perso.py
# la bloquerait dans ce fichier même (il scanne les lignes ajoutées du dépôt).
PERSO = "quelquun@" + "gmail.com"
OK = KO = 0


def dit(cond, titre):
    global OK, KO
    OK, KO = (OK + 1, KO) if cond else (OK, KO + 1)
    print("  %s %s" % ("✓" if cond else "✗", titre))


def commit(depot, n, auteur, committer, merge_de=None):
    env = dict(os.environ, GIT_AUTHOR_NAME=auteur[0], GIT_AUTHOR_EMAIL=auteur[1],
               GIT_COMMITTER_NAME=committer[0], GIT_COMMITTER_EMAIL=committer[1])
    if merge_de:
        subprocess.run(["git", "merge", "--no-ff", "-q", "-m", "Merge pull request #%d" % n,
                        merge_de], cwd=depot, env=env, check=True, capture_output=True)
    else:
        with open(os.path.join(depot, "f%d.txt" % n), "w") as f:
            f.write("ligne %d\n" % n)
        subprocess.run(["git", "add", "."], cwd=depot, check=True)
        subprocess.run(["git", "commit", "-q", "-m", "c%d" % n], cwd=depot, env=env, check=True)
    return subprocess.run(["git", "rev-parse", "HEAD"], cwd=depot, check=True,
                          capture_output=True, text=True).stdout.strip()


def garde(depot, base, tete):
    return subprocess.run([sys.executable, GARDE, base, tete], cwd=depot,
                          capture_output=True, text=True).returncode


with tempfile.TemporaryDirectory() as d:
    subprocess.run(["git", "init", "-q", "-b", "main", d], check=True)
    moi = ("exemple", NOREPLY)
    base = commit(d, 0, moi, moi)
    subprocess.run(["git", "checkout", "-q", "-b", "pr"], cwd=d, check=True)
    commit(d, 1, moi, moi)
    subprocess.run(["git", "checkout", "-q", "main"], cwd=d, check=True)
    # Ce que fait le bouton « Merge pull request » : auteur = la personne (noreply),
    # committer = GitHub lui-même.
    fusion = commit(d, 2, moi, ("GitHub", "noreply@github.com"), merge_de="pr")
    print("fusion par l'interface GitHub")
    dit(garde(d, base, fusion) == 0, "committer « GitHub <noreply@github.com> » : RAS")

    print("adresses personnelles")
    gm = commit(d, 3, moi, ("quelqu'un", PERSO))
    dit(garde(d, fusion, gm) == 1, "committer gmail : bloqué")
    ga = commit(d, 4, ("quelqu'un", PERSO), moi)
    dit(garde(d, gm, ga) == 1, "auteur gmail : bloqué")
    # Seule l'adresse EXACTE passe : pas un sous-domaine, pas un domaine voisin.
    for faux in ("noreply@github.com.fr", "x.noreply@github.com", "noreply@github.company.fr"):
        h = commit(d, 5 + len(faux), moi, ("piège", faux))
        dit(garde(d, ga, h) == 1, "committer « %s » : bloqué" % faux)
        ga = h

print("-" * 70)
if KO:
    print("❌ %d échec(s) sur %d — garde testé : %s" % (KO, OK + KO, GARDE))
    sys.exit(1)
print("\U0001f6e1️  GARDE-FOU : le garde perso laisse passer les fusions GitHub et bloque "
      "les adresses perso — %d vérifications OK." % OK)
