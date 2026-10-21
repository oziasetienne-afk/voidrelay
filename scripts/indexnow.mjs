#!/usr/bin/env node
/* Notifie les moteurs IndexNow (Bing, Yandex, Seznam, Naver…) des URLs du site.
 * Aucun compte requis : le fichier-clé <clé>.txt servi à la racine suffit (vérif auto).
 *
 * Usage :
 *   node scripts/indexnow.mjs                    tout le sitemap (filet hebdo, ~1 600 URLs)
 *   node scripts/indexnow.mjs --depuis <rév>     seulement les pages HTML modifiées entre <rév> et HEAD
 *   node scripts/indexnow.mjs ... --essai        affiche les URLs, n'envoie rien
 *   node scripts/indexnow.mjs --verifier         garde-fou hors ligne (branché dans les invariants)
 *
 * 21/10/2026 : avant, IndexNow ne partait que le lundi. Une page de build fusionnée un
 * mercredi attendait donc le lundi suivant pour être signalée à Bing, qui apporte 13 des
 * 51 visites humaines mesurées le 21/10 (contre 2 pour Google). Le mode --depuis est appelé
 * après chaque déploiement issu d'un push humain. On n'envoie que les pages modifiées :
 * IndexNow demande de ne pas renvoyer des URLs inchangées.
 * Le job restait aussi vert quand IndexNow refusait (403 = clé, 422 = URL hors domaine) :
 * une erreur HTTP fait maintenant échouer le script.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOST = "voidrelay.fr";
const ORIGINE = `https://${HOST}`;
const KEY = (process.env.INDEXNOW_KEY || fs.readFileSync(path.join(ROOT, ".indexnow_key"), "utf8")).trim();
// Format imposé par le protocole IndexNow : 8 à 128 caractères a-z A-Z 0-9 -.
if (!/^[A-Za-z0-9-]{8,128}$/.test(KEY)) {
  console.error("❌ IndexNow : clé absente ou mal formée (.indexnow_key)");
  process.exit(1);
}
// 09/07/2026 : sitemaps des anciens jeux retirés (osrs/poe/d2/jeux, supprimés du site).
const SITEMAPS = ["sitemap.xml"];

const args = process.argv.slice(2);
const ESSAI = args.includes("--essai");

function lirePlan() {
  const urls = new Set();
  for (const sm of SITEMAPS) {
    const p = path.join(ROOT, sm);
    if (!fs.existsSync(p)) continue;
    for (const m of fs.readFileSync(p, "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)) urls.add(m[1].trim());
  }
  return urls;
}

// Fichier du dépôt → URL publique, SEULEMENT si elle est dans le sitemap. Le sitemap fait
// foi : il exclut déjà les fiches /o/xxx en noindex, les pages internes et tout ce qui
// n'est pas publié. Règle vérifiée le 21/10 sur les 1 602 URLs : « chemin » ↔ chemin.html,
// « dossier/ » ↔ dossier/index.html.
function urlDuFichier(fichier, plan) {
  const f = fichier.replace(/\\/g, "/").replace(/^\.?\//, "");
  if (!f.endsWith(".html")) return null;
  const base = f.slice(0, -".html".length);
  const candidat = base === "index" ? `${ORIGINE}/`
    : base.endsWith("/index") ? `${ORIGINE}/${base.slice(0, -"index".length)}`
    : `${ORIGINE}/${base}`;
  return plan.has(candidat) ? candidat : null;
}

function fichiersModifies(rev) {
  // La révision vient du workflow (SHA de la run de déploiement) : on la restreint à un
  // SHA hexadécimal, éventuellement suivi de ^1 ou ~1, ou à HEAD~1. Rien d'autre
  // n'atteint git, et execFileSync ne passe par aucun shell.
  if (!/^([0-9a-f]{7,40}|HEAD)([~^]1)?$/.test(rev)) {
    console.error(`❌ IndexNow : révision refusée : ${JSON.stringify(rev)}`);
    process.exit(1);
  }
  const sortie = execFileSync("git", ["diff", "--name-only", "-z", "--diff-filter=AMR", rev, "HEAD"], { cwd: ROOT, encoding: "utf8" });
  return sortie.split("\0").filter(Boolean);
}

function verifier() {
  const plan = lirePlan();
  const erreurs = [];
  if (plan.size < 100) erreurs.push(`sitemap presque vide (${plan.size} URLs)`);
  // Pages qui DOIVENT être retrouvées : accueil, accueil EN, page de dossier, page simple, build.
  const attendus = {
    "index.html": `${ORIGINE}/`,
    "en/index.html": `${ORIGINE}/en/`,
    "guides/index.html": `${ORIGINE}/guides/`,
    "hub.html": `${ORIGINE}/hub`,
    "builds/mesa.html": `${ORIGINE}/builds/mesa`,
    "en/builds/excalibur.html": `${ORIGINE}/en/builds/excalibur`,
  };
  for (const [f, u] of Object.entries(attendus)) {
    const obtenu = urlDuFichier(f, plan);
    if (obtenu !== u) erreurs.push(`${f} → ${obtenu} (attendu ${u})`);
  }
  // Fichiers qui ne doivent JAMAIS partir : données, doc interne, page absente du sitemap.
  for (const f of ["data/market.json", "CLAUDE.md", "docs/PASSATION.md", "stats.html", "builds/mesa"]) {
    const obtenu = urlDuFichier(f, plan);
    if (obtenu) erreurs.push(`${f} ne devrait pas être soumis (→ ${obtenu})`);
  }
  // Sans le fichier-clé publié à la racine, IndexNow répond 403 à tout.
  const fCle = path.join(ROOT, `${KEY}.txt`);
  if (!fs.existsSync(fCle)) erreurs.push(`fichier-clé ${KEY}.txt absent de la racine`);
  else if (fs.readFileSync(fCle, "utf8").trim() !== KEY) erreurs.push(`${KEY}.txt ne contient pas la clé`);
  if (erreurs.length) {
    console.error("❌ IndexNow --verifier :\n  " + erreurs.join("\n  "));
    process.exit(1);
  }
  console.log(`✅ IndexNow --verifier : correspondance fichier → URL et fichier-clé OK (${plan.size} URLs au sitemap)`);
}

async function envoyer(list) {
  let ok = 0, fail = 0;
  for (let i = 0; i < list.length; i += 10000) {
    const batch = list.slice(i, i + 10000);
    const body = { host: HOST, key: KEY, keyLocation: `${ORIGINE}/${KEY}.txt`, urlList: batch };
    try {
      const r = await fetch("https://api.indexnow.org/indexnow", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      });
      console.log(`  lot ${i / 10000 + 1} (${batch.length} URLs) -> HTTP ${r.status}`);
      // 200 = accepté ; 202 = reçu, clé en cours de validation. Tout le reste est un refus.
      if (r.status === 200 || r.status === 202) ok += batch.length;
      else {
        fail += batch.length;
        console.error(`  réponse : ${(await r.text().catch(() => "")).slice(0, 300)}`);
      }
    } catch (e) { console.error("  échec lot :", e.message); fail += batch.length; }
  }
  console.log(`${fail ? "❌" : "✅"} IndexNow : ${ok} soumises, ${fail} en échec`);
  if (fail) process.exit(1);
}

if (args.includes("--verifier")) {
  verifier();
} else {
  const plan = lirePlan();
  const iDepuis = args.indexOf("--depuis");
  let list;
  if (iDepuis >= 0) {
    const rev = args[iDepuis + 1] || "";
    const modifies = fichiersModifies(rev);
    list = [...new Set(modifies.map((f) => urlDuFichier(f, plan)).filter(Boolean))];
    console.log(`IndexNow : ${modifies.length} fichier(s) modifié(s) depuis ${rev}, ${list.length} page(s) du sitemap à signaler`);
  } else {
    list = [...plan];
    console.log(`IndexNow : ${list.length} URLs à soumettre (clé ${KEY.slice(0, 6)}…)`);
  }
  if (ESSAI) {
    for (const u of list) console.log("  " + u);
    console.log("(essai : rien n'a été envoyé)");
  } else if (list.length === 0) {
    console.log("Aucune page publique modifiée : rien à signaler.");
  } else {
    await envoyer(list);
  }
}
