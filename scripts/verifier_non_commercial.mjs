#!/usr/bin/env node
/* ============================================================================
   VoidRelay — GARDE-FOU « site non commercial » (22/10/2026).

   Le proxy de prix (proxy/vercel/) tourne sur une équipe Vercel Hobby, réservée
   à l'usage personnel NON commercial. Les règles Vercel citent comme commerciale
   la simple inclusion de publicités, AdSense compris
   (vercel.com/docs/limits/fair-use-guidelines, lu le 22/10/2026).
   Or 5 829 pages chargeaient adsbygoogle.js, ads.txt déclarait un éditeur
   AdSense et 4 213 pages portaient un lien razer.com/affiliate — alors que
   AdSense avait refusé le site (septembre 2026) : zéro revenu, risque de
   suspension du proxy, donc des prix en direct.

   Ce garde-fou refuse le retour de tout cela dans les fichiers publiés :
   script ou domaine publicitaire Google, identifiant éditeur, lien affilié,
   lien « sponsored », fichiers ads.txt et js/ads.js.
   Revenir sur ce choix = décision de l'admin ET changement d'hébergement du
   proxy (offre qui autorise l'usage commercial) — pas un contournement ici.

   node scripts/verifier_non_commercial.mjs     0 = rien trouvé, 1 = au moins un cas
   ========================================================================== */
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
// Hors site publié : outils, docs, tests, CI, proxy (le proxy est vérifié à part, ligne FICHIERS_INTERDITS).
const HORS_SITE = /^(scripts|docs|tests|\.github|\.claude|proxy|node_modules)\//;
const EXT = /\.(html?|js|mjs|css|json|txt|xml|webmanifest)$|(^|\/)_headers$|(^|\/)_redirects$/;
const MOTIFS = [
  [/adsbygoogle/i, "script AdSense"],
  [/googlesyndication\.com|googleadservices\.com|doubleclick\.net|adservice\.google|googletagservices\.com|fundingchoicesmessages|adtrafficquality/i, "domaine publicitaire Google"],
  [/\b(ca-)?pub-\d{16}\b/, "identifiant éditeur AdSense"],
  [/razer\.com\/affiliate/i, "lien affilié Razer"],
  [/rel="[^"]*\bsponsored\b[^"]*"/i, "lien sponsorisé (rel=sponsored)"],
];
const FICHIERS_INTERDITS = ["ads.txt", "js/ads.js"];

const fichiers = execFileSync("git", ["-c", "core.quotepath=off", "ls-files"], { cwd: ROOT, encoding: "utf8" })
  .split("\n").filter(f => f && EXT.test(f) && !HORS_SITE.test(f));

const trouves = new Map(); // motif → [fichiers]
for (const f of fichiers) {
  let txt;
  try { txt = fs.readFileSync(path.join(ROOT, f), "utf8"); } catch { continue; } // fichier suivi mais supprimé localement
  for (const [re, nom] of MOTIFS) if (re.test(txt)) {
    if (!trouves.has(nom)) trouves.set(nom, []);
    trouves.get(nom).push(f);
  }
}
const interdits = FICHIERS_INTERDITS.filter(f => fs.existsSync(path.join(ROOT, f)));

if (!trouves.size && !interdits.length) {
  console.log(`✅ site non commercial : aucune pub, aucun lien affilié dans ${fichiers.length} fichiers publiés`);
  process.exit(0);
}
console.error("💥 Site non commercial (offre Vercel Hobby du proxy de prix) :");
for (const [nom, fs_] of trouves) console.error(`   ${nom} : ${fs_.length} fichier(s), ex. ${fs_.slice(0, 3).join(", ")}`);
for (const f of interdits) console.error(`   fichier interdit présent : ${f}`);
process.exit(1);
