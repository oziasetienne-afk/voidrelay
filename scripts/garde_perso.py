#!/usr/bin/env python3
"""Garde anti-fuite d'infos personnelles (19/10/2026).

Bloque un push / une PR si :
  1. un commit est signé avec une identité qui n'est pas anonyme
     (seules les adresses noreply GitHub, noreply@anthropic.com et @voidrelay.fr passent) ;
  2. une ligne AJOUTÉE contient un terme personnel interdit, ou une adresse
     email perso (gmail, hotmail, outlook, icloud, yahoo, orange, free, sfr, laposte, wanadoo).

Les termes interdits ne sont PAS écrits ici en clair (le dépôt est public) :
on compare l'empreinte SHA-256 tronquée de chaque mot. Pour en ajouter un :
  python3 -c "import hashlib;print(hashlib.sha256('mot'.lower().encode()).hexdigest()[:16])"

Usage : python3 scripts/garde_perso.py <commit_de_base> <commit_de_tete>
"""
import hashlib
import re
import subprocess
import sys

TERMES_INTERDITS = {
    "25d4824df6054554",
    "95d232bb8dd52ae2",
    "f77f4165993ffb96",
    "da8816b34de3126e",
    "c84aad710248f367",
    "bf43f7b77bcaa5f3",
}

IDENTITES_OK = re.compile(
    r"(@users\.noreply\.github\.com|^noreply@anthropic\.com|@voidrelay\.fr)$", re.I
)
EMAIL_PERSO = re.compile(
    r"[A-Za-z0-9._%+-]+@(gmail|googlemail|hotmail|outlook|live|icloud|me|yahoo|"
    r"orange|free|sfr|laposte|wanadoo)\.[a-z.]{2,6}",
    re.I,
)
MOT = re.compile(r"[\w.@+-]+", re.U)

# Fichiers lourds générés automatiquement : pas de texte humain dedans.
IGNORES = re.compile(r"^(data/|o/|en/o/|assets/|scripts/\.generated-manifest\.json)")


def git(*args: str) -> str:
    return subprocess.run(
        ["git", *args], check=True, capture_output=True, text=True, errors="replace"
    ).stdout


def empreinte(mot: str) -> str:
    return hashlib.sha256(mot.lower().encode()).hexdigest()[:16]


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    base, tete = sys.argv[1], sys.argv[2]
    plage = tete if set(base) <= {"0"} else f"{base}..{tete}"
    erreurs: list[str] = []

    # 1) Identités des commits (auteur ET committer)
    for ligne in git("log", "--format=%h|%ae|%ce", plage).splitlines():
        h, auteur, committer = ligne.split("|")
        for role, mail in (("auteur", auteur), ("committer", committer)):
            if not IDENTITES_OK.search(mail):
                erreurs.append(f"{h} : {role} non anonyme -> utilise l'adresse noreply GitHub")

    # 2) Contenu ajouté
    diff = git("diff", "--unified=0", "--no-color", "--no-ext-diff",
               base if not set(base) <= {"0"} else git("hash-object", "-t", "tree", "/dev/null").strip(),
               tete)
    fichier = ""
    for ligne in diff.splitlines():
        if ligne.startswith("+++ b/"):
            fichier = ligne[6:]
            continue
        if not ligne.startswith("+") or ligne.startswith("+++") or IGNORES.match(fichier):
            continue
        texte = ligne[1:]
        if EMAIL_PERSO.search(texte):
            erreurs.append(f"{fichier} : adresse email personnelle ajoutée")
        for mot in MOT.findall(texte):
            for variante in {mot, mot.strip(".-+")}:
                if variante and empreinte(variante) in TERMES_INTERDITS:
                    erreurs.append(f"{fichier} : terme personnel interdit ajouté")

    if erreurs:
        print("GARDE PERSO : fuite d'infos personnelles bloquée")
        for e in sorted(set(erreurs)):
            print(" -", e)
        return 1
    print("GARDE PERSO : RAS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
