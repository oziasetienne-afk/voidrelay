/* ============================================================================
   VoidRelay — GARDE-FOU de /api/evt (mesure de l'engagement), 26/09/2026.

   Ce que ce script prouve, en appelant le VRAI onRequest :
     1. seuls les événements de la liste fermée entrent ; un chemin qui n'en est
        pas un est refusé ; un détail exotique devient « autre » ;
     2. un autre site ne peut pas écrire (Origin), un corps trop long non plus ;
     3. deux fois le même événement = UN compteur à 2, pas deux lignes ;
     4. aucune IP n'est stockée, même quand Cloudflare en fournit une ;
     5. la lecture est réservée à l'admin (401 sans jeton, 503 sans secret).

   La base : node:sqlite quand Node le fournit (22+, local) — le SQL de
   production est alors exécuté pour de vrai, ON CONFLICT compris. Sinon (Node 20
   en CI) une base simulée couvre l'écriture ; les requêtes de lecture sont
   signalées comme non exécutées plutôt que déclarées vertes.
     node scripts/verifier_api_evt.mjs   → 0 = tout passe · 1 = un cas échoue
   ========================================================================== */
import { lireEvenement, onRequest, EVENEMENTS } from "../functions/api/evt.js";

let echecs = 0;
function ok(nom, condition, detail) {
  console.log((condition ? "  ✓ " : "  ✗ ") + nom + (detail ? " — " + detail : ""));
  if (!condition) echecs++;
}

/* --- Base : vraie SQLite si possible, sinon une simulation de l'écriture --- */
let sqlite = null;
// VR_SANS_SQLITE=1 force la base simulée : c'est ainsi qu'on vérifie le chemin CI en local.
if (!process.env.VR_SANS_SQLITE) try {
  process.removeAllListeners("warning");
  sqlite = (await import("node:sqlite")).DatabaseSync;
} catch (e) { /* Node 20 : pas de node:sqlite */ }

function baseD1() {
  if (sqlite) {
    const db = new sqlite(":memory:");
    return {
      vraie: true,
      brut: db,
      prepare(sql) {
        let args = [];
        const st = {
          bind(...a) { args = a; return st; },
          async run() { db.prepare(sql).run(...args); return { success: true }; },
          async all() { return { results: db.prepare(sql).all(...args) }; },
        };
        return st;
      },
    };
  }
  const lignes = new Map();
  let table = false;
  return {
    vraie: false,
    lignes,
    prepare(sql) {
      let args = [];
      const st = {
        bind(...a) { args = a; return st; },
        async run() {
          if (/^\s*CREATE TABLE/i.test(sql)) { table = true; return {}; }
          if (!table) throw new Error("D1_ERROR: no such table: evt");
          const k = args.slice(0, 4).join("\u0001");
          lignes.set(k, (lignes.get(k) || 0) + 1);
          return {};
        },
        async all() { if (!table) throw new Error("D1_ERROR: no such table: evt"); return { results: [] }; },
      };
      return st;
    },
  };
}

function req(methode, corps, entetes = {}, url = "https://voidrelay.fr/api/evt") {
  return new Request(url, {
    method: methode,
    headers: entetes,
    body: methode === "POST" ? (typeof corps === "string" ? corps : JSON.stringify(corps)) : undefined,
  });
}
const MEME = { Origin: "https://voidrelay.fr", "CF-Connecting-IP": "203.0.113.77" };

console.log("🛡️  /api/evt — ce qui entre dans les compteurs, et qui peut les lire");

/* --- 1. lireEvenement --- */
ok("un événement hors liste est refusé", lireEvenement({ e: "achat", p: "/" }) === null);
ok("la liste fermée contient la conversion (sortie)", EVENEMENTS.includes("sortie"));
ok("un chemin absolu vers un autre site est refusé", lireEvenement({ e: "sortie", p: "//evil.example/x" }) === null);
ok("une URL complète n'est pas un chemin", lireEvenement({ e: "sortie", p: "https://x.example/" }) === null);
const long = lireEvenement({ e: "recherche", p: "/o/" + "a".repeat(300) + "?q=secret#h" });
ok("un chemin est coupé à 120 caractères, requête et ancre retirées",
  long && long.p.length === 120 && !long.p.includes("?"), long && long.p.length);
ok("un détail exotique devient « autre »", (lireEvenement({ e: "partage", d: "<script>", p: "/" }) || {}).d === "autre");

/* --- 2 à 4. écriture --- */
const base = baseD1();
const env = { BUILDS: base, VR_ADMIN_TOKEN: "jeton-test" };
const post = (corps, h = MEME) => onRequest({ request: req("POST", corps, h), env });

let r = await post({ e: "sortie", d: "warframe.market", p: "/o/arcane_energize" });
ok("premier événement accepté, table posée d'elle-même", r.status === 204, "HTTP " + r.status);
r = await post({ e: "sortie", d: "warframe.market", p: "/o/arcane_energize" });
ok("second événement identique accepté", r.status === 204, "HTTP " + r.status);
r = await post({ e: "sortie", d: "warframe.market", p: "/" }, { Origin: "https://autre-site.example" });
ok("un autre site ne peut pas écrire", r.status === 403, "HTTP " + r.status);
r = await post({ e: "sortie", d: "x", p: "/" }, {});
ok("une requête sans Origin ni Sec-Fetch-Site est refusée", r.status === 403, "HTTP " + r.status);
r = await post({ e: "langue", p: "/en/" }, { Origin: "null", "Sec-Fetch-Site": "same-origin" });
ok("Origin « null » mais Sec-Fetch-Site same-origin : accepté", r.status === 204, "HTTP " + r.status);
r = await post("x".repeat(600));
ok("un corps de plus de 512 octets est refusé", r.status === 413, "HTTP " + r.status);
r = await post({ e: "achat", p: "/" });
ok("un événement inconnu est refusé", r.status === 400, "HTTP " + r.status);

if (base.vraie) {
  const lignes = base.brut.prepare("SELECT * FROM evt").all();
  const sortie = lignes.find(l => l.e === "sortie" && l.p === "/o/arcane_energize");
  ok("deux événements identiques = UN compteur à 2", lignes.filter(l => l.e === "sortie").length === 1 && sortie && sortie.n === 2,
    JSON.stringify(lignes.filter(l => l.e === "sortie")));
  const colonnes = base.brut.prepare("PRAGMA table_info(evt)").all().map(c => c.name).join(",");
  ok("la table n'a aucune colonne d'identification", colonnes === "jour,e,d,p,n", colonnes);
  ok("l'IP fournie par Cloudflare n'est stockée nulle part", !JSON.stringify(lignes).includes("203.0.113.77"));
} else {
  const cles = [...base.lignes.keys()].filter(k => k.includes("sortie"));
  ok("deux événements identiques = UN compteur à 2 (base simulée)", cles.length === 1 && base.lignes.get(cles[0]) === 2);
  ok("l'IP fournie par Cloudflare n'est stockée nulle part", ![...base.lignes.keys()].join().includes("203.0.113.77"));
}

/* --- 5. lecture --- */
const get = (h, e = env) => onRequest({ request: req("GET", null, h, "https://voidrelay.fr/api/evt?jours=7"), env: e });
r = await get({});
ok("lecture sans jeton : 401", r.status === 401, "HTTP " + r.status);
r = await get({ "X-VR-Admin": "mauvais" });
ok("lecture avec un mauvais jeton : 401", r.status === 401, "HTTP " + r.status);
r = await get({}, { BUILDS: base });
ok("sans secret configuré : 503, jamais ouvert à tous", r.status === 503, "HTTP " + r.status);
r = await get({ "X-VR-Admin": "jeton-test" });
if (base.vraie) {
  const j = await r.json();
  const s = (j.parDetail || []).find(x => x.e === "sortie" && x.d === "warframe.market");
  ok("l'admin lit les totaux (sortie vers warframe.market = 2)", r.status === 200 && s && s.n === 2, JSON.stringify(s));
} else {
  console.log("  · lecture SQL non exécutée ici (Node sans node:sqlite) — elle l'est en local");
}

console.log(echecs ? `\n💥 ${echecs} cas en échec.` : "\n✅ /api/evt : tout passe.");
process.exit(echecs ? 1 : 0);
