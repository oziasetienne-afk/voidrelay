// VoidRelay — mesure de l'engagement (Cloudflare Pages + D1), 26/09/2026.
//
// LA QUESTION. Cloudflare Web Analytics compte déjà les pages vues (balise sur
// 5 692 pages). Ce qu'aucun outil ne disait : que FONT les visiteurs une fois
// sur la page ? Partent-ils vendre sur warframe.market (la vraie conversion
// d'un site de trading) ? Se servent-ils de la recherche, des favoris, du
// partage ? Sans ce chiffre, aucune des pistes suivantes ne peut être classée.
//
// CE QUI EST STOCKÉ, ET SURTOUT CE QUI NE L'EST PAS. Une ligne par
// (jour, événement, détail, page) avec un COMPTEUR. Pas d'IP, pas d'empreinte,
// pas de cookie, pas d'identifiant de visiteur, pas d'horodatage fin : il est
// impossible de reconstituer le parcours d'une personne, par construction.
// C'est aussi ce qui garde la base petite : quelques milliers de lignes par
// mois au plus, quel que soit le trafic.
//
// POURQUOI LA MÊME BASE QUE LES BUILDS. La liaison D1 « BUILDS » existe déjà
// en production (vérifié le 26/09 : /api/builds répond). Une deuxième base
// demanderait un passage dans le tableau de bord Cloudflare ; une table de
// plus n'en demande aucun — elle est posée au premier appel, comme builds.
//
//   POST /api/evt  {e, d, p}           → +1 sur le compteur (204, rien à lire)
//   GET  /api/evt?jours=30   (admin)   → totaux + pages en tête
//
// L'admin s'authentifie par l'en-tête X-VR-Admin = VR_ADMIN_TOKEN, exactement
// comme la modération des builds. La page /stats le fait pour le Chef.

import { tableManquante } from "./builds.js";

/* Liste FERMÉE : un événement inconnu est refusé, jamais créé. Sans ça, n'importe
   qui pourrait remplir la table de noms inventés. Chaque nom répond à une question :
     sortie   — clic vers un autre site (d = le domaine) : la conversion
     recherche — un résultat de la recherche a été ouvert
     favori   — ajout/retrait d'un favori sur une page objet
     comparer — ajout au comparateur
     copie    — « copier le nom » d'un objet (préparer un message de trade)
     partage  — un bouton de partage (d = le réseau)
     langue   — bascule FR ↔ EN */
export const EVENEMENTS = ["sortie", "recherche", "favori", "comparer", "copie", "partage", "langue"];

export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS evt (
    jour TEXT NOT NULL,
    e    TEXT NOT NULL,
    d    TEXT NOT NULL DEFAULT '',
    p    TEXT NOT NULL DEFAULT '',
    n    INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (jour, e, d, p)
  )`,
];

const MAX_CORPS = 512;          // un événement tient en ~80 octets
const MAX_JOURS = 90;

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/* Ce qui a le droit d'entrer. Tout est RAMENÉ à une forme bornée plutôt que
   rejeté au moindre écart : un chemin trop long est coupé, un détail exotique
   devient « autre ». Seul un événement hors liste, ou un chemin qui n'en est
   pas un, fait refuser la requête. */
export function lireEvenement(corps) {
  if (!corps || typeof corps !== "object") return null;
  const e = String(corps.e || "");
  if (!EVENEMENTS.includes(e)) return null;
  let p = String(corps.p || "");
  if (!p.startsWith("/") || p.startsWith("//")) return null;
  p = p.split(/[?#]/)[0].slice(0, 120).replace(/[^\w\-/.%()]/g, "");
  let d = String(corps.d || "").toLowerCase().slice(0, 40);
  if (!/^[a-z0-9._-]*$/.test(d)) d = "autre";
  return { e, d, p };
}

/* Même origine seulement. Un POST de navigateur porte Origin (ou, à défaut,
   Sec-Fetch-Site) : un autre site ne peut donc pas gonfler les compteurs depuis
   ses pages. Un script hors navigateur le peut — c'est une mesure d'usage, pas
   une comptabilité, et l'effet se limiterait à des chiffres faux sur un tableau
   privé. Accepté en connaissance de cause. */
export function origineAutorisee(request) {
  const origine = request.headers.get("Origin");
  if (origine && origine !== "null") {
    try { return new URL(origine).host === new URL(request.url).host; } catch (e) { return false; }
  }
  return request.headers.get("Sec-Fetch-Site") === "same-origin";
}

function estAdmin(request, env) {
  const attendu = env && env.VR_ADMIN_TOKEN;
  if (!attendu) return null;
  return request.headers.get("X-VR-Admin") === attendu;
}

async function avecTable(base, travail) {
  try {
    return await travail();
  } catch (e) {
    if (!tableManquante(e)) throw e;
    for (const ordre of SCHEMA) await base.prepare(ordre).run();
    return await travail();
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  const base = env && env.BUILDS;
  if (!base) return json({ ok: false, error: "liaison D1 « BUILDS » absente" }, 503);
  const url = new URL(request.url);

  if (request.method === "POST") {
    if (!origineAutorisee(request)) return json({ ok: false, error: "origine refusée" }, 403);
    const brut = await request.text().catch(() => "");
    if (brut.length > MAX_CORPS) return json({ ok: false, error: "trop long" }, 413);
    let corps = null;
    try { corps = JSON.parse(brut); } catch (e) { /* corps illisible → refusé plus bas */ }
    const ev = lireEvenement(corps);
    if (!ev) return json({ ok: false, error: "événement refusé" }, 400);
    const jour = new Date().toISOString().slice(0, 10);
    await avecTable(base, () => base.prepare(
      "INSERT INTO evt (jour, e, d, p, n) VALUES (?, ?, ?, ?, 1) " +
      "ON CONFLICT (jour, e, d, p) DO UPDATE SET n = n + 1"
    ).bind(jour, ev.e, ev.d, ev.p).run());
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  }

  if (request.method === "GET") {
    const admin = estAdmin(request, env);
    if (admin === null) return json({ ok: false, error: "VR_ADMIN_TOKEN non configuré" }, 503);
    if (!admin) return json({ ok: false, error: "réservé au Chef" }, 401);
    const jours = Math.min(MAX_JOURS, Math.max(1, parseInt(url.searchParams.get("jours"), 10) || 30));
    const depuis = new Date(Date.now() - (jours - 1) * 86400000).toISOString().slice(0, 10);
    const r = await avecTable(base, async () => ({
      parJour: (await base.prepare(
        "SELECT jour, e, SUM(n) AS n FROM evt WHERE jour >= ? GROUP BY jour, e ORDER BY jour"
      ).bind(depuis).all()).results || [],
      parDetail: (await base.prepare(
        "SELECT e, d, SUM(n) AS n FROM evt WHERE jour >= ? GROUP BY e, d ORDER BY n DESC LIMIT 60"
      ).bind(depuis).all()).results || [],
      pages: (await base.prepare(
        "SELECT e, p, SUM(n) AS n FROM evt WHERE jour >= ? GROUP BY e, p ORDER BY n DESC LIMIT 40"
      ).bind(depuis).all()).results || [],
    }));
    return json({ ok: true, jours, depuis, ...r });
  }

  return json({ ok: false, error: "méthode non supportée" }, 405);
}
