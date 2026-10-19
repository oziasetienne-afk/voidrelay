#!/usr/bin/env python3
# Bibliothèque de builds par URL : /arsenal#biblio ouvre la bibliothèque en mode
# GLOBAL (tous les objets confondus), tandis que le bouton de la page reste
# filtré sur l'objet équipé. En mode global chaque ligne doit afficher le NOM
# de l'objet, jamais son uniqueName interne.
# Les titres du jeu d'essai ne contiennent volontairement AUCUN nom d'objet :
# sinon l'assertion sur le nom passerait par accident sur le titre.
import json
import sys

from playwright.sync_api import sync_playwright

from _outils import BASE, ok, lancer, bloquer_externe, demarrer_serveur, bilan

# Deux builds sur DEUX objets différents : c'est ce que le mode global montre.
TOUS = {"ok": True, "builds": [
    {"id": 1, "arme": "/Lotus/Powersuits/Rhino/Rhino", "titre": "Tank increvable",
     "auteur": "A", "notes": "", "votes": 3, "lien": "https://voidrelay.fr/arsenal#z=AA"},
    {"id": 2, "arme": "/Lotus/Weapons/Tenno/LongGuns/PrimeBoltor/PrimeBoltor",
     "titre": "Crit maximal", "auteur": "B", "notes": "", "votes": 1,
     "lien": "https://voidrelay.fr/arsenal#z=BB"}]}


def main():
    srv = demarrer_serveur()
    with sync_playwright() as p:
        b = lancer(p)
        ctx = b.new_context(viewport={"width": 1100, "height": 950})
        bloquer_externe(ctx)
        appels = []

        def route(r):
            appels.append(r.request.url)
            r.fulfill(status=200, content_type="application/json",
                      body=json.dumps(TOUS))

        ctx.route("**/api/builds*", route)
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:160]))

        pg.goto(BASE + "/arsenal#biblio", wait_until="networkidle", timeout=60000)
        pg.wait_for_selector(".ars-biblio li", timeout=30000)

        ok("#biblio ouvre la bibliothèque tout seul",
           pg.evaluate("()=>!document.getElementById('ars-picker').hidden"))
        ok("en mode global, l'API est appelée SANS filtre d'arme",
           any("/api/builds" in u and "arme=" not in u for u in appels),
           " · ".join(appels)[:110])
        ok("le titre dit que ce sont tous les objets",
           "tous les objets" in (pg.text_content(".ars-pk-top") or "").lower(),
           (pg.text_content(".ars-pk-top") or "")[:70])
        ok("les deux builds sont listés",
           pg.evaluate("()=>document.querySelectorAll('.ars-biblio li').length") == 2)
        txt = pg.text_content(".ars-biblio") or ""
        # Ni « Rhino » ni « Boltor Prime » n'apparaissent dans les titres :
        # les trouver ici prouve que nomDeUn() a bien résolu l'uniqueName.
        ok("le nom de la warframe est affiché, pas son uniqueName",
           "Rhino" in txt and "Powersuits" not in txt,
           txt.replace("\n", " ")[:120])
        ok("le nom de l'arme est affiché, pas son uniqueName",
           "Boltor Prime" in txt and "PrimeBoltor" not in txt,
           txt.replace("\n", " ")[:120])

        # sans objet équipé, le bloc « publier » ne doit pas être un cul-de-sac :
        # il demande de choisir un objet ET donne le bouton qui ferme la fenêtre.
        ok("le bloc publier propose de choisir un objet",
           pg.evaluate("()=>!!document.getElementById('ars-biblio-choisir')"))
        pg.click("#ars-biblio-choisir")
        pg.wait_for_timeout(300)
        ok("le bouton « Choisir un objet » ferme bien la fenêtre",
           pg.evaluate("()=>document.getElementById('ars-picker').hidden"))

        # bibliothèque VIDE en mode global : le message ne doit pas parler d'arme
        ctx.unroute("**/api/builds*")
        vides = []
        ctx.route("**/api/builds*", lambda r: (vides.append(r.request.url), r.fulfill(
            status=200, content_type="application/json",
            body=json.dumps({"ok": True, "builds": []})))[-1])
        # ?v=2 est INDISPENSABLE : re-naviguer vers la même URL à ancre est une
        # navigation « même document » — la page ne se rechargerait pas et on
        # relirait la fenêtre précédente (mesuré : le test passait au vert à tort).
        pg.goto(BASE + "/arsenal?v=2#biblio", wait_until="networkidle", timeout=60000)
        pg.wait_for_selector(".ars-pk-box", timeout=30000)
        pg.wait_for_timeout(2500)
        vide = (pg.text_content(".ars-pk-box") or "").lower()
        ok("bibliothèque vide en mode global : pas de « cette arme »",
           "aucun build" in vide and "cette arme" not in vide,
           vide.replace("\n", " ")[:110])

        # le bouton d'une arme ne doit PAS ouvrir la vue globale
        pg.goto(BASE + "/arsenal", wait_until="networkidle", timeout=60000)
        pg.wait_for_timeout(1500)
        appels.clear()
        pg.click("#ars-biblio-btn")
        pg.wait_for_timeout(900)
        ok("le bouton de la page reste filtré sur l'objet équipé (piège de l'événement)",
           "tous les objets" not in (pg.text_content(".ars-pk-top") or "").lower(),
           (pg.text_content(".ars-pk-top") or "")[:70])
        ok("zéro erreur JS", not errs, str(errs))
    return bilan("bibliothèque par URL")


if __name__ == "__main__":
    sys.exit(main())
