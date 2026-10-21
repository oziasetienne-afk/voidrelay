#!/usr/bin/env python3
# Marché & trading (21/10/2026) : les pages FR du marché affichent le nom du
# CATALOGUE (jamais un nom fabriqué depuis le slug), le rang du prix, et leurs
# variations se lisent sur la médiane — /hub, /marche, /bons-plans, /marche-profils.
#
# Hors ligne (bloquer_externe). Les deux fichiers de données sont ceux du dépôt,
# passés dans le VRAI pipeline (noms_catalogue + enrich_market_items) : ce qui est
# vérifié est le CÂBLAGE des pages, pas la fraîcheur des prix. Un mouvement connu
# est injecté sur Arcane Energize pour que /bons-plans ait quelque chose à classer.
import json
import os
import re
import sys

from playwright.sync_api import sync_playwright

from _outils import BASE, RACINE, ok, lancer, bloquer_externe, demarrer_serveur, bilan

sys.path.insert(0, os.path.join(RACINE, "scripts"))
from update_warframe_data import attacher_noms, enrich_market_items, noms_catalogue  # noqa: E402

DATA = os.path.join(RACINE, "data")


def fixture():
    with open(os.path.join(DATA, "market.json"), encoding="utf-8") as f:
        market = json.load(f)
    with open(os.path.join(DATA, "market_history.json"), encoding="utf-8") as f:
        hist = json.load(f)
    with open(os.path.join(DATA, "summary.json"), encoding="utf-8") as f:
        summary = json.load(f)
    attacher_noms(market, noms_catalogue(DATA))
    movers = enrich_market_items(market, hist)
    par = {it["slug"]: it for it in market["items"]}
    # mouvement connu, assez gros pour dominer le classement : +40 p (+44 %) sur
    # Arcane Energize, rang 5, médiane 130
    e = par["arcane_energize"]
    e.update({"change24h": 40, "change24hPct": 44, "trend": "up", "median": 130, "rang": 5})
    movers = [m for m in movers if m["slug"] != "arcane_energize"]
    movers.insert(0, {"slug": "arcane_energize", "nom": e["nom"], "nomFr": e["nomFr"], "change24h": 40,
                      "change24hPct": 44, "minSellPlat": e["minSellPlat"], "median": 130, "rang": 5})
    summary["market"] = {"platform": "pc", "items": market["items"]}
    summary["marketMovers"] = movers
    return market, summary


def servir(ctx, market, summary):
    def h(route):
        url = route.request.url
        if url.endswith("/data/market.json"):
            return route.fulfill(status=200, content_type="application/json", body=json.dumps(market))
        if url.endswith("/data/summary.json"):
            return route.fulfill(status=200, content_type="application/json", body=json.dumps(summary))
        return route.continue_() if "localhost" in url else route.abort()
    ctx.route("**/*", h)


def main():
    srv = demarrer_serveur()
    market, summary = fixture()
    ok("le pipeline pose un nom FR de catalogue sur Arcane Energize",
       summary["market"]["items"][[i["slug"] for i in market["items"]].index("arcane_energize")]["nomFr"] == "Arcane Énergétique")
    with sync_playwright() as p:
        b = lancer(p)
        ctx = b.new_context(viewport={"width": 1280, "height": 900})
        bloquer_externe(ctx)
        servir(ctx, market, summary)
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:160]))

        # ---- /hub : tableau du marché
        pg.goto(BASE + "/hub", wait_until="networkidle", timeout=30000)
        pg.wait_for_selector("#marketTable table", timeout=15000)
        txt = pg.text_content("#marketTable")
        ok("/hub : Arcane Energize s'appelle « Arcane Énergétique »", "Arcane Énergétique" in txt)
        ok("/hub : Primed Flow s'appelle « Flux Accru Prime »", "Flux Accru Prime" in txt)
        ok("/hub : aucun nom n'est le slug (« ash prime set »)", "ash prime set" not in txt and "arcane_energize" not in txt)
        titre = pg.get_attribute("#marketTable a[title='Arcane Energize']", "title")
        ok("/hub : le nom EN du catalogue reste en infobulle (lien warframe.market)", titre == "Arcane Energize")
        ligne = pg.evaluate("() => [...document.querySelectorAll('#marketTable tbody tr')].find(t => t.textContent.includes('Arcane Énergétique')).textContent")
        ok("/hub : le rang du prix est affiché (R5)", "R5" in ligne, ligne[:80])
        ok("/hub : la variation est annoncée sur la médiane", "Δ méd. 24h" in txt and "+40" in ligne)
        resume = pg.text_content("body")
        ok("/hub : la ligne « Farm de ducats » nomme l'objet par le catalogue",
           "Farm de ducats" in resume and "au prix médian" in resume)
        ok("/hub : le bandeau ne parle plus de mise à jour quotidienne", "quotidienne" not in resume)
        pg.fill("#mq", "énergétique")
        pg.wait_for_timeout(300)
        ok("/hub : le filtre trouve l'objet par son nom français",
           pg.evaluate("() => document.querySelectorAll('#marketTable tbody tr').length") == 1)

        # ---- /marche : colonne arcanes
        pg.goto(BASE + "/marche", wait_until="networkidle", timeout=30000)
        pg.click('.mk-pill[data-c="arcanes"]')
        pg.wait_for_selector(".mk-row .mk-name", timeout=15000)
        txt = pg.text_content("#mkGrid")
        ok("/marche : arcanes nommés en français (catalogue)", "Arcane Énergétique" in txt and "Arcane Energize" not in txt)
        ok("/marche : le rang du prix est affiché (R5)", "R5" in txt)
        href = pg.get_attribute(".mk-row .mk-name", "href")
        # un nom FR slugifié donnerait « arcane_nerg_tique » (accents perdus)
        ok("/marche : le lien warframe.market garde le slug (pas le nom FR slugifié)",
           href is not None and re.fullmatch(r"https://warframe\.market/items/[a-z0-9_]+", href) is not None
           and "_nerg_" not in href and "%" not in href, str(href))
        statut = pg.text_content("#mkStatus")
        ok("/marche : l'instantané annonce la vraie cadence (2 h)", "toutes les 2 h" in statut, statut)
        fav = pg.get_attribute(".mk-row .mk-star", "data-fav")
        ok("/marche : la clé des favoris reste le nom EN du catalogue", fav is not None and fav.startswith("Arcane ") and "É" not in fav, str(fav))
        pg.click('.mk-pill[data-c="mods"]')
        pg.wait_for_timeout(300)
        txt = pg.text_content("#mkGrid")
        ok("/marche : mods nommés en français (Flux Accru Prime, rang 10)", "Flux Accru Prime" in txt and "R10" in txt)

        # ---- /bons-plans : classements
        pg.goto(BASE + "/bons-plans", wait_until="networkidle", timeout=30000)
        pg.wait_for_selector("#up a.tile", timeout=15000)
        up = pg.text_content("#up")
        ok("/bons-plans : la hausse injectée est nommée par le catalogue, avec son rang",
           "Arcane Énergétique" in up and "rang 5" in up, up[:120])
        ok("/bons-plans : le prix montré est celui du pourcentage (médiane)", "130 PL méd." in up)
        duc = pg.text_content("#duc")
        ok("/bons-plans : le classement ducats/platine est rempli et nommé", "ducats/PL" in duc and "_" not in duc)
        ok("/bons-plans : aucun nom EN de mod/arcane sur la page FR",
           "Primed " not in (up + duc + (pg.text_content("#down") or "")))

        # ---- /marche-profils : ducatier à la médiane, noms FR
        pg.goto(BASE + "/marche-profils", wait_until="networkidle", timeout=30000)
        pg.click('.pf-card[data-id="ducatier"]')
        pg.wait_for_timeout(400)
        entetes = pg.eval_on_selector_all("#pfTbl thead th", "e=>e.map(x=>x.textContent.trim())")
        ok("/marche-profils : le ducatier affiche le prix médian", "Prix médian" in entetes, " · ".join(entetes))
        pg.click('.pf-card[data-id="farmeur"]')
        pg.wait_for_timeout(400)
        txt = pg.text_content("#pfTbl")
        ok("/marche-profils : les objets à rang portent leur nom français", "Arcane " in txt and "Arcane Energize" not in txt)

        ok("zéro erreur JS sur les quatre pages", not errs, str(errs[:2]))
        ctx.close()
        b.close()
    if srv:
        srv.terminate()
    return bilan("test_marche_noms")


if __name__ == "__main__":
    sys.exit(main())
