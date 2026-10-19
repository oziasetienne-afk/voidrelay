// VoidRelay — bibliothèque publique de builds (Cloudflare Pages + D1).
//
// POURQUOI D1 ET PAS KV. La question que pose la bibliothèque est toujours
// « les builds de CETTE arme, triés par votes ». KV ne sait pas trier : il
// faudrait maintenir à la main un index par arme, le relire en entier à chaque
// vote, et vivre avec sa cohérence différée — un vote pourrait ne pas
// apparaître tout de suite. D1 répond en une requête.
//
// PUBLICATION IMMÉDIATE, ET POURQUOI C'EST TENABLE (05/09/2026). La file de
// validation manuelle a été retirée à la demande du Chef : elle demandait sa
// présence, donc en pratique elle aurait tout gelé. Elle n'est PAS remplacée
// par rien — elle est remplacée par des barrières qui n'ont besoin de personne :
//
//   1. LE LIEN NE PEUT PAS SORTIR DU SITE. lienValide() n'accepte qu'un lien
//      d'Arsenal VoidRelay portant un build. Le vecteur le plus dangereux
//      — l'URL de phishing ou de spam — est fermé par construction, pas filtré.
//   2. LE TEXTE NE PEUT PAS FAIRE DE PUBLICITÉ. sansPub() retire toute adresse
//      de site du titre, de l'auteur et des notes. Publier ici ne peut donc
//      envoyer personne ailleurs : le spam perd son seul intérêt.
//   3. LES CHEVRONS ET LES CARACTÈRES DE CONTRÔLE SONT RETIRÉS, et l'affichage
//      échappe tout. Aucune injection possible dans la page.
//   4. UNE COURTE LISTE DE MOTS refuse les insultes les plus évidentes. Elle
//      est DÉLIBÉRÉMENT courte et se contourne : c'est un filet, pas un mur.
//   5. CE QUI PASSE QUAND MÊME EST RETIRÉ PAR LES LECTEURS. Deux signalements
//      d'empreintes différentes suffisent à masquer un build, automatiquement.
//      C'est le remplacement réel de la relecture : le site se nettoie seul.
//
// Le Chef garde les routes d'administration : il peut toujours republier un
// build masqué à tort, ou en retirer un que personne n'a signalé.
//
//   GET  /api/builds?arme=<uniqueName>&tri=votes|date   → builds APPROUVÉS
//   POST /api/builds            {arme,titre,auteur,notes,lien} → PUBLIÉ aussitôt
//   POST /api/builds?a=signaler {id}                    → masque à 2 signalements
//   POST /api/builds?a=vote     {id}                    → +1 vote (1 par IP)
//   GET  /api/builds?statut=attente          (admin)    → la file
//   POST /api/builds?a=moderer  {id,ok:true|false}      (admin)
//
// L'admin s'authentifie par l'en-tête X-VR-Admin, comparé à la variable
// d'environnement VR_ADMIN_TOKEN du projet Cloudflare Pages. Sans cette
// variable, les routes admin répondent 503 : pas de secret, pas d'admin.
//
// MISE EN PLACE (une seule fois, dans le tableau de bord Cloudflare) :
//   1. D1 → Create database → nom : voidrelay
//   2. (facultatif) Console SQL → coller functions/api/builds.schema.sql.
//      Les tables se posent SEULES au premier appel qui les trouve absentes
//      (cf. SCHEMA / avecSchema plus bas) : ce collage n'est qu'un raccourci.
//   3. Pages → warframe-hub → Settings → Functions → D1 bindings :
//        variable BUILDS  →  base voidrelay
//   4. Settings → Environment variables → VR_ADMIN_TOKEN = <un secret long>
//      et VR_SEL_IP = <un autre secret> (sel des empreintes d'IP)
// Tant que l'étape 3 n'est pas faite, l'API répond 503 avec un message clair
// et l'interface le dit à l'utilisateur au lieu de casser.

const MAX = { titre: 80, auteur: 40, notes: 600, lien: 4000, arme: 200 };
const PAGE = 30;
const DEBIT_PAR_HEURE = 5;
/* Deux suffisent : le site est jeune et peu fréquenté ; exiger cinq lecteurs
   reviendrait à ne jamais masquer. Un masquage à tort est réversible d'un clic
   côté admin ; une insulte laissée en ligne, non. */
const SEUIL_SIGNALEMENTS = 2;
const CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function json(obj, status = 200, maxAge = 0) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": maxAge ? `public, max-age=${maxAge}` : "no-store",
    },
  });
}

/* Nettoyage d'un champ texte venu du public. Trois règles, toutes délibérées :
   caractères de contrôle retirés (ils cassent l'affichage et les journaux),
   chevrons retirés (aucun titre de build n'en a besoin, et ça retire une
   classe entière de mauvaises surprises côté rendu), longueur bornée.
   L'échappement à l'affichage reste OBLIGATOIRE côté client : ceci est une
   ceinture, pas des bretelles. */
export function nettoie(v, max) {
  if (typeof v !== "string") return "";
  return v.replace(CTRL, "").replace(/[<>]/g, "").slice(0, max).trim();
}

/* Un lien de build doit être un lien d'Arsenal VoidRelay portant un build
   (#z= compressé ou #b= base64). On refuse tout le reste : la bibliothèque
   n'est pas un raccourcisseur d'URL, et un lien libre serait le vecteur le
   plus commode pour du spam. */
/* Retire du texte libre tout ce qui ressemble à une adresse de site.

   Ce n'est pas de la pudeur : c'est ce qui rend la publication automatique
   tenable. Le spam n'existe que pour ENVOYER AILLEURS. Un titre qui ne peut
   pas contenir « monsite.fr » ni « discord.gg/xxx » n'a plus aucune valeur
   pour un spammeur, et il n'y a plus rien à modérer.

   On retire plutôt qu'on refuse : un joueur qui écrit « vu sur warframe.market »
   dans ses notes n'est pas un spammeur, et lui rejeter son envoi serait
   incompréhensible. Sa phrase perd deux mots, son build passe. */
export function sansPub(v) {
  return String(v || "")
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, " ")
    .replace(/\b[a-z0-9][a-z0-9-]{1,30}\.(?:com|net|org|fr|io|gg|me|tv|co|dev|xyz|shop|link|ru|info|biz|to|cc|ly)\b\S*/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/* Filet à insultes, DÉLIBÉRÉMENT COURT. Une liste exhaustive n'existe pas, se
   contourne avec un caractère changé, et donnerait une fausse impression de
   sécurité. Celle-ci n'attrape que les cas les plus grossiers ; le vrai
   nettoyage vient des signalements des lecteurs. Elle est écrite ici plutôt
   que dans un fichier à part pour qu'on la voie en lisant la validation. */
const INSULTES = /\b(?:nique|encul|salope|pute|batard|bâtard|conn(?:ard|asse)|nigg|f[a4]gg|retard[eé]|pedophil|pédophil)/i;

export function lienValide(lien) {
  if (typeof lien !== "string" || lien.length > MAX.lien) return false;
  let u;
  try { u = new URL(lien); } catch (e) { return false; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  if (!/(^|\.)voidrelay\.fr$|(^|\.)pages\.dev$|^localhost$|^127\.0\.0\.1$/.test(u.hostname)) return false;
  const chemin = u.pathname.replace(/\/$/, "") || "/arsenal";
  if (!/\/(en\/)?arsenal(\.html)?$/.test(chemin)) return false;
  return /#(z|b)=/.test(u.hash);
}

export function valide(corps) {
  const arme = nettoie(corps && corps.arme, MAX.arme);
  /* sansPub AVANT la coupe de longueur : sinon une adresse tronquée survivrait
     en fragment, et « monsite.f » ne se retire plus. */
  const titre = nettoie(sansPub(corps && corps.titre), MAX.titre);
  const auteur = nettoie(sansPub(corps && corps.auteur), MAX.auteur);
  const notes = nettoie(sansPub(corps && corps.notes), MAX.notes);
  const lien = typeof (corps && corps.lien) === "string" ? corps.lien.trim() : "";
  if (!arme) return { ok: false, error: "arme manquante" };
  if (titre.length < 3) return { ok: false, error: "titre trop court (3 caractères minimum)" };
  if (!lienValide(lien)) return { ok: false, error: "le lien doit être un lien d'Arsenal VoidRelay contenant un build (#z= ou #b=)" };
  if (INSULTES.test(titre + " " + auteur + " " + notes)) return { ok: false, error: "texte refusé" };
  return { ok: true, valeur: { arme, titre, auteur, notes, lien } };
}

// Empreinte d'IP salée : on ne stocke JAMAIS l'adresse, seulement de quoi
// reconnaître un même visiteur pour le débit et le dédoublonnage des votes.
async function empreinte(ip, sel) {
  const data = new TextEncoder().encode(String(sel || "vr") + "|" + String(ip || ""));
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ---------------------------------------------------------------------------
   LE SCHÉMA SE POSE TOUT SEUL.

   Pourquoi. Chaque table ajoutée ici demandait au Chef d'aller coller du SQL
   dans la console Cloudflare — et tant qu'il ne l'avait pas fait, la
   fonctionnalité répondait 500 avec un message de moteur SQL, sans que rien
   ne le signale. Le 05/09/2026, « signalements » est arrivée exactement comme
   ça : le bouton de signalement d'un build est la CINQUIÈME barrière de la
   publication automatique, celle qui remplace la relecture humaine. Une table
   manquante et le site ne se nettoie plus, en silence.

   Comment. On ne pose PAS le schéma à chaque requête (ce serait une dizaine
   d'ordres SQL inutiles à chaque appel) : on ne le pose que lorsque D1 dit
   lui-même « no such table ». Le chemin normal ne coûte donc rien, et le
   premier appel après un ajout de table se répare en une fois.

   Ces ordres sont ceux de builds.schema.sql, à l'identique : le fichier reste
   la version lisible (avec ses commentaires et ses requêtes d'entretien), et
   verifier_api_builds.mjs interdit aux deux de diverger. */
export const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS builds (id INTEGER PRIMARY KEY AUTOINCREMENT, arme TEXT NOT NULL, titre TEXT NOT NULL, auteur TEXT, notes TEXT, lien TEXT NOT NULL, emp TEXT NOT NULL, statut TEXT NOT NULL DEFAULT 'attente', votes INTEGER NOT NULL DEFAULT 0, cree TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS idx_builds_arme ON builds (statut, arme, votes DESC)",
  "CREATE INDEX IF NOT EXISTS idx_builds_date ON builds (statut, cree DESC)",
  "CREATE INDEX IF NOT EXISTS idx_builds_emp ON builds (emp, cree)",
  "CREATE TABLE IF NOT EXISTS votes (build_id INTEGER NOT NULL, emp TEXT NOT NULL, PRIMARY KEY (build_id, emp))",
  "CREATE TABLE IF NOT EXISTS signalements (build_id INTEGER NOT NULL, emp TEXT NOT NULL, PRIMARY KEY (build_id, emp))",
  "CREATE TABLE IF NOT EXISTS sync (id TEXT PRIMARY KEY, paquet TEXT NOT NULL, maj TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS sync_debit (emp TEXT NOT NULL, quand TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS idx_sync_debit ON sync_debit (emp, quand)",
];

export function tableManquante(e) {
  return /no such table|no such index/i.test(String((e && e.message) || e || ""));
}

export async function assurerSchema(base) {
  for (const ordre of SCHEMA) await base.prepare(ordre).run();
}

/* Exécute `travail`. Si D1 se plaint d'une table absente, pose le schéma et
   REESSAIE UNE FOIS. Une seule reprise : si la deuxième échoue aussi, c'est
   autre chose qu'un schéma en retard, et il faut que l'erreur remonte. */
export async function avecSchema(base, travail) {
  try {
    return await travail();
  } catch (e) {
    if (!tableManquante(e)) throw e;
    await assurerSchema(base);
    return await travail();
  }
}

function db(env) { return env && env.BUILDS ? env.BUILDS : null; }
function estAdmin(request, env) {
  const attendu = env && env.VR_ADMIN_TOKEN;
  if (!attendu) return null;                       // pas de secret configuré
  return request.headers.get("X-VR-Admin") === attendu;
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const base = db(env);
  if (!base) {
    return json({
      ok: false,
      error: "bibliothèque non configurée",
      detail: "La liaison D1 « BUILDS » n'existe pas encore sur ce projet Cloudflare Pages. Marche à suivre en tête de functions/api/builds.js.",
    }, 503);
  }
  const ip = request.headers.get("CF-Connecting-IP") || "";
  const emp = await empreinte(ip, env.VR_SEL_IP);
  /* Le corps est lu ICI, une seule fois : un flux de requête ne se relit pas,
     et avecSchema() peut rejouer le traitement après avoir posé le schéma. */
  const corps = request.method === "POST" ? await request.json().catch(() => null) : null;

  try {
    return await avecSchema(base, () => traiter({ request, env, url, base, emp, corps }));
  } catch (e) {
    return json({ ok: false, error: String(e && e.message ? e.message : e) }, 500);
  }
}

async function traiter({ request, env, url, base, emp, corps }) {
  if (request.method === "GET") {
    if (url.searchParams.get("statut") === "attente") {
      const admin = estAdmin(request, env);
      if (admin === null) return json({ ok: false, error: "VR_ADMIN_TOKEN non configuré" }, 503);
      if (!admin) return json({ ok: false, error: "réservé à la modération" }, 401);
      const r = await base.prepare(
        "SELECT id, arme, titre, auteur, notes, lien, cree FROM builds WHERE statut='attente' ORDER BY cree ASC LIMIT 100"
      ).all();
      return json({ ok: true, builds: r.results || [] });
    }
    const arme = nettoie(url.searchParams.get("arme"), MAX.arme);
    const tri = url.searchParams.get("tri") === "date" ? "cree DESC" : "votes DESC, cree DESC";
    const r = arme
      ? await base.prepare(
          "SELECT id, arme, titre, auteur, notes, lien, votes, cree FROM builds WHERE statut='ok' AND arme=? ORDER BY " + tri + " LIMIT " + PAGE
        ).bind(arme).all()
      : await base.prepare(
          "SELECT id, arme, titre, auteur, notes, lien, votes, cree FROM builds WHERE statut='ok' ORDER BY " + tri + " LIMIT " + PAGE
        ).all();
    return json({ ok: true, builds: r.results || [] }, 200, 30);
  }

  if (request.method !== "POST") return json({ ok: false, error: "méthode non supportée" }, 405);
  const action = url.searchParams.get("a") || "publier";

  if (action === "vote") {
    const id = Number(corps && corps.id);
    if (!Number.isInteger(id) || id <= 0) return json({ ok: false, error: "id invalide" }, 400);
    // Un vote par empreinte et par build : c'est la contrainte d'unicité qui
    // fait foi, pas une lecture préalable (deux requêtes simultanées
    // passeraient toutes les deux).
    const ins = await base.prepare("INSERT OR IGNORE INTO votes (build_id, emp) VALUES (?, ?)").bind(id, emp).run();
    const nouveau = !!(ins && ins.meta && ins.meta.changes > 0);
    if (nouveau) await base.prepare("UPDATE builds SET votes = votes + 1 WHERE id=? AND statut='ok'").bind(id).run();
    const r = await base.prepare("SELECT votes FROM builds WHERE id=?").bind(id).first();
    return json({ ok: true, deja: !nouveau, votes: (r && r.votes) || 0 });
  }

  if (action === "signaler") {
    const id = Number(corps && corps.id);
    if (!Number.isInteger(id) || id <= 0) return json({ ok: false, error: "id invalide" }, 400);
    /* Même mécanique que le vote : c'est la contrainte d'unicité qui compte
       un signalement par empreinte, pas une lecture préalable. Sans elle,
       une seule personne masquerait n'importe quoi en cliquant deux fois. */
    await base.prepare("INSERT OR IGNORE INTO signalements (build_id, emp) VALUES (?, ?)").bind(id, emp).run();
    const r = await base.prepare("SELECT COUNT(*) AS n FROM signalements WHERE build_id=?").bind(id).first();
    const n = (r && r.n) || 0;
    /* Au seuil, le build repasse en 'attente' : il disparaît de la
       bibliothèque publique et atterrit dans la file d'administration, où le
       Chef peut le republier s'il a été masqué à tort. On ne SUPPRIME jamais
       sur signalement — un clic de foule ne doit pas détruire le travail de
       quelqu'un. */
    if (n >= SEUIL_SIGNALEMENTS) {
      await base.prepare("UPDATE builds SET statut='attente' WHERE id=? AND statut='ok'").bind(id).run();
    }
    return json({ ok: true, signalements: n, masque: n >= SEUIL_SIGNALEMENTS });
  }

  if (action === "moderer") {
    const admin = estAdmin(request, env);
    if (admin === null) return json({ ok: false, error: "VR_ADMIN_TOKEN non configuré" }, 503);
    if (!admin) return json({ ok: false, error: "réservé à la modération" }, 401);
    const id = Number(corps && corps.id);
    if (!Number.isInteger(id) || id <= 0) return json({ ok: false, error: "id invalide" }, 400);
    const statut = corps && corps.ok ? "ok" : "refuse";
    await base.prepare("UPDATE builds SET statut=? WHERE id=?").bind(statut, id).run();
    return json({ ok: true, id, statut });
  }

  const v = valide(corps);
  if (!v.ok) return json({ ok: false, error: v.error }, 400);
  const recents = await base.prepare(
    "SELECT COUNT(*) AS n FROM builds WHERE emp=? AND cree > datetime('now','-1 hour')"
  ).bind(emp).first();
  if (recents && recents.n >= DEBIT_PAR_HEURE) {
    return json({ ok: false, error: "limite atteinte : " + DEBIT_PAR_HEURE + " publications par heure" }, 429);
  }
  /* statut 'ok' d'emblée : la publication est immédiate (cf. en-tête). Ce qui
     tient la barrière est en AMONT — lien impossible à sortir du site, texte
     sans adresse, insultes grossières refusées — et en AVAL, par les
     signalements. Pas dans une file que personne n'ouvrirait. */
  const ins = await base.prepare(
    "INSERT INTO builds (arme, titre, auteur, notes, lien, emp, statut, votes, cree) VALUES (?,?,?,?,?,?,'ok',0,datetime('now'))"
  ).bind(v.valeur.arme, v.valeur.titre, v.valeur.auteur, v.valeur.notes, v.valeur.lien, emp).run();
  return json({
    ok: true,
    id: ins && ins.meta ? ins.meta.last_row_id : null,
    statut: "ok",
    message: "Build publié. Il est visible tout de suite dans la bibliothèque.",
  }, 201);
}
