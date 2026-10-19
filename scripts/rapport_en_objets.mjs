#!/usr/bin/env node
/* ============================================================================
 * Rapport hebdo de suivi du lot EN restreint (/en/o/, 250 objets + /en/guides/).
 *
 * Objectif : décider si le lot mérite d'être étendu aux 3834 objets, sur la
 * base d'une mesure réelle (pas une intuition) — croise deux sources :
 *   1) Google Search Console : clics, impressions, CTR, position moyenne,
 *      filtrés sur les pages contenant "/en/o/" et "/en/guides/".
 *   2) Cloudflare Web Analytics (GraphQL) : pageviews réels, même filtre.
 *
 * Ce script NE DÉCIDE PAS à ta place : il présente les chiffres, avec un
 * repère indicatif clairement signalé comme tel (pas une règle absolue).
 *
 * ── 2 ÉTATS DISTINCTS, VOLONTAIREMENT SÉPARÉS ────────────────────────────
 * 1) Secrets absents (pas encore configurés) → log clair, exit 0. Normal,
 *    attendu tant que la config n'est pas prête. Aucun rapport écrit.
 * 2) Secrets présents mais authentification/requête en échec (jeton expiré,
 *    révoqué, mauvaise permission, propriété GSC mal orthographiée, schéma
 *    Cloudflare qui a changé…) → ÉCHEC BRUYANT : exit 1, message clair,
 *    AUCUN rapport écrit. Ne jamais confondre "on n'a pas pu vérifier" avec
 *    "on a vérifié et il n'y a rien" — c'est exactement le piège du
 *    rate-limit pris pour un volume nul lors du calcul du lot EN (10/07/2026).
 * Seul un succès structurel (réponse valide, même avec 0 clics/pageviews)
 * produit un rapport — ce zéro-là est un vrai zéro mesuré.
 *
 * ── CREDENTIALS REQUIS (secrets du dépôt GitHub — jamais en clair, jamais
 *    committés, jamais envoyés au bot) ─────────────────────────────────────
 *
 * GSC_SA_KEY_JSON — contenu intégral du fichier .json téléchargé pour un
 *   compte de service Google Cloud, permission MINIMALE :
 *   1. console.cloud.google.com → IAM et administration → Comptes de service
 *      → Créer un compte de service (ex. "voidrelay-search-console-ro").
 *      Aucun rôle IAM à cocher au niveau du projet — l'accès aux données se
 *      donne séparément, côté Search Console (étape 3).
 *   2. Sur ce compte de service → onglet Clés → Ajouter une clé → Créer une
 *      clé → JSON → télécharge le fichier. Le CONTENU de ce fichier = la
 *      valeur du secret GSC_SA_KEY_JSON.
 *   3. search.google.com/search-console → propriété voidrelay.fr → Réglages
 *      (roue crantée, en bas à gauche) → Utilisateurs et autorisations →
 *      Ajouter un utilisateur → coller l'email du compte de service (visible
 *      dans le JSON sous "client_email", finit par
 *      "@<projet>.iam.gserviceaccount.com") → niveau de permission
 *      "Restreint" (PAS "Complet"/"Propriétaire" — "Restreint" suffit pour
 *      lire les données de Search Analytics, principe du moindre privilège).
 *
 * GSC_SITE_URL — l'URL de propriété EXACTEMENT comme affichée dans le
 *   sélecteur de propriété de Search Console (ex. "https://voidrelay.fr/",
 *   avec le slash final) — copie-la depuis l'interface plutôt que de la
 *   retaper, un slash manquant fait échouer la requête.
 *
 * CF_API_TOKEN — jeton API Cloudflare, permission MINIMALE :
 *   dash.cloudflare.com → icône de profil (haut droite) → Mon profil →
 *   Jetons API → Créer un jeton → "Créer un jeton personnalisé" (PAS un
 *   modèle prédéfini) → Permissions : Compte / Analytics / Lecture →
 *   Ressources de compte : LE compte voidrelay uniquement (pas "tous les
 *   comptes") → Continuer → Créer le jeton. Copie-le : il ne sera plus
 *   jamais réaffiché.
 *
 * CF_ACCOUNT_ID — pas un secret à proprement parler (identifiant, pas une
 *   clé), mais gardé au même endroit par simplicité : dash.cloudflare.com →
 *   sélectionne le site voidrelay.fr → barre latérale droite de la page
 *   Aperçu → "ID de compte".
 *
 * Colle ces 4 valeurs dans Settings → Secrets and variables → Actions du
 * dépôt GitHub. Jamais dans un message, jamais dans un fichier du dépôt.
 *
 * Usage :
 *   node scripts/rapport_en_objets.mjs                 → rapport de la semaine écoulée
 *   node scripts/rapport_en_objets.mjs --check-schema   → valide les noms de champs
 *     GraphQL Cloudflare (dataset RUM encore en beta chez Cloudflare, jamais
 *     testé avec un vrai jeton faute d'accès à ce compte — À FAIRE avant la
 *     première exécution réelle du rapport hebdo)
 * ========================================================================== */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHECK_SCHEMA = process.argv.includes("--check-schema");
const PATH_FILTERS = ["/en/o/", "/en/guides/"];

function missingCreds() {
  const missing = [];
  if (!process.env.GSC_SA_KEY_JSON) missing.push("GSC_SA_KEY_JSON");
  if (!process.env.GSC_SITE_URL) missing.push("GSC_SITE_URL");
  if (!process.env.CF_API_TOKEN) missing.push("CF_API_TOKEN");
  if (!process.env.CF_ACCOUNT_ID) missing.push("CF_ACCOUNT_ID");
  return missing;
}

function fail(message) {
  console.error("");
  console.error("💥 ÉCHEC — aucun rapport écrit (mieux vaut rien qu'un rapport trompeur) :");
  console.error("   " + message);
  console.error("   Ce n'est PAS un signal « pas de trafic » — vérifie le jeton/la config avant toute conclusion.");
  console.error("");
  process.exit(1);
}

// --- Google Search Console (compte de service, JWT signé maison — pas de dépendance googleapis) ---
function base64url(buf) { return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }

async function getGoogleAccessToken(saKeyJson) {
  let sa;
  try { sa = JSON.parse(saKeyJson); } catch (e) { throw new Error("GSC_SA_KEY_JSON n'est pas un JSON valide : " + e.message); }
  if (!sa.client_email || !sa.private_key) throw new Error("GSC_SA_KEY_JSON ne contient pas client_email/private_key — mauvais fichier ?");
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64url(Buffer.from(JSON.stringify(header)))}.${base64url(Buffer.from(JSON.stringify(claims)))}`;
  const signature = crypto.sign("RSA-SHA256", Buffer.from(unsigned), sa.private_key);
  const jwt = `${unsigned}.${base64url(signature)}`;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${jwt}`,
  });
  const d = await r.json();
  if (!d.access_token) throw new Error(`Authentification Google échouée (HTTP ${r.status}) : ${d.error_description || d.error || JSON.stringify(d)} — jeton de compte de service invalide/révoqué, ou compte de service pas encore ajouté dans Search Console.`);
  return d.access_token;
}

async function queryGSC(accessToken, siteUrl, startDate, endDate, pathContains) {
  const r = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      startDate, endDate,
      dimensions: ["page"],
      dimensionFilterGroups: [{ filters: [{ dimension: "page", operator: "contains", expression: pathContains }] }],
      rowLimit: 25000,
    }),
  });
  const d = await r.json();
  if (!r.ok || d.error) throw new Error(`Search Console (${pathContains}, HTTP ${r.status}) : ${d.error?.message || "réponse inattendue"} — vérifie GSC_SITE_URL et que le compte de service est bien utilisateur de cette propriété.`);
  const rows = d.rows || [];
  return {
    pages: rows.length,
    clicks: rows.reduce((s, x) => s + x.clicks, 0),
    impressions: rows.reduce((s, x) => s + x.impressions, 0),
    avgCtr: rows.length ? rows.reduce((s, x) => s + x.ctr, 0) / rows.length : 0,
    avgPosition: rows.length ? rows.reduce((s, x) => s + x.position, 0) / rows.length : 0,
    topPages: rows.sort((a, b) => b.clicks - a.clicks).slice(0, 10).map(x => ({ page: x.keys[0], clicks: x.clicks, impressions: x.impressions })),
  };
}

// --- Cloudflare (jeton vérifié explicitement avant tout usage — un jeton expiré/révoqué
// doit échouer bruyamment ici, pas produire silencieusement des zéros plus loin). ---
async function verifyCloudflareToken(apiToken) {
  const r = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", {
    headers: { Authorization: `Bearer ${apiToken}` },
  });
  const d = await r.json();
  if (!r.ok || !d.success) throw new Error(`Jeton Cloudflare invalide, expiré ou révoqué (HTTP ${r.status}) : ${JSON.stringify(d.errors || d)}`);
}

async function cfGraphQL(apiToken, query, variables) {
  const r = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const d = await r.json();
  if (!r.ok || (d.errors && d.errors.length)) throw new Error(`Cloudflare GraphQL (HTTP ${r.status}) : ${JSON.stringify(d.errors || d)}`);
  return d.data;
}

async function checkCloudflareSchema(apiToken) {
  console.log("🔎 --check-schema : introspection du filtre rumPageloadEventsAdaptiveGroups...");
  await verifyCloudflareToken(apiToken);
  console.log("✅ jeton Cloudflare valide.");
  const introspection = `
    query IntrospectFilter {
      __type(name: "AccountRumPageloadEventsAdaptiveGroupsFilter_InputObject") {
        inputFields { name type { name kind ofType { name } } }
      }
    }`;
  const data = await cfGraphQL(apiToken, introspection, {});
  const fields = data?.__type?.inputFields || [];
  if (!fields.length) {
    fail("Introspection vide ou type introuvable — le nom du type a peut-être changé côté Cloudflare (dataset en beta). Vérifie la doc GraphQL Analytics API à jour avant de faire confiance au reste du script.");
  }
  console.log(`✅ ${fields.length} champs de filtre trouvés :`);
  for (const f of fields) console.log(`   ${f.name}`);
  const hasPath = fields.some(f => /path/i.test(f.name));
  const hasDate = fields.some(f => /date|time/i.test(f.name));
  console.log(hasPath ? "✅ un champ lié au chemin d'URL existe (à confirmer lequel exactement ci-dessus)" : "❌ aucun champ évident pour filtrer par chemin — le script principal utilise 'requestPath_like' par hypothèse, à corriger si absent de la liste ci-dessus");
  console.log(hasDate ? "✅ un champ de date/heure existe" : "❌ aucun champ de date évident");
}

async function queryCloudflarePageviews(apiToken, accountId, since, until, pathLike) {
  const query = `
    query PageviewsByPath($accountTag: String!, $since: Time!, $until: Time!, $pathLike: String!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          rumPageloadEventsAdaptiveGroups(
            limit: 1
            filter: { datetime_geq: $since, datetime_leq: $until, requestPath_like: $pathLike }
          ) {
            count
            sum { visits }
          }
        }
      }
    }`;
  const data = await cfGraphQL(apiToken, query, { accountTag: accountId, since, until, pathLike: `%${pathLike}%` });
  const accounts = data?.viewer?.accounts;
  if (!accounts || !accounts.length) throw new Error(`Aucun compte retourné pour CF_ACCOUNT_ID=${accountId} — jeton valide mais probablement pas de portée sur ce compte, ou ID de compte incorrect.`);
  const g = accounts[0]?.rumPageloadEventsAdaptiveGroups?.[0];
  // g === undefined ici est un ZÉRO STRUCTUREL RÉEL (requête réussie, aucune ligne) — pas une erreur.
  return { pageviews: g?.count ?? 0, visits: g?.sum?.visits ?? 0 };
}

async function main() {
  if (CHECK_SCHEMA) {
    const missing = missingCreds().filter(m => m.startsWith("CF_"));
    if (missing.length) { console.log(`⚠️  --check-schema nécessite ${missing.join(", ")} — non configuré(s), rien à vérifier.`); return; }
    await checkCloudflareSchema(process.env.CF_API_TOKEN);
    return;
  }

  const missing = missingCreds();
  if (missing.length) {
    console.log(`⚠️  Rapport EN objets : credentials manquantes (${missing.join(", ")}) — pas encore configuré, c'est attendu. Rapport non généré. Voir l'en-tête de ce script pour la procédure. Sortie propre (exit 0), pas un échec CI.`);
    return;
  }

  const until = new Date();
  const since = new Date(until.getTime() - 7 * 24 * 3600 * 1000);
  const fmt = d => d.toISOString().slice(0, 10);

  console.log(`Rapport EN objets — semaine du ${fmt(since)} au ${fmt(until)}`);

  // Vérifications d'authentification EXPLICITES avant toute requête de données : un jeton
  // cassé doit échouer ici, bruyamment — pas être avalé plus bas et confondu avec un zéro réel.
  await verifyCloudflareToken(process.env.CF_API_TOKEN);
  const accessToken = await getGoogleAccessToken(process.env.GSC_SA_KEY_JSON);

  const gscResults = {};
  for (const p of PATH_FILTERS) gscResults[p] = await queryGSC(accessToken, process.env.GSC_SITE_URL, fmt(since), fmt(until), p);

  const cfResults = {};
  for (const p of PATH_FILTERS) cfResults[p] = await queryCloudflarePageviews(process.env.CF_API_TOKEN, process.env.CF_ACCOUNT_ID, since.toISOString(), until.toISOString(), p);

  // À partir d'ici, tout a réussi structurellement — les zéros éventuels ci-dessous sont réels.
  const lines = [];
  lines.push(`# Rapport EN objets — semaine ${fmt(since)} → ${fmt(until)}`);
  lines.push("");
  lines.push("Chiffres mesurés avec succès (aucune erreur d'authentification/requête cette semaine) — sans verdict automatique, la décision d'étendre le lot t'appartient.");
  lines.push("");
  for (const p of PATH_FILTERS) {
    const g = gscResults[p], c = cfResults[p];
    lines.push(`## ${p}`);
    lines.push("");
    lines.push("**Google Search Console**");
    lines.push(`- Pages indexées avec impressions : ${g.pages}`);
    lines.push(`- Clics (7j) : ${g.clicks}`);
    lines.push(`- Impressions (7j) : ${g.impressions}`);
    lines.push(`- CTR moyen : ${(g.avgCtr * 100).toFixed(2)}%`);
    lines.push(`- Position moyenne : ${g.avgPosition.toFixed(1)}`);
    if (g.topPages.length) {
      lines.push(`- Top pages par clics :`);
      for (const tp of g.topPages) lines.push(`  - ${tp.page} — ${tp.clicks} clics, ${tp.impressions} impressions`);
    }
    lines.push("");
    lines.push("**Cloudflare Web Analytics**");
    lines.push(`- Pageviews (7j) : ${c.pageviews}`);
    lines.push(`- Visites (7j) : ${c.visits}`);
    lines.push("");
  }
  lines.push("---");
  lines.push("**Repère indicatif** (pas une règle, à ajuster à l'usage) : voir `reports/en-objects/CRITERES-EXTENSION.md` pour les seuils chiffrés définis à l'avance.");
  lines.push("");

  const report = lines.join("\n");
  const REPORTS_DIR = path.join(ROOT, "reports", "en-objects");
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const reportPath = path.join(REPORTS_DIR, `${fmt(until)}.md`);
  fs.writeFileSync(reportPath, report);
  console.log(`✅ Rapport écrit : ${path.relative(ROOT, reportPath)}`);
}

try {
  await main();
} catch (e) {
  fail(e.message);
}
