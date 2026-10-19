/* ============================================================================
   VoidRelay — UN OUTIL ANNONCÉ SUR /outils SE DÉCLARE COMME UN OUTIL.

   Mesuré le 05/09/2026 : `/outils` présente 17 outils et `/en/tools` 12, mais
   seules **6 pages sur 26** disaient à un moteur de recherche ce qu'elles sont
   (`WebApplication`). Les 20 autres — dont `/trade`, `/marche`, `/arsenal`,
   `/favoris`, les pages qui portent la valeur commerciale du site — se
   présentaient comme des pages quelconques. L'incohérence n'avait aucune
   raison d'être : trois pages françaises et trois anglaises le faisaient déjà,
   avec une convention nette.

   POURQUOI DÉRIVER DE LA CARTE. La carte de `/outils` porte déjà le nom de
   l'outil (son `<h2>`), sa description (son `<p>`) et son adresse (son `href`).
   Rédiger la déclaration à côté serait un doublon de plus à désynchroniser —
   la leçon de v72, v75 et v78. Elle est donc EXTRAITE de la carte : un outil
   ajouté demain porte sa déclaration avec lui.

   CE QUE LE GARDE-FOU EXIGE, ET CE QU'IL N'EXIGE PAS. Il exige qu'une page
   annoncée comme outil se déclare, et que l'URL déclarée soit la sienne — deux
   faits vérifiables. Il n'impose PAS le libellé : le nom est du contenu, il
   appartient à qui écrit la page, et six pages avaient déjà le leur.

     node scripts/verifier_outils_declares.mjs            → vérifie (0 / 1)
     node scripts/verifier_outils_declares.mjs --ecrire   → pose ce qui manque
   ========================================================================== */
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(new URL("..", import.meta.url).pathname);
const SITE = "https://voidrelay.fr";
const ECRIRE = process.argv.includes("--ecrire");

const ENTITES = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " };
const texte = (h) => String(h)
  .replace(/<[^>]*>/g, "")
  .replace(/&(#\d+|[a-z]+);/gi, (t, e) => (e in ENTITES ? ENTITES[e] : (/^#\d+$/.test(e) ? String.fromCharCode(+e.slice(1)) : t)))
  .replace(/\s+/g, " ").trim();

/* Les cartes d'un annuaire d'outils, lues sur la page elle-même. */
function cartes(fichierAnnuaire) {
  const html = fs.readFileSync(path.join(RACINE, fichierAnnuaire), "utf8");
  const out = [];
  for (const m of html.matchAll(/<a class="tool-card" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const url = m[1];
    /* Une carte qui mène à un DOSSIER (/en/o/) désigne un annuaire, pas un
       outil : il n'y a rien à déclarer comme application. */
    if (url.endsWith("/")) continue;
    const h2 = /<h2>([\s\S]*?)<\/h2>/.exec(m[2]);
    const p = /<p>([\s\S]*?)<\/p>/.exec(m[2]);
    out.push({ url, titre: h2 ? texte(h2[1]) : "", desc: p ? texte(p[1]) : "" });
  }
  return out;
}

/* Le fichier qui sert cette URL.
   L'ANCRE est retirée d'abord : « /arsenal#biblio » est servi par arsenal.html,
   et une ancre n'a jamais désigné un fichier. Sans ça le garde-fou cherchait
   « arsenal#biblio.html » et accusait une carte parfaitement valide — vu à la
   fusion, quand la carte « Bibliothèque de builds » (v84) est arrivée.
   La chaîne de requête part avec, pour la même raison. */
function fichierDe(url) {
  url = String(url).split("#")[0].split("?")[0];
  if (!url) return null;
  const direct = url.replace(/^\//, "") + ".html";
  if (fs.existsSync(path.join(RACINE, direct))) return direct;
  const index = url.replace(/^\//, "") + "/index.html";
  return fs.existsSync(path.join(RACINE, index)) ? index : null;
}

/* Convention observée sur les six pages qui déclaraient déjà, reproduite à
   l'identique : en français le nom du jeu SUIT le libellé, en anglais il le
   PRÉCÈDE et le libellé passe en casse de titre. */
const nomDeclare = (titre, en) => en
  ? "Warframe " + titre.replace(/\b([a-z])/g, (c) => c.toUpperCase())
  : titre + " Warframe";

function declaration(carte, en) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: nomDeclare(carte.titre, en),
    description: carte.desc,
    url: SITE + carte.url,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    isPartOf: { "@id": SITE + "/#site" },
  };
}

const ANNUAIRES = [["outils.html", false], ["en/tools.html", true]];
const manquants = [], mauvaiseUrl = [], introuvables = [];
let poses = 0, vus = 0;

for (const [annuaire, en] of ANNUAIRES) {
  for (const carte of cartes(annuaire)) {
    const f = fichierDe(carte.url);
    if (!f) { introuvables.push(`${annuaire} → ${carte.url}`); continue; }
    vus++;
    let html = fs.readFileSync(path.join(RACINE, f), "utf8");
    const dejala = /"@type":"WebApplication"[^}]*"url":"([^"]+)"/.exec(html.replace(/\s+/g, ""));
    if (dejala) {
      /* L'ancre est retirée ici AUSSI : deux cartes peuvent mener à la même page
         par des ancres différentes (/arsenal et /arsenal#biblio), et la page ne
         déclare qu'elle-même. Comparer avec l'ancre accuserait une déclaration
         juste. Ce qui doit correspondre, c'est la PAGE, pas l'endroit où l'on
         arrive dedans. */
      const attendue = SITE + String(carte.url).split("#")[0].split("?")[0];
      if (dejala[1] !== attendue) mauvaiseUrl.push(`${f} déclare ${dejala[1]}, la carte mène à ${attendue}`);
      continue;
    }
    if (!ECRIRE || !html.includes("</head>")) { manquants.push(`${f} (carte « ${carte.titre} » sur ${annuaire})`); continue; }
    const bloc = '<script type="application/ld+json">' + JSON.stringify(declaration(carte, en)) + "</script>\n";
    fs.writeFileSync(path.join(RACINE, f), html.replace("</head>", bloc + "</head>"));
    poses++;
  }
}

console.log("🛡️  Outils déclarés — une page annoncée comme outil doit se dire outil");
console.log("   cartes d'outils menant à une page : " + vus);
if (ECRIRE) console.log("   déclarations posées : " + poses);
for (const [nom, liste] of [["page(s) annoncée(s) comme outil sans déclaration", manquants],
                            ["déclaration(s) pointant vers une autre page", mauvaiseUrl],
                            ["carte(s) menant à une page absente du disque", introuvables]]) {
  if (!liste.length) continue;
  console.log("  ✗ " + liste.length + " " + nom + " :");
  for (const l of liste.slice(0, 25)) console.log("      " + l);
}
console.log("----------------------------------------------------------------------");
if (manquants.length || mauvaiseUrl.length || introuvables.length) {
  console.log("💥 GARDE-FOU : annuaire d'outils et pages ne disent pas la même chose." + (manquants.length ? "  Réparer : node scripts/verifier_outils_declares.mjs --ecrire" : ""));
  process.exit(1);
}
console.log("🛡️  GARDE-FOU : les " + vus + " outils annoncés se déclarent, et vers la bonne adresse — OK.");
process.exit(0);
