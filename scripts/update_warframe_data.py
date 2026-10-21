#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
update_warframe_data.py — Rafraichit les donnees du Warframe Hub.

Conçu pour tourner SEUL dans une GitHub Action (cron quotidien), sans aucune
intervention humaine et sans aucune clé API. 100 % bibliothèque standard Python
(aucun `pip install`), donc durable et pérenne.

Sources publiques, gratuites, sans authentification :
  1. warframestat.us         -> état du monde "friendly" (cycles inclus)  [PRIMAIRE]
  2. api.warframe.com (DE)    -> état du monde officiel brut              [SECOURS]
  3. api.warframe.market v2   -> prix marché + ducats pour une liste suivie [PRIX]

Principe de SÉCURITÉ (ne casse jamais le site) :
  - N'écrit QUE dans le dossier `data/`. Ne touche jamais aux fichiers du site.
  - Ne plante JAMAIS : si une source tombe, on conserve la dernière donnée valide
    et on note le statut "stale" dans data/last_update.json.
  - JSON trié (sort_keys) => diffs propres => "commit seulement si changé" fiable.

v1.2.0 — Ajouts (additifs, contrat summary.json préservé) :
  - Marché enrichi : median, avgTop5, ducats (caché), ducatsPerPlat, trend,
    change24h, change7d, spark (sparkline) — calculs DÉTERMINISTES, sans LLM.
  - data/market_history.json : snapshot quotidien capé (tendances & graphes).
  - summary.marketMovers : top hausses/baisses 24 h (déterministe).
  - summary.darvo : Daily Deal (Darvo) ; summary.voidStorms : failles Railjack.

Aucune clé n'est lue ni écrite. Aucune donnée personnelle.
"""

import calendar
import json
import os
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone

SCRIPT_VERSION = "1.2.0"

# --- Chemins ---------------------------------------------------------------
HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(HERE, ".."))
DEFAULT_DATA_DIR = os.path.join(REPO_ROOT, "data")

# --- Config par défaut (surchargée par scripts/wf_config.json s'il existe) --
DEFAULT_CONFIG = {
    "platform": "pc",
    "language": "en",
    "data_dir": "data",
    "warframestat_base": "https://api.warframestat.us",
    "de_worldstate_url": "https://api.warframe.com/cdn/worldState.php",
    "market_base": "https://api.warframe.market",
    "save_raw_worldstate": True,
    # Liste d'items suivis sur warframe.market (slugs). Modifiable librement.
    # Élargie le 09/07/2026 (9 -> 124) pour aligner sur les mêmes objets déjà
    # curés dans data/market.json (mêmes 6 catégories) : donne à data/market_history.json
    # (et donc à la section "Historique de prix" des pages /o/*) une couverture réelle sur
    # les objets les plus recherchés, sans appel client supplémentaire ni changement de
    # connect-src (ce fetch tourne côté serveur, dans ce script, via le cron GitHub Actions).
    "market_watchlist": [
        # warframes (40)
        "ash_prime_set", "atlas_prime_set", "banshee_prime_set", "baruuk_prime_set",
        "chroma_prime_set", "ember_prime_set", "equinox_prime_set", "frost_prime_set",
        "gara_prime_set", "garuda_prime_set", "gauss_prime_set", "grendel_prime_set",
        "harrow_prime_set", "hydroid_prime_set", "inaros_prime_set", "khora_prime_set",
        "limbo_prime_set", "loki_prime_set", "mag_prime_set", "mesa_prime_set",
        "mirage_prime_set", "nekros_prime_set", "nezha_prime_set", "nidus_prime_set",
        "nova_prime_set", "nyx_prime_set", "oberon_prime_set", "octavia_prime_set",
        "protea_prime_set", "revenant_prime_set", "rhino_prime_set", "saryn_prime_set",
        "titania_prime_set", "trinity_prime_set", "valkyr_prime_set", "vauban_prime_set",
        "volt_prime_set", "wisp_prime_set", "wukong_prime_set", "zephyr_prime_set",
        # primary (16)
        "soma_prime_set", "boltor_prime_set", "braton_prime_set", "burston_prime_set",
        "latron_prime_set", "paris_prime_set", "tigris_prime_set", "sybaris_prime_set",
        "vectis_prime_set", "rubico_prime_set", "baza_prime_set", "tenora_prime_set",
        "stradavar_prime_set", "corinth_prime_set", "astilla_prime_set", "panthera_prime_set",
        # secondary (15)
        "lex_prime_set", "vasto_prime_set", "akbolto_prime_set", "aklex_prime_set",
        "akstiletto_prime_set", "aksomati_prime_set", "akjagara_prime_set", "akbronco_prime_set",
        "magnus_prime_set", "pandero_prime_set", "zakti_prime_set", "spira_prime_set",
        "hikou_prime_set", "ballistica_prime_set", "bronco_prime_set",
        # melee (20)
        "bo_prime_set", "fang_prime_set", "ankyros_prime_set", "dakra_prime_set",
        "orthos_prime_set", "reaper_prime_set", "scindo_prime_set", "fragor_prime_set",
        "nikana_prime_set", "dual_kamas_prime_set", "galatine_prime_set", "destreza_prime_set",
        "kronen_prime_set", "venka_prime_set", "nami_skyla_prime_set", "redeemer_prime_set",
        "gram_prime_set", "tipedo_prime_set", "guandao_prime_set", "glaive_prime_set",
        # arcanes (12)
        "arcane_energize", "arcane_grace", "arcane_guardian", "melee_duplicate",
        "arcane_steadfast", "magus_repair", "magus_lockdown", "arcane_aegis",
        "arcane_velocity", "molt_vigor", "arcane_avenger", "arcane_blessing",
        # mods (21) — primed_fury exclu (prix/volume nuls sur le marché, cf data/market.json)
        "primed_continuity", "primed_flow", "primed_pressure_point", "primed_reach",
        "primed_animal_instinct", "blind_rage", "transient_fortitude", "narrow_minded",
        "fleeting_expertise", "overextended", "hunter_munitions", "blood_rush",
        "weeping_wounds", "condition_overload", "galvanized_aptitude", "galvanized_chamber",
        "galvanized_diffusion", "vigilante_armaments", "argon_scope", "bladed_rounds",
        "hornet_strike",
    ],
    "http_timeout_seconds": 25,
    "http_retries": 3,
    # --- Réglages enrichissement marché (tous facultatifs) ---
    "market_history_days": 90,      # rétention des snapshots de prix
    "market_fetch_ducats": True,    # récupère ducats (statique, mis en cache)
    "market_alert_pct": 15          # |variation 24 h| >= ce % => alerte (déterministe)
}

USER_AGENT = "warframe-hub-updater/%s (+github-actions; contact: repo owner)" % SCRIPT_VERSION


# --- Utilitaires HTTP ------------------------------------------------------
def http_get_json(url, headers=None, timeout=25, retries=3):
    """GET JSON avec retries/backoff. Renvoie (data, None) ou (None, 'erreur')."""
    hdrs = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    if headers:
        hdrs.update(headers)
    last_err = None
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, headers=hdrs)
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read()
            return json.loads(raw.decode("utf-8")), None
        except (urllib.error.HTTPError, urllib.error.URLError, ValueError, TimeoutError) as e:
            last_err = "%s: %s" % (type(e).__name__, e)
            if attempt < retries:
                time.sleep(2 * attempt)  # backoff linéaire 2s, 4s...
    return None, last_err


# --- Helpers temps ---------------------------------------------------------
def now_utc_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def today_utc_date():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def ms_to_iso(ms):
    """Convertit un timestamp epoch-ms (DE) en ISO 8601 UTC."""
    try:
        return datetime.fromtimestamp(int(ms) / 1000.0, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    except Exception:
        return None


def de_date(field):
    """Extrait l'epoch-ms d'un champ DE {'$date': {'$numberLong': '...'}}."""
    try:
        return int(field["$date"]["$numberLong"])
    except (KeyError, TypeError, ValueError):
        return None


def iso_to_epoch(iso):
    """ISO 8601 (avec ou sans millisecondes / 'Z') -> epoch seconds (float) ou None."""
    if not iso or not isinstance(iso, str):
        return None
    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp()
    except Exception:
        return None


def _is_active(start_iso, end_iso, fallback=None):
    """True si l'instant présent est dans [start, end] (UTC). Repli sur le booléen
    fourni si les dates manquent. Utilisé pour Prime Resurgence : warframestat sert
    souvent vaultTrader.active = null, on le recalcule donc nous-mêmes (06/06/2026)."""
    a = iso_to_epoch(start_iso)
    e = iso_to_epoch(end_iso)
    if a is None or e is None:
        return bool(fallback)
    return a <= time.time() <= e


def cycle_from_wfs(c, now_s=None):
    """Normalise un cycle warframestat -> {state, timeLeftSeconds (INT), expiryUtc (ISO)}.

    warframestat renvoie `timeLeft` en TEXTE ('23m 35s') et parfois `null`, mais
    `expiry` (ISO) est fiable. On calcule donc les secondes depuis `expiry`, et on
    EXPOSE `expiryUtc` pour un décompte client EXACT (insensible à la latence du cron).
    """
    if now_s is None:
        now_s = time.time()
    if not c:
        return {"state": None, "timeLeftSeconds": None, "expiryUtc": None}
    exp = c.get("expiry")
    ep = iso_to_epoch(exp)
    secs = max(0, int(round(ep - now_s))) if ep is not None else None
    return {"state": c.get("state"), "timeLeftSeconds": secs, "expiryUtc": exp}


def store_item_name(path):
    """'/Lotus/StoreItems/Upgrades/Focus/DefenseLensGreater' -> 'Defense Lens Greater'."""
    if not path or not isinstance(path, str):
        return path
    leaf = path.rstrip("/").split("/")[-1]
    # insère un espace avant chaque majuscule interne (CamelCase -> mots)
    out = []
    for i, ch in enumerate(leaf):
        if ch.isupper() and i > 0 and (leaf[i - 1].islower() or leaf[i - 1].isdigit()):
            out.append(" ")
        out.append(ch)
    return "".join(out).strip()


# --- Cycles (calcul local, utilisé surtout en mode secours) ----------------
# Constantes communautaires éprouvées. Si warframestat est joignable, on prend
# SES cycles (exacts). Sinon on calcule ici et on marque source="computed".
def compute_cycles(now_s=None):
    if now_s is None:
        now_s = time.time()

    def exp_iso(secs):
        return datetime.fromtimestamp(now_s + secs, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    def cyc(anchor, total, first_len, first_state, second_state):
        pos = (now_s - anchor) % total
        if pos < first_len:
            left = int(first_len - pos)
            return {"state": first_state, "timeLeftSeconds": left, "expiryUtc": exp_iso(left)}
        left = int(total - pos)
        return {"state": second_state, "timeLeftSeconds": left, "expiryUtc": exp_iso(left)}

    # Cetus : 150 min (jour 100 min / nuit 50 min). Ancre alignée sur le jour.
    cetus = cyc(1518347465, 9000, 6000, "day", "night")
    # Cambion (Deimos) : synchronisé sur Cetus (mêmes durées). Fass = "jour",
    # Vome = "nuit" (wiki). Alignement marqué _approx : en mode normal c'est
    # warframestat qui fournit l'état exact.
    cambion = {"state": "vome" if cetus["state"] == "day" else "fass",
               "timeLeftSeconds": cetus["timeLeftSeconds"],
               "expiryUtc": cetus["expiryUtc"], "_approx": True}
    # Orb Vallis : 1600 s (chaud 400 s / froid 1200 s).
    vallis = cyc(1541837628, 1600, 400, "warm", "cold")
    # Terre : 8 h (jour 4 h / nuit 4 h).
    earth = cyc(1490695176, 28800, 14400, "day", "night")

    return {
        "_source": "computed",
        "_note": "Cycles calculés localement (mode secours). Constantes corrigeables en haut du script.",
        "cetus": cetus,
        "cambion": cambion,
        "vallis": vallis,
        "earth": earth,
    }


# --- Mappages enums DE (mode secours) --------------------------------------
FISSURE_TIERS = {
    "VoidT1": "Lith", "VoidT2": "Meso", "VoidT3": "Neo",
    "VoidT4": "Axi", "VoidT5": "Requiem", "VoidT6": "Omnia",
}
FACTIONS = {
    "FC_GRINEER": "Grineer", "FC_CORPUS": "Corpus", "FC_INFESTATION": "Infested",
    "FC_OROKIN": "Orokin", "FC_CORRUPTED": "Corrupted", "FC_SENTIENT": "Sentient",
}


def prettify_boss(code):
    """SORTIE_BOSS_CORRUPTED_VOR -> 'Corrupted Vor' (lisibilité du mode secours)."""
    if not code:
        return code
    c = code
    for p in ("SORTIE_BOSS_", "ARCHON_BOSS_"):
        if c.startswith(p):
            c = c[len(p):]
    return c.replace("_", " ").title()


_SOLNODES = None
def node_name(key):
    """Nom lisible d'un nœud DE (« SolNode38 » → « Hydron (Sedna) »).
    Mapping statique data/solnodes.json (451 nœuds, source warframestat /solNodes,
    posé le 05/06/2026 — backlog « noms lisibles en mode secours »). Repli : clé brute.
    Aucune dépendance : stdlib + fichier committé ; si absent, comportement d'avant."""
    global _SOLNODES
    if _SOLNODES is None:
        import os
        p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "solnodes.json")
        try:
            with open(p, encoding="utf-8") as f:
                _SOLNODES = {k: v for k, v in json.load(f).items() if not k.startswith("_")}
        except Exception:
            _SOLNODES = {}
    return _SOLNODES.get(key, key)


def parse_de_worldstate(ws):
    """Construit un état du monde normalisé depuis le worldstate brut de DE."""
    out = {"_source": "de-fallback"}

    # Baro Ki'Teer (VoidTraders)
    vts = ws.get("VoidTraders") or []
    if vts:
        vt = vts[0]
        start = de_date(vt.get("Activation", {}))
        end = de_date(vt.get("Expiry", {}))
        now_ms = int(time.time() * 1000)
        # Inventaire en mode secours (05/06/2026, idée backlog n°1) : DE expose
        # Manifest=[{ItemType:"/Lotus/...", PrimePrice:ducats, RegularPrice:crédits}]
        # UNIQUEMENT pendant la visite de Baro. Défensif : entrée illisible = sautée
        # (= comportement d'avant, inventaire vide). ⚠️ noms de champs à confirmer
        # sur payload réel à la prochaine visite (12/06) — warframestat reste le primaire.
        inv = []
        for it in (vt.get("Manifest") or []):
            name = store_item_name(it.get("ItemType"))
            if name:
                inv.append({"item": name,
                            "ducats": it.get("PrimePrice"),
                            "credits": it.get("RegularPrice")})
        out["baro"] = {
            "character": vt.get("Character"),
            "location": node_name(vt.get("Node")),
            "active": bool(start and end and start <= now_ms <= end),
            "startUtc": ms_to_iso(start),
            "endUtc": ms_to_iso(end),
            "inventory": inv,
        }

    # Sortie
    sorties = ws.get("Sorties") or []
    if sorties:
        s = sorties[0]
        out["sortie"] = {
            "boss": prettify_boss(s.get("Boss")),
            "endUtc": ms_to_iso(de_date(s.get("Expiry", {}))),
            "missions": [{"missionType": v.get("missionType"), "modifier": v.get("modifierType")}
                         for v in s.get("Variants", [])],
        }

    # Archon Hunt (LiteSorties)
    lites = ws.get("LiteSorties") or []
    if lites:
        ls = lites[0]
        out["archonHunt"] = {
            "boss": prettify_boss(ls.get("Boss")),
            "endUtc": ms_to_iso(de_date(ls.get("Expiry", {}))),
            "missions": [{"missionType": v.get("missionType"), "modifier": v.get("modifierType")}
                         for v in ls.get("Missions", [])] if ls.get("Missions") else [],
        }

    # Fissures (ActiveMissions)
    fissures = []
    by_tier = {}
    for m in ws.get("ActiveMissions") or []:
        tier = FISSURE_TIERS.get(m.get("Modifier"), m.get("Modifier"))
        by_tier[tier] = by_tier.get(tier, 0) + 1
        fissures.append({
            "node": node_name(m.get("Node")),
            "missionType": m.get("MissionType"),
            "tier": tier,
            "hard": bool(m.get("Hard")),
            "endUtc": ms_to_iso(de_date(m.get("Expiry", {}))),
        })
    out["fissures"] = {"count": len(fissures), "byTier": by_tier,
                       "steelPathCount": sum(1 for f in fissures if f["hard"]),
                       "list": fissures}

    # Void Storms (failles Railjack)
    out["voidStorms"] = parse_voidstorms_de(ws)

    # Invasions
    invs = []
    for inv in ws.get("Invasions") or []:
        if inv.get("Completed"):
            continue
        # DE: la faction qui MÈNE l'invasion = champ top-level "Faction".
        # "DefenderFaction" = faction adverse. (AttackerMissionInfo.faction est
        # la faction que l'on COMBAT côté attaquant -> trompeur, ne pas utiliser.)
        invs.append({
            "node": node_name(inv.get("Node")),
            "attacker": FACTIONS.get(inv.get("Faction"), inv.get("Faction")),
            "defenderFaction": FACTIONS.get(inv.get("DefenderFaction"), inv.get("DefenderFaction")),
            "goal": inv.get("Goal"),
            "count": inv.get("Count"),
        })
    out["invasions"] = {"count": len(invs), "list": invs}

    # Darvo / Daily Deal
    out["darvo"] = parse_darvo_de(ws)

    # Nightwave (SeasonInfo)
    si = ws.get("SeasonInfo") or {}
    if si:
        out["nightwave"] = {
            "season": si.get("Season"),
            "phase": si.get("Phase"),
            "tag": si.get("AffiliationTag"),
            "endUtc": ms_to_iso(de_date(si.get("Expiry", {}))),
            "activeChallenges": len(si.get("ActiveChallenges", [])),
        }

    # Events / Goals
    events = []
    for ev in ws.get("Events") or []:
        msg = ev.get("Messages") or []
        name = (msg[0].get("Message") if msg else None) or ev.get("Tag")
        events.append({"name": name, "endUtc": ms_to_iso(de_date(ev.get("Expiry", {})))})
    out["events"] = events

    return out


def parse_voidstorms_de(ws):
    """Failles Railjack (Void Storms) depuis le worldstate DE."""
    items = []
    for vs in ws.get("VoidStorms") or []:
        tier = FISSURE_TIERS.get(vs.get("ActiveMissionTier"), vs.get("ActiveMissionTier"))
        items.append({"node": node_name(vs.get("Node")), "tier": tier,
                      "endUtc": ms_to_iso(de_date(vs.get("Expiry", {})))})
    return {"count": len(items), "list": items}


def parse_darvo_de(ws):
    """Daily Deal (Darvo) depuis le worldstate DE."""
    dd = ws.get("DailyDeals") or []
    if not dd:
        return {"active": False}
    d = dd[0]
    end = de_date(d.get("Expiry", {}))
    total = d.get("AmountTotal")
    sold = d.get("AmountSold")
    return {
        "active": True,
        "item": store_item_name(d.get("StoreItem")),
        "discount": d.get("Discount"),
        "originalPlat": d.get("OriginalPrice"),
        "salePlat": d.get("SalePrice"),
        "total": total,
        "sold": sold,
        "stockLeft": (total - sold) if (isinstance(total, int) and isinstance(sold, int)) else None,
        "endUtc": ms_to_iso(end),
    }


def build_summary_from_warframestat(wfs):
    """Construit le résumé normalisé depuis le JSON 'friendly' de warframestat."""
    out = {"_source": "warframestat"}

    out["cycles"] = {
        "_source": "warframestat",
        "cetus": cycle_from_wfs(wfs.get("cetusCycle")),
        "vallis": cycle_from_wfs(wfs.get("vallisCycle")),
        "cambion": cycle_from_wfs(wfs.get("cambionCycle")),
        "earth": cycle_from_wfs(wfs.get("earthCycle")),
    }

    vt = wfs.get("voidTrader") or {}
    out["baro"] = {
        "character": vt.get("character"),
        "location": vt.get("location"),
        "active": vt.get("active"),
        "startUtc": vt.get("activation"),
        "endUtc": vt.get("expiry"),
        "inventory": [{"item": i.get("item"), "ducats": i.get("ducats"), "credits": i.get("credits")}
                      for i in (vt.get("inventory") or [])],
    }

    s = wfs.get("sortie") or {}
    out["sortie"] = {
        "boss": s.get("boss"),
        "faction": s.get("faction"),
        "endUtc": s.get("expiry"),
        "missions": [{"missionType": v.get("missionType"), "modifier": v.get("modifier"),
                      "node": v.get("node")} for v in (s.get("variants") or [])],
    }

    ah = wfs.get("archonHunt") or {}
    out["archonHunt"] = {
        "boss": ah.get("boss"),
        "faction": ah.get("faction"),
        "endUtc": ah.get("expiry"),
        "missions": [{"missionType": v.get("type"), "node": v.get("node")}
                     for v in (ah.get("missions") or [])],
    }

    # Circuit de Duviri (09/07/2026) : la rotation HEBDO des Warframes (normal) et des
    # armes Incarnon (Steel Path) est déjà dans le worldstate téléchargé ; on ne la
    # persistait pas alors que « warframe incarnon rotation » est une requête récurrente
    # (autocomplete FR+EN). Alimente la page /guides/rotation-incarnon. NB : duviriCycle
    # expire toutes les 2 h (cycle d'humeur) mais les choix Circuit changent le lundi.
    dv = wfs.get("duviriCycle") or {}
    circuit = {"normal": [], "incarnon": []}  # fin de rotation = lundi 00:00 UTC, calculée côté page
    def _pretty_choice(name):
        # warframestat renvoie les identifiants internes accolés ("AckAndBrunt", "NamiSolo") :
        # on insère les espaces aux frontières de majuscules et on rétablit le « & ».
        import re as _re
        s = _re.sub(r"(?<=[a-z])(?=[A-Z])", " ", name or "")
        return s.replace(" And ", " & ")
    for ch in (dv.get("choices") or []):
        cat = (ch.get("category") or "").lower()
        if cat == "normal":
            circuit["normal"] = [_pretty_choice(c) for c in (ch.get("choices") or [])]
        elif cat == "hard":
            circuit["incarnon"] = [_pretty_choice(c) for c in (ch.get("choices") or [])]
    out["circuit"] = circuit

    fissures = wfs.get("fissures") or []
    by_tier = {}
    flist = []
    for f in fissures:
        tier = f.get("tier")
        by_tier[tier] = by_tier.get(tier, 0) + 1
        flist.append({"node": f.get("node"), "missionType": f.get("missionType"),
                      "tier": tier, "hard": f.get("isHard"), "endUtc": f.get("expiry")})
    out["fissures"] = {"count": len(flist), "byTier": by_tier,
                       "steelPathCount": sum(1 for f in flist if f.get("hard")),
                       "list": flist}

    # Void Storms (failles Railjack) — warframestat
    vstorms = []
    for v in (wfs.get("voidStorms") or []):
        vstorms.append({"node": v.get("node"),
                        "tier": v.get("activeMissionTier") or v.get("tier"),
                        "endUtc": v.get("expiry")})
    out["voidStorms"] = {"count": len(vstorms), "list": vstorms}

    invs = [i for i in (wfs.get("invasions") or []) if not i.get("completed")]

    def _faction(inv, side, legacy):
        """warframestat sert la faction dans attacker/defender.faction (objets) ;
        les champs plats attackingFaction/defendingFaction sont restés null
        (bug trouvé le 05/06/2026 : « null vs null » sur la carte Invasions).
        On lit le vrai champ, avec replis (ancien champ plat, puis desc)."""
        o = inv.get(side) or {}
        return (o.get("faction") or inv.get(legacy) or None)

    out["invasions"] = {
        "count": len(invs),
        "list": [{"node": i.get("node"),
                  "attacker": _faction(i, "attacker", "attackingFaction"),
                  "defenderFaction": _faction(i, "defender", "defendingFaction"),
                  "desc": i.get("desc"),
                  "completion": round(i.get("completion", 0), 1)} for i in invs],
    }

    # Darvo / Daily Deal — warframestat
    dd = wfs.get("dailyDeals") or []
    if dd:
        d = dd[0]
        total = d.get("total")
        sold = d.get("sold")
        out["darvo"] = {
            "active": True,
            "item": d.get("item"),
            "discount": d.get("discount"),
            "originalPlat": d.get("originalPrice"),
            "salePlat": d.get("salePrice"),
            "total": total,
            "sold": sold,
            "stockLeft": (total - sold) if (isinstance(total, int) and isinstance(sold, int)) else None,
            "endUtc": d.get("expiry"),
        }
    else:
        out["darvo"] = {"active": False}

    nw = wfs.get("nightwave") or {}
    out["nightwave"] = {
        "season": nw.get("season"),
        "phase": nw.get("phase"),
        "tag": nw.get("tag"),
        "endUtc": nw.get("expiry"),
        "activeChallenges": len(nw.get("activeChallenges", []) or []),
    }

    out["events"] = [{"name": e.get("description") or e.get("node"), "endUtc": e.get("expiry")}
                     for e in (wfs.get("events") or [])]

    # Steel Path — Honneurs de Teshin (récompense hebdo rotative + boutique evergreen).
    # Ajout 06/06/2026 (features) : alimente la carte 🗡️ du hub. Additif, jamais bloquant.
    sp = wfs.get("steelPath") or {}
    cur = sp.get("currentReward") or {}
    out["steelPath"] = {
        "currentReward": ({"name": cur.get("name"), "cost": cur.get("cost")} if cur.get("name") else None),
        "expiryUtc": sp.get("expiry"),
        "rotation": [{"name": r.get("name"), "cost": r.get("cost")}
                     for r in (sp.get("rotation") or []) if r.get("name")][:8],
        "evergreens": [{"name": r.get("name"), "cost": r.get("cost")}
                       for r in (sp.get("evergreens") or []) if r.get("name")][:6],
    }

    # Prime Resurgence (Varzia / vaultTrader). `active` calculé depuis les dates car
    # warframestat le sert souvent à null. Warframes vedettes = uniqueName /Powersuits/
    # (on ne liste pas chaque relique/pack : seulement les frames Prime de la rotation).
    vv = wfs.get("vaultTrader") or {}
    v_inv = vv.get("inventory") or []
    featured = [i.get("item") for i in v_inv
                if "/Powersuits/" in (i.get("uniqueName") or "") and i.get("item")]
    out["resurgence"] = {
        "active": _is_active(vv.get("activation"), vv.get("expiry"), vv.get("active")),
        "character": vv.get("character"),
        "location": vv.get("location"),
        "startUtc": vv.get("activation"),
        "endUtc": vv.get("expiry"),
        "itemCount": len(v_inv),
        "featured": featured[:6],
    }

    return out


# --- Rivens : statistiques de prix OFFICIELLES DE (hebdo) -------------------
# Ajouté le 05/06/2026. Source : warframestat /pc/rivens = relais du dataset
# officiel Digital Extremes (médiane/avg/pop des ÉCHANGES RÉELS par arme).
# Honnêteté : ce sont des stats observées, pas une « cote » par roll — cohérent
# avec la FAQ. On n'embarque qu'un TOP compact (pas les ~130 Ko).
def build_rivens_top(raw, top_n=10, min_pop=3):
    """{catégorie:{arme:{rerolled|unrolled:{median,avg,pop,...}}}} -> top trié par médiane."""
    rows = []
    for cat, weapons in (raw or {}).items():
        if not isinstance(weapons, dict):
            continue
        cat_short = str(cat).replace(" Riven Mod", "")
        for weapon, variants in weapons.items():
            if not isinstance(variants, dict) or str(weapon).startswith("Veiled"):
                continue  # « Veiled » = mod non révélé, pas une arme
            st = variants.get("rerolled") or variants.get("unrolled") or {}
            med, pop = st.get("median"), st.get("pop")
            if not isinstance(med, (int, float)) or not isinstance(pop, (int, float)):
                continue
            if pop < min_pop:
                continue  # anti-bruit : trop peu échangé pour être représentatif
            rows.append({"weapon": weapon, "category": cat_short,
                         "median": round(med), "avg": round(st.get("avg") or 0),
                         "pop": pop, "rerolled": bool(st.get("rerolled"))})
    rows.sort(key=lambda r: (-r["median"], -r["pop"]))
    return rows[:top_n]


def fetch_rivens(cfg):
    """Renvoie {updated_utc, top:[...]} ou None (échec = section absente, jamais bloquant)."""
    url = "%s/pc/rivens/" % cfg["warframestat_base"].rstrip("/")
    raw, err = http_get_json(url, timeout=cfg["http_timeout_seconds"], retries=2)
    if not raw or not isinstance(raw, dict):
        print("[warn] rivens indisponibles (%s) — section omise" % err)
        return None
    top = build_rivens_top(raw)
    if not top:
        return None
    return {"updated_utc": now_utc_iso(), "top": top,
            "_source": "stats officielles DE (hebdo) via warframestat /pc/rivens"}


# --- Catalogue complet des objets échangeables (data/items.json) ------------
# Consommé par l'autocomplétion (courses/favoris/trade/estimateur, views.js)
# et par /marche-complet (catalogue temps réel : ids v2 + tags pour les familles).
ITEMS_TAG_ALLOW = ["set", "weapon", "primary", "secondary", "melee", "archgun", "archmelee",
                   "warframe", "mod", "augment", "riven_mod", "veiled_riven",
                   "arcane_enhancement", "arcane_helmet", "relic", "companion",
                   "component", "blueprint", "prime"]


def refresh_items_catalog(cfg, data_dir):
    """Régénère data/items.json ([{n,u,i,t}]) depuis /v2/items. Jamais bloquant :
    échec ou liste anormalement courte => on garde le fichier précédent."""
    base = cfg["market_base"].rstrip("/")
    data, err = http_get_json(f"{base}/v2/items")
    rows = (data or {}).get("data") or []
    prev = read_json(data_dir, "items.json") or []
    if err or len(rows) < max(1000, int(len(prev) * 0.9)):
        return "stale (%s)" % (err or "liste trop courte : %d" % len(rows))
    out = []
    for it in rows:
        name = ((it.get("i18n") or {}).get("en") or {}).get("name") or \
            it.get("slug", "").replace("_", " ").title()
        tags = [t for t in ITEMS_TAG_ALLOW if t in (it.get("tags") or [])][:4]
        out.append({"n": name, "u": it.get("slug"), "i": it.get("id"), "t": tags})
    out.sort(key=lambda x: x["n"].lower())
    write_json(data_dir, "items.json", out)
    return "ok (%d objets)" % len(out)


# --- warframe.market (prix + ducats) ---------------------------------------
def fetch_market(cfg, ducats_cache=None, prev_items=None):
    """Renvoie {platform, items:[{slug,minSellPlat,sellOrders,...,ducats,rang}], errors:{...}}.

    ducats_cache : dict slug->ducats (statique). On ne refetch /v2/item que pour
    les slugs absents du cache => courtoisie envers l'API.
    prev_items : dict slug->objet du market.json précédent (rang suivi, rang max connu).
    """
    ducats_cache = dict(ducats_cache or {})
    prev_items = prev_items or {}
    base = cfg["market_base"].rstrip("/")
    platform = cfg.get("platform", "pc")
    lang = cfg.get("language", "en")
    headers = {"Platform": platform, "Language": lang, "Accept": "application/json"}
    result = {"platform": platform, "items": [], "errors": {}}

    for slug in cfg.get("market_watchlist", []):
        url = "%s/v2/orders/item/%s" % (base, slug)
        data, err = http_get_json(url, headers=headers,
                                   timeout=cfg["http_timeout_seconds"],
                                   retries=cfg["http_retries"])
        if err or not data:
            result["errors"][slug] = err or "no data"
            continue
        prec = prev_items.get(slug) or {}

        # Fiche de l'objet (ducats, rang max, famille) : cache d'abord, sinon /v2/item.
        # Arcanes et mods n'ont pas de ducats : leur fiche est donc relue à chaque
        # passe, ce qui donne aussi leur rang max et leurs tags à jour.
        ducats = ducats_cache.get(slug)
        rang_max, tags = prec.get("rangMax"), None
        if ducats is None and cfg.get("market_fetch_ducats", True):
            iurl = "%s/v2/item/%s" % (base, slug)
            idata, ierr = http_get_json(iurl, headers=headers,
                                        timeout=cfg["http_timeout_seconds"],
                                        retries=cfg["http_retries"])
            if idata:
                d = idata.get("data") or {}
                ducats = d.get("ducats")
                if isinstance(d.get("maxRank"), int):
                    rang_max = d["maxRank"]
                tags = d.get("tags") or []
            time.sleep(0.3)

        # Un seul calcul de prix pour tout le site (cf. _prix_ordres) : vendeurs
        # en jeu, et surtout un seul RANG à la fois — mélanger un arcane rang 0
        # et rang 5 invente des marges qui n'existent pas.
        orders = data.get("data") or []
        rang, regle = _choisir_rang(slug, orders, tags, rang_max,
                                    prec.get("rang"), prec.get("rangRegle"))
        item = {"slug": slug}
        item.update(_prix_ordres(orders, rang))
        # Toujours présent (null sur un set) : dit à quel rang se rapportent
        # minSellPlat, median, avgTop5 et toute la série d'historique.
        item["rang"] = rang
        if rang is not None:
            item["rangRegle"] = regle
            if rang_max is not None:
                item["rangMax"] = rang_max
        if ducats is not None:
            item["ducats"] = ducats

        result["items"].append(item)
        time.sleep(0.4)  # courtoisie envers l'API
    return result


def _choisir_rang(slug, orders, tags, rang_max, rang_prec, regle_prec=None):
    """Rang auquel un objet est coté, et la règle qui l'a fixé : (rang, règle).

    POURQUOI UNE RÈGLE FIXE. Jusqu'au 20/10/2026 on prenait à CHAQUE passe le
    rang qui portait le plus de ventes. Or Primed Flow a autant de vendeurs au
    rang 0 (≈ 30 p) qu'au rang 10 (≈ 90 p) : le rang retenu basculait d'une
    passe à l'autre, la série d'historique alternait 28, 99, 90, 33… et
    /bons-plans titrait « +65 % en 24 h » sur un prix qui n'avait pas bougé.
    Relevé dans market.json du 20/10 : 8 objets en fausse alerte, dont
    Arcane Velocity « +151 % sur 7 j » (8 → 170 : rang 0 contre rang 5).

      - Mods Primés et arcanes → rang MAX, toujours. C'est le rang qu'on cite
        (« un Flow Primé vaut 90 ») et celui que retiennent déjà js/api.js et
        js/objet.js : les trois calculs parlent enfin du même objet.
      - Autres mods à rangs → le rang de la passe précédente tant qu'il a des
        vendeurs en jeu (« suivi »), sinon le rang le plus vendu. Plus de
        bascule, donc plus de série en dents de scie.
      - Objet sans rang (set, pièce) → (None, None).

    rang_max vient de /v2/item ; à défaut, le plus haut rang vu dans les ordres
    (un ordre ne peut pas dépasser le rang max du jeu).
    """
    rangs = {o.get("rank") for o in orders if isinstance(o.get("rank"), int)}
    if not rangs:
        return None, None
    if tags is None:
        # Fiche /v2/item indisponible : on garde la règle de la passe précédente.
        a_rang_max = slug.startswith("primed_") or regle_prec == "max"
    else:
        a_rang_max = slug.startswith("primed_") or "arcane_enhancement" in tags
    if a_rang_max:
        return (rang_max if isinstance(rang_max, int) else max(rangs)), "max"
    ventes = [o for o in orders if o.get("type") == "sell"
              and (o.get("user") or {}).get("status") == "ingame"]
    if isinstance(rang_prec, int) and any(o.get("rank") == rang_prec for o in ventes):
        return rang_prec, "suivi"
    r = _rang_marchand(ventes)
    if r is None:
        # Aucun vendeur en jeu : l'objet reste un objet À RANG (sinon sa série se
        # mélangerait à celle d'un objet sans rang) ; son prix sera null.
        r = rang_prec if isinstance(rang_prec, int) else max(rangs)
    return r, "plus-vendu"


def _rang_marchand(sells):
    """Le rang sur lequel l'objet se négocie vraiment, ou None s'il n'a pas de rang.

    POURQUOI CE FILTRE EXISTE. Un arcane et un mod Primé se vendent à des rangs
    différents, et les prix n'ont RIEN à voir : le 03/09/2026, Arcane Steadfast
    affichait 6 ventes au rang 0 (à partir de 10 p) et 13 au rang 5, pendant que
    les demandes d'achat étaient au rang 5 (jusqu'à 840 p). Mélanger les deux
    fabriquait une « marge » de 830 platine qui n'existe pas : personne ne paie
    840 p pour l'objet vendu 10 p, ce sont deux objets différents.

    On retient le rang qui porte le PLUS de ventes — celui qui a un marché — et
    tout se calcule dedans. À égalité, le rang le plus bas (celui qui tombe du
    jeu). Un set n'a pas de rang : ses ordres n'ont pas le champ, on rend None.
    """
    compte = {}
    for o in sells:
        r = o.get("rank")
        if r is None:
            continue
        compte[r] = compte.get(r, 0) + 1
    if not compte:
        return None
    haut = max(compte.values())
    return min(r for r, n in compte.items() if n == haut)


_AUTO = object()


def _prix_ordres(orders, rang=_AUTO):
    """Prix d'un objet depuis ses ordres v2 — vendeurs EN JEU, à rang comparable.

    `rang` : le rang imposé par `_choisir_rang` ; sans lui (pièces de set),
    le rang le plus vendu.

    Seuls les vendeurs « ingame » comptent : un prix affiché par un joueur hors
    ligne n'est pas un prix auquel on peut acheter maintenant. Sur les pièces la
    nuance pèse plus lourd encore — elles dorment souvent chez des inactifs.

    Rend un dict : minSellPlat, low5SellPlat, sellOrders, maxBuyPlat,
    high5BuyPlat, buyOrders, rang. `high5BuyPlat` existe pour la même raison que
    `low5SellPlat` : le meilleur ordre, des deux côtés, est parfois isolé et
    absurde. Le DEUXIÈME dit la vérité du marché, et une page ne peut le montrer
    que si la donnée est là.
    """
    ingame = [o for o in orders if (o.get("user") or {}).get("status") == "ingame"]
    sells = sorted((o for o in ingame if o.get("type") == "sell"),
                   key=lambda o: o.get("platinum", 10 ** 9))
    if rang is _AUTO:
        rang = _rang_marchand(sells)
    if rang is not None:
        sells = [o for o in sells if o.get("rank") == rang]
        buys = [o for o in ingame if o.get("type") == "buy" and o.get("rank") == rang]
    else:
        buys = [o for o in ingame if o.get("type") == "buy"]
    buys.sort(key=lambda o: o.get("platinum", 0), reverse=True)
    return {
        "minSellPlat": sells[0]["platinum"] if sells else None,
        "low5SellPlat": [o["platinum"] for o in sells[:5]],
        "sellOrders": len(sells),
        "maxBuyPlat": buys[0]["platinum"] if buys else None,
        "high5BuyPlat": [o["platinum"] for o in buys[:5]],
        "buyOrders": len(buys),
        "rang": rang,
    }


def fetch_market_pieces(cfg, slugs):
    """Prix des PIÈCES de set. Renvoie {generated, items:{slug:{...}}, errors:{}}.

    Appelé au plus une fois par jour (voir `pieces_perimees`) : 336 requêtes de
    plus à chaque passe de 4 h serait discourtois envers une API communautaire
    gratuite, pour une donnée — l'écart set/pièces — qui ne bouge pas d'heure en
    heure.
    """
    base = cfg["market_base"].rstrip("/")
    headers = {"Platform": cfg.get("platform", "pc"),
               "Language": cfg.get("language", "en"), "Accept": "application/json"}
    out = {"items": {}, "errors": {}}
    for slug in slugs:
        data, err = http_get_json("%s/v2/orders/item/%s" % (base, slug), headers=headers,
                                  timeout=cfg["http_timeout_seconds"],
                                  retries=cfg["http_retries"])
        if err or not data:
            out["errors"][slug] = err or "no data"
            continue
        px = _prix_ordres(data.get("data") or [])
        out["items"][slug] = {"minSellPlat": px["minSellPlat"],
                              "low5SellPlat": px["low5SellPlat"],
                              "sellOrders": px["sellOrders"],
                              "maxBuyPlat": px["maxBuyPlat"]}
        time.sleep(0.4)
    return out


def pieces_perimees(prec, heures=20):
    """Vrai si data/market_pieces.json manque ou date de plus de `heures`."""
    stamp = (prec or {}).get("generated")
    if not stamp:
        return True
    try:
        t = time.strptime(stamp, "%Y-%m-%dT%H:%M:%SZ")
    except Exception:
        return True
    return (time.time() - calendar.timegm(t)) > heures * 3600


def noms_catalogue(data_dir):
    """slug -> {"nom": nom EN du catalogue, "nomFr": nom FR du catalogue (si connu)}.

    POURQUOI. Jusqu'au 21/10/2026, /hub, /marche et /bons-plans fabriquaient le
    nom affiché depuis le slug (« ash prime set », « Primed Flow » sur une page
    française) : un nom inventé par le code, pas le nom du jeu. Les noms
    existent déjà dans le dépôt, on les lit — jamais déduits du slug :
      - data/items.json   : nom EN de warframe.market (3 892 objets) ;
      - data/noms_fr.json : LA source FR du site (i18n officielle WFCD, mods +
        arcanes par nom EN ; écrit par scripts/generer_noms_fr.mjs, lu par les
        builds, guides et fiches /o/) — « Flux Accru », pas « Flux Accru Prime » ;
      - repli, seulement si un nom manque dans noms_fr.json : data/arcanes.json
        (champ f) et data/arsenal/mods.json (champ n, nom EN en `en`), dont les
        libellés des mods Primés ajoutent « Prime » (5 écarts relevés le 21/10).
    Un slug absent du catalogue n'a PAS de nom : la page montre le slug tel
    quel, et le garde-fou verifier_noms_marche.py le signale.
    """
    noms = {}
    for it in read_json(data_dir, "items.json") or []:
        if it.get("u") and it.get("n"):
            noms[it["u"]] = {"nom": it["n"]}
    officiel = read_json(data_dir, "noms_fr.json") or {}
    fr_par_en = {}
    for mod in read_json(os.path.join(data_dir, "arsenal"), "mods.json") or []:
        if mod.get("en") and mod.get("n"):
            fr_par_en[mod["en"]] = mod["n"]
    fr_par_en.update(officiel.get("mods") or {})
    fr_par_en.update(officiel.get("arcanes") or {})
    repli_arcanes = {arc["w"]: arc["f"] for arc in read_json(data_dir, "arcanes.json") or []
                     if arc.get("w") and arc.get("f")}
    for slug, d in noms.items():
        fr = fr_par_en.get(d["nom"]) or repli_arcanes.get(slug)
        if fr and fr != d["nom"]:
            d["nomFr"] = fr
    return noms


def attacher_noms(market, noms):
    """Pose nom / nomFr sur chaque objet du marché depuis le catalogue (rien d'autre)."""
    for it in market.get("items", []):
        d = noms.get(it.get("slug"))
        it.pop("nom", None)
        it.pop("nomFr", None)
        if d:
            it["nom"] = d["nom"]
            if d.get("nomFr"):
                it["nomFr"] = d["nomFr"]
    return market


def _median(nums):
    xs = sorted(n for n in nums if isinstance(n, (int, float)))
    if not xs:
        return None
    m = len(xs) // 2
    if len(xs) % 2:
        return xs[m]
    return round((xs[m - 1] + xs[m]) / 2, 1)


def serie_du_rang(series, rang):
    """Les points d'historique qui décrivent CE rang — et seulement eux.

    Chaque point d'un objet à rangs porte `r` depuis le 20/10/2026. Un point
    sans `r` sur un objet à rangs a été écrit quand le rang basculait d'une
    passe à l'autre : on ne sait pas quel objet il décrit, il n'entre dans
    AUCUN calcul (ni variation, ni alerte, ni sparkline). Sur un objet sans
    rang, au contraire, aucun point n'a de `r`.
    """
    if rang is None:
        return [p for p in series or [] if "r" not in p]
    return [p for p in series or [] if p.get("r") == rang]


def update_market_history(prev_hist, market, cap_days=90):
    """Ajoute (ou remplace) le point du jour pour chaque (objet, rang). Renvoie l'historique capé.

    Une seule série par objet dans le fichier (les pages la lisent telle quelle),
    mais chaque point d'un objet à rangs porte son rang `r` : la série d'un rang
    se lit avec `serie_du_rang`. Le cap garde les `cap_days` dernières DATES.
    """
    hist = dict(prev_hist or {})
    today = today_utc_date()
    for it in market.get("items", []):
        slug = it.get("slug")
        if not slug or it.get("minSellPlat") is None:
            continue
        rang = it.get("rang")
        point = {"d": today, "min": it.get("minSellPlat"), "median": it.get("median")}
        if rang is not None:
            point["r"] = rang
        series = [p for p in hist.get(slug, [])
                  if not (p.get("d") == today and p.get("r") == point.get("r"))
                  # Objet à rangs : un point sans r ne décrit aucun rang connu
                  # (écrit quand le rang basculait) ; on le retire du fichier
                  # plutôt que de laisser chaque lecteur s'en méfier.
                  and not (rang is not None and "r" not in p)]
        series.append(point)
        # Tri STABLE sur la date seule : dans une même journée, le dernier point
        # reste le dernier écrit (memeRang côté client lit le dernier r).
        series.sort(key=lambda p: p.get("d") or "")
        dates = sorted({p.get("d") for p in series})[-cap_days:]
        hist[slug] = [p for p in series if p.get("d") in set(dates)]
    return hist


def _jour(d, decalage):
    """'AAAA-MM-JJ' décalé de `decalage` jours."""
    t = calendar.timegm(time.strptime(d, "%Y-%m-%d")) + decalage * 86400
    return time.strftime("%Y-%m-%d", time.gmtime(t))


def _pct(nouveau, ancien):
    return round((nouveau - ancien) * 100.0 / ancien) if ancien else None


def enrich_market_items(market, hist, alert_pct=15):
    """Ajoute median/avgTop5/ducatsPerPlat/trend/change24h/change7d/spark (déterministe).

    LE PRIX DE RÉFÉRENCE EST LA MÉDIANE (des cinq offres les plus basses de
    vendeurs en jeu, au rang affiché), PAS L'OFFRE LA PLUS BASSE. Mesuré le
    21/10/2026 sur 6 703 couples J/J-1 de market_history.json : 707 « alertes »
    (≥ 15 %) calculées sur minSellPlat, dont 258 (36 %) avec une médiane quasi
    immobile (< 5 %). Une seule offre isolée suffisait : Lex Prime Set, 7, 8, 8
    puis 3 platine (la 2e offre à 5, la 3e à 9) → « −62 % », tête des baisses
    de /bons-plans et « meilleur farm de ducats » du Hub à 18,3 ducats/plat ;
    trois heures plus tard l'offre avait disparu (11,0 en direct). Gauss Prime
    « +43 % » (35 → 50) pendant que la médiane faisait 50 → 55. minSellPlat
    reste publié (c'est le prix d'achat immédiat), mais variations, alertes,
    sparkline, movers et ducats/platine se calculent sur la médiane.

    Tout se calcule sur la série DU RANG affiché (cf. serie_du_rang), et
    seulement avec un point de référence daté honnêtement : la veille pour
    24 h, J-6 à J-8 pour 7 jours. Sans ce point, la variation vaut null
    (« non disponible ») — jamais une comparaison avec un point de 3 semaines
    présentée comme « 24 h ».

    change24h / change7d sont en PLATINE ; change24hPct / change7dPct en %.
    Renvoie la liste 'movers' (top hausses/baisses 24 h).
    """
    movers = []
    for it in market.get("items", []):
        low5 = it.get("low5SellPlat") or []
        it["median"] = _median(low5)
        it["avgTop5"] = round(sum(low5) / len(low5), 1) if low5 else None
        ducats = it.get("ducats")
        ref = it.get("median")
        it.pop("ducatsPerPlat", None)
        if isinstance(ducats, (int, float)) and isinstance(ref, (int, float)) and ref > 0:
            it["ducatsPerPlat"] = round(ducats / ref, 2)  # plus haut = meilleur rendement
        series = [p for p in serie_du_rang((hist or {}).get(it.get("slug"), []), it.get("rang"))
                  if isinstance(p.get("median"), (int, float))]
        # spark = dernières <=14 médianes, toutes du même rang
        it["spark"] = [p["median"] for p in series[-14:]]
        it.pop("alert", None)
        for k in ("change24h", "change24hPct", "change7d", "change7dPct", "trend"):
            it[k] = None
        # Moins de 3 offres : la « médiane » redevient une offre isolée — pas de
        # variation ni d'alerte (null = n.d.), le prix et la sparkline restent.
        if not isinstance(ref, (int, float)) or not series or len(low5) < 3:
            continue
        jour = series[-1]["d"]
        par_jour = {p["d"]: p["median"] for p in series}
        # change24h : vs la VEILLE, et elle seule
        veille = par_jour.get(_jour(jour, -1))
        if isinstance(veille, (int, float)):
            it["change24h"] = round(ref - veille, 1)
            it["change24hPct"] = _pct(ref, veille)
            it["trend"] = "up" if ref > veille else ("down" if ref < veille else "flat")
            if veille > 0 and abs(ref - veille) * 100.0 / veille >= alert_pct:
                it["alert"] = "drop" if ref < veille else "spike"
        # change7d : vs J-7, ou J-6 / J-8 si le robot a sauté ce jour-là
        for dec in (-7, -6, -8):
            prec = par_jour.get(_jour(jour, dec))
            if isinstance(prec, (int, float)):
                it["change7d"] = round(ref - prec, 1)
                it["change7dPct"] = _pct(ref, prec)
                break
        if it.get("change24h"):
            movers.append({"slug": it["slug"], "nom": it.get("nom"), "nomFr": it.get("nomFr"),
                           "change24h": it["change24h"], "change24hPct": it["change24hPct"],
                           "minSellPlat": it.get("minSellPlat"), "median": ref,
                           "rang": it.get("rang")})
    movers.sort(key=lambda m: abs(m["change24h"]), reverse=True)
    return movers[:6]


# --- Agenda iCalendar (data/warframe.ics) -----------------------------------
# Ajouté le 05/06/2026 (backlog « flux ICS des événements ») : les joueurs
# s'abonnent dans leur calendrier (iPhone/Google) à l'arrivée de Baro et aux
# fins d'événements. 100 % stdlib, additif, ne casse jamais le build (try/except).
def _ics_escape(s):
    return (str(s or "").replace("\\", "\\\\").replace(";", "\\;")
            .replace(",", "\\,").replace("\n", "\\n"))


def _ics_dt(iso):
    """ISO 8601 -> format ICS UTC basique (AAAAMMJJTHHMMSSZ) ou None."""
    ep = iso_to_epoch(iso)
    if ep is None:
        return None
    return datetime.fromtimestamp(ep, tz=timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def build_ics(summary):
    """Construit le contenu iCalendar depuis le résumé (Baro + événements)."""
    now_ics = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    L = ["BEGIN:VCALENDAR", "VERSION:2.0",
         "PRODID:-//VoidRelay//Warframe Agenda//FR",
         "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
         "X-WR-CALNAME:Warframe — Baro & événements (VoidRelay)",
         "X-WR-TIMEZONE:UTC"]

    def vevent(uid, start, end, summary_txt, desc):
        if not start:
            return
        L.extend(["BEGIN:VEVENT",
                  "UID:%s@voidrelay.fr" % uid,
                  "DTSTAMP:%s" % now_ics,
                  "DTSTART:%s" % start]
                 + (["DTEND:%s" % end] if end else [])
                 + ["SUMMARY:%s" % _ics_escape(summary_txt),
                    "DESCRIPTION:%s" % _ics_escape(desc),
                    "URL:https://voidrelay.fr/hub",
                    "END:VEVENT"])

    b = summary.get("baro") or {}
    if b.get("startUtc"):
        vevent("baro-%s" % _ics_dt(b["startUtc"]),
               _ics_dt(b["startUtc"]), _ics_dt(b.get("endUtc")),
               "Baro Ki'Teer — %s" % (b.get("location") or "relais"),
               "Le marchand du Vide est là (48 h). Inventaire en direct : https://voidrelay.fr/hub")
    for e in (summary.get("events") or [])[:12]:
        end = _ics_dt(e.get("endUtc"))
        if end:
            vevent("event-end-%s-%s" % (end, abs(hash(str(e.get("name")))) % 99999),
                   end, None,
                   "Fin d'événement : %s" % (e.get("name") or "Warframe"),
                   "Dernière chance — détail sur https://voidrelay.fr/hub")
    L.append("END:VCALENDAR")
    return "\r\n".join(L) + "\r\n"   # RFC 5545 : fins de ligne CRLF


def write_ics(data_dir, summary):
    try:
        path = os.path.join(data_dir, "warframe.ics")
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8", newline="") as f:
            f.write(build_ics(summary))
        os.replace(tmp, path)
        return path
    except Exception as e:  # jamais bloquant
        print("[warn] warframe.ics non généré: %s" % e)
        return None


# --- E/S fichiers (uniquement dans data/) ----------------------------------
def write_json(data_dir, name, obj):
    path = os.path.join(data_dir, name)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")
    os.replace(tmp, path)
    return path


def read_json(data_dir, name):
    path = os.path.join(data_dir, name)
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return None
    return None


def load_config():
    cfg = dict(DEFAULT_CONFIG)
    cfg_path = os.path.join(HERE, "wf_config.json")
    if os.path.exists(cfg_path):
        try:
            with open(cfg_path, "r", encoding="utf-8") as f:
                user_cfg = json.load(f)
            for k, v in user_cfg.items():
                if not k.startswith("_"):
                    cfg[k] = v
        except Exception as e:
            print("[warn] wf_config.json illisible, valeurs par défaut utilisées: %s" % e)
    return cfg


# --- Programme principal ---------------------------------------------------
def main():
    cfg = load_config()
    data_dir = os.path.join(REPO_ROOT, cfg.get("data_dir", "data"))
    os.makedirs(data_dir, exist_ok=True)

    status = {"worldstate": None, "market": None}
    summary = {"updated_utc": now_utc_iso(), "scriptVersion": SCRIPT_VERSION}

    # 1) Worldstate : warframestat (primaire) -> DE (secours)
    wfs_url = "%s/%s/?language=%s" % (cfg["warframestat_base"].rstrip("/"),
                                      cfg.get("platform", "pc"), cfg.get("language", "en"))
    wfs, wfs_err = http_get_json(wfs_url, timeout=cfg["http_timeout_seconds"],
                                 retries=cfg["http_retries"])
    normalized = None
    cycles = None
    if wfs and isinstance(wfs, dict) and wfs.get("timestamp"):
        normalized = build_summary_from_warframestat(wfs)
        cycles = normalized.pop("cycles", None)
        status["worldstate"] = "warframestat"
        if cfg.get("save_raw_worldstate", True):
            write_json(data_dir, "worldstate.json", wfs)  # JSON friendly complet (optionnel)
    else:
        # Secours : worldstate officiel DE
        ws, ws_err = http_get_json(cfg["de_worldstate_url"],
                                   timeout=cfg["http_timeout_seconds"],
                                   retries=cfg["http_retries"])
        if ws and isinstance(ws, dict):
            normalized = parse_de_worldstate(ws)
            cycles = compute_cycles()
            status["worldstate"] = "de-fallback"
            if cfg.get("save_raw_worldstate", True):
                write_json(data_dir, "worldstate_raw.json", ws)
        else:
            status["worldstate"] = "stale"
            print("[warn] worldstate indisponible (warframestat: %s | DE: %s)" % (wfs_err, ws_err))

    # Conserver la dernière donnée valide si tout a échoué
    if normalized is None:
        normalized = read_json(data_dir, "summary.json") or {}
        normalized = {k: v for k, v in normalized.items()
                      if k not in ("updated_utc", "scriptVersion", "sources", "market",
                                   "marketMovers")}
    if cycles is None:
        prev = read_json(data_dir, "cycles.json")
        cycles = prev if prev else compute_cycles()

    write_json(data_dir, "cycles.json", cycles)

    # 2) Marché : warframe.market v2 (+ ducats caché) + enrichissement déterministe
    prev_market = read_json(data_dir, "market.json") or {}
    ducats_cache = {i.get("slug"): i.get("ducats")
                    for i in (prev_market.get("items") or []) if i.get("ducats") is not None}
    market = fetch_market(cfg, ducats_cache=ducats_cache,
                          prev_items={i.get("slug"): i for i in (prev_market.get("items") or [])})
    movers = []
    if market["items"]:
        status["market"] = "ok" if not market["errors"] else "partial"
        # historique (avant enrichissement : il alimente le point du jour avec min;
        # on calcule median d'abord pour le stocker).
        for it in market["items"]:
            it.setdefault("median", _median(it.get("low5SellPlat") or []))
        attacher_noms(market, noms_catalogue(data_dir))
        prev_hist = read_json(data_dir, "market_history.json") or {}
        hist = update_market_history(prev_hist, market, cap_days=cfg.get("market_history_days", 90))
        movers = enrich_market_items(market, hist, alert_pct=cfg.get("market_alert_pct", 15))
        write_json(data_dir, "market_history.json", hist)
        # Horodatage de fraîcheur : les pages peuvent afficher l'âge réel des prix
        # (en panne de pipeline, l'ancien horodatage reste — honnête par construction).
        market["generated"] = now_utc_iso()
        write_json(data_dir, "market.json", market)
    else:
        status["market"] = "stale"
        if prev_market:
            market = prev_market
            movers = []

    # 2ter) Prix des PIÈCES de set — au plus une fois par jour (cf. fetch_market_pieces).
    # Sert l'écart « set vs pièces » : ce que coûte le montage pièce par pièce
    # face à ce que le set entier se revend. Sans les pièces, ce profil de
    # joueur — celui qui achète les morceaux pour revendre l'ensemble — n'a
    # aucun chiffre sur le site.
    recette = read_json(data_dir, "set_pieces.json") or {}
    prev_pieces = read_json(data_dir, "market_pieces.json") or {}
    if recette.get("sets") and pieces_perimees(prev_pieces):
        besoin = sorted({p["slug"] for s in recette["sets"].values()
                         for p in s.get("pieces", [])})
        pieces = fetch_market_pieces(cfg, besoin)
        if pieces["items"]:
            pieces["generated"] = now_utc_iso()
            write_json(data_dir, "market_pieces.json", pieces)
            status["market_pieces"] = "ok" if not pieces["errors"] else "partial"
        else:
            # Rien reçu : on GARDE l'ancien fichier plutôt que d'en écrire un vide.
            # Un écart calculé sur des prix d'hier vaut mieux qu'aucun écart, et
            # l'horodatage conservé dit au visiteur de quand il date.
            status["market_pieces"] = "stale"
    elif prev_pieces:
        status["market_pieces"] = "frais"

    # 2bis) Catalogue complet des objets échangeables (autocomplétion + /marche-complet)
    status["items_catalog"] = refresh_items_catalog(cfg, data_dir)

    # 3) Résumé compact (contrat stable pour le Hub) + last_update
    summary.update(normalized)
    summary["cycles"] = cycles
    summary["market"] = {"platform": market.get("platform"),
                         "items": market.get("items", [])}
    summary["marketMovers"] = movers
    # Rivens (stats officielles DE) — additif : échec = on garde la section précédente si elle existe
    riv = fetch_rivens(cfg)
    if riv:
        summary["rivens"] = riv
    else:
        prev_sum = read_json(data_dir, "summary.json") or {}
        if prev_sum.get("rivens"):
            summary["rivens"] = prev_sum["rivens"]

    summary["sources"] = status
    write_json(data_dir, "summary.json", summary)
    write_ics(data_dir, summary)   # agenda Baro + événements (jamais bloquant)

    write_json(data_dir, "last_update.json", {
        "updated_utc": summary["updated_utc"],
        "scriptVersion": SCRIPT_VERSION,
        "sources": status,
    })

    print("[ok] Données écrites dans %s" % data_dir)
    print("     worldstate=%s | market=%s | movers=%d" %
          (status["worldstate"], status["market"], len(movers)))
    # Code de sortie 0 même en mode dégradé : on ne casse jamais le build.
    return 0


def selftest():
    """Teste les PARSERS hors-ligne (utile car warframestat peut être bloqué
    depuis certains réseaux). Renvoie 0 si tout passe, 1 sinon."""
    ok = True

    # --- Parser warframestat (chemin PRIMAIRE) sur un mini échantillon ----
    wfs_sample = {
        "timestamp": "2026-06-02T00:00:00.000Z",
        "cetusCycle": {"state": "night", "timeLeft": "12m", "expiry": "2099-01-01T00:00:00.000Z"},
        "vallisCycle": {"state": "warm", "timeLeft": None, "expiry": "2099-01-01T00:00:00.000Z"},
        "cambionCycle": {"state": "fass", "timeLeft": "12m", "expiry": "2099-01-01T00:00:00.000Z"},
        "earthCycle": {"state": "day", "timeLeft": "1h", "expiry": "2099-01-01T00:00:00.000Z"},
        "voidTrader": {"character": "Baro Ki'Teer", "location": "Strata Relay",
                       "active": False, "activation": "2026-06-10T13:00:00Z",
                       "expiry": "2026-06-12T13:00:00Z", "inventory": []},
        "sortie": {"boss": "Lephantis", "faction": "Infested", "expiry": "x",
                   "variants": [{"missionType": "Defense", "modifier": "X", "node": "Y"}]},
        "archonHunt": {"boss": "Nira", "faction": "Narmer", "expiry": "x",
                       "missions": [{"type": "Assassination", "node": "Z"}]},
        "fissures": [{"tier": "Lith", "node": "A", "missionType": "Capture",
                      "isHard": False, "expiry": "x"},
                     {"tier": "Axi", "node": "B", "missionType": "Survival",
                      "isHard": True, "expiry": "x"}],
        "voidStorms": [{"node": "Veil", "activeMissionTier": "Axi", "expiry": "x"}],
        "invasions": [{"node": "C", "attackingFaction": "Grineer",
                       "defendingFaction": "Corpus", "completion": 42.4,
                       "completed": False}],
        "dailyDeals": [{"item": "Sweeping Serration", "discount": 50,
                        "originalPrice": 30, "salePrice": 15, "total": 200,
                        "sold": 120, "expiry": "x"}],
        "nightwave": {"season": 15, "phase": 0, "tag": "Glassmaker",
                      "expiry": "x", "activeChallenges": [{}, {}]},
        "events": [{"description": "Test event", "expiry": "x"}],
        "steelPath": {"currentReward": {"name": "50,000 Kuva", "cost": 55},
                      "expiry": "2099-01-01T00:00:00.000Z",
                      "rotation": [{"name": "Umbra Forma Blueprint", "cost": 150}],
                      "evergreens": [{"name": "Veiled Riven Cipher", "cost": 20}]},
        "vaultTrader": {"character": "Varzia", "location": "Maroo's Bazaar (Mars)",
                        "active": None, "activation": "2000-01-01T00:00:00Z",
                        "expiry": "2099-01-01T00:00:00Z",
                        "inventory": [
                            {"item": "Rhino Prime", "ducats": 3, "credits": None,
                             "uniqueName": "/Lotus/StoreItems/Powersuits/Rhino/RhinoPrime"},
                            {"item": "Boltor Prime", "ducats": 2, "credits": None,
                             "uniqueName": "/Lotus/StoreItems/Weapons/Tenno/LongGuns/PrimeBoltor/PrimeBoltor"},
                            {"item": "M P V Rhino Prime Single Pack", "ducats": 6, "credits": None,
                             "uniqueName": "/Lotus/Types/StoreItems/Packages/MegaPrimeVault/MPVRhinoPrimeSinglePack"}]},
    }
    n = build_summary_from_warframestat(wfs_sample)
    checks = [
        ("cycles.cetus.state", n["cycles"]["cetus"]["state"] == "night"),
        ("cycles.cetus.secs_int", isinstance(n["cycles"]["cetus"]["timeLeftSeconds"], int)),
        ("cycles.vallis.secs_int_even_if_timeleft_null",
         isinstance(n["cycles"]["vallis"]["timeLeftSeconds"], int)),
        ("cycles.cetus.expiryUtc", n["cycles"]["cetus"]["expiryUtc"] == "2099-01-01T00:00:00.000Z"),
        ("baro.character", n["baro"]["character"] == "Baro Ki'Teer"),
        ("sortie.missions", len(n["sortie"]["missions"]) == 1),
        ("archon.boss", n["archonHunt"]["boss"] == "Nira"),
        ("fissures.count", n["fissures"]["count"] == 2),
        ("fissures.steelPath", n["fissures"]["steelPathCount"] == 1),
        ("voidStorms.count", n["voidStorms"]["count"] == 1),
        ("invasions.count", n["invasions"]["count"] == 1),
        ("darvo.active", n["darvo"]["active"] is True),
        ("darvo.stockLeft", n["darvo"]["stockLeft"] == 80),
        ("nightwave.challenges", n["nightwave"]["activeChallenges"] == 2),
        ("events", len(n["events"]) == 1),
        # Steel Path + Prime Resurgence (features 06/06/2026)
        ("steelPath.reward", n["steelPath"]["currentReward"]["name"] == "50,000 Kuva"),
        ("steelPath.rotation", len(n["steelPath"]["rotation"]) == 1),
        ("resurgence.active_computed", n["resurgence"]["active"] is True),
        ("resurgence.featured_frames_only", n["resurgence"]["featured"] == ["Rhino Prime"]),
        ("resurgence.itemCount", n["resurgence"]["itemCount"] == 3),
    ]

    # --- Parser DE (chemin SECOURS) sur un mini échantillon ---------------
    de_sample = {
        "VoidTraders": [{"Character": "Baro'Ki Teel", "Node": "SaturnHUB",
                         "Activation": {"$date": {"$numberLong": "1700000000000"}},
                         "Expiry": {"$date": {"$numberLong": "1700100000000"}}}],
        "Sorties": [{"Boss": "SORTIE_BOSS_CORRUPTED_VOR",
                     "Expiry": {"$date": {"$numberLong": "1700100000000"}},
                     "Variants": [{"missionType": "MT_DEFENSE", "modifierType": "M"}]}],
        "LiteSorties": [{"Boss": "SORTIE_BOSS_NIRA",
                         "Expiry": {"$date": {"$numberLong": "1700100000000"}}}],
        "ActiveMissions": [{"Node": "SolNode1", "MissionType": "MT_RESCUE",
                            "Modifier": "VoidT5", "Hard": True,
                            "Expiry": {"$date": {"$numberLong": "1700100000000"}}}],
        "VoidStorms": [{"Node": "CrewBattleNode501", "ActiveMissionTier": "VoidT2",
                        "Expiry": {"$date": {"$numberLong": "1700100000000"}}}],
        "Invasions": [{"Node": "SolNode2", "Completed": False, "Goal": 100, "Count": 10,
                       "Faction": "FC_GRINEER",
                       "AttackerMissionInfo": {"faction": "FC_CORPUS"},
                       "DefenderFaction": "FC_CORPUS"}],
        "DailyDeals": [{"StoreItem": "/Lotus/StoreItems/Upgrades/Focus/DefenseLensGreater",
                        "Discount": 50, "OriginalPrice": 40, "SalePrice": 20,
                        "AmountTotal": 50, "AmountSold": 30,
                        "Expiry": {"$date": {"$numberLong": "1700100000000"}}}],
        "SeasonInfo": {"Season": 15, "Phase": 0, "AffiliationTag": "Tag",
                       "Expiry": {"$date": {"$numberLong": "1700100000000"}},
                       "ActiveChallenges": [{}, {}, {}]},
        "Events": [],
    }
    de = parse_de_worldstate(de_sample)
    checks += [
        # 05/06/2026 : node_name() mappe désormais les nœuds DE vers leur nom lisible
        # (data/solnodes.json) ; SaturnHUB → « Kronia Relay (Saturn) ». Une clé inconnue
        # reste inchangée (2e check).
        ("de.baro.location", de["baro"]["location"] == "Kronia Relay (Saturn)"),
        # build_rivens_top : veiled exclu, pop<3 filtrée, rerolled prioritaire, tri médiane desc
        ("rivens.top", (lambda t: len(t) == 1 and t[0]["weapon"] == "TestGun" and t[0]["median"] == 100)(
            build_rivens_top({"Rifle Riven Mod": {
                "Veiled Rifle Riven Mod": {"unrolled": {"median": 999, "avg": 999, "pop": 50, "rerolled": False}},
                "TestGun": {"rerolled": {"median": 100, "avg": 120, "pop": 10, "rerolled": True}},
                "RareGun": {"unrolled": {"median": 500, "avg": 500, "pop": 1, "rerolled": False}}}}))),
        ("de.node_name.inconnu_passe_brut", node_name("SolNodeJamaisVu") == "SolNodeJamaisVu"),
        ("de.sortie.boss_pretty", de["sortie"]["boss"] == "Corrupted Vor"),
        ("de.archon.boss_pretty", de["archonHunt"]["boss"] == "Nira"),
        ("de.fissure.tier_map", de["fissures"]["list"][0]["tier"] == "Requiem"),
        ("de.fissure.steelPath", de["fissures"]["steelPathCount"] == 1),
        ("de.voidStorm.tier_map", de["voidStorms"]["list"][0]["tier"] == "Meso"),
        ("de.invasion.faction_map", de["invasions"]["list"][0]["attacker"] == "Grineer"),
        ("de.darvo.item_name", de["darvo"]["item"] == "Defense Lens Greater"),
        ("de.darvo.stockLeft", de["darvo"]["stockLeft"] == 20),
        ("de.nightwave.challenges", de["nightwave"]["activeChallenges"] == 3),
    ]

    # --- Cycles calculés : cohérence ---------------------------------------
    cy = compute_cycles(1700000000)
    checks += [
        ("cycles.cetus.range", 0 <= cy["cetus"]["timeLeftSeconds"] <= 6000),
        ("cycles.cambion.synced", cy["cambion"]["timeLeftSeconds"] == cy["cetus"]["timeLeftSeconds"]),
        ("cycles.vallis.range", 0 <= cy["vallis"]["timeLeftSeconds"] <= 1200),
        ("cycles.computed.expiry", isinstance(cy["earth"]["expiryUtc"], str) and cy["earth"]["expiryUtc"].endswith("Z")),
    ]

    # --- cycle_from_wfs : secondes calculées depuis expiry (déterministe) --
    base = iso_to_epoch("2026-06-02T00:00:00Z")
    cw = cycle_from_wfs({"state": "day", "timeLeft": "x", "expiry": "2026-06-02T01:00:00Z"}, now_s=base)
    checks += [
        ("cycle_from_wfs.secs", cw["timeLeftSeconds"] == 3600),
        ("cycle_from_wfs.expiry", cw["expiryUtc"] == "2026-06-02T01:00:00Z"),
    ]

    # --- Enrichissement marché : math déterministe -------------------------
    # Le prix de référence est la MÉDIANE des cinq offres les plus basses (90
    # ici), pas l'offre isolée (80) : cf. enrich_market_items.
    mkt = {"platform": "pc", "items": [
        {"slug": "octavia_prime_set", "minSellPlat": 80, "low5SellPlat": [80, 85, 90, 95, 100],
         "ducats": 175},
    ]}
    # historique : 8 jours pour exercer change24h, change7d et spark
    hist = {"octavia_prime_set": [
        {"d": "2026-05-25", "min": 100, "median": 100}, {"d": "2026-05-26", "min": 98, "median": 98},
        {"d": "2026-05-27", "min": 96, "median": 96}, {"d": "2026-05-28", "min": 95, "median": 95},
        {"d": "2026-05-29", "min": 92, "median": 92}, {"d": "2026-05-30", "min": 90, "median": 90},
        {"d": "2026-05-31", "min": 88, "median": 88}, {"d": "2026-06-01", "min": 100, "median": 110},
        {"d": "2026-06-02", "min": 80, "median": 90},
    ]}
    movers = enrich_market_items(mkt, hist, alert_pct=15)
    it0 = mkt["items"][0]
    checks += [
        ("mkt.median", it0["median"] == 90),
        ("mkt.avgTop5", it0["avgTop5"] == 90.0),
        ("mkt.ducatsPerPlat", it0["ducatsPerPlat"] == round(175 / 90, 2)),
        ("mkt.change24h", it0["change24h"] == -20),       # 90 - 110 (01-06), médianes
        ("mkt.trend.down", it0["trend"] == "down"),
        ("mkt.alert.drop", it0.get("alert") == "drop"),   # 18% >= 15%
        ("mkt.change7d", it0["change7d"] == (90 - 98)),   # vs series[-8] = 98 (26-05, 7 j avant)
        ("mkt.spark.len", len(it0["spark"]) == 9 or len(it0["spark"]) == 14),
        ("mkt.spark.median", it0["spark"][-1] == 90 and it0["spark"][-2] == 110),
        ("mkt.movers", movers and movers[0]["slug"] == "octavia_prime_set"
         and movers[0]["median"] == 90),
        ("mkt.change24hPct", it0["change24hPct"] == round(-20 * 100 / 110)),
        ("mkt.change7dPct", it0["change7dPct"] == round(-8 * 100 / 98)),
    ]
    # Une offre isolée ne fabrique ni alerte ni « bon plan » : Lex Prime Set le
    # 20/10/2026 (7, 8, 8 puis 3 platine, la 2e offre à 5, la 3e à 9) titrait
    # « −62 % » et 18,3 ducats/plat ; la médiane n'avait pas bougé.
    lex = {"slug": "lex_prime_set", "minSellPlat": 3, "low5SellPlat": [3, 5, 9, 9, 10], "ducats": 55}
    mv = enrich_market_items({"items": [lex]}, {"lex_prime_set": [
        {"d": "2026-10-19", "min": 8, "median": 9}, {"d": "2026-10-20", "min": 3, "median": 9}]})
    checks += [
        ("isole.sans.alerte", lex["change24h"] == 0 and lex["trend"] == "flat"
         and lex.get("alert") is None and mv == []),
        ("isole.ducats.median", lex["ducatsPerPlat"] == round(55 / 9, 2)),
        ("isole.spark.median", lex["spark"] == [9, 9]),
    ]

    # --- Rangs : la série du rang affiché, rien d'autre ---------------------
    # Primed Flow tel que market_history.json l'avait le 20/10/2026 : rangs 0 et 10
    # mêlés (28, 30, 99…). Seuls les points r=10 comptent ; le reste n'existe pas.
    flow = {"slug": "primed_flow", "rang": 10, "minSellPlat": 80, "low5SellPlat": [80, 85, 85]}
    hf = {"primed_flow": [
        {"d": "2026-06-01", "min": 28, "median": 30}, {"d": "2026-06-01", "min": 30, "median": 32, "r": 0},
        {"d": "2026-06-01", "min": 90, "median": 92, "r": 10}, {"d": "2026-06-02", "min": 80, "median": 85, "r": 10},
    ]}
    enrich_market_items({"items": [flow]}, hf)
    checks += [
        ("rang.spark", flow["spark"] == [92, 85]),
        ("rang.change24h", flow["change24h"] == -7 and flow.get("alert") is None),
        ("rang.change7d.null", flow["change7d"] is None and flow["change7dPct"] is None),
    ]
    # Un seul point au bon rang : aucune variation n'est inventée.
    seul = {"slug": "arcane_velocity", "rang": 5, "minSellPlat": 170, "low5SellPlat": [170]}
    enrich_market_items({"items": [seul]}, {"arcane_velocity": [
        {"d": "2026-06-01", "min": 8, "median": 8}, {"d": "2026-06-02", "min": 170, "median": 170, "r": 5}]})
    checks += [
        ("rang.seul.null", seul["change24h"] is None and seul["trend"] is None
         and seul.get("alert") is None and seul["spark"] == [170]),
    ]
    # Point de référence trop vieux : pas de « 24 h » sur 3 semaines d'écart.
    vieux = {"slug": "x_set", "rang": None, "minSellPlat": 50, "low5SellPlat": [50]}
    enrich_market_items({"items": [vieux]}, {"x_set": [
        {"d": "2026-05-10", "min": 100, "median": 100}, {"d": "2026-06-02", "min": 50, "median": 50}]})
    checks += [("ref.trop.vieille", vieux["change24h"] is None and vieux["change7d"] is None)]
    # Règle de rang : Primé / arcane → max, même si le rang 0 a plus de vendeurs.
    def _o(p, r, t="sell"):
        return {"type": t, "platinum": p, "rank": r, "user": {"status": "ingame"}}
    ordres = [_o(30, 0)] * 40 + [_o(90, 10)] * 30
    checks += [
        ("regle.primed.max", _choisir_rang("primed_flow", ordres, ["mod", "legendary"], 10, 0) == (10, "max")),
        ("regle.arcane.max", _choisir_rang("arcane_aegis", [_o(8, 0)] * 9 + [_o(130, 5)],
                                           ["arcane_enhancement"], 5, 0) == (5, "max")),
        ("regle.mod.suivi", _choisir_rang("blind_rage", ordres, ["mod"], 10, 10) == (10, "suivi")),
        ("regle.set.sans", _choisir_rang("x_set", [{"type": "sell", "platinum": 5}], [], None, None)
         == (None, None)),
    ]
    h4 = update_market_history({"primed_flow": [{"d": today_utc_date(), "min": 30, "r": 0}]},
                               {"items": [{"slug": "primed_flow", "rang": 10,
                                           "minSellPlat": 90, "median": 92}]})
    checks += [("hist.par.rang", len(h4["primed_flow"]) == 2
                and h4["primed_flow"][-1] == {"d": today_utc_date(), "min": 90, "median": 92, "r": 10})]

    # --- Historique : ajout/MAJ du jour + cap ------------------------------
    h2 = update_market_history({"x": [{"d": "2026-06-01", "min": 10}]},
                               {"items": [{"slug": "x", "minSellPlat": 12, "median": 12}]},
                               cap_days=90)
    checks += [
        ("hist.append", len(h2["x"]) == 2 and h2["x"][-1]["min"] == 12),
    ]
    h3 = update_market_history({"x": [{"d": today_utc_date(), "min": 10}]},
                               {"items": [{"slug": "x", "minSellPlat": 12, "median": 12}]},
                               cap_days=90)
    checks += [
        ("hist.replace_same_day", len(h3["x"]) == 1 and h3["x"][-1]["min"] == 12),
    ]

    for name, passed in checks:
        print(("  PASS " if passed else "  FAIL ") + name)
        ok = ok and passed
    print("[selftest] " + ("TOUT OK" if ok else "ÉCHEC"))
    return 0 if ok else 1


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        sys.exit(selftest())
    sys.exit(main())
