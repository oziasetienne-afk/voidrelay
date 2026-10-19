#!/usr/bin/env node
/* Garde-fou : toute page publique doit se partager avec une carte.

   Mesuré le 04/09/2026 : 19 pages outils sur 22 et 15 pages de guide anglaises
   n'avaient AUCUN og:image. Partagées sur Discord ou Twitter — le seul canal de
   diffusion réel d'un site de fans — elles apparaissaient en lien nu. Quatre
   pages (trade, courses, favoris, digest) n'avaient même pas d'og:title.

   Rien ne cassait, aucune page n'était en erreur : c'est exactement le type de
   défaut que seule une mesure attrape. D'où ce garde-fou.

   Il vérifie aussi que l'image RÉFÉRENCÉE EXISTE sur le disque : une carte qui
   pointe vers un fichier absent est pire qu'une absence de carte — le partage
   affiche un cadre vide au lieu d'un lien propre. */
import fs from "fs";
import path from "path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SITE = "https://voidrelay.fr";
let ok = 0, ko = 0;
const dit = (c, quoi, det) => { c ? ok++ : ko++; console.log(`  ${c ? "✓" : "✗"} ${quoi}${det ? " — " + det : ""}`); };

/* Pages hors périmètre, et pourquoi : elles ne sont pas destinées au partage. */
const HORS = new Set(["404.html", "offline.html", "hub-widget.example.html", "warframe.html",
                      /* Page privée d'administration : noindex, hors navigation, hors sitemap.
                         Lui demander une carte de partage n'aurait aucun sens — elle n'est pas
                         faite pour être partagée, elle est faite pour n'être vue que par le Chef. */
                      "moderation.html",
                      /* Même statut que moderation.html : tableau privé des statistiques (v91). */
                      "stats.html"]);
const estHors = f => HORS.has(path.basename(f)) || /^google[0-9a-f]+\.html$/.test(path.basename(f));

function pages() {
  const out = [];
  for (const d of ["", "en"]) {
    const abs = path.join(ROOT, d);
    for (const f of fs.readdirSync(abs)) {
      if (!f.endsWith(".html")) continue;
      const rel = d ? `${d}/${f}` : f;
      if (!estHors(rel)) out.push(rel);
    }
  }
  // Un échantillon de chaque famille générée : le gabarit est unique, une page suffit
  // à prouver qu'il porte la carte — et 3838 lectures ne prouveraient rien de plus.
  for (const p of ["guides/index.html", "guides/farmer-ducats.html", "guides/bien-modder.html",
                   "en/guides/index.html", "en/guides/farm-ducats.html", "en/guides/modding-guide.html",
                   "o/soma_prime_set.html", "en/o/soma_prime_set.html"]) {
    if (fs.existsSync(path.join(ROOT, p))) out.push(p);
  }
  return out;
}

const bal = (s, re) => { const m = s.match(re); return m ? m[1] : null; };

console.log("🖼️  cartes de partage (Open Graph + Twitter)");
const sans = { titre: [], desc: [], image: [], tw: [] };
const imagesAbsentes = [];
const liste = pages();

for (const rel of liste) {
  const s = fs.readFileSync(path.join(ROOT, rel), "utf8");
  const titre = bal(s, /<meta property="og:title" content="([^"]*)"/);
  const desc = bal(s, /<meta property="og:description" content="([^"]*)"/);
  const image = bal(s, /<meta property="og:image" content="([^"]*)"/);
  const tw = bal(s, /<meta name="twitter:card" content="([^"]*)"/);
  if (!titre) sans.titre.push(rel);
  if (!desc) sans.desc.push(rel);
  if (!image) sans.image.push(rel);
  if (!tw) sans.tw.push(rel);
  if (image) {
    if (!image.startsWith(SITE + "/")) imagesAbsentes.push(`${rel} → URL non absolue : ${image}`);
    else if (!fs.existsSync(path.join(ROOT, image.slice(SITE.length + 1)))) imagesAbsentes.push(`${rel} → fichier absent : ${image}`);
  }
}

const court = a => a.slice(0, 5).join(", ") + (a.length > 5 ? ` … (+${a.length - 5})` : "");
dit(sans.titre.length === 0, "chaque page publique a un og:title", sans.titre.length ? court(sans.titre) : `${liste.length} pages`);
dit(sans.desc.length === 0, "chaque page publique a un og:description", sans.desc.length ? court(sans.desc) : `${liste.length} pages`);
dit(sans.image.length === 0, "chaque page publique a un og:image", sans.image.length ? court(sans.image) : `${liste.length} pages`);
dit(sans.tw.length === 0, "chaque page publique a une carte Twitter", sans.tw.length ? court(sans.tw) : `${liste.length} pages`);
dit(imagesAbsentes.length === 0, "chaque og:image est une URL absolue ET un fichier qui existe",
    imagesAbsentes.length ? court(imagesAbsentes) : "aucun lien mort");

console.log("-".repeat(70));
if (ko) { console.log(`❌ ${ko} échec(s) sur ${ok + ko}`); process.exit(1); }
console.log(`🛡️  GARDE-FOU : ${liste.length} pages se partagent avec une carte complète — ${ok} vérifications OK.`);
