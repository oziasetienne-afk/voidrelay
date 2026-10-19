#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Garde-fou CONTRAT de data/summary.json — stdlib uniquement (zéro pip).

Pourquoi : le Hub (hub.html) lit summary.json en aveugle. Si l'updater change de
forme (API amont modifiée, bug), le site casserait en silence. Cette étape CI
REFUSE le commit tant que le contrat n'est pas respecté → le site garde les
dernières données saines.

Contrat minimal vérifié (clés vitales seulement — on n'interdit RIEN d'ajouter) :
  - updated_utc : date ISO parseable et pas dans le futur (>15 min)
  - cycles.{cetus,vallis,cambion,earth}.expiryUtc : ISO parseable (le rollover client en dépend)
  - fissures.list[] : tier(str) + endUtc(ISO) + node(str) + missionType(str)
  - baro : endUtc/startUtc ISO ; archonHunt/sortie : endUtc ISO si présents
  - market.items[] si présent : urlName/name(str)
Usage : python3 scripts/check_contract.py [chemin/summary.json]
Sortie : exit 0 = contrat OK ; exit 1 + raisons précises sinon.
"""
import json, sys, datetime

PATH = sys.argv[1] if len(sys.argv) > 1 else "data/summary.json"
errs = []

def iso(s, label, required=True):
    if s is None or s == "":
        if required: errs.append(f"{label} : date ISO manquante")
        return None
    try:
        return datetime.datetime.fromisoformat(str(s).replace("Z", "+00:00"))
    except Exception:
        errs.append(f"{label} : date ISO illisible → {s!r}")
        return None

def need(d, key, types, label):
    v = d.get(key)
    if v is None or not isinstance(v, types):
        errs.append(f"{label}.{key} : attendu {types}, reçu {type(v).__name__}")
        return None
    return v

try:
    S = json.load(open(PATH, encoding="utf-8"))
except Exception as e:
    print(f"CONTRAT ✗ : {PATH} illisible ({e})"); sys.exit(1)

# 1) fraîcheur déclarée
t = iso(S.get("updated_utc"), "updated_utc")
if t:
    now = datetime.datetime.now(datetime.timezone.utc)
    if t > now + datetime.timedelta(minutes=15):
        errs.append(f"updated_utc dans le futur ({t.isoformat()}) — horloge/format suspect")

# 2) cycles (le rollover client exige expiryUtc parseable)
cyc = S.get("cycles")
if not isinstance(cyc, dict):
    errs.append("cycles : dict manquant")
else:
    for k in ("cetus", "vallis", "cambion", "earth"):
        c = cyc.get(k)
        if not isinstance(c, dict):
            errs.append(f"cycles.{k} : dict manquant"); continue
        iso(c.get("expiryUtc"), f"cycles.{k}.expiryUtc")
        if not isinstance(c.get("state"), str) or not c.get("state"):
            errs.append(f"cycles.{k}.state : str non vide attendu")

# 3) fissures
f = S.get("fissures")
if not isinstance(f, dict) or not isinstance(f.get("list"), list):
    errs.append("fissures.list : liste manquante")
else:
    for i, x in enumerate(f["list"][:200]):
        if not isinstance(x, dict):
            errs.append(f"fissures.list[{i}] : dict attendu"); continue
        for kk in ("tier", "node", "missionType"):
            if not isinstance(x.get(kk), str) or not x.get(kk):
                errs.append(f"fissures.list[{i}].{kk} : str non vide attendu")
        iso(x.get("endUtc"), f"fissures.list[{i}].endUtc")
        if len(errs) > 25: break  # assez de preuves

# 4) baro / archonHunt / sortie (dates si présents)
b = S.get("baro")
if isinstance(b, dict):
    iso(b.get("endUtc"), "baro.endUtc"); iso(b.get("startUtc"), "baro.startUtc")
else:
    errs.append("baro : dict manquant")
for sec in ("archonHunt", "sortie"):
    v = S.get(sec)
    if isinstance(v, dict) and v.get("endUtc") is not None:
        iso(v.get("endUtc"), f"{sec}.endUtc")

# 5) marché (souple : présent → items[] avec slug, la clé que hub.html utilise
#    pour construire les liens warframe.market — vérifié dans hub.html l.522)
m = S.get("market")
if isinstance(m, dict) and isinstance(m.get("items"), list):
    for i, it in enumerate(m["items"][:50]):
        if not isinstance(it, dict) or not isinstance(it.get("slug"), str) or not it.get("slug"):
            errs.append(f"market.items[{i}].slug : str non vide attendu")
            break

if errs:
    print(f"CONTRAT ✗ — {len(errs)} violation(s) :")
    for e in errs[:30]:
        print("  -", e)
    sys.exit(1)
print(f"CONTRAT ✓ — {PATH} respecte le contrat du Hub "
      f"(updated_utc, cycles×4, {len((S.get('fissures') or {}).get('list', []))} failles, baro, marché).")
