// VoidRelay — synchronisation par code (Cloudflare Pages + D1).
//
// CE QUE LE SERVEUR SAIT, ET CE QU'IL NE SAIT PAS. Il reçoit un identifiant
// (empreinte du code) et un paquet CHIFFRÉ par le navigateur. Il ne connaît
// ni le code, ni la clef, ni le contenu : il range et il rend. Une base qui
// fuite ne révèle donc rien d'exploitable, et il n'y a aucun dépannage
// possible — code perdu, données perdues. C'est assumé et dit à l'utilisateur
// avant qu'il n'agisse.
//
//   GET  /api/sync?id=<empreinte>              → { ok, paquet, maj }
//   POST /api/sync   {id, paquet}              → enregistre (crée ou remplace)
//
// Pas de suppression exposée : sans compte, une route de suppression serait
// une arme à disposition de qui devine un identifiant. Les lignes inactives
// sont purgées par une requête planifiée (voir builds.schema.sql).
//
// MISE EN PLACE : même base D1 que la bibliothèque (liaison BUILDS). Les
// tables sync / sync_debit se posent TOUTES SEULES au premier appel qui les
// trouve absentes (cf. avecSchema dans builds.js) : rien à coller à la main.

import { avecSchema } from "./builds.js";

const MAX_PAQUET = 256 * 1024;     // 256 Ko chiffré : très large pour du JSON
const DEBIT_PAR_HEURE = 60;        // un envoi toutes les minutes suffit


function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

// L'identifiant est une empreinte hexadécimale produite par le client : on
// n'accepte QUE cette forme, ce qui ferme d'un coup toute injection par ce
// paramètre (il part ensuite dans une requête préparée, mais deux barrières
// valent mieux qu'une).
export function idValide(id) {
  return typeof id === "string" && /^[0-9a-f]{32}$/.test(id);
}
// Le paquet est « <base64>.<base64> » (vecteur d'initialisation, puis contenu).
export function paquetValide(p) {
  return typeof p === "string" && p.length <= MAX_PAQUET && /^[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/.test(p);
}

async function empreinte(ip, sel) {
  const data = new TextEncoder().encode(String(sel || "vr") + "|" + String(ip || ""));
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function onRequest(context) {
  const { request, env } = context;
  const base = env && env.BUILDS ? env.BUILDS : null;
  if (!base) {
    return json({
      ok: false,
      error: "synchronisation non configurée",
      detail: "La liaison D1 « BUILDS » n'existe pas encore sur ce projet Cloudflare Pages. Marche à suivre en tête de functions/api/builds.js.",
    }, 503);
  }
  const url = new URL(request.url);
  /* Le corps est lu ICI, une seule fois : un flux de requête ne se relit pas,
     et avecSchema() peut rejouer le traitement après avoir posé le schéma. */
  const corps = request.method === "POST" ? await request.json().catch(() => null) : null;

  try {
    return await avecSchema(base, () => traiter({ request, env, url, base, corps }));
  } catch (e) {
    return json({ ok: false, error: String((e && e.message) || e) }, 500);
  }
}

async function traiter({ request, env, url, base, corps }) {
  if (request.method === "GET") {
    const id = url.searchParams.get("id") || "";
    if (!idValide(id)) return json({ ok: false, error: "identifiant invalide" }, 400);
    const r = await base.prepare("SELECT paquet, maj FROM sync WHERE id=?").bind(id).first();
    if (!r) return json({ ok: false, error: "aucune sauvegarde pour ce code" }, 404);
    return json({ ok: true, paquet: r.paquet, maj: r.maj });
  }

  if (request.method !== "POST") return json({ ok: false, error: "méthode non supportée" }, 405);
  const id = corps && corps.id;
  const paquet = corps && corps.paquet;
  if (!idValide(id)) return json({ ok: false, error: "identifiant invalide" }, 400);
  if (!paquetValide(paquet)) return json({ ok: false, error: "paquet invalide ou trop gros" }, 400);

  const emp = await empreinte(request.headers.get("CF-Connecting-IP") || "", env.VR_SEL_IP);
  const recents = await base.prepare(
    "SELECT COUNT(*) AS n FROM sync_debit WHERE emp=? AND quand > datetime('now','-1 hour')"
  ).bind(emp).first();
  if (recents && recents.n >= DEBIT_PAR_HEURE) {
    return json({ ok: false, error: "trop d'envois — réessaie dans un moment" }, 429);
  }
  await base.prepare("INSERT INTO sync_debit (emp, quand) VALUES (?, datetime('now'))").bind(emp).run();
  await base.prepare(
    "INSERT INTO sync (id, paquet, maj) VALUES (?,?,datetime('now')) ON CONFLICT(id) DO UPDATE SET paquet=excluded.paquet, maj=excluded.maj"
  ).bind(id, paquet).run();
  return json({ ok: true, maj: new Date().toISOString() });
}
