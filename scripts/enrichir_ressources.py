#!/usr/bin/env python3
# Ressources : d'où elles viennent, en quelle quantité, avec quelle rareté et quel taux (28/09/2026).
#
# data/resources.json n'avait qu'un nom, une image et la description du jeu : impossible de
# savoir où farmer quoi, ni à quelle fréquence. Deux sources, chacune pour ce qu'elle sait :
#
#   • Module:Resources/data du wiki : rareté (Commune/Peu commune/Rare — 70 ressources),
#     quantité par ramassage (98), lieux (« Location: » de la description), et si les
#     boosters / mods récupérateurs s'appliquent. Couvre 227 des 241 ressources du site.
#   • WFCD warframe-items (Resources.json, tiré des tables de drop OFFICIELLES) : le taux
#     de drop exact, lieu par lieu et rotation par rotation, pour 110 ressources gagnées en
#     récompense de mission, prime ou caisse.
#
# Les ressources de base (Ferrite, Rubedo, Cellule Orokin…) tombent des ennemis et des
# conteneurs de la planète : les tables officielles ne publient pas de taux pour elles.
# On affiche alors lieux + rareté + quantité, jamais un pourcentage inventé.
#
# Ajoute aussi les ressources ABSENTES du site. Le 28/09/2026, il en manquait ~140, dont les plus
# farmées (Ferrite, Rubedo, Cellule Orokin, Cristal d'Argon, Nitain, Kuva, Vitus…) : la page avait
# été bâtie sur Resources.json de WFCD seul, qui les range ailleurs (Misc.json). La liste de
# référence est donc le module du wiki (Type Resource/Gem/Ore/Plant), moins ce qui n'est pas une
# ressource à farmer (EXCLUS). Image : WFCD (cdn.warframestat.us) si connue, sinon le wiki.
# Usage : python3 scripts/enrichir_ressources.py
import json
import os
import re
import urllib.request

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FICHIER = os.path.join(RACINE, "data", "resources.json")
WIKI = "https://wiki.warframe.com/w/Module:Resources/data?action=raw"
WFCD = "https://raw.githubusercontent.com/WFCD/warframe-items/master/data/json/Resources.json"
WFCD_MISC = "https://raw.githubusercontent.com/WFCD/warframe-items/master/data/json/Misc.json"
WIKI_IMG = "https://wiki.warframe.com/images/"
TYPES_WIKI = {"Resource": "Ressource", "Gem": "Gemme", "Ore": "Gemme", "Plant": "Plante"}
# Rangés « Resource » par le wiki mais pas des ressources à farmer : objets, cosmétiques,
# catégories de sécrétions Helminth (Bile, Calx…), pièces de Mandachord, monnaies.
EXCLUS = re.compile(r"Lens$|Syandana|Mandachord|^Forma$|Nav Coordinate|Pigment|^(Bile|Biotics|Calx|Oxides|"
                    r"Pheromones|Synthetics)$|^Judgement Points$|^Incubator Power Core$|^Chroma (Signal|Mark)$|"
                    r"^/Lotus/")
CDN = "https://cdn.warframestat.us/img/"
MAX_SOURCES = 8   # les meilleures sources par taux ; le nombre total est gardé à part

RARETE = {"Common": "Commune", "Uncommon": "Peu commune", "Rare": "Rare", "Legendary": "Légendaire"}
TYPE = {"Resource": "Ressource", "Gem": "Gemme", "Plant": "Plante"}
# Noms de lieux traduits pour la page FR ; le reste (modes, hubs) garde son nom de jeu.
LIEUX = [("the Void", "le Néant"), ("Void", "Néant"), ("Mercury", "Mercure"), ("Earth", "Terre"),
         ("Venus", "Vénus"), ("Saturn", "Saturne"), ("Pluto", "Pluton"), ("Ceres", "Cérès"),
         ("Kuva Fortress", "Forteresse Kuva"), (" and ", " et "), ("Missions in", "Missions dans")]


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "voidrelay-ressources/1.0"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def lieux_fr(s):
    for en, fr in LIEUX:
        s = re.sub(r"\b" + re.escape(en.strip()) + r"\b", fr.strip(), s) if en.strip() == en else s.replace(en, fr)
    return s.replace(", et ", " et ")   # pas de virgule avant « et » en français


def module_wiki(texte):
    """Entrées de premier niveau du module Lua : Name, Rarity, Amount, Description, boost."""
    out = {}
    for bloc in re.split(r"\n\t(?=\[?\"?[A-Za-z0-9])", texte):
        m = re.search(r'\n\t\tName = "([^"]+)"', bloc)
        if not m:
            continue
        rar = re.search(r'\n\t\tRarity = "([^"]+)"', bloc)
        amt = re.search(r"\n\t\tAmount = \{ ?(\d+), ?(\d+) ?\}", bloc)
        desc = re.search(r'\n\t\tDescription = "((?:[^"\\]|\\.)*)"', bloc)
        ty = re.search(r'\n\t\tType = "([^"]+)"', bloc)
        img = re.search(r'\n\t\tImage = "([^"]+)"', bloc)
        out[m.group(1)] = {
            "type": ty.group(1) if ty else None, "img": img.group(1) if img else None,
            "rar": rar.group(1) if rar else None,
            "amt": (int(amt.group(1)), int(amt.group(2))) if amt else None,
            "desc": (desc.group(1) if desc else "").replace("\\r", "").replace("\\n", "\n"),
            "boost": "ResourceBoostAble = true" in bloc,
        }
    return out


def separer_lieu(desc):
    """La description du jeu finit souvent par « Location: … » : on l'isole."""
    m = re.search(r"\s*Location:\s*(.+)$", desc or "", re.S)
    if not m:
        return (desc or "").strip(), None
    return desc[:m.start()].strip(), re.sub(r"\s+", " ", m.group(1)).strip()


def sources(drops, nom):
    """Tables officielles : garde, par lieu, le meilleur taux ; trie par taux décroissant.
    Seules les lignes dont l'objet EST la ressource comptent : la liste d'« Eidolon Shard »
    contient aussi des « Synthetic Eidolon Shard » (mesuré le 28/09/2026)."""
    meilleur = {}
    for d in drops or []:
        if re.sub(r"^\d[\d,]*X ", "", d.get("type") or "").lower() != nom.lower():
            continue
        lieu = d.get("location") or ""
        c = d.get("chance")
        if c is None or not lieu:
            continue
        qte = re.match(r"(\d[\d,]*)X ", d.get("type") or "")
        cle = lieu
        if cle not in meilleur or c > meilleur[cle]["c"]:
            meilleur[cle] = {"l": lieu, "c": round(float(c), 2), "r": RARETE.get(d.get("rarity"), d.get("rarity")),
                             **({"x": qte.group(1).replace(",", "")} if qte else {})}
    return sorted(meilleur.values(), key=lambda s: -s["c"])


site = json.load(open(FICHIER, encoding="utf-8"))
wiki = module_wiki(get(WIKI).decode("utf-8"))
wfcd = {x["name"]: x for x in json.loads(get(WFCD))}
misc = {x["name"]: x for x in json.loads(get(WFCD_MISC))}

# 1) ressources absentes du site
noms = {r["n"] for r in site}
ajouts = []
for n, x in wfcd.items():
    if n in noms or x.get("category") != "Resources":
        continue
    img = x.get("imageName")
    if img and not os.path.exists(os.path.join(RACINE, "assets", "resources", img)):
        open(os.path.join(RACINE, "assets", "resources", img), "wb").write(get(CDN + img))
    site.append({"n": n, "i": img, "t": TYPE.get(x.get("type"), "Ressource"), "desc": x.get("description") or ""})
    ajouts.append(n); noms.add(n)
for n, w in wiki.items():
    if n in noms or w.get("type") not in TYPES_WIKI or EXCLUS.search(n):
        continue
    img = (misc.get(n) or {}).get("imageName")
    url = CDN + img if img else (WIKI_IMG + w["img"] if w.get("img") else None)
    img = img or w.get("img")
    dest = os.path.join(RACINE, "assets", "resources", img or "")
    if img and not os.path.exists(dest):
        try:
            open(dest, "wb").write(get(url))
        except Exception as e:   # image introuvable : la page affiche son image de repli
            print(f"  image absente pour {n} ({e})"); img = None
    site.append({"n": n, "i": img, "t": TYPES_WIKI[w["type"]], "desc": w.get("desc") or ""})
    ajouts.append(n); noms.add(n)

# 2) enrichissement
stats = {"rarete": 0, "quantite": 0, "lieux": 0, "taux": 0}
for r in site:
    for k in ("r", "q", "loc", "src", "nsrc", "boost"):
        r.pop(k, None)
    w = wiki.get(r["n"], {})
    desc, lieu = separer_lieu(r.get("desc"))
    if not lieu and w.get("desc"):
        lieu = separer_lieu(w["desc"])[1]
    r["desc"] = desc
    if lieu:
        r["loc"] = lieux_fr(lieu); stats["lieux"] += 1
    if w.get("rar"):
        r["r"] = RARETE.get(w["rar"], w["rar"]); stats["rarete"] += 1
    if w.get("amt"):
        a, b = w["amt"]; r["q"] = str(a) if a == b else f"{a}–{b}"; stats["quantite"] += 1
    if w:
        r["boost"] = bool(w.get("boost"))
    src = sources((wfcd.get(r["n"]) or {}).get("drops") or (misc.get(r["n"]) or {}).get("drops"), r["n"])
    if src:
        r["src"] = src[:MAX_SOURCES]; r["nsrc"] = len(src); stats["taux"] += 1

site.sort(key=lambda r: r["n"].lower())
open(FICHIER, "w", encoding="utf-8").write(json.dumps(site, ensure_ascii=False, separators=(",", ":")))
print(f"✅ {len(site)} ressources (+{len(ajouts)}) · rareté {stats['rarete']} · "
      f"quantité {stats['quantite']} · lieux {stats['lieux']} · taux officiels {stats['taux']}")
