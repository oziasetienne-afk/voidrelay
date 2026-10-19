/* ============================================================================
   VoidRelay — LE FIL D'ARIANE VISIBLE ET LE FIL D'ARIANE DÉCLARÉ SONT LE MÊME.

   Mesuré le 05/09/2026 : les 5 651 pages GÉNÉRÉES (objets, guides, annuaires)
   déclarent un BreadcrumbList à Google — et les 37 pages ÉCRITES À LA MAIN,
   qui sont justement les outils (/trade, /marche, /arsenal, /ducats…), en
   affichent un à l'écran sans jamais le déclarer. Google n'a donc aucun fil
   d'Ariane à montrer sous leur résultat de recherche, alors que la page en
   porte un, correct, à trois niveaux pour certaines.

   POURQUOI DÉRIVER PLUTÔT QUE RÉDIGER. Une liste de fils d'Ariane tenue à la
   main dans un script serait un doublon de plus à désynchroniser — la leçon
   de v72 et de v75. Le fil déclaré est donc EXTRAIT DE LA PAGE : ce que le
   visiteur lit est, mot pour mot, ce que Google reçoit. Une page qui change
   son fil change sa déclaration ; elle ne peut pas mentir.

     node scripts/verifier_fil_ariane.mjs            → vérifie (0 / 1)
     node scripts/verifier_fil_ariane.mjs --ecrire   → pose ce qui manque

   La vérification couvre TOUTES les pages du site, générées comprises : elle
   attrape aussi le jour où un générateur changerait le fil affiché sans
   changer le JSON-LD qu'il écrit à côté.
   ========================================================================== */
import fs from "node:fs";
import path from "node:path";
import { filVisible, declarationFilAriane, SITE } from "./lib_fil_ariane.mjs";

const RACINE = path.resolve(new URL("..", import.meta.url).pathname);
const ECRIRE = process.argv.includes("--ecrire");

/* --ecrire NE TOUCHE JAMAIS UNE PAGE GÉNÉRÉE. Une déclaration posée à la main
   dans /o/, /guides/ ou /builds/ disparaîtrait à la prochaine génération — le
   fork exact que v72 puis v74 ont eu à réparer. Ces pages-là se corrigent dans
   leur générateur, et le garde-fou le dit au lieu de le laisser deviner.
   Deux marques suffisent : le manifeste écrit par generer_pages_objets.mjs, et
   le commentaire que generer_builds.mjs pose en tête de ses pages. */
const MANIFESTE = (() => {
  try { return new Set(Object.keys(JSON.parse(fs.readFileSync(path.join(RACINE, "scripts/.generated-manifest.json"), "utf8")))); }
  catch (e) { return new Set(); }
})();
const MARQUE_GENERATEUR = /<!-- vr-[a-z-]*gen/;
function estGeneree(fichier, html) {
  return MANIFESTE.has(path.relative(RACINE, fichier).split(path.sep).join("/")) || MARQUE_GENERATEUR.test(html);
}

/* Le sélecteur de langue vit DANS le <nav class="bc"> (à droite, flottant) —
   c'est un choix de mise en page, pas une étape du chemin. Il porte toujours
   hreflang : c'est ce qui le distingue, plutôt qu'une liste de libellés. */
const EST_LIEN_DE_LANGUE = /hreflang=/;

function pages(dossier, acc = []) {
  for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    const complet = path.join(dossier, e.name);
    if (e.isDirectory()) pages(complet, acc);
    else if (e.name.endsWith(".html")) acc.push(complet);
  }
  return acc;
}

function canonique(html, fichier) {
  const m = /<link rel="canonical" href="([^"]+)"/.exec(html);
  if (m) return m[1];
  const rel = "/" + path.relative(RACINE, fichier).split(path.sep).join("/");
  return SITE + rel.replace(/\/index\.html$/, "/").replace(/\.html$/, "");
}

/* La déclaration attendue pour cette page : le fil visible, plus l'URL
   canonique pour l'étape courante. La règle vit dans lib_fil_ariane.mjs —
   la même que celle qu'appliquent les générateurs. */
export function declarationAttendue(html, fichier) {
  return declarationFilAriane(html, canonique(html, fichier));
}

/* Ce que la page déclare aujourd'hui, quel que soit le bloc qui le porte
   (les pages générées empilent plusieurs objets dans un même script). */
function declarationPresente(html) {
  for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    let donnees;
    try { donnees = JSON.parse(m[1]); } catch (e) { continue; }
    for (const bloc of Array.isArray(donnees) ? donnees : [donnees]) {
      if (bloc && bloc["@type"] === "BreadcrumbList") return bloc;
    }
  }
  return null;
}

/* Remplace LE SEUL bloc BreadcrumbList de la page, en laissant intacts les
   autres objets du même script (Article, FAQPage…) : ces pages empilent
   plusieurs déclarations dans un tableau, et on ne touche qu'à la nôtre. */
function remplacerDeclaration(html, attendu) {
  return html.replace(/<script type="application\/ld\+json"([^>]*)>([\s\S]*?)<\/script>/g, (tout, attrs, corps) => {
    let donnees;
    try { donnees = JSON.parse(corps); } catch (e) { return tout; }
    const liste = Array.isArray(donnees) ? donnees : [donnees];
    let touche = false;
    const neuf = liste.map((bloc) => {
      if (bloc && bloc["@type"] === "BreadcrumbList") { touche = true; return attendu; }
      return bloc;
    });
    if (!touche) return tout;
    return '<script type="application/ld+json"' + attrs + ">" + JSON.stringify(Array.isArray(donnees) ? neuf : neuf[0]) + "</script>";
  });
}

const resume = (bloc) => (bloc ? bloc.itemListElement.map((e) => e.name + " → " + e.item).join(" | ") : "aucun");

const fichiers = pages(RACINE);
const manquantsMain = [];
const manquantsGeneres = new Map();   // dossier → nombre
const divergents = [];
let poses = 0;
let corriges = 0;
let avecFil = 0;

for (const f of fichiers) {
  let html = fs.readFileSync(f, "utf8");
  const attendu = declarationAttendue(html, f);
  if (!attendu) continue;
  avecFil++;
  const present = declarationPresente(html);
  const nom = path.relative(RACINE, f);
  if (!present) {
    if (estGeneree(f, html)) {
      const dossier = nom.includes("/") ? nom.slice(0, nom.lastIndexOf("/") + 1) : "(racine)";
      manquantsGeneres.set(dossier, (manquantsGeneres.get(dossier) || 0) + 1);
    } else if (ECRIRE && html.includes("</head>")) {
      const bloc = '<script type="application/ld+json">' + JSON.stringify(attendu) + "</script>\n";
      fs.writeFileSync(f, html.replace("</head>", bloc + "</head>"));
      poses++;
    } else manquantsMain.push(nom);
    continue;
  }
  if (resume(present) === resume(attendu)) continue;
  /* Une déclaration FAUSSE est pire qu'une déclaration absente : elle raconte
     à Google un chemin que la page n'a pas. Sur une page écrite à la main, on
     la réaligne sur ce qui est affiché ; sur une page générée, on refuse d'y
     toucher et on renvoie au générateur. */
  if (ECRIRE && !estGeneree(f, html)) {
    const corrige = remplacerDeclaration(html, attendu);
    if (corrige !== html) { fs.writeFileSync(f, corrige); corriges++; continue; }
  }
  divergents.push(nom + "\n      écran  : " + resume(attendu) + "\n      déclaré: " + resume(present));
}

console.log("🛡️  Fil d'Ariane — ce que le visiteur lit doit être ce que Google reçoit");
console.log("   pages porteuses d'un fil : " + avecFil + " sur " + fichiers.length);
if (ECRIRE) console.log("   déclarations posées : " + poses + " · corrigées : " + corriges);
if (manquantsMain.length) {
  console.log("  ✗ " + manquantsMain.length + " page(s) ÉCRITE(S) À LA MAIN affichent un fil sans le déclarer :");
  for (const m of manquantsMain.slice(0, 40)) console.log("      " + m);
  if (manquantsMain.length > 40) console.log("      … et " + (manquantsMain.length - 40) + " autres");
}
if (manquantsGeneres.size) {
  let total = 0;
  for (const n of manquantsGeneres.values()) total += n;
  console.log("  ✗ " + total + " page(s) GÉNÉRÉE(S) affichent un fil sans le déclarer — à corriger DANS LE GÉNÉRATEUR :");
  for (const [d, n] of [...manquantsGeneres].sort((a, b) => b[1] - a[1])) console.log("      " + String(n).padStart(5) + "  " + d);
}
if (divergents.length) {
  console.log("  ✗ " + divergents.length + " page(s) déclarent AUTRE CHOSE que ce qu'elles affichent :");
  for (const d of divergents.slice(0, 10)) console.log("      " + d);
}
console.log("----------------------------------------------------------------------");
if (manquantsMain.length || manquantsGeneres.size || divergents.length) {
  console.log("💥 GARDE-FOU : fil d'Ariane incomplet ou incohérent." + (manquantsMain.length ? "  Réparer les pages à la main : node scripts/verifier_fil_ariane.mjs --ecrire" : ""));
  process.exit(1);
}
console.log("🛡️  GARDE-FOU : les " + avecFil + " fils d'Ariane affichés sont déclarés à l'identique — OK.");
process.exit(0);
