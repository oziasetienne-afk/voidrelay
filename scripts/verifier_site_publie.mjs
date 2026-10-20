#!/usr/bin/env node
/* ============================================================================
   VoidRelay — GARDE-FOU du dossier publié (21/10/2026).

   Constaté en prod : le déploiement publiait le dépôt entier, et
   https://voidrelay.fr/CLAUDE.md, /docs/PASSATION.md,
   /.github/workflows/garde-rendu.yml, /scripts/garde_perso.py répondaient 200.
   Depuis, scripts/construire_site.sh copie une LISTE BLANCHE dans _site/ et
   c'est ce dossier qui part sur Cloudflare Pages. Deux façons de rater ça :

     1. un fichier interne revient dans le dossier publié (quelqu'un élargit la
        liste blanche à un dossier entier, ajoute un *.md dans data/…) ;
     2. la liste blanche oublie un fichier dont le site a besoin : une page, une
        image, un JSON chargé par le JS — 404 en prod, aucun test ne rougit.

   Le (2) est jugé de deux manières : verifier_liens_internes.mjs relancé SUR le
   dossier publié (href, src, hreflang, coque du service worker, fetch du JS,
   _redirects), puis une passe différentielle : aucun fichier publié ne doit
   citer un fichier du dépôt que la liste blanche a laissé de côté.

   node scripts/verifier_site_publie.mjs [dossier]
     sans argument : construit dans un dossier jetable (ce que font les invariants)
     avec argument : juge ce dossier tel quel (ce que fait le workflow de déploiement)
   0 = tout passe, 1 = au moins un échec.
   ========================================================================== */
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";

const DEPOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
let ok = 0, ko = 0;
const dit = (c, quoi, det) => { c ? ok++ : ko++; console.log(`  ${c ? "✓" : "✗"} ${quoi}${det ? " — " + det : ""}`); };

let SITE = process.argv[2] ? path.resolve(process.argv[2]) : null;
let jetable = null;
if (!SITE) {
  jetable = fs.mkdtempSync(path.join(os.tmpdir(), "vr-site-"));
  SITE = path.join(jetable, "site");
  execFileSync("bash", [path.join(DEPOT, "scripts/construire_site.sh"), SITE], { stdio: "ignore" });
}
const nettoie = () => { if (jetable) fs.rmSync(jetable, { recursive: true, force: true }); };

function fichiers(racine) {
  const out = [];
  const marche = (d) => {
    for (const e of fs.readdirSync(path.join(racine, d), { withFileTypes: true })) {
      const rel = d ? `${d}/${e.name}` : e.name;
      if (e.isDirectory()) marche(rel); else out.push(rel);
    }
  };
  marche("");
  return out;
}

console.log(`📦 dossier publié (${path.relative(DEPOT, SITE) || SITE})`);
const publies = fichiers(SITE);
const ensemble = new Set(publies);

/* 1) Rien d'interne. Les dossiers et extensions de l'outillage, et les fichiers de
   config de la racine. Un .md n'a aucune raison d'être servi, où qu'il soit. */
const INTERDITS = [
  [/^(\.claude|\.github|\.git|docs|scripts|tests|functions|proxy|refs|reports|node_modules|\.wrangler)\//, "dossier interne"],
  [/\.(md|py|sh|mjs|cjs|ts|sql|toml|ya?ml|lock|env|key|pem|bak)$/i, "fichier d'outillage"],
  [/(^|\/)(\.DS_Store|\.gitignore|\.gitleaks\.toml|\.indexnow_key|\.nojekyll|\.dev\.vars.*|\.env.*)$/, "fichier de config"],
  [/^package(-lock)?\.json$/, "manifeste npm"],
];
const fautifs = [];
for (const f of publies) {
  for (const [re, quoi] of INTERDITS) if (re.test(f)) { fautifs.push(`${f} (${quoi})`); break; }
}
dit(fautifs.length === 0, "aucun fichier interne dans le dossier publié",
    fautifs.length ? `${fautifs.length} : ${fautifs.slice(0, 10).join(" · ")}` : `${publies.length} fichiers, tous de type site`);

/* Les quatre adresses constatées en prod le 21/10/2026, nommément. */
const temoins = ["CLAUDE.md", "docs/PASSATION.md", ".github/workflows/garde-rendu.yml", "scripts/garde_perso.py"];
dit(temoins.every((t) => !ensemble.has(t)), "les 4 fichiers vus en prod le 21/10 ne sont plus publiés",
    temoins.filter((t) => ensemble.has(t)).join(" · "));

/* 2a) Le site lui-même tient dans le dossier publié. */
const indispensables = ["index.html", "404.html", "sw.js", "manifest.webmanifest", "_headers", "_redirects",
                        "robots.txt", "sitemap.xml", "favicon.ico", "data/summary.json", "data/items.json"];
const manquants = indispensables.filter((f) => !ensemble.has(f));
dit(manquants.length === 0, "les fichiers piliers du site sont publiés", manquants.join(" · "));

let liens = "";
try {
  liens = execFileSync("node", [path.join(DEPOT, "scripts/verifier_liens_internes.mjs")],
                       { env: { ...process.env, VR_RACINE: SITE }, encoding: "utf8" });
  dit(true, "verifier_liens_internes.mjs passe SUR le dossier publié",
      (liens.match(/GARDE-FOU : (.*)$/m) || [, ""])[1]);
} catch (e) {
  const echecs = String(e.stdout || "").split("\n").filter((l) => l.includes("✗")).map((l) => l.trim());
  dit(false, "verifier_liens_internes.mjs passe SUR le dossier publié", echecs.join(" · ").slice(0, 600));
}

/* 2b) Différentiel : chaque fichier du dépôt laissé de côté est cherché, comme
   adresse absolue, dans tout ce que le site publie de textuel. Une page qui le
   cite le demandera en prod et prendra une 404. */
const depot = execFileSync("git", ["-c", "core.quotepath=off", "ls-files"], { cwd: DEPOT, encoding: "utf8" })
  .split("\n").filter(Boolean);
const ecartes = depot.filter((f) => !ensemble.has(f) && !f.startsWith("functions/"));
const echappe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const RE_CITE = new RegExp(`(?:["'(=]|voidrelay\\.fr)/(${ecartes.map(echappe).join("|")})(?=["'?#)\\s<])`, "g");
const TEXTE = /\.(html|css|js|json|webmanifest|xml|txt)$|^_headers$|^_redirects$/;
const cites = new Map();
for (const f of publies) {
  if (!TEXTE.test(f)) continue;
  for (const m of fs.readFileSync(path.join(SITE, f), "utf8").matchAll(RE_CITE)) {
    if (!cites.has(m[1])) cites.set(m[1], f);
  }
}
dit(cites.size === 0, "aucun fichier publié ne cite un fichier laissé hors du site",
    cites.size ? [...cites].slice(0, 8).map(([c, f]) => `/${c} (cité par ${f})`).join(" · ")
               : `${ecartes.length} fichiers écartés, aucun cité`);

nettoie();
console.log("-".repeat(70));
if (ko) { console.log(`❌ ${ko} échec(s) sur ${ok + ko}`); process.exit(1); }
console.log(`🛡️  GARDE-FOU : ${publies.length} fichiers publiés, rien d'interne, rien d'oublié.`);
