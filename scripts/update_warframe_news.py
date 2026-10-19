#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
update_warframe_news.py — Digest HEBDOMADAIRE « Nouveautés » du Warframe Hub.

Conçu pour tourner SEUL dans une GitHub Action (cron hebdo), sans intervention
humaine, sans clé API, 100 % bibliothèque standard Python (aucun pip install).

CONTENU DÉTERMINISTE, SANS LLM : on récupère le flux de news officiel du jeu et
on le normalise (filtre par fenêtre temporelle, dédoublonnage, tri, plafond,
étiquetage par mots-clés). Aucun texte n'est « généré » : on relaie la source.

SOURCES (officielles / API publiques tolérantes uniquement) :
  1. warframestat.us  /<platform>/news   -> news « friendly » (flags update/prime/stream) [PRIMAIRE]
  2. api.warframe.com /cdn/worldState.php -> champ "Events" (news in-game brut)            [SECOURS]

NON UTILISÉ — par respect des ToS/robots (vérifié 2026-06-02) :
  - Reddit r/Warframe : robots.txt = "User-agent: * / Disallow: /"  -> AUCUN scraping (même .rss).
  - forums.warframe.com : 403 (protection anti-bot Cloudflare)       -> AUCUN scraping.

SÉCURITÉ (ne casse jamais le site) :
  - N'écrit QUE data/news.json. Ne touche jamais aux fichiers du site.
  - Ne plante JAMAIS : si tout échoue, on conserve le data/news.json précédent.
  - JSON trié (sort_keys) => diffs propres => "commit seulement si changé".

Aucune clé n'est lue ni écrite. Aucune donnée personnelle.
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta

SCRIPT_VERSION = "1.1.0"

# Base publique du site (pour les liens du flux RSS). Statique, pas de secret.
SITE_BASE = "https://voidrelay.fr"

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(HERE, ".."))

DEFAULT_CONFIG = {
    "platform": "pc",
    "language": "en",
    "data_dir": "data",
    "warframestat_base": "https://api.warframestat.us",
    "de_worldstate_url": "https://api.warframe.com/cdn/worldState.php",
    "http_timeout_seconds": 25,
    "http_retries": 3,
    "news_max_items": 25,
    "news_window_days": 45,
}

USER_AGENT = "warframe-hub-news/%s (+github-actions; contact: repo owner)" % SCRIPT_VERSION

# Mots-clés -> étiquette (classification DÉTERMINISTE, pas de LLM).
TAG_KEYWORDS = [
    ("primeAccess", ("prime access", "prime resurgence", "prime vault")),
    ("update", ("update", "hotfix", "patch", "mise à jour", "correctif", "atualização",
                "actualización", "aktualizacja")),
    ("stream", ("devstream", "prime time", "twitch", "stream", "devshort")),
]


# --- HTTP -------------------------------------------------------------------
def http_get_json(url, headers=None, timeout=25, retries=3):
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
                time.sleep(2 * attempt)
    return None, last_err


# --- Helpers ----------------------------------------------------------------
def now_utc_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def iso_to_dt(iso):
    if not iso or not isinstance(iso, str):
        return None
    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except Exception:
        return None


def ms_to_iso(ms):
    try:
        return datetime.fromtimestamp(int(ms) / 1000.0, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    except Exception:
        return None


def de_date(field):
    try:
        return int(field["$date"]["$numberLong"])
    except (KeyError, TypeError, ValueError):
        return None


def classify(text):
    """Étiquette déterministe par mots-clés. Renvoie 'update'|'primeAccess'|'stream'|'news'."""
    t = (text or "").lower()
    for tag, kws in TAG_KEYWORDS:
        if any(k in t for k in kws):
            return tag
    return "news"


def is_evergreen(message, link):
    """Liens permanents (Discord/Wiki/Forums) ou tokens /Lotus/... -> exclus du digest."""
    m = (message or "")
    if m.startswith("/Lotus") or not m.strip():
        return True
    low = (link or "").lower()
    bad = ("discord.com/invite", "discord.gg", "wiki.warframe.com", "warframe.fandom.com",
           "forums.warframe.com/", "bsky.app", "bit.ly")
    # un lien purement "communauté permanente" sans date utile
    return any(b in low for b in bad) and "/news" not in low


# --- Normalisation des sources ---------------------------------------------
def items_from_warframestat(news):
    """news = liste d'objets warframestat {message, link, date, imageLink, update, primeAccess, stream}."""
    out = []
    for n in news or []:
        msg = n.get("message")
        link = n.get("link")
        date = n.get("date")
        dt = iso_to_dt(date)
        if dt is None or dt.year < 2000:
            # pas de date réelle => évergreen, on saute
            continue
        if is_evergreen(msg, link):
            continue
        if n.get("update"):
            tag = "update"
        elif n.get("primeAccess"):
            tag = "primeAccess"
        elif n.get("stream"):
            tag = "stream"
        else:
            tag = classify(msg)
        out.append({"message": msg, "link": link,
                    "date": dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "tag": tag, "imageLink": n.get("imageLink")})
    return out


def items_from_de_events(ws):
    """Repli : champ Events du worldState officiel (DE)."""
    out = []
    for ev in (ws or {}).get("Events") or []:
        # message EN si dispo
        msg = None
        for m in ev.get("Messages") or []:
            if m.get("LanguageCode") == "en":
                msg = m.get("Message"); break
        if msg is None and ev.get("Messages"):
            msg = ev["Messages"][0].get("Message")
        link = ev.get("Prop")
        date_ms = de_date(ev.get("Date", {}))
        date = ms_to_iso(date_ms) if date_ms else None
        if date is None:
            continue  # on garde uniquement les events datés
        if is_evergreen(msg, link):
            continue
        out.append({"message": msg, "link": link, "date": date,
                    "tag": classify(msg), "imageLink": ev.get("ImageUrl")})
    return out


def consolidate(items, window_days=45, max_items=25, now=None):
    """Filtre fenêtre temporelle + dédoublonnage + tri (récent d'abord) + plafond."""
    now = now or datetime.now(timezone.utc)
    cutoff = now - timedelta(days=window_days)
    seen = set()
    keep = []
    for it in items:
        dt = iso_to_dt(it.get("date"))
        if dt is None:
            continue
        # autorise les annonces futures (ex. "arrive le 17 juin") dans une marge
        if dt < cutoff:
            continue
        key = ((it.get("message") or "").strip().lower(), (it.get("link") or "").strip().lower())
        if key in seen:
            continue
        seen.add(key)
        keep.append(it)
    keep.sort(key=lambda x: x.get("date") or "", reverse=True)
    return keep[:max_items]


# --- E/S (uniquement data/) -------------------------------------------------
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


# --- Flux RSS « Nouveautés » (data/feed.xml) --------------------------------
# 100 % déterministe (aucune date « now » volatile) => le fichier ne change que si
# les NEWS changent => même cadence de commit que news.json (diffs propres).
# Pur stdlib, XML échappé. Permet de suivre les nouveautés dans un lecteur RSS
# ou un webhook Discord, sans email, sans serveur, sans compte. (Ajout 2026-06-19.)
RSS_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
              "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
RSS_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def rfc822(dt):
    """datetime aware -> date RFC-822 (format attendu par les flux RSS)."""
    if dt is None:
        return None
    dt = dt.astimezone(timezone.utc)
    return "%s, %02d %s %04d %02d:%02d:%02d GMT" % (
        RSS_DAYS[dt.weekday()], dt.day, RSS_MONTHS[dt.month - 1], dt.year,
        dt.hour, dt.minute, dt.second)


def xml_escape(s):
    return (str(s if s is not None else "")
            .replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace('"', "&quot;").replace("'", "&apos;"))


def safe_link(u):
    """N'accepte que http(s) absolu, sinon repli sur la page hub (anti-injection)."""
    u = str(u or "").strip()
    if u.startswith("http://") or u.startswith("https://"):
        return u
    return SITE_BASE + "/hub"


def build_rss(items, source):
    """Construit le XML RSS 2.0 depuis les items normalisés (message, link, date, tag)."""
    dates = [iso_to_dt(it.get("date")) for it in items]
    dates = [d for d in dates if d is not None]
    last_build = rfc822(max(dates)) if dates else rfc822(
        datetime(2026, 1, 1, tzinfo=timezone.utc))
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
        '<channel>',
        '<title>VoidRelay — Nouveautés Warframe</title>',
        '<link>%s/hub</link>' % SITE_BASE,
        '<atom:link href="%s/data/feed.xml" rel="self" type="application/rss+xml"/>' % SITE_BASE,
        '<description>Mises à jour, Prime Access et devstreams Warframe — '
        'digest non officiel de VoidRelay (sans affiliation à Digital Extremes).</description>',
        '<language>fr</language>',
        '<lastBuildDate>%s</lastBuildDate>' % last_build,
        '<generator>VoidRelay update_warframe_news.py %s</generator>' % SCRIPT_VERSION,
    ]
    for it in items:
        msg = it.get("message") or ""
        raw = (it.get("link") or "").strip()
        link = safe_link(raw)
        dt = iso_to_dt(it.get("date"))
        # guid stable et SÛR : on n'y met le lien que s'il est http(s) ; sinon date+titre.
        guid = raw if (raw.startswith("http://") or raw.startswith("https://")) \
            else (str(it.get("date") or "") + "-" + msg)
        lines.append('<item>')
        lines.append('<title>%s</title>' % xml_escape(msg))
        lines.append('<link>%s</link>' % xml_escape(link))
        lines.append('<guid isPermaLink="false">%s</guid>' % xml_escape(guid))
        if dt is not None:
            lines.append('<pubDate>%s</pubDate>' % rfc822(dt))
        if it.get("tag"):
            lines.append('<category>%s</category>' % xml_escape(it.get("tag")))
        lines.append('<description>%s</description>' % xml_escape(msg))
        lines.append('</item>')
    lines.append('</channel>')
    lines.append('</rss>')
    return "\n".join(lines) + "\n"


def write_text(data_dir, name, text):
    path = os.path.join(data_dir, name)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(text)
    os.replace(tmp, path)
    return path


def emit_feed(data_dir, items, source):
    """Écrit data/feed.xml (idempotent : ne change que si les news changent)."""
    try:
        write_text(data_dir, "feed.xml", build_rss(items, source))
        print("[ok] data/feed.xml écrit : %d items (RSS)" % len(items))
    except Exception as e:
        print("[warn] feed.xml non écrit (%s) — non bloquant." % e)


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
            print("[warn] wf_config.json illisible: %s" % e)
    return cfg


# --- Programme principal ----------------------------------------------------
def main():
    cfg = load_config()
    data_dir = os.path.join(REPO_ROOT, cfg.get("data_dir", "data"))
    os.makedirs(data_dir, exist_ok=True)

    source = None
    items = []

    # 1) warframestat /pc/news (primaire)
    url = "%s/%s/news/?language=%s" % (cfg["warframestat_base"].rstrip("/"),
                                       cfg.get("platform", "pc"), cfg.get("language", "en"))
    news, err = http_get_json(url, timeout=cfg["http_timeout_seconds"], retries=cfg["http_retries"])
    if isinstance(news, list) and news:
        items = items_from_warframestat(news)
        source = "warframestat"
    else:
        # 2) secours : Events du worldState officiel DE
        ws, ws_err = http_get_json(cfg["de_worldstate_url"],
                                   timeout=cfg["http_timeout_seconds"], retries=cfg["http_retries"])
        if isinstance(ws, dict):
            items = items_from_de_events(ws)
            source = "de-fallback"
        else:
            print("[warn] news indisponible (warframestat: %s | DE: %s)" % (err, ws_err))

    items = consolidate(items, window_days=cfg.get("news_window_days", 45),
                        max_items=cfg.get("news_max_items", 25))

    if not items:
        # rien de neuf récupéré -> on garde l'ancien digest s'il existe
        prev = read_json(data_dir, "news.json")
        if prev and prev.get("items"):
            print("[ok] aucune news fraîche, conservation du digest précédent (%d items)." % len(prev["items"]))
            # Régénère feed.xml depuis l'ancien digest (idempotent : crée le flux au 1er run,
            # ne committe rien si identique). Source = celle du digest conservé.
            emit_feed(data_dir, prev.get("items") or [], prev.get("source"))
            return 0
        source = source or "stale"

    out = {
        "updated_utc": now_utc_iso(),
        "scriptVersion": SCRIPT_VERSION,
        "source": source or "stale",
        "count": len(items),
        "items": items,
    }
    write_json(data_dir, "news.json", out)
    print("[ok] data/news.json écrit : %d items (source=%s)" % (len(items), source))
    emit_feed(data_dir, items, source)
    return 0


def selftest():
    ok = True
    checks = []

    # warframestat : 1 update daté, 1 prime access daté, 1 évergreen (1970), 1 doublon
    wfs = [
        {"message": "Update 42: The Shadowgrapher", "link": "https://www.warframe.com/news/u42",
         "date": "2026-03-25T00:00:00.000Z", "update": True},
        {"message": "Styanax Prime Access", "link": "https://www.warframe.com/news/styanax",
         "date": "2026-06-01T00:00:00.000Z", "primeAccess": True},
        {"message": "Join the official Warframe Discord server", "link": "https://discord.com/invite/playwarframe",
         "date": "1970-01-01T00:00:00.000Z"},
        {"message": "Devstream 196", "link": "https://www.warframe.com/news/ds196",
         "date": "2026-05-20T00:00:00.000Z", "stream": True},
        {"message": "Update 42: The Shadowgrapher", "link": "https://www.warframe.com/news/u42",
         "date": "2026-03-25T00:00:00.000Z", "update": True},  # doublon exact
    ]
    it = items_from_warframestat(wfs)
    checks.append(("wfs.drops_evergreen_1970", all("discord" not in (x["link"] or "") for x in it)))
    checks.append(("wfs.update_tag", any(x["tag"] == "update" for x in it)))
    checks.append(("wfs.prime_tag", any(x["tag"] == "primeAccess" for x in it)))
    checks.append(("wfs.stream_tag", any(x["tag"] == "stream" for x in it)))

    # consolidate : fenêtre large pour 2026, dédoublonnage, tri récent->ancien
    now = datetime(2026, 6, 2, tzinfo=timezone.utc)
    cons = consolidate(it, window_days=120, max_items=25, now=now)
    checks.append(("cons.dedup", len(cons) == 3))  # 4 uniques - 1 doublon ; (discord déjà retiré)
    checks.append(("cons.sorted_desc", cons[0]["date"] >= cons[-1]["date"]))
    checks.append(("cons.window_excludes_old",
                   len(consolidate(it, window_days=10, max_items=25, now=now)) ==
                   sum(1 for x in it if iso_to_dt(x["date"]) >= now - timedelta(days=10))))

    # DE Events fallback : message EN, lien Prop, date ; évergreen/Lotus exclus
    de = {"Events": [
        {"Messages": [{"LanguageCode": "en", "Message": "Jade Shadows: Constellations Coming June 17"},
                      {"LanguageCode": "fr", "Message": "..."}],
         "Prop": "https://www.warframe.com/news/jade", "Date": {"$date": {"$numberLong": "1781000000000"}}},
        {"Messages": [{"LanguageCode": "en", "Message": "/Lotus/Language/CommunityMessages/JoinDiscord"}],
         "Prop": "https://discord.com/invite/playwarframe"},  # pas de date -> exclu
    ]}
    dei = items_from_de_events(de)
    checks.append(("de.keeps_dated_en", len(dei) == 1 and dei[0]["message"].startswith("Jade Shadows")))
    checks.append(("de.classify_update", dei[0]["tag"] == "update"))  # "Coming" pas update; "Constellations" non -> 'news'? vérifie ci-dessous
    # NB: "Jade Shadows: Constellations Coming June 17" ne contient pas de mot-clé update -> 'news'
    checks[-1] = ("de.classify_news", dei[0]["tag"] == "news")

    # classify direct
    checks.append(("classify.hotfix", classify("Voruna Prime: Hotfix 42.0.11") == "update"))
    checks.append(("classify.prime", classify("Styanax Prime Access Coming June 17") == "primeAccess"))
    checks.append(("classify.stream", classify("Prochainement : Devstream 196") == "stream"))
    checks.append(("classify.plain", classify("Pride 2026") == "news"))

    # RSS : XML bien formé (parsable), échappement, déterminisme (2 builds identiques)
    import xml.dom.minidom as _md
    rss_items = [
        {"message": "Update & <Test>", "link": "https://www.warframe.com/news/x",
         "date": "2026-06-17T00:00:00Z", "tag": "update"},
        {"message": 'Quote "Prime"', "link": "javascript:alert(1)",   # lien piégé -> doit retomber sur /hub
         "date": "2026-06-10T00:00:00Z", "tag": "primeAccess"},
    ]
    xml1 = build_rss(rss_items, "warframestat")
    xml2 = build_rss(rss_items, "warframestat")
    try:
        _md.parseString(xml1.encode("utf-8")); parsed_ok = True
    except Exception:
        parsed_ok = False
    checks.append(("rss.well_formed_xml", parsed_ok))
    checks.append(("rss.deterministic", xml1 == xml2))
    checks.append(("rss.escapes_amp_lt", "&amp;" in xml1 and "&lt;Test&gt;" in xml1))
    checks.append(("rss.blocks_bad_link", "javascript:" not in xml1 and "/hub" in xml1))
    checks.append(("rss.has_two_items", xml1.count("<item>") == 2))
    checks.append(("rfc822.format", rfc822(iso_to_dt("2026-06-17T00:00:00Z")) == "Wed, 17 Jun 2026 00:00:00 GMT"))

    for name, passed in checks:
        print(("  PASS " if passed else "  FAIL ") + name)
        ok = ok and passed
    print("[selftest] " + ("TOUT OK" if ok else "ÉCHEC"))
    return 0 if ok else 1


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        sys.exit(selftest())
    sys.exit(main())
